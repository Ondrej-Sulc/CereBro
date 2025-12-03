import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WarPlanningDashboard from "@/components/war-planning/war-planning-dashboard";

export default async function WarPlanningPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/api/auth/signin");
  }

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

  // Fetch past wars for the alliance
  const wars = await prisma.war.findMany({
    where: {
      allianceId: player.allianceId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Pre-fill logic (example: based on last war)
  const lastWar = wars.length > 0 ? wars[0] : null;
  const defaultSeason = lastWar ? lastWar.season : 1;
  const defaultWarNumber = lastWar && lastWar.warNumber !== null ? lastWar.warNumber + 1 : 1;
  const defaultTier = lastWar ? lastWar.warTier : 1;

  return (
    <div className="container mx-auto py-8 min-h-screen">
      <WarPlanningDashboard 
        wars={wars}
        defaultSeason={defaultSeason}
        defaultWarNumber={defaultWarNumber}
        defaultTier={defaultTier}
        userTimezone={player.timezone}
        isBotAdmin={player.isBotAdmin}
      />
    </div>
  );
}