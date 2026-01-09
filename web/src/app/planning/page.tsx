import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import WarPlanningDashboard from "@/components/war-planning/war-planning-dashboard";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

export default async function WarPlanningPage() {
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/planning");
  }

  if (!player.isBotAdmin && !player.allianceId) {
    return (
        <div className="container mx-auto py-20 text-center space-y-4">
            <h1 className="text-2xl font-bold text-white">Access Denied</h1>
            <p className="text-slate-400">You must be in an Alliance to access War Planning.</p>
        </div>
    );
  }

  // Fetch past wars for the alliance
  const wars = player.allianceId ? await prisma.war.findMany({
    where: {
      allianceId: player.allianceId,
    },
    orderBy: {
      createdAt: "desc",
    },
  }) : [];

  // Pre-fill logic (example: based on last war)
  const lastWar = wars.length > 0 ? wars[0] : null;
  const defaultSeason = lastWar ? lastWar.season : 1;
  const defaultWarNumber = lastWar && lastWar.warNumber !== null ? lastWar.warNumber + 1 : 1;
  const defaultTier = lastWar ? lastWar.warTier : 1;

  const isOfficer = player.isOfficer || player.isBotAdmin;

  return (
    <div className="container mx-auto py-8 min-h-screen">
      <WarPlanningDashboard 
        wars={wars}
        defaultSeason={defaultSeason}
        defaultWarNumber={defaultWarNumber}
        defaultTier={defaultTier}
        userTimezone={player.timezone}
        isBotAdmin={player.isBotAdmin}
        isOfficer={isOfficer}
      />
    </div>
  );
}