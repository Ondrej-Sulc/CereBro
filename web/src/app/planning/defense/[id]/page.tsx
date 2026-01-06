import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DefenseDetailsClient from "@/components/war-planning/defense-details-client";
import { updateDefensePlacement } from "../../defense-actions";
import { getFromCache } from "@/lib/cache";
import { getCachedChampions } from "@/lib/data/champions";
import FormPageBackground from "@/components/FormPageBackground";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

interface DefenseDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function DefenseDetailsPage({ params }: DefenseDetailsPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

  const { id } = await params;

  const player = await getUserPlayerWithAlliance();

  if (!player) {
    return <p>Player profile not found.</p>;
  }

  const isBotAdmin = player.isBotAdmin;

  if (!player.allianceId && !isBotAdmin) {
    return <p>You must be in an Alliance to access War Defense Planning.</p>;
  }

  // Allow admins to view any plan, otherwise restrict to player's alliance
  const whereClause: any = { id: id };
  if (!isBotAdmin) {
      whereClause.allianceId = player.allianceId;
  }

  const plan = await prisma.warDefensePlan.findFirst({
    where: whereClause,
    include: {
        highlightTag: true
    }
  });

  if (!plan) {
    return <p>Plan not found or you do not have permission to view it.</p>;
  }

  const isOfficer = player.isOfficer || isBotAdmin;

  const champions = await getCachedChampions();

  // Fetch members of the PLAN's alliance, not necessarily the viewer's alliance
  const allianceMembers = await getFromCache(`alliance-members-${plan.allianceId}`, 3600, async () => {
    return await prisma.player.findMany({
      where: { allianceId: plan.allianceId },
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
        isOfficer={isOfficer}
      />
    </>
  );
}
