import { prisma } from "@/lib/prisma";
import DefenseDashboard from "@/components/war-planning/defense-dashboard";
import { redirect } from "next/navigation";
import FormPageBackground from "@/components/FormPageBackground";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";

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

  const plans = await prisma.warDefensePlan.findMany({
    where: { allianceId: player.allianceId },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="min-h-screen text-slate-200 font-sans selection:bg-indigo-500/30 relative">
      <FormPageBackground />
      <main className="container mx-auto py-8 px-4 relative z-10">
        <DefenseDashboard
          plans={plans}
          userTimezone={player.timezone}
          isOfficer={player.isOfficer || player.isBotAdmin}
        />
      </main>
    </div>
  );
}
