import { describe, expect, it, vi } from "vitest";
import { ChampionClass } from "@prisma/client";
import { applyPlayerQuestPlanningMutation } from "./quest-planning-mutation";
import { prisma } from "./prisma";

function createMutationDb(overrides: Record<string, unknown> = {}) {
  const db = {
    questPlan: {
      findUnique: vi.fn().mockResolvedValue({
        id: "quest-1",
        teamLimit: 3,
        minStarLevel: null,
        maxStarLevel: null,
        requiredClasses: [],
        requiredTags: [],
        encounters: [{ id: "encounter-1", routePathId: null, sequence: 1 }],
        routeSections: [],
      }),
    },
    questEncounter: {
      findUnique: vi.fn().mockResolvedValue({
        id: "encounter-1",
        questPlanId: "quest-1",
        requiredTags: [],
      }),
    },
    playerQuestPlan: {
      upsert: vi.fn().mockResolvedValue({ id: "player-plan-1" }),
      findUnique: vi.fn().mockResolvedValue({
        id: "player-plan-1",
        encounters: [],
        synergyChampions: [],
        routeChoices: [],
      }),
    },
    playerQuestEncounter: {
      upsert: vi.fn().mockResolvedValue({ id: "player-encounter-1" }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    playerQuestRouteChoice: {
      upsert: vi.fn().mockResolvedValue({ id: "route-choice-1" }),
    },
    playerQuestSynergyChampion: {
      upsert: vi.fn().mockResolvedValue({ id: "synergy-1" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    roster: {
      findMany: vi.fn().mockResolvedValue([
        { id: "roster-1", championId: 1, stars: 7, rank: 2 },
      ]),
    },
    champion: {
      findUnique: vi.fn().mockResolvedValue({
        id: 1,
        class: ChampionClass.SCIENCE,
        tags: [],
        obtainable: ["6*", "7*"],
      }),
    },
    ...overrides,
  };

  return db as unknown as typeof prisma;
}

describe("Quest Planning Mutation", () => {
  it("applies a counter mutation behind one mutation interface", async () => {
    const db = createMutationDb();

    const result = await applyPlayerQuestPlanningMutation({
      db,
      playerId: "player-1",
      mutation: {
        kind: "counter",
        questPlanId: "quest-1",
        questEncounterId: "encounter-1",
        championId: 1,
      },
    });

    expect(result).toEqual({
      success: true,
      questPlanId: "quest-1",
      invalidateCounterStats: true,
    });
    expect(db.playerQuestEncounter.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        playerQuestPlanId: "player-plan-1",
        questEncounterId: "encounter-1",
        questPlanId: "quest-1",
        selectedChampionId: 1,
      }),
      update: { selectedChampionId: 1 },
    }));
  });

  it("cleans up an empty encounter row when a counter is cleared", async () => {
    const db = createMutationDb();

    await applyPlayerQuestPlanningMutation({
      db,
      playerId: "player-1",
      mutation: {
        kind: "counter",
        questPlanId: "quest-1",
        questEncounterId: "encounter-1",
        championId: null,
      },
    });

    expect(db.playerQuestEncounter.deleteMany).toHaveBeenCalledWith({
      where: {
        playerQuestPlanId: "player-plan-1",
        questEncounterId: "encounter-1",
        selectedChampionId: null,
        prefightChampionId: null,
        revivesUsed: 0,
      },
    });
  });

  it("removes synergy champions without loading validation data", async () => {
    const db = createMutationDb();

    const result = await applyPlayerQuestPlanningMutation({
      db,
      playerId: "player-1",
      mutation: {
        kind: "synergy",
        questPlanId: "quest-1",
        championId: 1,
        isRemoving: true,
      },
    });

    expect(result).toEqual({ success: true, questPlanId: "quest-1" });
    expect(db.playerQuestSynergyChampion.deleteMany).toHaveBeenCalledWith({
      where: {
        playerQuestPlanId: "player-plan-1",
        championId: 1,
      },
    });
    expect(db.questPlan.findUnique).not.toHaveBeenCalled();
  });
});
