type DiscordProfile = {
  id?: string | null;
  avatar?: string | null;
  discriminator?: string | null;
  global_name?: string | null;
  username?: string | null;
  name?: string | null;
  image_url?: string | null;
};

type BotUserRecord = {
  id: string;
  activeProfileId: string | null;
};

type PlayerRecord = {
  id: string;
  botUserId: string | null;
  isActive: boolean;
};

type PrismaForDiscordProfileSync = {
  account: {
    findUnique(args: {
      where: { provider_providerAccountId: { provider: string; providerAccountId: string } };
      select: { userId: true };
    }): Promise<{ userId: string } | null>;
  };
  botUser: {
    upsert(args: {
      where: { discordId: string };
      update: { avatar: string | null };
      create: { discordId: string; avatar: string | null };
    }): Promise<BotUserRecord>;
    update(args: { where: { id: string }; data: { activeProfileId: string } }): Promise<unknown>;
  };
  player: {
    updateMany(args: {
      where: { discordId?: string; useDiscordAvatar?: boolean; id?: { in: string[] } };
      data: { avatar?: string | null; botUserId?: string };
    }): Promise<unknown>;
    findMany(args: { where: { discordId: string }; orderBy: { createdAt: "asc" } }): Promise<PlayerRecord[]>;
    create(args: {
      data: {
        discordId: string;
        ingameName: string;
        avatar: string | null;
        useDiscordAvatar: true;
        isActive: true;
        botUserId: string;
      };
    }): Promise<{ id: string }>;
  };
  user: {
    update(args: { where: { id: string }; data: { image: string | null } }): Promise<unknown>;
  };
};

export function getDiscordAvatarUrl(profile: DiscordProfile | undefined, fallback: string | null): string | null {
  if (!profile) {
    return fallback;
  }

  if (profile.id && profile.avatar === null) {
    const discriminator = profile.discriminator ?? "0";
    const defaultAvatarNumber =
      discriminator === "0"
        ? Number(BigInt(profile.id) >> BigInt(22)) % 6
        : Number.parseInt(discriminator, 10) % 5;

    return `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
  }

  if (profile.id && profile.avatar) {
    const format = profile.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}?size=256`;
  }

  return profile.image_url ?? fallback;
}

export function getDiscordDisplayName(profile: DiscordProfile | undefined, fallback: string | null | undefined): string {
  return profile?.global_name || profile?.username || profile?.name || fallback || "New Player";
}

export async function syncDiscordProfileOnSignIn({
  prisma,
  discordId,
  profile,
  authUserImage,
  authUserName,
}: {
  prisma: PrismaForDiscordProfileSync;
  discordId: string;
  profile: DiscordProfile | undefined;
  authUserImage: string | null | undefined;
  authUserName: string | null | undefined;
}): Promise<void> {
  const avatar = getDiscordAvatarUrl(profile, authUserImage ?? null);

  const botUser = await prisma.botUser.upsert({
    where: { discordId },
    update: { avatar },
    create: { discordId, avatar },
  });

  const linkedAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "discord",
        providerAccountId: discordId,
      },
    },
    select: { userId: true },
  });

  if (linkedAccount) {
    await prisma.user.update({
      where: { id: linkedAccount.userId },
      data: { image: avatar },
    });
  }

  await prisma.player.updateMany({
    where: {
      discordId,
      useDiscordAvatar: true,
    },
    data: { avatar },
  });

  const existingPlayers = await prisma.player.findMany({
    where: { discordId },
    orderBy: { createdAt: "asc" },
  });

  if (existingPlayers.length === 0) {
    const newPlayer = await prisma.player.create({
      data: {
        discordId,
        ingameName: getDiscordDisplayName(profile, authUserName),
        avatar,
        useDiscordAvatar: true,
        isActive: true,
        botUserId: botUser.id,
      },
    });

    if (!botUser.activeProfileId) {
      await prisma.botUser.update({
        where: { id: botUser.id },
        data: { activeProfileId: newPlayer.id },
      });
    }

    return;
  }

  const unlinkedPlayers = existingPlayers.filter((player) => !player.botUserId);
  if (unlinkedPlayers.length === 0) {
    return;
  }

  await prisma.player.updateMany({
    where: { id: { in: unlinkedPlayers.map((player) => player.id) } },
    data: { botUserId: botUser.id },
  });

  if (!botUser.activeProfileId) {
    const activeLegacy = unlinkedPlayers.find((player) => player.isActive) || unlinkedPlayers[0];
    await prisma.botUser.update({
      where: { id: botUser.id },
      data: { activeProfileId: activeLegacy.id },
    });
  }
}
