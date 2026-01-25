import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminTacticManagerClient from "@/components/admin/admin-tactic-manager-client";

export default async function AdminTacticsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    await signIn("discord", { redirectTo: "/admin/tactics" });
    return null;
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

  const botUser = await prisma.botUser.findUnique({
    where: { discordId: account.providerAccountId },
  });

  if (!botUser?.isBotAdmin) {
    return <p>You must be a Bot Admin to access this page.</p>;
  }

  const tactics = await prisma.warTactic.findMany({
    orderBy: [{ season: 'desc' }, { minTier: 'asc' }],
    include: {
        attackTag: true,
        defenseTag: true
    }
  });

  return (
    <AdminTacticManagerClient initialTactics={tactics} />
  );
}
