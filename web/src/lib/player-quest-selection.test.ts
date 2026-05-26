import { describe, expect, it } from "vitest";
import { ChampionClass } from "@prisma/client";
import {
  collectQuestTeamChampionIds,
  isQuestRosterEntryUnavailableForEncounter,
  isChampionValidForEncounterOrQuest,
  questEncounterSelectionConflictReason,
  unlimitedSwapsSelectionConflictReason,
  validateOwnedChampionForQuestSelection,
  wouldExceedQuestTeamLimit,
  type QuestSelectionChampion,
  type QuestSelectionRosterEntry,
} from "./player-quest-selection";

const scienceChampion: QuestSelectionChampion = {
  id: 1,
  class: ChampionClass.SCIENCE,
  tags: [{ id: 10, name: "#Saga Champions" }],
  obtainable: ["5*", "6*", "7*"],
};

function rosterEntry(overrides: Partial<QuestSelectionRosterEntry> = {}): QuestSelectionRosterEntry {
  return {
    id: "r1",
    championId: scienceChampion.id,
    stars: 6,
    rank: 4,
    champion: scienceChampion,
    ...overrides,
  };
}

describe("Player Quest Selection", () => {
  it("matches quest and fight restrictions through one rule surface", () => {
    expect(isChampionValidForEncounterOrQuest(
      rosterEntry(),
      {
        minStarLevel: 6,
        requiredClasses: [ChampionClass.SCIENCE],
        requiredTags: [{ id: 10, name: "#Saga Champions" }],
      },
      { maxStarLevel: 6 }
    )).toBe(true);

    expect(isChampionValidForEncounterOrQuest(
      rosterEntry({ stars: 5 }),
      { minStarLevel: 6 },
      undefined
    )).toBe(false);
  });

  it("uses obtainable star levels for unowned roster placeholders", () => {
    expect(isChampionValidForEncounterOrQuest(
      rosterEntry({ id: "unowned-1", stars: 0, isUnowned: true }),
      { minStarLevel: 7, maxStarLevel: 7 },
      undefined
    )).toBe(true);

    expect(isChampionValidForEncounterOrQuest(
      rosterEntry({ id: "unowned-1", stars: 0, isUnowned: true }),
      { minStarLevel: 4, maxStarLevel: 4 },
      undefined
    )).toBe(false);
  });

  it("selects any owned rarity that satisfies restrictions instead of only the highest rarity", () => {
    const result = validateOwnedChampionForQuestSelection({
      champion: scienceChampion,
      rosterEntries: [
        { id: "seven", championId: 1, stars: 7, rank: 1 },
        { id: "five", championId: 1, stars: 5, rank: 5 },
      ],
      quest: { maxStarLevel: 5 },
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.rosterEntry.id).toBe("five");
    }
  });

  it("reports counter and prefight conflicts consistently", () => {
    expect(questEncounterSelectionConflictReason({
      field: "selectedChampionId",
      candidateChampionId: 1,
      prefightChampionId: 1,
    })).toMatch(/different/);

    expect(questEncounterSelectionConflictReason({
      field: "prefightChampionId",
      candidateChampionId: 2,
      selectedChampionId: 1,
    })).toBeNull();
  });

  it("simulates team limit replacements across counters, prefights, and synergies", () => {
    const encounters = [
      { questEncounterId: "e1", selectedChampionId: 1, prefightChampionId: null },
      { questEncounterId: "e2", selectedChampionId: null, prefightChampionId: 2 },
    ];
    const synergyChampions = [{ championId: 3 }];

    expect(Array.from(collectQuestTeamChampionIds({ encounters, synergyChampions })).sort()).toEqual([1, 2, 3]);
    expect(wouldExceedQuestTeamLimit({
      teamLimit: 3,
      encounters,
      synergyChampions,
      replacement: { field: "selectedChampionId", questEncounterId: "e3", championId: 4 },
    })).toBe(true);
    expect(wouldExceedQuestTeamLimit({
      teamLimit: 3,
      encounters,
      synergyChampions,
      replacement: { field: "prefightChampionId", questEncounterId: "e2", championId: 1 },
    })).toBe(false);
    expect(wouldExceedQuestTeamLimit({
      teamLimit: 3,
      encounters,
      synergyChampions,
      replacement: { field: "synergyChampionId", championId: 2 },
    })).toBe(false);
  });

  it("applies objective restrictions with ANY tag matching and star ranges", () => {
    const godChampion = rosterEntry({
      champion: {
        ...scienceChampion,
        tags: [{ id: 20, name: "God" }],
      },
    });
    const deathlessSixStar = rosterEntry({
      stars: 6,
      champion: {
        ...scienceChampion,
        tags: [{ id: 30, name: "Deathless" }],
      },
    });

    expect(isChampionValidForEncounterOrQuest(
      godChampion,
      {
        objective: {
          requiredTags: [{ id: 20, name: "God" }, { id: 21, name: "Cul's Worthy" }],
          requiredTagMode: "ANY",
        },
      }
    )).toBe(true);

    expect(isChampionValidForEncounterOrQuest(
      deathlessSixStar,
      {
        objective: {
          minStarLevel: 7,
          maxStarLevel: 7,
          requiredTags: [{ id: 30, name: "Deathless" }],
        },
      }
    )).toBe(false);
  });

  it("marks a champion rarity unavailable when already selected on an active Unlimited Swaps encounter", () => {
    const activeEncounterIds = new Set(["e1", "e2"]);
    const roster = [
      rosterEntry({ id: "r1" }),
      rosterEntry({ id: "r2" }),
      rosterEntry({ id: "r3", stars: 5 }),
    ];

    expect(isQuestRosterEntryUnavailableForEncounter({
      entry: roster[1],
      encounterId: "e2",
      selections: { e1: "r1", e2: null, inactive: "r2" },
      activeEncounterIds,
      roster,
      quest: { minStarLevel: 6, teamLimit: null },
      encounter: { id: "e2" },
    })).toBe(true);

    expect(isQuestRosterEntryUnavailableForEncounter({
      entry: roster[2],
      encounterId: "e2",
      selections: { e1: "r1", e2: null, e3: "r2" },
      activeEncounterIds: new Set(["e1", "e2", "e3"]),
      roster,
      quest: { minStarLevel: 6, teamLimit: null },
      encounter: { id: "e2" },
    })).toBe(false);
  });

  it("enforces Unlimited Swaps by champion rarity and prefight matching", () => {
    const encounters = [
      { questEncounterId: "e1", selectedChampionId: 1, selectedChampionStars: 6, prefightChampionId: null },
      { questEncounterId: "e2", selectedChampionId: 2, selectedChampionStars: 7, prefightChampionId: null },
    ];

    expect(unlimitedSwapsSelectionConflictReason({
      encounters,
      replacement: { field: "selectedChampionId", questEncounterId: "e2", championId: 1, championStars: 6 },
    })).toMatch(/already used/);

    expect(unlimitedSwapsSelectionConflictReason({
      encounters,
      replacement: { field: "selectedChampionId", questEncounterId: "e2", championId: 1, championStars: 7 },
    })).toBeNull();

    expect(unlimitedSwapsSelectionConflictReason({
      encounters,
      replacement: { field: "prefightChampionId", questEncounterId: "e2", championId: 2, championStars: 7 },
    })).toBeNull();

    expect(unlimitedSwapsSelectionConflictReason({
      encounters,
      replacement: { field: "prefightChampionId", questEncounterId: "e2", championId: 3, championStars: 7 },
    })).toMatch(/must match/);
  });
});
