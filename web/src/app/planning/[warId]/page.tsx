import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WarDetailsClient from "@/components/war-planning/war-details-client";
import { updateWarFight, updateWarStatus } from "../actions";
import { getFromCache } from "@/lib/cache";
import { getCachedChampions } from "@/lib/data/champions";

interface WarDetailsPageProps {
  params: Promise<{ warId: string }>;
}

export default async function WarDetailsPage({ params }: WarDetailsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const { warId } = await params;

  const account = await prisma.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "discord",
    },
  });

  if (!account?.providerAccountId) {
    return <p>Error: No linked Discord account found.</p>;
  }

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
    include: { alliance: true },
  });

  if (!player || !player.allianceId) {
    return <p>You must be in an Alliance to access War Planning.</p>;
  }

  const war = await prisma.war.findUnique({
    where: { id: warId, allianceId: player.allianceId },
  });

  if (!war) {
    return <p>War not found or you do not have permission to view it.</p>;
  }

  const isOfficer = player.isOfficer || player.isBotAdmin;

  const champions = await getCachedChampions();

  // Fetch Season Bans
  const seasonBans = await getFromCache(`season-bans-${war.season}-${war.warTier}`, 300, async () => {
    return await prisma.seasonBan.findMany({
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
  });

  // Fetch War Bans
  const warBans = await getFromCache(`war-bans-${warId}`, 60, async () => {
    return await prisma.warBan.findMany({
      where: { warId: warId },
      include: {
          champion: {
              select: { id: true, name: true, images: true }
          }
      }
    });
  });

  const allianceMembers = await getFromCache(`alliance-members-${player.allianceId}`, 300, async () => {
    return await prisma.player.findMany({
      where: { allianceId: player.allianceId },
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
    />
  );
}
