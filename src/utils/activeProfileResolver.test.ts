import { describe, expect, it, vi } from "vitest";
import { resolveActivePlayerIdForDiscord } from "./activeProfileResolver";

describe("resolveActivePlayerIdForDiscord", () => {
  it("prefers BotUser.activeProfileId over a stale legacy isActive profile", async () => {
    const prisma = {
      botUser: {
        findUnique: vi.fn().mockResolvedValue({ activeProfileId: "profile-active" }),
      },
      player: {
        findFirst: vi.fn().mockResolvedValue({ id: "profile-active" }),
      },
    };

    await expect(resolveActivePlayerIdForDiscord(prisma, "discord-1")).resolves.toBe("profile-active");

    expect(prisma.player.findFirst).toHaveBeenCalledWith({
      where: { id: "profile-active", discordId: "discord-1" },
      select: { id: true },
    });
  });

  it("falls back to the legacy active profile when BotUser.activeProfileId is missing", async () => {
    const prisma = {
      botUser: {
        findUnique: vi.fn().mockResolvedValue({ activeProfileId: null }),
      },
      player: {
        findFirst: vi.fn()
          .mockResolvedValueOnce({ id: "legacy-active" })
          .mockResolvedValueOnce({ id: "latest-profile" }),
      },
    };

    await expect(resolveActivePlayerIdForDiscord(prisma, "discord-1")).resolves.toBe("legacy-active");
  });

  it("ignores an activeProfileId that does not belong to the Discord user", async () => {
    const prisma = {
      botUser: {
        findUnique: vi.fn().mockResolvedValue({ activeProfileId: "other-user-profile" }),
      },
      player: {
        findFirst: vi.fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: "latest-profile" }),
      },
    };

    await expect(resolveActivePlayerIdForDiscord(prisma, "discord-1")).resolves.toBe("latest-profile");
  });
});
