import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DefenseDetailsClient from "@/components/war-planning/defense-details-client";
import { updateDefensePlacement } from "../../defense-actions";
import { getFromCache } from "@/lib/cache";
import { getCachedChampions } from "@/lib/data/champions";
import FormPageBackground from "@/components/FormPageBackground";

interface DefenseDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function DefenseDetailsPage({ params }: DefenseDetailsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

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
    return <p>You must be an Alliance Officer to access War Defense Planning.</p>;
  }

  const plan = await prisma.warDefensePlan.findFirst({
    where: { id: id, allianceId: player.allianceId },
    include: {
        highlightTag: true
    }
  });

  if (!plan) {
    return <p>Plan not found or you do not have permission to view it.</p>;
  }

  const champions = await getCachedChampions();

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

  const tags = await prisma.tag.findMany({
      where: {
          OR: [
              { category: "Defense" },
              { category: "Alliance Wars" }, // Assuming this category exists for generic AW tags
          ]
      },
      orderBy: { name: 'asc' }
  });

  return (
    <>
      <FormPageBackground />
      <DefenseDetailsClient
        plan={plan}
        planId={id}
        updatePlacement={updateDefensePlacement}
        champions={champions}
        players={allianceMembers}
        availableTags={tags}
      />
    </>
  );
}
