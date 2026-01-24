'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
    throw new Error(`You already have a profile named "${data.name}"`);
  }

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
  if (!profile) throw new Error("Profile not found");

  // Check for duplicates (excluding self)
  const existing = user.profiles.find(p => p.ingameName.toLowerCase() === data.name.toLowerCase() && p.id !== profileId);
  if (existing) {
    throw new Error(`You already have a profile named "${data.name}"`);
  }

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
  if (!profile) throw new Error("Profile not found");

  // Don't allow deleting the last profile
  if (user.profiles.length <= 1) {
    throw new Error("You cannot delete your only profile.");
  }

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
  if (!profile) throw new Error("Profile not found");

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
