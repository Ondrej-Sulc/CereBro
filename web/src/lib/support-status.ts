import { ALLIANCE_UNLOCK_THRESHOLD_MINOR } from "@cerebro/core/services/rosterScreenshotQuotaService";
import { prisma } from "@/lib/prisma";

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

  const donations = await prisma.supportDonation.findMany({
    where: {
      ...visibleSucceededDonationWhere,
      OR: [
        { playerId: { in: playerIds } },
        botUserToPlayerId.size > 0 ? { botUserId: { in: Array.from(botUserToPlayerId.keys()) } } : null,
        discordToPlayerId.size > 0 ? { discordId: { in: Array.from(discordToPlayerId.keys()) } } : null,
      ].filter((clause): clause is NonNullable<typeof clause> => clause !== null),
    },
    select: { playerId: true, botUserId: true, discordId: true },
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
  }

  return supporterPlayerIds;
}

export async function getAllianceScreenshotUnlockStatus(allianceId: string, now = new Date()) {
  const monthStart = getCurrentMonthStart(now);

  const result = await prisma.supportDonation.aggregate({
    where: {
      ...visibleSucceededDonationWhere,
      createdAt: { gte: monthStart },
      player: { allianceId },
    },
    _sum: { amountMinor: true },
  });

  const currentMonthMinor = result._sum.amountMinor ?? 0;

  return {
    currentMonthMinor,
    thresholdMinor: ALLIANCE_UNLOCK_THRESHOLD_MINOR,
    unlocked: currentMonthMinor >= ALLIANCE_UNLOCK_THRESHOLD_MINOR,
  };
}
