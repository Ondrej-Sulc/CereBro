import { describe, expect, it } from "vitest";
import {
  applyQuestTimelineTeamMemberRemoval,
  clearQuestTimelinePlanSelections,
  decideQuestTimelineCounterSelection,
  decideQuestTimelinePrefightSelection,
  decideQuestTimelineRevives,
  decideQuestTimelineSynergy,
  decideQuestTimelineTeamMemberRemoval,
} from "./quest-timeline-controller";

const champion = (id: number) => ({
  id,
  name: `Champion ${id}`,
  slug: `champion-${id}`,
  shortName: `C${id}`,
  gameId: `champion_${id}`,
  class: "SCIENCE" as const,
  releaseDate: new Date("2026-01-01T00:00:00.000Z"),
  obtainable: ["7"],
  images: {
    hero: "",
    full_primary: "",
    full_secondary: "",
    p_32: "",
    s_32: "",
    p_64: "",
    s_64: "",
    p_128: "",
    s_128: "",
  },
  discordEmoji: null,
  fullAbilities: {},
  isPlayable: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const rosterEntry = (id: string, championId: number, stars = 7) => ({
  id,
  playerId: "player_1",
  championId,
  stars,
  rank: 1,
  sigLevel: 0,
  isAwakened: false,
  isAscended: false,
  ascensionLevel: 0,
  reservedForAttack: false,
  powerRating: 0,
  champion: champion(championId),
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
});

const quest = (teamLimit: number | null) => ({ teamLimit });

describe("Quest Timeline Controller", () => {
  it("accepts a new counter and clears mismatched Unlimited Swaps prefight", () => {
    expect(decideQuestTimelineCounterSelection({
      quest: quest(null),
      encounterId: "enc_1",
      rosterId: "r2",
      roster: [rosterEntry("r1", 1, 7), rosterEntry("r2", 2, 7)],
      selections: { enc_1: "r1" },
      prefightSelections: { enc_1: "r1" },
      activeQuestAssignments: [{
        questEncounterId: "enc_1",
        selectedChampionId: 1,
        selectedChampionStars: 7,
        prefightChampionId: 1,
        prefightChampionStars: 7,
      }],
      activeSynergyChampions: [],
    })).toEqual({
      kind: "accepted",
      previousRosterId: "r1",
      previousPrefightRosterId: "r1",
      nextRosterId: "r2",
      nextChampionId: 2,
      nextChampionStars: 7,
      shouldClearPrefight: true,
    });
  });

  it("rejects duplicate champion rarity on another Unlimited Swaps fight", () => {
    expect(decideQuestTimelineCounterSelection({
      quest: quest(null),
      encounterId: "enc_2",
      rosterId: "r1",
      roster: [rosterEntry("r1", 1, 7)],
      selections: {},
      prefightSelections: {},
      activeQuestAssignments: [{
        questEncounterId: "enc_1",
        selectedChampionId: 1,
        selectedChampionStars: 7,
      }],
      activeSynergyChampions: [],
    })).toEqual({
      kind: "rejected",
      title: "Invalid Counter",
      description: "This champion rarity is already used on this quest route.",
    });
  });

  it("rejects team-limited prefight when it matches the counter champion", () => {
    expect(decideQuestTimelinePrefightSelection({
      quest: quest(5),
      encounterId: "enc_1",
      rosterId: "r1",
      roster: [rosterEntry("r1", 1, 7)],
      selections: { enc_1: "r1" },
      prefightSelections: {},
      activeQuestAssignments: [{
        questEncounterId: "enc_1",
        selectedChampionId: 1,
      }],
      activeSynergyChampions: [],
    })).toEqual({
      kind: "rejected",
      title: "Invalid Prefight",
      description: "Counter and prefight champion must be different for the same fight.",
    });
  });

  it("toggles an existing prefight off", () => {
    expect(decideQuestTimelinePrefightSelection({
      quest: quest(5),
      encounterId: "enc_1",
      rosterId: "r2",
      roster: [rosterEntry("r2", 2, 7)],
      selections: {},
      prefightSelections: { enc_1: "r2" },
      activeQuestAssignments: [{
        questEncounterId: "enc_1",
        prefightChampionId: 2,
      }],
      activeSynergyChampions: [],
    })).toEqual({
      kind: "accepted",
      previousRosterId: "r2",
      nextRosterId: null,
      nextChampionId: null,
      nextChampionStars: null,
    });
  });

  it("clamps revive counts and prepares rollback state", () => {
    expect(decideQuestTimelineRevives({
      readOnly: false,
      encounterId: "enc_1",
      revivesUsed: 120,
      revivesByEncounterId: { enc_1: 2, enc_2: 4 },
    })).toEqual({
      kind: "accepted",
      previousRevives: 2,
      nextRevives: 99,
      nextRevivesByEncounterId: { enc_1: 99, enc_2: 4 },
      rollbackRevivesByEncounterId: { enc_1: 2, enc_2: 4 },
    });

    expect(decideQuestTimelineRevives({
      readOnly: false,
      encounterId: "enc_1",
      revivesUsed: 0,
      revivesByEncounterId: { enc_1: 2 },
    })).toEqual({
      kind: "accepted",
      previousRevives: 2,
      nextRevives: 0,
      nextRevivesByEncounterId: {},
      rollbackRevivesByEncounterId: { enc_1: 2 },
    });
  });

  it("ignores unchanged or read-only revive updates", () => {
    expect(decideQuestTimelineRevives({
      readOnly: true,
      encounterId: "enc_1",
      revivesUsed: 5,
      revivesByEncounterId: {},
    })).toEqual({ kind: "ignored" });

    expect(decideQuestTimelineRevives({
      readOnly: false,
      encounterId: "enc_1",
      revivesUsed: 3,
      revivesByEncounterId: { enc_1: 3 },
    })).toEqual({ kind: "ignored" });
  });

  it("accepts synergy toggles and preserves rollback ids", () => {
    expect(decideQuestTimelineSynergy({
      quest: quest(5),
      championId: 3,
      synergyIds: [1, 2],
      activeQuestAssignments: [],
      activeSynergyChampions: [{ championId: 1 }, { championId: 2 }],
    })).toEqual({
      kind: "accepted",
      isRemoving: false,
      nextSynergyIds: [1, 2, 3],
      rollbackSynergyIds: [1, 2],
    });

    expect(decideQuestTimelineSynergy({
      quest: quest(5),
      championId: 2,
      synergyIds: [1, 2],
      activeQuestAssignments: [],
      activeSynergyChampions: [{ championId: 1 }, { championId: 2 }],
    })).toEqual({
      kind: "accepted",
      isRemoving: true,
      nextSynergyIds: [1],
      rollbackSynergyIds: [1, 2],
    });
  });

  it("rejects adding synergy when the team limit is reached", () => {
    expect(decideQuestTimelineSynergy({
      quest: quest(1),
      championId: 2,
      synergyIds: [],
      activeQuestAssignments: [{ questEncounterId: "enc_1", selectedChampionId: 1 }],
      activeSynergyChampions: [],
    })).toEqual({
      kind: "rejected",
      title: "Team Limit Reached",
      description: "You can only select up to 1 champions for this quest.",
    });
  });

  it("decides whether team member removal needs confirmation", () => {
    const selectedTeamMembers = [{
      rosterEntry: { id: "r1", championId: 1 },
      assignedEncounters: [{ id: "enc_1" }, { id: "enc_2" }],
      prefightEncounters: [{ id: "enc_3" }],
    }];

    expect(decideQuestTimelineTeamMemberRemoval({
      rosterId: "r1",
      championId: 1,
      championName: "Champion 1",
      teamLimit: null,
      selectedTeamMembers,
      synergyIds: [1],
    })).toEqual({
      kind: "confirm",
      target: {
        rosterId: "r1",
        championId: 1,
        championName: "Champion 1",
        assignedEncounters: ["enc_1", "enc_2"],
        assignedPrefights: ["enc_3"],
        isSynergy: true,
      },
    });

    expect(decideQuestTimelineTeamMemberRemoval({
      rosterId: "other-roster-row",
      championId: 1,
      championName: "Champion 1",
      teamLimit: 5,
      selectedTeamMembers,
      synergyIds: [],
    })).toEqual({
      kind: "confirm",
      target: {
        rosterId: "other-roster-row",
        championId: 1,
        championName: "Champion 1",
        assignedEncounters: ["enc_1", "enc_2"],
        assignedPrefights: ["enc_3"],
        isSynergy: false,
      },
    });
  });

  it("applies team member removal state after remote operations succeed", () => {
    expect(applyQuestTimelineTeamMemberRemoval({
      target: {
        rosterId: "r1",
        championId: 1,
        assignedEncounters: ["enc_1"],
        assignedPrefights: ["enc_2"],
        isSynergy: true,
      },
      selections: { enc_1: "r1", untouched: "r2" },
      prefightSelections: { enc_2: "r1" },
      synergyIds: [1, 2],
    })).toEqual({
      selections: { enc_1: null, untouched: "r2" },
      prefightSelections: { enc_2: null },
      synergyIds: [2],
    });
  });

  it("clears counter and prefight selections while preserving other local state elsewhere", () => {
    expect(clearQuestTimelinePlanSelections()).toEqual({
      selections: {},
      prefightSelections: {},
    });
  });
});
