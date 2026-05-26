import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChampionClass, QuestPlanStatus } from "@prisma/client";

const prismaFake = vi.hoisted(() => ({
  $transaction: vi.fn(),
  playerQuestPlan: {
    updateMany: vi.fn(),
    upsert: vi.fn(),
  },
  questEncounter: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  questPlan: {
    create: vi.fn(),
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
vi.mock("@/lib/gcs", () => ({ deleteFromGcs: vi.fn(), uploadToGcs: vi.fn() }));
vi.mock("@/lib/logger", () => ({ default: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() } }));
vi.mock("@/lib/with-request-context", () => ({
  withActionContext: (_name: string, fn: unknown) => fn,
}));
vi.mock("next/cache", () => cacheFake);

import {
  clearRecommendedChampionsInQuest,
  duplicateQuestPlan,
  updateFeaturedPlayers,
} from "./quest-plan-admin";

describe("quest plan admin actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authFake.requireBotAdmin.mockResolvedValue({ id: "admin_1" });
    prismaFake.$transaction.mockResolvedValue([]);
  });

  it("deduplicates featured players and replaces the featured set", async () => {
    prismaFake.playerQuestPlan.updateMany.mockReturnValueOnce({ op: "clear" });
    prismaFake.playerQuestPlan.upsert
      .mockReturnValueOnce({ op: "feature_p1" })
      .mockReturnValueOnce({ op: "feature_p2" });

    await expect(updateFeaturedPlayers("quest_1", ["p1", "p2", "p1"]))
      .resolves.toEqual({ success: true });

    expect(prismaFake.playerQuestPlan.updateMany).toHaveBeenCalledWith({
      where: { questPlanId: "quest_1", scopeKey: "base" },
      data: { isFeatured: false },
    });
    expect(prismaFake.playerQuestPlan.upsert).toHaveBeenCalledTimes(2);
    expect(prismaFake.$transaction).toHaveBeenCalledWith([
      { op: "clear" },
      { op: "feature_p1" },
      { op: "feature_p2" },
    ]);
    expect(cacheFake.revalidateTag).toHaveBeenCalledWith("quest-plan-detail", "default");
    expect(cacheFake.revalidateTag).toHaveBeenCalledWith("quest-featured-picks-quest_1", "default");
  });

  it("duplicates a quest plan as a draft with copied encounter relationships", async () => {
    prismaFake.questPlan.findUnique.mockResolvedValueOnce({
      id: "source_1",
      title: "Everest Quest",
      videoUrl: "https://video.example",
      bannerUrl: "https://banner.example",
      bannerFit: "contain",
      bannerPosition: "top",
      categoryId: "cat_1",
      minStarLevel: 6,
      maxStarLevel: 7,
      teamLimit: 5,
      requiredClasses: [ChampionClass.SCIENCE],
      requiredTags: [{ id: 11 }],
      encounters: [{
        sequence: 1,
        videoUrl: "https://fight.example",
        tips: "Bring slow",
        defenderId: 101,
        recommendedTags: ["Slow"],
        requiredClasses: [ChampionClass.TECH],
        minStarLevel: 6,
        maxStarLevel: 7,
        recommendedChampions: [{ id: 201 }],
        requiredTags: [{ id: 12 }],
        nodes: [{ nodeModifierId: "node_1", isHighlighted: true }],
      }],
    });
    prismaFake.questPlan.create.mockResolvedValueOnce({ id: "copy_1" });

    await expect(duplicateQuestPlan("source_1"))
      .resolves.toEqual({ success: true, planId: "copy_1" });

    expect(prismaFake.questPlan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Everest Quest (Copy)",
        status: QuestPlanStatus.DRAFT,
        creatorId: "admin_1",
        requiredTags: { connect: [{ id: 11 }] },
        encounters: {
          create: [expect.objectContaining({
            defenderId: 101,
            recommendedChampions: { connect: [{ id: 201 }] },
            requiredTags: { connect: [{ id: 12 }] },
            nodes: { create: [{ nodeModifierId: "node_1", isHighlighted: true }] },
          })],
        },
      }),
    });
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/admin/quests");
  });

  it("clears recommended champions from every encounter in a quest", async () => {
    prismaFake.questEncounter.findMany.mockResolvedValueOnce([{ id: "enc_1" }, { id: "enc_2" }]);
    prismaFake.questEncounter.update
      .mockReturnValueOnce({ op: "clear_enc_1" })
      .mockReturnValueOnce({ op: "clear_enc_2" });

    await expect(clearRecommendedChampionsInQuest("quest_1")).resolves.toEqual({ success: true });

    expect(prismaFake.$transaction).toHaveBeenCalledWith([
      { op: "clear_enc_1" },
      { op: "clear_enc_2" },
    ]);
    expect(prismaFake.questEncounter.update).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      data: { recommendedChampions: { set: [] } },
    });
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/admin/quests/quest_1");
    expect(cacheFake.revalidatePath).toHaveBeenCalledWith("/planning/quests/quest_1");
  });
});
