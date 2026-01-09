import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminBansManagerClient from "@/components/admin/admin-bans-manager-client";
import { getCachedChampions } from "@/lib/data/champions";

export default async function AdminBansPage() {
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

  const botUser = await prisma.botUser.findUnique({
    where: { discordId: account.providerAccountId },
  });

  if (!botUser?.isBotAdmin) {
    return <p>You must be a Bot Admin to access this page.</p>;
  }

  const bans = await prisma.seasonBan.findMany({
    orderBy: [{ season: 'desc' }, { minTier: 'asc' }],
    include: {
        champion: {
            select: {
                id: true,
                name: true,
                images: true
            }
        }
    }
  });

  const champions = await getCachedChampions();

  return (
    <AdminBansManagerClient initialBans={bans} champions={champions} />
  );
}
