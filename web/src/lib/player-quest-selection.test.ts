import { describe, expect, it } from "vitest";
import { ChampionClass } from "@prisma/client";
import {
  collectQuestTeamChampionIds,
  isChampionValidForEncounterOrQuest,
  questEncounterSelectionConflictReason,
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
});
