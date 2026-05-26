import { beforeEach, describe, expect, it, vi } from "vitest";

const txFake = vi.hoisted(() => ({
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

vi.mock("@/lib/prisma", () => ({ prisma: prismaFake }));
vi.mock("@/lib/auth-helpers", () => authFake);
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
} from "./quest-objectives";

describe("quest objective actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authFake.requireBotAdmin.mockResolvedValue({ id: "admin_1" });
    prismaFake.questObjective.findUnique.mockResolvedValue({ questPlanId: "quest_1" });
    prismaFake.questEncounter.findUnique.mockResolvedValue({ questPlanId: "quest_1" });
    prismaFake.champion.findMany.mockResolvedValue([{ id: 101 }, { id: 102 }]);
    prismaFake.$transaction.mockImplementation(async (callback: (tx: typeof txFake) => unknown) => callback(txFake));
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
});
