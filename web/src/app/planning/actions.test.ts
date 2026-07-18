import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, WarMapType, WarResult, WarStatus } from "@prisma/client";

const txFake = vi.hoisted(() => ({
  war: {
    create: vi.fn(),
  },
  warFight: {
    createMany: vi.fn(),
  },
  warNode: {
    findMany: vi.fn(),
  },
}));

const prismaFake = vi.hoisted(() => ({
  $transaction: vi.fn(),
  war: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  warBan: {
    deleteMany: vi.fn(),
  },
  warExtraChampion: {
    deleteMany: vi.fn(),
  },
}));

const authHelpersFake = vi.hoisted(() => ({
  getUserPlayerWithAlliance: vi.fn(),
}));

const permissionsFake = vi.hoisted(() => ({
  canPlanAllianceWar: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: prismaFake,
  WarStatus: { PLANNING: "PLANNING", FINISHED: "FINISHED" },
}));
vi.mock("@/lib/auth-helpers", () => authHelpersFake);
vi.mock("@/lib/alliance-permissions", () => permissionsFake);
vi.mock("@/lib/logger", () => ({ default: { debug: vi.fn(), error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("@/lib/discord-config-validation", () => ({
  createMissingDiscordChannelMessage: vi.fn(),
  findMissingBattlegroupChannels: vi.fn(),
}));
vi.mock("@/lib/championHelper", () => ({ getChampionImageUrl: vi.fn() }));
vi.mock("@cerebro/core/config", () => ({ config: { BOT_TOKEN: "test-token" } }));
vi.mock("@cerebro/core/services/mapImageService", () => ({ MapImageService: vi.fn() }));
vi.mock("next/cache", () => cacheFake);

import { createWar, removeExtraChampion, removeWarBan, updateWarStatus } from "./actions";

function buildCreateWarForm(overrides: {
  season?: string;
  warNumber?: string;
  tier?: string;
  opponent?: string;
  mapType?: string;
  isOffSeason?: string;
} = {}) {
  const formData = new FormData();
  formData.set("season", overrides.season ?? "55");
  formData.set("tier", overrides.tier ?? "3");
  formData.set("opponent", overrides.opponent ?? "[TAG] Existing Alliance");
  formData.set("mapType", overrides.mapType ?? WarMapType.STANDARD);
  formData.set("isOffSeason", overrides.isOffSeason ?? "false");

  if (overrides.warNumber !== undefined) {
    formData.set("warNumber", overrides.warNumber);
  } else if (overrides.isOffSeason !== "true") {
    formData.set("warNumber", "3");
  }

  return formData;
}

function p2002Error() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "test",
    meta: { target: ["allianceId", "season", "warNumber"] },
  });
}

describe("planning actions createWar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHelpersFake.getUserPlayerWithAlliance.mockResolvedValue({
      id: "player_1",
      allianceId: "alliance_1",
      isBotAdmin: false,
      isOfficer: true,
      isPlanner: false,
    });
    permissionsFake.canPlanAllianceWar.mockReturnValue(true);
    prismaFake.$transaction.mockImplementation(async (callback) => callback(txFake));
    prismaFake.war.findUnique.mockResolvedValue(null);
    txFake.war.create.mockResolvedValue({ id: "war_1" });
    txFake.warNode.findMany.mockResolvedValue([{ id: "node_1", nodeNumber: 1 }]);
    txFake.warFight.createMany.mockResolvedValue({ count: 3 });
    prismaFake.war.update.mockResolvedValue({ id: "war_1" });
    prismaFake.warBan.deleteMany.mockResolvedValue({ count: 1 });
    prismaFake.warExtraChampion.deleteMany.mockResolvedValue({ count: 1 });
  });

  it("returns validation failure when a numbered war already exists", async () => {
    prismaFake.war.findUnique.mockResolvedValueOnce({ id: "existing_war" });

    const result = await createWar(buildCreateWarForm({ season: "55", warNumber: "3" }));

    expect(result).toEqual({
      success: false,
      error: "Season 55, War 3 already exists. Open the existing war plan or choose a different war number.",
      fieldErrors: {
        warNumber: "A war plan already exists for this Season and War #.",
      },
    });
    expect(prismaFake.war.findUnique).toHaveBeenCalledWith({
      where: {
        allianceId_season_warNumber: {
          allianceId: "alliance_1",
          season: 55,
          warNumber: 3,
        },
      },
      select: { id: true },
    });
    expect(prismaFake.$transaction).not.toHaveBeenCalled();
  });

  it("returns validation failure when a numbered-war create hits a P2002 race", async () => {
    prismaFake.$transaction.mockRejectedValueOnce(p2002Error());

    await expect(createWar(buildCreateWarForm({ season: "55", warNumber: "3" }))).resolves.toEqual({
      success: false,
      error: "Season 55, War 3 already exists. Open the existing war plan or choose a different war number.",
      fieldErrors: {
        warNumber: "A war plan already exists for this Season and War #.",
      },
    });
  });

  it("creates a numbered war and returns the new war id", async () => {
    const result = await createWar(buildCreateWarForm({ season: "55", warNumber: "4" }));

    expect(result).toEqual({ success: true, warId: "war_1" });
    expect(txFake.war.create).toHaveBeenCalledWith({
      data: {
        season: 55,
        warNumber: 4,
        warTier: 3,
        enemyAlliance: "[TAG] Existing Alliance",
        allianceId: "alliance_1",
        status: "PLANNING",
        mapType: WarMapType.STANDARD,
      },
    });
    expect(txFake.warFight.createMany).toHaveBeenCalledWith({
      data: [
        { warId: "war_1", battlegroup: 1, nodeId: "node_1", death: 0 },
        { warId: "war_1", battlegroup: 2, nodeId: "node_1", death: 0 },
        { warId: "war_1", battlegroup: 3, nodeId: "node_1", death: 0 },
      ],
    });
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/planning");
  });

  it("requires a war number for regular season wars", async () => {
    const result = await createWar(buildCreateWarForm({ warNumber: "", isOffSeason: "false" }));

    expect(result).toEqual({
      success: false,
      error: "Check the war details and try again.",
      fieldErrors: {
        warNumber: "War # is required for season wars.",
      },
    });
    expect(prismaFake.war.findUnique).not.toHaveBeenCalled();
    expect(prismaFake.$transaction).not.toHaveBeenCalled();
  });

  it("allows offseason wars without duplicate lookup", async () => {
    const result = await createWar(buildCreateWarForm({ isOffSeason: "true", warNumber: undefined }));

    expect(result).toEqual({ success: true, warId: "war_1" });
    expect(prismaFake.war.findUnique).not.toHaveBeenCalled();
    expect(txFake.war.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        season: 55,
        warNumber: null,
        allianceId: "alliance_1",
      }),
    });
  });

  it("returns validation failure for unauthorized planners", async () => {
    permissionsFake.canPlanAllianceWar.mockReturnValueOnce(false);

    const result = await createWar(buildCreateWarForm());

    expect(result).toEqual({
      success: false,
      error: "You must be an Alliance Planner, Officer, or Bot Admin to plan a war.",
    });
    expect(prismaFake.war.findUnique).not.toHaveBeenCalled();
    expect(prismaFake.$transaction).not.toHaveBeenCalled();
  });
});

describe("planning action error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authHelpersFake.getUserPlayerWithAlliance.mockResolvedValue({
      id: "player_1",
      allianceId: "alliance_1",
      isBotAdmin: false,
      isOfficer: true,
      isPlanner: false,
    });
    permissionsFake.canPlanAllianceWar.mockReturnValue(true);
    prismaFake.warBan.deleteMany.mockResolvedValue({ count: 0 });
    prismaFake.warExtraChampion.deleteMany.mockResolvedValue({ count: 0 });
  });

  it("treats removing an already-absent war ban as success", async () => {
    await expect(removeWarBan("missing_ban")).resolves.toEqual({ success: true });
    expect(prismaFake.warBan.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "missing_ban",
        war: { allianceId: "alliance_1" },
      },
    });
  });

  it("treats removing an already-absent extra champion as success", async () => {
    await expect(removeExtraChampion("missing_extra")).resolves.toEqual({ success: true });
    expect(prismaFake.warExtraChampion.deleteMany).toHaveBeenCalledWith({
      where: {
        id: "missing_extra",
        war: { allianceId: "alliance_1" },
      },
    });
  });

  it("returns a controlled permission failure without attempting a removal", async () => {
    permissionsFake.canPlanAllianceWar.mockReturnValue(false);

    await expect(removeWarBan("ban_1")).resolves.toEqual({
      success: false,
      error: "You must be an Alliance Planner, Officer, or Bot Admin to manage war bans.",
    });
    expect(prismaFake.warBan.deleteMany).not.toHaveBeenCalled();
  });

  it("returns useful validation when a war is missing its result", async () => {
    prismaFake.war.findUnique.mockResolvedValue({
      id: "war_1",
      allianceId: "alliance_1",
      result: WarResult.UNKNOWN,
      enemyDeaths: null,
    });

    await expect(updateWarStatus("war_1", WarStatus.FINISHED)).resolves.toEqual({
      success: false,
      error: "Set the war result and enemy deaths before finishing the war.",
    });
    expect(prismaFake.war.update).not.toHaveBeenCalled();
  });

  it("updates a finished war when the result and deaths are supplied", async () => {
    prismaFake.war.findUnique.mockResolvedValue({
      id: "war_1",
      allianceId: "alliance_1",
      result: WarResult.UNKNOWN,
      enemyDeaths: null,
    });
    prismaFake.war.update.mockResolvedValue({ id: "war_1" });

    await expect(updateWarStatus("war_1", WarStatus.FINISHED, {
      result: WarResult.WIN,
      enemyDeaths: 4,
    })).resolves.toEqual({ success: true });
    expect(prismaFake.war.update).toHaveBeenCalledWith({
      where: { id: "war_1" },
      data: {
        status: WarStatus.FINISHED,
        result: WarResult.WIN,
        enemyDeaths: 4,
      },
    });
  });
});
