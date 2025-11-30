import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WarDetailsClient from "@/components/war-planning/war-details-client";
import { updateWarFight, updateWarStatus } from "../actions";

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

  if (!player || !player.allianceId || (!player.isOfficer && !player.isBotAdmin)) {
    return <p>You must be an Alliance Officer to access War Planning.</p>;
  }

  const war = await prisma.war.findUnique({
    where: { id: warId, allianceId: player.allianceId },
  });

  if (!war) {
    return <p>War not found or you do not have permission to view it.</p>;
  }

  const champions = await prisma.champion.findMany({
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      images: true,
      class: true,
      shortName: true,
      releaseDate: true,
      obtainable: true,
      prestige: true,
      discordEmoji: true,
      fullAbilities: true,
      createdAt: true,
      updatedAt: true,
      abilities: {
        select: {
          ability: {
            select: { name: true }
          }
        }
      }
    }
  });

  const allianceMembers = await prisma.player.findMany({
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

  return (
    <WarDetailsClient
      war={war}
      warId={warId}
      updateWarFight={updateWarFight}
      updateWarStatus={updateWarStatus}
      champions={champions}
      players={allianceMembers}
    />
  );
}
