import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Player, Alliance, Prisma } from "@prisma/client";
import { Permission } from "./permissions";
import { cache } from "react";

export type UserPlayerWithAlliance = Player & {
  alliance: Alliance | null;
  isBotAdmin: boolean;
  permissions: string[];
};

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

export const getUserPlayerWithAlliance = cache(async (): Promise<UserPlayerWithAlliance | null> => {
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
      where: { 
          id: botUser.activeProfileId,
          discordId: account.providerAccountId 
      },
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

  if (player) {
    // Override the local isBotAdmin with the global BotUser permission if available
    return {
      ...player,
      isBotAdmin: botUser?.isBotAdmin ?? false,
      permissions: botUser?.permissions ?? []
    };
  }

  return null;
});

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

export async function requireBotAdmin(requiredPermission?: Permission) {
  const actingUser = await getUserPlayerWithAlliance();
  if (!actingUser) throw new Error("Unauthorized");

  // getUserPlayerWithAlliance already populated isBotAdmin from BotUser table.
  if (actingUser.isBotAdmin) {
    return actingUser;
  }

  if (requiredPermission && actingUser.permissions?.includes(requiredPermission)) {
    return actingUser;
  }

  if (!requiredPermission && actingUser.permissions && actingUser.permissions.length > 0) {
    return actingUser;
  }

  throw new Error("Unauthorized");
}

export async function hasCurrentUserSupportedCereBro(): Promise<boolean> {
  const player = await getUserPlayerWithAlliance();
  if (!player) {
    return false;
  }

  const orConditions: Prisma.SupportDonationWhereInput[] = [
    { playerId: player.id },
    { discordId: player.discordId },
  ];

  if (player.botUserId) {
    orConditions.push({ botUserId: player.botUserId });
  }

  const donation = await prisma.supportDonation.findFirst({
    where: {
      OR: orConditions,
      status: "succeeded",
      anonymizedAt: null,
      deletedAt: null,
      consentRevoked: false,
    },
    select: { id: true },
  });

  return !!donation;
}
