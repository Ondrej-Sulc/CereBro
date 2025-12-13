import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import DefenseDashboard from "@/components/war-planning/defense-dashboard";
import { redirect } from "next/navigation";
import FormPageBackground from "@/components/FormPageBackground";

export const dynamic = 'force-dynamic';

export default async function DefensePlanningPage() {
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
    return <div>No linked Discord account found.</div>;
  }

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
    include: { alliance: true },
  });

  if (!player || !player.allianceId) {
    return (
      <div className="flex h-screen items-center justify-center text-slate-400">
        You must be in an alliance to use the War Planner.
      </div>
    );
  }

  const plans = await prisma.warDefensePlan.findMany({
    where: { allianceId: player.allianceId },
    orderBy: { updatedAt: 'desc' },
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
