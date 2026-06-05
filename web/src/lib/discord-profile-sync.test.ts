import { describe, expect, it, vi } from "vitest";
import { getDiscordAvatarUrl, syncDiscordProfileOnSignIn } from "./discord-profile-sync";

function createPrismaMock({
  linkedUserId = "auth_user_1",
  existingPlayers = [{ id: "player_1", botUserId: "bot_user_1", isActive: true }],
} = {}) {
  return {
    account: {
      findUnique: vi.fn().mockResolvedValue(linkedUserId ? { userId: linkedUserId } : null),
    },
    botUser: {
      upsert: vi.fn().mockResolvedValue({ id: "bot_user_1", activeProfileId: "player_1" }),
      update: vi.fn().mockResolvedValue({}),
    },
    player: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue(existingPlayers),
      create: vi.fn().mockResolvedValue({ id: "player_new" }),
    },
    user: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

describe("discord profile sync", () => {
  it("derives the avatar URL from the fresh Discord profile hash", () => {
    const avatar = getDiscordAvatarUrl(
      { id: "123456789012345678", avatar: "new_hash" },
      "https://cdn.discordapp.com/avatars/123456789012345678/old_hash.png",
    );

    expect(avatar).toBe("https://cdn.discordapp.com/avatars/123456789012345678/new_hash.png?size=256");
  });

  it("uses gif URLs for animated Discord avatars", () => {
    const avatar = getDiscordAvatarUrl({ id: "123456789012345678", avatar: "a_new_hash" }, null);

    expect(avatar).toBe("https://cdn.discordapp.com/avatars/123456789012345678/a_new_hash.gif?size=256");
  });

  it("syncs returning logins from the fresh profile instead of stale Auth.js user.image", async () => {
    const prisma = createPrismaMock();
    const staleAvatar = "https://cdn.discordapp.com/avatars/discord_1/old_hash.png";
    const freshAvatar = "https://cdn.discordapp.com/avatars/discord_1/new_hash.png?size=256";

    await syncDiscordProfileOnSignIn({
      prisma,
      discordId: "discord_1",
      profile: { id: "discord_1", avatar: "new_hash", username: "Fresh User" },
      authUserImage: staleAvatar,
      authUserName: "Old User",
    });

    expect(prisma.botUser.upsert).toHaveBeenCalledWith({
      where: { discordId: "discord_1" },
      update: { avatar: freshAvatar },
      create: { discordId: "discord_1", avatar: freshAvatar },
    });
    expect(prisma.player.updateMany).toHaveBeenCalledWith({
      where: { discordId: "discord_1", useDiscordAvatar: true },
      data: { avatar: freshAvatar },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "auth_user_1" },
      data: { image: freshAvatar },
    });
  });

  it("does not update Auth.js User before the Discord account is linked", async () => {
    const prisma = createPrismaMock({ linkedUserId: "", existingPlayers: [] });

    await syncDiscordProfileOnSignIn({
      prisma,
      discordId: "discord_1",
      profile: { id: "discord_1", avatar: "new_hash", username: "Fresh User" },
      authUserImage: null,
      authUserName: null,
    });

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.player.create).toHaveBeenCalledWith({
      data: {
        discordId: "discord_1",
        ingameName: "Fresh User",
        avatar: "https://cdn.discordapp.com/avatars/discord_1/new_hash.png?size=256",
        useDiscordAvatar: true,
        isActive: true,
        botUserId: "bot_user_1",
      },
    });
  });
});
