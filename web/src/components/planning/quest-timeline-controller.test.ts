import { describe, expect, it } from "vitest";
import {
  decideQuestTimelineCounterSelection,
  decideQuestTimelinePrefightSelection,
} from "./quest-timeline-controller";

const champion = (id: number) => ({
  id,
  name: `Champion ${id}`,
  shortName: `C${id}`,
  class: "SCIENCE" as const,
  images: {},
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
});
