import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AdminBansManagerClient from "@/components/admin/admin-bans-manager-client";

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

  const player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId },
  });

  if (!player?.isBotAdmin) {
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

  const champions = await prisma.champion.findMany({
    select: {
        id: true,
        name: true,
        images: true,
        // Include other fields required by Champion type or cast it
        shortName: true,
        class: true,
        releaseDate: true,
        obtainable: true,
        prestige: true,
        discordEmoji: true,
        fullAbilities: true,
        createdAt: true,
        updatedAt: true
    },
    orderBy: { name: 'asc' }
  });

  return (
    <AdminBansManagerClient initialBans={bans} champions={champions} />
  );
}
