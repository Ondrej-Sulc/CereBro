import { prisma } from "@/lib/prisma";
import DefenseDashboard from "@/components/war-planning/defense-dashboard";
import { redirect } from "next/navigation";
import FormPageBackground from "@/components/FormPageBackground";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import logger from "@/lib/logger";

export const dynamic = "force-dynamic";

export default async function DefensePlanningPage() {
  const player = await getUserPlayerWithAlliance();

  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/planning/defense");
  }

  if (!player.allianceId) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        You must be in an alliance to use the War Planner.
      </div>
    );
  }

  logger.info({ userId: player.id, allianceId: player.allianceId }, "User accessing Defense Planning page");

  const plans = await prisma.warDefensePlan.findMany({
    where: { allianceId: player.allianceId },
    orderBy: { updatedAt: "desc" },
  });

  const bgColors = {
      1: player.alliance?.battlegroup1Color || "#ef4444",
      2: player.alliance?.battlegroup2Color || "#22c55e",
      3: player.alliance?.battlegroup3Color || "#3b82f6",
  };

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-indigo-500/30 relative">
      <FormPageBackground />
      <main className="container mx-auto py-8 px-4 relative z-10">
        <DefenseDashboard
          plans={plans}
          userTimezone={player.timezone}
          isOfficer={player.isOfficer || player.isBotAdmin}
          bgColors={bgColors}
        />
      </main>
    </div>
  );
}
