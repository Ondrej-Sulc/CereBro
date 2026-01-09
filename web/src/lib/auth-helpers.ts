import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function isUserBotAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });

  if (!account?.providerAccountId) return false;

  const botUser = await prisma.botUser.findUnique({
    where: { discordId: account.providerAccountId }
  });

  return !!botUser?.isBotAdmin;
}

export async function getUserPlayerWithAlliance() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });

  if (!account?.providerAccountId) return null;

  // 1. Fetch the BotUser to get global permissions
  const botUser = await prisma.botUser.findUnique({
    where: { discordId: account.providerAccountId }
  });

  // 2. Fetch the Player (Profile)
  let player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId, isActive: true },
    include: { alliance: true },
  });

  // Fallback: If no active profile found, try to find the most recently updated one
  if (!player) {
    player = await prisma.player.findFirst({
      where: { discordId: account.providerAccountId },
      orderBy: { updatedAt: 'desc' },
      include: { alliance: true },
    });
  }

  if (player && botUser) {
    // Override the local isBotAdmin with the global BotUser permission
    return {
        ...player,
        isBotAdmin: botUser.isBotAdmin
    };
  } else if (player) {
      // Fallback if no BotUser exists yet (should be covered by migration)
      return player;
  }

  return null;
}

export async function requireBotAdmin() {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const account = await prisma.account.findFirst({
        where: { userId: session.user.id, provider: "discord" },
    });
    if (!account?.providerAccountId) throw new Error("No discord account linked");
    
    const botUser = await prisma.botUser.findUnique({
        where: { discordId: account.providerAccountId }
    });

    if (!botUser?.isBotAdmin) throw new Error("Must be bot admin");

    return { session, account, botUser };
}
