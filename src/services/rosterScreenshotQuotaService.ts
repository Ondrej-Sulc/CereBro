import type { PrismaClient } from "@prisma/client";

export const FREE_SCREENSHOT_MONTHLY_LIMIT = 5;
export const ALLIANCE_UNLOCK_THRESHOLD_MINOR = 2500;
export const PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR = 1000;
export const ROSTER_SCREENSHOT_SUPPORT_URL = "/support";
export const ACTIVE_SUPPORT_SUBSCRIPTION_STATUSES = ["active", "trialing", "past_due"] as const;

export const FREE_LIMIT_EXCEEDED_REASON = "free_limit_exceeded" as const;

export interface RosterScreenshotQuotaActor {
  playerId?: string | null;
  botUserId?: string | null;
  discordId?: string | null;
  allianceId?: string | null;
}

export interface RosterScreenshotQuotaResult {
  allowed: boolean;
  limit: number;
  used: number;
  remaining: number;
  requested: number;
  resetAt: string;
  supportUrl: string;
  reason?: typeof FREE_LIMIT_EXCEEDED_REASON;
  unlimitedReason?: "personal_supporter" | "personal_lifetime_supporter" | "alliance_unlocked";
  personalLifetimeMinor: number;
  allianceCurrentMonthMinor: number;
}

export function getCurrentServerLocalMonthBounds(now = new Date()): { start: Date; end: Date } {
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function actorWhere(actor: RosterScreenshotQuotaActor) {
  const ors = [
    actor.playerId ? { actorPlayerId: actor.playerId } : null,
    actor.botUserId ? { actorBotUserId: actor.botUserId } : null,
    actor.discordId ? { discordUserId: actor.discordId } : null,
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);

  return ors.length > 0 ? { OR: ors } : null;
}

function supportActorWhere(actor: RosterScreenshotQuotaActor) {
  const ors = [
    actor.playerId ? { playerId: actor.playerId } : null,
    actor.botUserId ? { botUserId: actor.botUserId } : null,
    actor.discordId ? { discordId: actor.discordId } : null,
  ].filter((clause): clause is NonNullable<typeof clause> => clause !== null);

  return ors.length > 0 ? { OR: ors } : null;
}

export async function getAllianceCurrentMonthSupportMinor(
  prisma: PrismaClient,
  allianceId: string,
  monthStart: Date,
): Promise<number> {
  const donations = await prisma.supportDonation.findMany({
    where: {
      status: "succeeded",
      player: { allianceId },
      OR: [
        { createdAt: { gte: monthStart } },
        {
          stripeSubscriptionId: { not: null },
          stripeSubscriptionStatus: { in: [...ACTIVE_SUPPORT_SUBSCRIPTION_STATUSES] },
        },
      ],
    },
    select: {
      amountMinor: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });

  let currentMonthMinor = 0;
  const latestSubscriptions = new Map<string, { amountMinor: number; createdAt: Date }>();

  for (const donation of donations) {
    if (!donation.stripeSubscriptionId) {
      if (donation.createdAt >= monthStart) {
        currentMonthMinor += donation.amountMinor;
      }
      continue;
    }

    const existing = latestSubscriptions.get(donation.stripeSubscriptionId);
    if (!existing || donation.createdAt > existing.createdAt) {
      latestSubscriptions.set(donation.stripeSubscriptionId, {
        amountMinor: donation.amountMinor,
        createdAt: donation.createdAt,
      });
    }
  }

  for (const donation of latestSubscriptions.values()) {
    currentMonthMinor += donation.amountMinor;
  }

  return currentMonthMinor;
}

export async function getRosterScreenshotQuota(
  actor: RosterScreenshotQuotaActor,
  requested: number,
  options: { now?: Date; prisma?: PrismaClient } = {}
): Promise<RosterScreenshotQuotaResult> {
  const prisma = options.prisma ?? (await import("./prismaService.js")).prisma;
  const { start, end } = getCurrentServerLocalMonthBounds(options.now);
  const actorFilter = actorWhere(actor);
  const supportActorFilter = supportActorWhere(actor);

  const [usage, currentMonthPersonalDonation, lifetimePersonalDonations, allianceCurrentMonthMinor] = await Promise.all([
    actorFilter
      ? prisma.rosterUploadEvent.aggregate({
          where: {
            createdAt: { gte: start, lt: end },
            ...actorFilter,
          },
          _sum: { fileCount: true },
        })
      : Promise.resolve({ _sum: { fileCount: 0 } }),
    supportActorFilter
      ? prisma.supportDonation.findFirst({
          where: {
            status: "succeeded",
            createdAt: { gte: start, lt: end },
            ...supportActorFilter,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    supportActorFilter
      ? prisma.supportDonation.aggregate({
          where: {
            status: "succeeded",
            ...supportActorFilter,
          },
          _sum: { amountMinor: true },
        })
      : Promise.resolve({ _sum: { amountMinor: 0 } }),
    actor.allianceId
      ? getAllianceCurrentMonthSupportMinor(prisma, actor.allianceId, start)
      : Promise.resolve(0),
  ]);

  const used = usage._sum.fileCount ?? 0;
  const personalLifetimeMinor = lifetimePersonalDonations._sum.amountMinor ?? 0;
  const unlimitedReason = currentMonthPersonalDonation
    ? "personal_supporter"
    : personalLifetimeMinor >= PERSONAL_LIFETIME_UNLOCK_THRESHOLD_MINOR
      ? "personal_lifetime_supporter"
    : allianceCurrentMonthMinor >= ALLIANCE_UNLOCK_THRESHOLD_MINOR
      ? "alliance_unlocked"
      : undefined;
  const remaining = Math.max(FREE_SCREENSHOT_MONTHLY_LIMIT - used, 0);
  const allowed = !!unlimitedReason || used + requested <= FREE_SCREENSHOT_MONTHLY_LIMIT;

  return {
    allowed,
    limit: FREE_SCREENSHOT_MONTHLY_LIMIT,
    used,
    remaining,
    requested,
    resetAt: end.toISOString(),
    supportUrl: ROSTER_SCREENSHOT_SUPPORT_URL,
    reason: allowed ? undefined : FREE_LIMIT_EXCEEDED_REASON,
    unlimitedReason,
    personalLifetimeMinor,
    allianceCurrentMonthMinor,
  };
}

export function formatDiscordQuotaExceededMessage(quota: RosterScreenshotQuotaResult): string {
  return `You have used ${quota.used}/${quota.limit} screenshots this month. This batch has ${quota.requested} screenshots. Donate any amount this month, or €10 total lifetime, to unlock your uploads; €25 total from your alliance unlocks uploads for everyone in it.`;
}
