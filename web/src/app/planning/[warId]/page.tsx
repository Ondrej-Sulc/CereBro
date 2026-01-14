import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WarDetailsClient from "@/components/war-planning/war-details-client";
import { updateWarFight, updateWarStatus } from "../actions";
import { getFromCache } from "@/lib/cache";
import { getCachedChampions } from "@/lib/data/champions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { SeasonBanWithChampion, WarBanWithChampion } from "@cerebro/core/data/war-planning/types";
import logger from "@/lib/logger";

interface WarDetailsPageProps {
  params: Promise<{ warId: string }>;
}

export default async function WarDetailsPage({ params }: WarDetailsPageProps) {
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/planning");
  }

  const { warId } = await params;

  // 1. Fetch the War
  const war = await prisma.war.findUnique({
    where: { id: warId },
    include: { alliance: true }
  });

  if (!war) {
    return <p>War not found.</p>;
  }

  // 2. Permission Check
  const isBotAdmin = player.isBotAdmin;
  const isMember = player.allianceId === war.allianceId;

  if (!isBotAdmin && !isMember) {
    return <p>You do not have permission to view this war plan.</p>;
  }

  logger.info({ userId: player.id, allianceId: player.allianceId }, "User accessing War Planning [warId] page");

  const isOfficer = player.isOfficer || isBotAdmin;

  const champions = await getCachedChampions();

  // Fetch Season Bans
  const seasonBans = await getFromCache(`season-bans-${war.season}-${war.warTier}`, 300, async () => {
    const bans = await prisma.seasonBan.findMany({
      where: {
        season: war.season,
        OR: [
          { minTier: null, maxTier: null },
          { minTier: { lte: war.warTier }, maxTier: { gte: war.warTier } }
        ]
      },
      include: {
          champion: {
              select: { id: true, name: true, images: true }
          }
      }
    });
    return bans as unknown as SeasonBanWithChampion[];
  });

  // Fetch War Bans
  const warBans = await getFromCache(`war-bans-${warId}`, 60, async () => {
    const bans = await prisma.warBan.findMany({
      where: { warId: warId },
      include: {
          champion: {
              select: { id: true, name: true, images: true }
          }
      }
    });
    return bans as unknown as WarBanWithChampion[];
  });

  const allianceMembers = await getFromCache(`alliance-members-${war.allianceId}`, 300, async () => {
    return await prisma.player.findMany({
      where: { allianceId: war.allianceId },
      orderBy: { ingameName: 'asc' },
      include: {
        roster: {
          select: {
            championId: true,
            stars: true,
            rank: true,
            isAscended: true,
            isAwakened: true,
          }
        }
      }
    });
  });

  const bgColors = {
      1: war.alliance.battlegroup1Color || "#ef4444",
      2: war.alliance.battlegroup2Color || "#22c55e",
      3: war.alliance.battlegroup3Color || "#3b82f6",
  };

  return (
    <WarDetailsClient
      war={war}
      warId={warId}
      updateWarFight={updateWarFight}
      updateWarStatus={updateWarStatus}
      champions={champions}
      players={allianceMembers}
      seasonBans={seasonBans}
      warBans={warBans}
      isOfficer={isOfficer}
      bgColors={bgColors}
    />
  );
}