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
  // First try to find one marked as isActive: true
  let player = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId, isActive: true },
    include: { alliance: true },
  });

  // Fallback 1: Use the BotUser's activeProfileId if set
  if (!player && botUser?.activeProfileId) {
    player = await prisma.player.findUnique({
      where: { id: botUser.activeProfileId },
      include: { alliance: true },
    });
  }

  // Fallback 2: If still no profile found, try to find the most recently updated one for this Discord ID
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
      isBotAdmin: botUser.isBotAdmin,
      permissions: botUser.permissions || []
    };
  }

  return null;
}

export async function getUserProfiles() {
  const session = await auth();
  if (!session?.user?.id) return [];

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });

  if (!account?.providerAccountId) return [];

  const botUser = await prisma.botUser.findUnique({
    where: { discordId: account.providerAccountId },
    include: {
      profiles: {
        include: { alliance: true },
        orderBy: { ingameName: 'asc' }
      }
    }
  });

  let profiles = botUser?.profiles || [];

  // Resolution logic to find the active profile if it's not in the botUser's linked profiles
  let activeProfile = await prisma.player.findFirst({
    where: { discordId: account.providerAccountId, isActive: true },
    include: { alliance: true },
  });

  if (!activeProfile && botUser?.activeProfileId) {
    activeProfile = await prisma.player.findUnique({
      where: { id: botUser.activeProfileId },
      include: { alliance: true },
    });
  }

  if (!activeProfile) {
    activeProfile = await prisma.player.findFirst({
      where: { discordId: account.providerAccountId },
      orderBy: { updatedAt: 'desc' },
      include: { alliance: true },
    });
  }

  if (activeProfile) {
    const isAlreadyIncluded = profiles.some(p => p.id === activeProfile?.id);
    if (!isAlreadyIncluded) {
        profiles = [...profiles, activeProfile];
    }
  }

  return profiles;
}

export async function requireBotAdmin(requiredPermission?: string) {
  const actingUser = await getUserPlayerWithAlliance();
  if (!actingUser) throw new Error("Unauthorized");

  // getUserPlayerWithAlliance already populated isBotAdmin from BotUser table.
  if (actingUser.isBotAdmin) {
    return actingUser;
  }

  if (requiredPermission && (actingUser as any).permissions?.includes(requiredPermission)) {
    return actingUser;
  }

  throw new Error("Unauthorized");
}
