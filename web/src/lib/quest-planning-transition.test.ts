import { describe, expect, it } from "vitest";
import { ChampionClass } from "@prisma/client";
import { decideQuestPlanningTransition } from "./quest-planning-transition";
import type { QuestSelectionChampion } from "./player-quest-selection";

const scienceChampion: QuestSelectionChampion = {
  id: 1,
  class: ChampionClass.SCIENCE,
  tags: [{ id: 10, name: "#Saga Champions" }],
  obtainable: ["6*", "7*"],
};

const skillChampion: QuestSelectionChampion = {
  id: 2,
  class: ChampionClass.SKILL,
  tags: [],
  obtainable: ["6*", "7*"],
};

const mysticChampion: QuestSelectionChampion = {
  id: 3,
  class: ChampionClass.MYSTIC,
  tags: [],
  obtainable: ["6*", "7*"],
};

const quest = {
  teamLimit: 2,
  minStarLevel: null,
  maxStarLevel: null,
  requiredClasses: [],
  requiredTags: [],
  routeSections: [
    {
      id: "root",
      title: "Opening",
      parentPathId: null,
      paths: [
        { id: "left", title: "Left" },
        { id: "right", title: "Right" },
      ],
    },
  ],
  encounters: [
    { id: "shared", routePathId: null, sequence: 1 },
    { id: "left-fight", routePathId: "left", sequence: 2 },
    { id: "right-fight", routePathId: "right", sequence: 3 },
  ],
};

describe("Quest Planning Transition", () => {
  it("rejects counter and prefight conflicts through the transition seam", () => {
    const decision = decideQuestPlanningTransition({
      kind: "counter",
      quest,
      plan: {
        encounters: [
          { questEncounterId: "shared", selectedChampionId: null, prefightChampionId: 1 },
        ],
      },
      field: "selectedChampionId",
      questEncounterId: "shared",
      candidate: {
        championId: 1,
        champion: scienceChampion,
        rosterEntries: [{ championId: 1, stars: 7, rank: 2 }],
      },
      encounter: { id: "shared" },
    });

    expect(decision).toEqual({
      valid: false,
      reason: "Counter and prefight champion must be different for the same fight.",
    });
  });

  it("checks team limits against only active route encounters", () => {
    const decision = decideQuestPlanningTransition({
      kind: "counter",
      quest: { ...quest, teamLimit: 3 },
      plan: {
        routeChoices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
        encounters: [
          { questEncounterId: "shared", selectedChampionId: 1, prefightChampionId: null },
          { questEncounterId: "left-fight", selectedChampionId: 2, prefightChampionId: null },
        ],
        synergyChampions: [{ championId: 3 }],
      },
      field: "selectedChampionId",
      questEncounterId: "right-fight",
      candidate: {
        championId: 2,
        champion: skillChampion,
        rosterEntries: [{ championId: 2, stars: 7, rank: 1 }],
      },
      encounter: { id: "right-fight" },
    });

    if (!decision.valid) throw new Error(decision.reason);
    expect(decision.valid).toBe(true);
    if (decision.valid) {
      expect(decision.intent).toMatchObject({
        kind: "counter",
        field: "selectedChampionId",
        questEncounterId: "right-fight",
        championId: 2,
        championStars: 7,
      });
      expect(decision.activeAssignments?.map(assignment => assignment.questEncounterId)).toEqual(["shared"]);
    }
  });

  it("rejects synergy additions that would exceed the active team limit", () => {
    const decision = decideQuestPlanningTransition({
      kind: "synergy",
      quest,
      plan: {
        routeChoices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
        encounters: [
          { questEncounterId: "shared", selectedChampionId: 1, prefightChampionId: null },
          { questEncounterId: "right-fight", selectedChampionId: 2, prefightChampionId: null },
        ],
      },
      field: "synergyChampionId",
      candidate: {
        championId: 3,
        champion: mysticChampion,
        rosterEntries: [{ championId: 3, stars: 6, rank: 5 }],
      },
    });

    expect(decision).toEqual({
      valid: false,
      reason: "Team limit of 2 reached.",
    });
  });

  it("enforces Unlimited Swaps by active route champion rarity", () => {
    const decision = decideQuestPlanningTransition({
      kind: "counter",
      quest: { ...quest, teamLimit: null },
      plan: {
        routeChoices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
        encounters: [
          { questEncounterId: "shared", selectedChampionId: 1, selectedChampionStars: 7, prefightChampionId: null },
          { questEncounterId: "left-fight", selectedChampionId: 1, selectedChampionStars: 6, prefightChampionId: null },
        ],
      },
      field: "selectedChampionId",
      questEncounterId: "right-fight",
      candidate: {
        championId: 1,
        stars: 7,
        champion: scienceChampion,
        rosterEntries: [{ championId: 1, stars: 7, rank: 1 }],
      },
      encounter: { id: "right-fight" },
    });

    expect(decision).toEqual({
      valid: false,
      reason: "This champion rarity is already used on this quest route.",
    });
  });

  it("requires Unlimited Swaps prefight to match the selected counter rarity", () => {
    const decision = decideQuestPlanningTransition({
      kind: "prefight",
      quest: { ...quest, teamLimit: null },
      plan: {
        encounters: [
          { questEncounterId: "shared", selectedChampionId: 1, selectedChampionStars: 7, prefightChampionId: null },
        ],
      },
      field: "prefightChampionId",
      questEncounterId: "shared",
      candidate: {
        championId: 2,
        stars: 7,
        champion: skillChampion,
        rosterEntries: [{ championId: 2, stars: 7, rank: 1 }],
      },
      encounter: { id: "shared" },
    });

    expect(decision).toEqual({
      valid: false,
      reason: "Unlimited Swaps prefight must match the selected counter for this fight.",
    });
  });

  it("clears Unlimited Swaps prefight when changing the counter rarity", () => {
    const decision = decideQuestPlanningTransition({
      kind: "counter",
      quest: { ...quest, teamLimit: null },
      plan: {
        encounters: [
          {
            questEncounterId: "shared",
            selectedChampionId: 1,
            selectedChampionStars: 7,
            prefightChampionId: 1,
            prefightChampionStars: 7,
          },
        ],
      },
      field: "selectedChampionId",
      questEncounterId: "shared",
      candidate: {
        championId: 2,
        stars: 7,
        champion: skillChampion,
        rosterEntries: [{ championId: 2, stars: 7, rank: 1 }],
      },
      encounter: { id: "shared" },
    });

    expect(decision).toMatchObject({
      valid: true,
      intent: {
        kind: "counter",
        questEncounterId: "shared",
        championId: 2,
        championStars: 7,
        clearPrefight: true,
      },
    });
  });

  it("returns route choice and revive intents without persistence concerns", () => {
    expect(decideQuestPlanningTransition({
      kind: "routeChoice",
      quest,
      plan: { encounters: [] },
      sectionId: "root",
      pathId: "right",
    })).toMatchObject({
      valid: true,
      intent: {
        kind: "routeChoice",
        sectionId: "root",
        pathId: "right",
        routeChoices: { root: "right" },
      },
    });

    expect(decideQuestPlanningTransition({
      kind: "revives",
      questEncounterId: "shared",
      revivesUsed: 3,
    })).toEqual({
      valid: true,
      intent: {
        kind: "revives",
        questEncounterId: "shared",
        revivesUsed: 3,
      },
    });
  });

  it("rejects changes to objective-locked route choices", () => {
    const decision = decideQuestPlanningTransition({
      kind: "routeChoice",
      quest: {
        ...quest,
        objective: {
          id: "objective-1",
          slug: "locked",
          title: "Locked",
          order: 1,
          requiredClasses: [],
          requiredTags: [],
          routeChoices: [{
            questRouteSectionId: "root",
            questRoutePathId: "left",
            isLocked: true,
          }],
        },
      },
      plan: { encounters: [] },
      sectionId: "root",
      pathId: "right",
    });

    expect(decision).toEqual({
      valid: false,
      reason: "This route choice is locked by the selected objective.",
    });
  });

  it("uses the first objective recommended route when no saved route choices exist", () => {
    const decision = decideQuestPlanningTransition({
      kind: "counter",
      quest: {
        ...quest,
        objective: {
          id: "objective-1",
          slug: "recommended",
          title: "Recommended",
          order: 1,
          requiredClasses: [],
          requiredTags: [],
          routeRecommendations: [{
            id: "variant-1",
            slug: "right",
            title: "Right",
            order: 1,
            choices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
          }],
        },
      },
      plan: { encounters: [] },
      field: "selectedChampionId",
      questEncounterId: "right-fight",
      candidate: {
        championId: 1,
        champion: scienceChampion,
        rosterEntries: [{ championId: 1, stars: 7, rank: 1 }],
      },
      encounter: { id: "right-fight" },
    });

    expect(decision.valid).toBe(true);
    expect(decision.activeEncounterIds?.has("right-fight")).toBe(true);
    expect(decision.activeEncounterIds?.has("left-fight")).toBe(false);
  });

  it("keeps saved route choices ahead of objective recommendations", () => {
    const decision = decideQuestPlanningTransition({
      kind: "counter",
      quest: {
        ...quest,
        objective: {
          id: "objective-1",
          slug: "recommended",
          title: "Recommended",
          order: 1,
          requiredClasses: [],
          requiredTags: [],
          routeRecommendations: [{
            id: "variant-1",
            slug: "right",
            title: "Right",
            order: 1,
            choices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
          }],
        },
      },
      plan: {
        routeChoices: [{ questRouteSectionId: "root", questRoutePathId: "left" }],
        encounters: [],
      },
      field: "selectedChampionId",
      questEncounterId: "left-fight",
      candidate: {
        championId: 1,
        champion: scienceChampion,
        rosterEntries: [{ championId: 1, stars: 7, rank: 1 }],
      },
      encounter: { id: "left-fight" },
    });

    expect(decision.valid).toBe(true);
    expect(decision.activeEncounterIds?.has("left-fight")).toBe(true);
    expect(decision.activeEncounterIds?.has("right-fight")).toBe(false);
  });

  it("applies objective locks after recommended route choices", () => {
    const decision = decideQuestPlanningTransition({
      kind: "counter",
      quest: {
        ...quest,
        objective: {
          id: "objective-1",
          slug: "locked",
          title: "Locked",
          order: 1,
          requiredClasses: [],
          requiredTags: [],
          routeChoices: [{
            questRouteSectionId: "root",
            questRoutePathId: "left",
            isLocked: true,
          }],
          routeRecommendations: [{
            id: "variant-1",
            slug: "right",
            title: "Right",
            order: 1,
            choices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
          }],
        },
      },
      plan: { encounters: [] },
      field: "selectedChampionId",
      questEncounterId: "left-fight",
      candidate: {
        championId: 1,
        champion: scienceChampion,
        rosterEntries: [{ championId: 1, stars: 7, rank: 1 }],
      },
      encounter: { id: "left-fight" },
    });

    expect(decision.valid).toBe(true);
    expect(decision.activeEncounterIds?.has("left-fight")).toBe(true);
    expect(decision.activeEncounterIds?.has("right-fight")).toBe(false);
  });
});
