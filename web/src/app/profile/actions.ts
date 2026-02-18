'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import logger from "@/lib/logger";

async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "discord" },
  });

  if (!account?.providerAccountId) return null;

  return prisma.botUser.findUnique({
    where: { discordId: account.providerAccountId },
    include: {
      profiles: true
    }
  });
}

const createProfileSchema = z.object({
  name: z.string().min(1).max(32),
});

export async function createProfile(name: string) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Unauthorized");

  const data = createProfileSchema.parse({ name });

  // Check for duplicates
  const existing = user.profiles.find(p => p.ingameName.toLowerCase() === data.name.toLowerCase());
  if (existing) {
    logger.warn({ userId: user.id, profileName: data.name }, "Attempted to create duplicate profile name");
    return { error: `You already have a profile named "${data.name}"` };
  }

  logger.info({ userId: user.id, profileName: data.name }, "Creating new profile");
  const newProfile = await prisma.player.create({
    data: {
      discordId: user.discordId,
      ingameName: data.name,
      isActive: false,
      botUserId: user.id,
    }
  });

  // If it's the first profile, make it active (though auth logic should handle this usually)
  if (!user.activeProfileId) {
    await prisma.botUser.update({
      where: { id: user.id },
      data: { activeProfileId: newProfile.id }
    });
    // Also update legacy isActive flag
    await prisma.player.update({
        where: { id: newProfile.id },
        data: { isActive: true }
    });
  }

  revalidatePath("/profile");
  return { success: true, profile: newProfile };
}

export async function renameProfile(profileId: string, newName: string) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Unauthorized");

  const data = createProfileSchema.parse({ name: newName });

  // Verify ownership
  const profile = user.profiles.find(p => p.id === profileId);
  if (!profile) {
    logger.warn({ userId: user.id, profileId }, "Profile not found for rename");
    return { error: "Profile not found" };
  }

  // Check for duplicates (excluding self)
  const existing = user.profiles.find(p => p.ingameName.toLowerCase() === data.name.toLowerCase() && p.id !== profileId);
  if (existing) {
    logger.warn({ userId: user.id, profileName: data.name }, "Attempted to rename to duplicate profile name");
    return { error: `You already have a profile named "${data.name}"` };
  }

  logger.info({ userId: user.id, profileId, oldName: profile.ingameName, newName: data.name }, "Renaming profile");
  await prisma.player.update({
    where: { id: profileId },
    data: { ingameName: data.name }
  });

  revalidatePath("/profile");
  return { success: true };
}

export async function deleteProfile(profileId: string) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Unauthorized");

  // Verify ownership
  const profile = user.profiles.find(p => p.id === profileId);
  if (!profile) {
    logger.warn({ userId: user.id, profileId }, "Profile not found for delete");
    return { error: "Profile not found" };
  }

  // Don't allow deleting the last profile
  if (user.profiles.length <= 1) {
    logger.warn({ userId: user.id, profileId }, "Attempted to delete the only profile");
    return { error: "You cannot delete your only profile." };
  }

  logger.info({ userId: user.id, profileId, profileName: profile.ingameName }, "Deleting profile");
  await prisma.player.delete({
    where: { id: profileId }
  });

  // If we deleted the active profile, switch to another one
  if (user.activeProfileId === profileId) {
    const remaining = user.profiles.filter(p => p.id !== profileId);
    const nextActive = remaining[0];
    
    await prisma.botUser.update({
      where: { id: user.id },
      data: { activeProfileId: nextActive.id }
    });

    // Update legacy isActive flags
    await prisma.player.updateMany({
        where: { botUserId: user.id },
        data: { isActive: false }
    });
    await prisma.player.update({
        where: { id: nextActive.id },
        data: { isActive: true }
    });
  }

  revalidatePath("/profile");
  return { success: true };
}

export async function switchProfile(profileId: string) {
  const user = await getAuthenticatedUser();
  if (!user) throw new Error("Unauthorized");

  // Verify ownership
  const profile = user.profiles.find(p => p.id === profileId);
  if (!profile) {
    logger.warn({ userId: user.id, profileId }, "Profile not found for switch");
    return { error: "Profile not found" };
  }

  logger.info({ userId: user.id, profileId, profileName: profile.ingameName }, "Switching profile");
  await prisma.botUser.update({
    where: { id: user.id },
    data: { activeProfileId: profileId }
  });

  // Update legacy isActive flags for backward compatibility
  await prisma.player.updateMany({
    where: { botUserId: user.id },
    data: { isActive: false }
  });
  await prisma.player.update({
    where: { id: profileId },
    data: { isActive: true }
  });

  revalidatePath("/profile");
  return { success: true };
}
