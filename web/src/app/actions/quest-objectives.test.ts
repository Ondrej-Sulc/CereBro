import { beforeEach, describe, expect, it, vi } from "vitest";

const txFake = vi.hoisted(() => ({
  questObjective: {
    upsert: vi.fn(),
  },
  questObjectiveRouteChoice: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  questObjectiveRouteRecommendation: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  questObjectiveEncounterRecommendationSet: {
    upsert: vi.fn(),
  },
  questObjectiveEncounterRecommendedChampion: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
}));

const prismaFake = vi.hoisted(() => ({
  $transaction: vi.fn(),
  champion: {
    findMany: vi.fn(),
  },
  questObjective: {
    findUnique: vi.fn(),
  },
  questEncounter: {
    findUnique: vi.fn(),
  },
  questRouteSection: {
    findMany: vi.fn(),
  },
  questRoutePath: {
    findMany: vi.fn(),
  },
  questObjectiveEncounterRecommendationSet: {
    deleteMany: vi.fn(),
  },
  questPlan: {
    findUnique: vi.fn(),
  },
}));

const authFake = vi.hoisted(() => ({
  requireBotAdmin: vi.fn(),
}));

const cacheFake = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const gcsFake = vi.hoisted(() => ({
  deleteFromGcs: vi.fn(),
  uploadToGcs: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authFake);
vi.mock("@/lib/gcs", () => gcsFake);
vi.mock("@/lib/logger", () => ({
  default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/lib/quest-objectives", () => ({
  isNecropolisQuestTitle: (title: string) => {
    const normalized = title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
    return normalized === "necropolis" || normalized === "the necropolis";
  },
}));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => cacheFake);

import {
  deleteQuestObjectiveEncounterRecommendationOverride,
  saveQuestObjectiveEncounterRecommendations,
  seedNecropolisCarinaObjectives,
  upsertQuestObjective,
} from "./quest-objectives";

describe("quest objective actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authFake.requireBotAdmin.mockResolvedValue({ id: "admin_1" });
    prismaFake.questObjective.findUnique.mockResolvedValue({ questPlanId: "quest_1" });
    prismaFake.questEncounter.findUnique.mockResolvedValue({ questPlanId: "quest_1" });
    prismaFake.champion.findMany.mockResolvedValue([{ id: 101 }, { id: 102 }]);
    prismaFake.questRouteSection.findMany.mockResolvedValue([
      { id: "root", questPlanId: "quest_1", parentPathId: null },
      { id: "child", questPlanId: "quest_1", parentPathId: "right" },
    ]);
    prismaFake.questRoutePath.findMany.mockResolvedValue([
      { id: "left", sectionId: "root", section: { questPlanId: "quest_1" } },
      { id: "right", sectionId: "root", section: { questPlanId: "quest_1" } },
      { id: "child-path", sectionId: "child", section: { questPlanId: "quest_1" } },
    ]);
    prismaFake.$transaction.mockImplementation(async (callback: (tx: typeof txFake) => unknown) => callback(txFake));
    txFake.questObjective.upsert.mockResolvedValue({ id: "objective_1" });
    txFake.questObjectiveRouteChoice.deleteMany.mockResolvedValue({ count: 0 });
    txFake.questObjectiveRouteChoice.createMany.mockResolvedValue({ count: 0 });
    txFake.questObjectiveRouteRecommendation.deleteMany.mockResolvedValue({ count: 0 });
    txFake.questObjectiveRouteRecommendation.create.mockResolvedValue({ id: "route_recommendation_1" });
    txFake.questObjectiveEncounterRecommendationSet.upsert.mockResolvedValue({ id: "set_1" });
    txFake.questObjectiveEncounterRecommendedChampion.deleteMany.mockResolvedValue({ count: 0 });
    txFake.questObjectiveEncounterRecommendedChampion.createMany.mockResolvedValue({ count: 2 });
  });

  it("replaces objective encounter recommendations in submitted order", async () => {
    await expect(saveQuestObjectiveEncounterRecommendations({
      questPlanId: "quest_1",
      questObjectiveId: "objective_1",
      questEncounterId: "enc_1",
      championIds: [101, 102, 101],
    })).resolves.toEqual({ success: true });

    expect(txFake.questObjectiveEncounterRecommendationSet.upsert).toHaveBeenCalledWith({
      where: {
        questObjectiveId_questEncounterId: {
          questObjectiveId: "objective_1",
          questEncounterId: "enc_1",
        },
      },
      create: {
        questObjectiveId: "objective_1",
        questEncounterId: "enc_1",
      },
      update: {},
    });
    expect(txFake.questObjectiveEncounterRecommendedChampion.deleteMany).toHaveBeenCalledWith({
      where: { recommendationSetId: "set_1" },
    });
    expect(txFake.questObjectiveEncounterRecommendedChampion.createMany).toHaveBeenCalledWith({
      data: [
        { recommendationSetId: "set_1", championId: 101, order: 0 },
        { recommendationSetId: "set_1", championId: 102, order: 1 },
      ],
    });
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/admin/quests/quest_1");
  });

  it("supports explicit empty objective recommendation overrides", async () => {
    await expect(saveQuestObjectiveEncounterRecommendations({
      questPlanId: "quest_1",
      questObjectiveId: "objective_1",
      questEncounterId: "enc_1",
      championIds: [],
    })).resolves.toEqual({ success: true });

    expect(txFake.questObjectiveEncounterRecommendedChampion.deleteMany).toHaveBeenCalledWith({
      where: { recommendationSetId: "set_1" },
    });
    expect(txFake.questObjectiveEncounterRecommendedChampion.createMany).not.toHaveBeenCalled();
  });

  it("rejects objective and encounter records outside the quest", async () => {
    prismaFake.questObjective.findUnique.mockResolvedValueOnce({ questPlanId: "other_quest" });

    await expect(saveQuestObjectiveEncounterRecommendations({
      questPlanId: "quest_1",
      questObjectiveId: "objective_1",
      questEncounterId: "enc_1",
      championIds: [101],
    })).rejects.toThrow(/Objective not found/);
  });

  it("deletes objective recommendation overrides to restore fallback", async () => {
    prismaFake.questObjectiveEncounterRecommendationSet.deleteMany.mockResolvedValueOnce({ count: 1 });

    await expect(deleteQuestObjectiveEncounterRecommendationOverride({
      questPlanId: "quest_1",
      questObjectiveId: "objective_1",
      questEncounterId: "enc_1",
    })).resolves.toEqual({ success: true });

    expect(prismaFake.questObjectiveEncounterRecommendationSet.deleteMany).toHaveBeenCalledWith({
      where: {
        questObjectiveId: "objective_1",
        questEncounterId: "enc_1",
      },
    });
  });

  it("rejects Necropolis seed requests on non-Necropolis quests", async () => {
    prismaFake.questPlan.findUnique.mockResolvedValueOnce({ id: "quest_1", title: "Realm of Legends" });

    await expect(seedNecropolisCarinaObjectives("quest_1")).rejects.toThrow(
      "Necropolis presets can only be seeded on The Necropolis quest plan."
    );
  });

  it("replaces objective recommended routes with validated choices", async () => {
    await expect(upsertQuestObjective({
      id: "objective_1",
      questPlanId: "quest_1",
      title: "Challenge",
      slug: "challenge",
      order: 1,
      routeRecommendations: [{
        title: "Recommended Route",
        order: 1,
        choices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
      }],
    })).resolves.toEqual({ success: true, objectiveId: "objective_1" });

    expect(txFake.questObjectiveRouteRecommendation.deleteMany).toHaveBeenCalledWith({
      where: { questObjectiveId: "objective_1" },
    });
    expect(txFake.questObjectiveRouteRecommendation.create).toHaveBeenCalledWith({
      data: {
        questObjectiveId: "objective_1",
        slug: "recommended-route",
        title: "Recommended Route",
        order: 1,
        choices: {
          create: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
        },
      },
    });
  });

  it("rejects more than two objective recommended routes", async () => {
    await expect(upsertQuestObjective({
      questPlanId: "quest_1",
      title: "Challenge",
      slug: "challenge",
      order: 1,
      routeRecommendations: [1, 2, 3].map(order => ({
        title: `Route ${order}`,
        order,
        choices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
      })),
    })).rejects.toThrow(/at most two/);
  });

  it("rejects objective recommended routes without choices", async () => {
    await expect(upsertQuestObjective({
      questPlanId: "quest_1",
      title: "Challenge",
      slug: "challenge",
      order: 1,
      routeRecommendations: [{
        title: "Empty Route",
        order: 1,
        choices: [],
      }],
    })).rejects.toThrow(/at least one route choice/);
  });

  it("rejects child route recommendations without the parent path choice", async () => {
    await expect(upsertQuestObjective({
      questPlanId: "quest_1",
      title: "Challenge",
      slug: "challenge",
      order: 1,
      routeRecommendations: [{
        title: "Broken Child Route",
        order: 1,
        choices: [{ questRouteSectionId: "child", questRoutePathId: "child-path" }],
      }],
    })).rejects.toThrow(/parent path/);
  });
});
