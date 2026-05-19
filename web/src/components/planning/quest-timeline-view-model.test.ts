import { describe, expect, it } from "vitest";
import {
  createInitialQuestTimelinePrefightSelections,
  createInitialQuestTimelineRevives,
  createInitialQuestTimelineSelections,
  groupQuestPlayerPicks,
  projectQuestTimelineViewModel,
} from "./quest-timeline-view-model";

const champion = (id: number, name = `Champion ${id}`) => ({
  id,
  name,
  shortName: name,
  class: "SCIENCE" as const,
  images: {},
});

const rosterEntry = (id: string, championId: number, stars: number) => ({
  id,
  playerId: "player_1",
  championId,
  stars,
  rank: 1,
  sigLevel: 0,
  isAwakened: false,
  isAscended: false,
  ascensionLevel: 0,
  powerRating: 0,
  champion: champion(championId),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const routeSections = [{
  id: "section_1",
  title: "Opening",
  order: 1,
  questPlanId: "quest_1",
  parentPathId: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  parentPath: null,
  paths: [
    {
      id: "path_a",
      title: "Path A",
      order: 1,
      sectionId: "section_1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      encounters: [{ id: "enc_1" }],
    },
  ],
}];

const quest = {
  id: "quest_1",
  title: "Quest",
  status: "VISIBLE" as const,
  videoUrl: null,
  bannerUrl: null,
  bannerFit: null,
  bannerPosition: null,
  categoryId: null,
  creatorId: "admin_1",
  minStarLevel: null,
  maxStarLevel: null,
  teamLimit: null,
  requiredClasses: [],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  category: null,
  requiredTags: [],
  routeSections,
  creators: [],
  encounters: [
    {
      id: "enc_1",
      questPlanId: "quest_1",
      sequence: 1,
      difficulty: "NORMAL" as const,
      videoUrl: null,
      tips: null,
      defenderId: null,
      recommendedTags: [],
      requiredClasses: [],
      minStarLevel: null,
      maxStarLevel: null,
      routePathId: "path_a",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      defender: null,
      requiredTags: [],
      recommendedChampions: [],
      videos: [],
      nodes: [],
    },
    {
      id: "enc_inactive",
      questPlanId: "quest_1",
      sequence: 2,
      difficulty: "HARD" as const,
      videoUrl: null,
      tips: null,
      defenderId: null,
      recommendedTags: [],
      requiredClasses: [],
      minStarLevel: null,
      maxStarLevel: null,
      routePathId: "other_path",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      defender: null,
      requiredTags: [],
      recommendedChampions: [],
      videos: [],
      nodes: [],
    },
  ],
  _count: { playerPlans: 0 },
  playerPlans: [],
};

describe("Quest Timeline View Model", () => {
  it("creates initial interactive selection maps from saved champion rarities", () => {
    const roster = [
      rosterEntry("r1-7", 1, 7),
      rosterEntry("r1-6", 1, 6),
      rosterEntry("r2-7", 2, 7),
    ];
    const savedEncounters = [
      {
        id: "saved_1",
        playerQuestPlanId: "player_plan_1",
        questPlanId: "quest_1",
        questEncounterId: "enc_1",
        selectedChampionId: 1,
        selectedChampionStars: 6,
        prefightChampionId: 2,
        prefightChampionStars: 7,
        revivesUsed: 4,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];

    expect(createInitialQuestTimelineSelections({
      quest,
      roster,
      savedEncounters,
      readOnly: false,
      rosterMap: {},
    })).toEqual({ enc_1: "r1-6" });
    expect(createInitialQuestTimelinePrefightSelections({
      quest,
      roster,
      savedEncounters,
      readOnly: false,
      rosterMap: {},
    })).toEqual({ enc_1: "r2-7" });
    expect(createInitialQuestTimelineRevives(savedEncounters)).toEqual({ enc_1: 4 });
  });

  it("creates read-only selection maps from the roster map", () => {
    const roster = [rosterEntry("readonly-counter", 1, 7), rosterEntry("readonly-prefight", 2, 7)];

    expect(createInitialQuestTimelineSelections({
      quest,
      roster: [],
      savedEncounters: [],
      readOnly: true,
      rosterMap: { enc_1: roster[0] },
      initialSelections: { enc_1: 1 },
    })).toEqual({ enc_1: "readonly-counter" });
    expect(createInitialQuestTimelinePrefightSelections({
      quest,
      roster: [],
      savedEncounters: [],
      readOnly: true,
      rosterMap: { "prefight:enc_1": roster[1] },
      initialPrefightSelections: { enc_1: 2 },
    })).toEqual({ enc_1: "readonly-prefight" });
  });

  it("groups player picks once and filters them to the active route in the view model", () => {
    const featuredPicks = {
      enc_1: [{
        championId: 1,
        count: 1,
        champion: champion(1),
        pickedBy: [{ id: "player_1", name: "Player One", avatar: null }],
      }],
    };
    const alliancePicks = {
      enc_inactive: [{
        championId: 2,
        count: 1,
        champion: champion(2),
        pickedBy: [{ id: "player_1", name: "Player One", avatar: null }],
      }],
    };

    expect(groupQuestPlayerPicks({ featuredPicks, alliancePicks }).player_1.picks.map(pick => pick.encounterId))
      .toEqual(["enc_1", "enc_inactive"]);

    const viewModel = projectQuestTimelineViewModel({
      quest,
      routeChoices: { section_1: "path_a" },
      selections: { enc_1: "r1" },
      prefightSelections: {},
      synergyIds: [],
      revivesByEncounterId: { enc_1: 2, enc_inactive: 9 },
      roster: [rosterEntry("r1", 1, 7)],
      savedSynergies: [],
      difficultyFilter: [],
      readOnly: false,
      rosterMap: {},
      featuredPicks,
      alliancePicks,
    });

    expect(viewModel.activePlayerPicksMap.player_1.picks.map(pick => pick.encounterId)).toEqual(["enc_1"]);
    expect(viewModel.activeRevivesTotal).toBe(2);
    expect(viewModel.allRevivesTotal).toBe(11);
  });
});
