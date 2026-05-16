import {
  ALLIANCE_UNLOCK_THRESHOLD_MINOR,
  ACTIVE_SUPPORT_SUBSCRIPTION_STATUSES,
} from "@cerebro/core/services/rosterScreenshotQuotaService";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

function getCurrentMonthStart(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

const visibleSucceededDonationWhere = {
  status: "succeeded",
  anonymizedAt: null,
  deletedAt: null,
  consentRevoked: false,
} as const;

export async function isPlayerSupporter(player: {
  id: string;
  botUserId?: string | null;
  discordId?: string | null;
}) {
  const donation = await prisma.supportDonation.findFirst({
    where: {
      ...visibleSucceededDonationWhere,
      OR: [
        { playerId: player.id },
        player.botUserId ? { botUserId: player.botUserId } : null,
        player.discordId ? { discordId: player.discordId } : null,
      ].filter((clause): clause is NonNullable<typeof clause> => clause !== null),
    },
    select: { id: true },
  });

  return !!donation;
}

export type SupportStatusPlayerIdentity = {
  id: string;
  ingameName?: string | null;
  botUserId?: string | null;
  discordId?: string | null;
};

export async function listSupporterPlayerIds(players: SupportStatusPlayerIdentity[]) {
  if (players.length === 0) return new Set<string>();

  const playerIds = players.map((player) => player.id);
  const botUserToPlayerId = new Map(
    players
      .filter((player) => !!player.botUserId)
      .map((player) => [player.botUserId as string, player.id]),
  );
  const discordToPlayerId = new Map(
    players
      .filter((player) => !!player.discordId)
      .map((player) => [player.discordId as string, player.id]),
  );
  const nameToPlayerId = new Map(
    players
      .map((player) => {
        const normalizedName = player.ingameName?.trim().toLowerCase();
        return normalizedName ? [normalizedName, player.id] as const : null;
      })
      .filter((entry): entry is readonly [string, string] => entry !== null),
  );

  const orConditions: Prisma.SupportDonationWhereInput[] = [
    { playerId: { in: playerIds } },
  ];

  if (botUserToPlayerId.size > 0) {
    orConditions.push({ botUserId: { in: Array.from(botUserToPlayerId.keys()) } });
  }
  if (discordToPlayerId.size > 0) {
    orConditions.push({ discordId: { in: Array.from(discordToPlayerId.keys()) } });
  }
  if (nameToPlayerId.size > 0) {
    orConditions.push({
      supporterName: { in: Array.from(nameToPlayerId.keys()), mode: Prisma.QueryMode.insensitive },
    });
  }

  const donations = await prisma.supportDonation.findMany({
    where: {
      ...visibleSucceededDonationWhere,
      OR: orConditions,
    },
    select: {
      playerId: true,
      botUserId: true,
      discordId: true,
      supporterName: true,
    },
  });

  const supporterPlayerIds = new Set<string>();
  for (const donation of donations) {
    if (donation.playerId) supporterPlayerIds.add(donation.playerId);
    if (donation.botUserId) {
      const playerId = botUserToPlayerId.get(donation.botUserId);
      if (playerId) supporterPlayerIds.add(playerId);
    }
    if (donation.discordId) {
      const playerId = discordToPlayerId.get(donation.discordId);
      if (playerId) supporterPlayerIds.add(playerId);
    }
    if (donation.supporterName) {
      const playerId = nameToPlayerId.get(donation.supporterName.trim().toLowerCase());
      if (playerId) supporterPlayerIds.add(playerId);
    }
  }

  return supporterPlayerIds;
}

export async function getAllianceScreenshotUnlockStatus(allianceId: string, now = new Date()) {
  const monthStart = getCurrentMonthStart(now);

  const donations = await prisma.supportDonation.findMany({
    where: {
      ...visibleSucceededDonationWhere,
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

  return {
    currentMonthMinor,
    thresholdMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR,
    unlocked: currentMonthMinor >= ALLIANCE_UNLOCK_THRESHOLD_MINOR,
  };
}
