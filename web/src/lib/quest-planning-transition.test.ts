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
      expect(decision.intent).toEqual({
        kind: "counter",
        field: "selectedChampionId",
        questEncounterId: "right-fight",
        championId: 2,
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
});
