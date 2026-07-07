type ActiveProfileIdResult = { id: string } | null;

export interface ActiveProfileResolverPrisma {
  botUser: {
    findUnique(args: {
      where: { discordId: string };
      select: { activeProfileId: true };
    }): Promise<{ activeProfileId: string | null } | null>;
  };
  player: {
    findFirst(args: {
      where: Record<string, unknown>;
      select: { id: true };
      orderBy?: { updatedAt: "desc" };
    }): Promise<ActiveProfileIdResult>;
  };
}

export async function resolveActivePlayerIdForDiscord(
  prisma: ActiveProfileResolverPrisma,
  discordId: string
): Promise<string | null> {
  const botUser = await prisma.botUser.findUnique({
    where: { discordId },
    select: { activeProfileId: true },
  });

  if (botUser?.activeProfileId) {
    const activeProfile = await prisma.player.findFirst({
      where: { id: botUser.activeProfileId, discordId },
      select: { id: true },
    });

    if (activeProfile) {
      return activeProfile.id;
    }
  }

  const legacyActiveProfile = await prisma.player.findFirst({
    where: { discordId, isActive: true },
    select: { id: true },
  });

  if (legacyActiveProfile) {
    return legacyActiveProfile.id;
  }

  const latestProfile = await prisma.player.findFirst({
    where: { discordId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  return latestProfile?.id ?? null;
}
