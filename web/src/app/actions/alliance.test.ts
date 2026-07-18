import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaFake = vi.hoisted(() => ({
  $transaction: vi.fn(),
  alliance: {
    findUnique: vi.fn(),
  },
}));

const txFake = vi.hoisted(() => ({
  alliance: {
    update: vi.fn(),
  },
  botJob: {
    upsert: vi.fn(),
  },
}));

const authHelpersFake = vi.hoisted(() => ({
  getUserPlayerWithAlliance: vi.fn(),
}));

const permissionsFake = vi.hoisted(() => ({
  canManageAllianceMembers: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authHelpersFake);
vi.mock("@/lib/alliance-permissions", () => permissionsFake);
vi.mock("@/lib/cache", () => ({ clearCache: vi.fn() }));
vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("@cerebro/core/config", () => ({
  config: { BOT_TOKEN: "test-token" },
}));
vi.mock("next/cache", () => cacheFake);

import {
  getAllianceDiscordOptions,
  updateAllianceDiscordConfig,
  type AllianceDiscordConfig,
} from "./alliance";

const emptyConfig: AllianceDiscordConfig = {
  officerRole: null,
  plannerRole: null,
  battlegroup1Role: null,
  battlegroup2Role: null,
  battlegroup3Role: null,
  warVideosChannelId: null,
  deathChannelId: null,
  battlegroup1ChannelId: null,
  battlegroup2ChannelId: null,
  battlegroup3ChannelId: null,
};

describe("alliance Discord configuration actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHelpersFake.getUserPlayerWithAlliance.mockResolvedValue({
      id: "player_1",
      allianceId: "alliance_1",
      isBotAdmin: false,
      isOfficer: true,
    });
    permissionsFake.canManageAllianceMembers.mockReturnValue(true);
    prismaFake.$transaction.mockImplementation(async (callback) => callback(txFake));
    prismaFake.alliance.findUnique.mockResolvedValue({
      id: "alliance_1",
      guildId: "guild_1",
      ...emptyConfig,
      deathChannelId: "deleted_channel",
    });

    vi.stubGlobal("fetch", vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.endsWith("/roles")) {
        return Response.json([]);
      }
      return Response.json([
        {
          id: "bg3_channel",
          name: "bg3",
          type: 0,
        },
      ]);
    }));
  });

  it("does not let an unchanged hidden stale channel block a valid battlegroup update", async () => {
    const result = await updateAllianceDiscordConfig({
      ...emptyConfig,
      deathChannelId: "deleted_channel",
      battlegroup3ChannelId: "bg3_channel",
    });

    expect(result).toEqual({
      success: true,
      queuedRoleSync: false,
    });
    expect(txFake.alliance.update).toHaveBeenCalledWith({
      where: { id: "alliance_1" },
      data: {
        ...emptyConfig,
        deathChannelId: "deleted_channel",
        battlegroup3ChannelId: "bg3_channel",
      },
    });
  });

  it("returns field-specific failure for a newly selected channel that is unavailable", async () => {
    prismaFake.alliance.findUnique.mockResolvedValueOnce({
      id: "alliance_1",
      guildId: "guild_1",
      ...emptyConfig,
    });

    const result = await updateAllianceDiscordConfig({
      ...emptyConfig,
      deathChannelId: "deleted_channel",
    });

    expect(result).toEqual({
      success: false,
      error: {
        code: "INVALID_DISCORD_CHANNELS",
        message:
          "The selected Deaths channel is no longer available. Choose another channel or set it to Not configured.",
        invalidFields: ["deathChannelId"],
      },
    });
    expect(prismaFake.$transaction).not.toHaveBeenCalled();
  });

  it("returns recovery guidance when Discord options cannot be loaded", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Missing Access", { status: 403 })));

    const result = await getAllianceDiscordOptions();

    expect(result).toEqual({
      success: false,
      error: {
        code: "DISCORD_UNAVAILABLE",
        message:
          "CereBro cannot read this Discord server. Check that the bot is still installed and can view its channels, then try again.",
      },
    });
  });
});
