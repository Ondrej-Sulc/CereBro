import { describe, expect, it } from "vitest";
import { projectSavedQuestPlanRosterMap } from "./saved-quest-plan-projection";

describe("Saved Quest Plan Projection", () => {
  it("resolves saved counters and prefights by champion plus rarity", () => {
    const rosterMap = projectSavedQuestPlanRosterMap({
      playerId: "player-1",
      encounters: [{
        id: "saved-1",
        questEncounterId: "encounter-1",
        selectedChampionId: 1,
        selectedChampionStars: 6,
        selectedChampion: { id: 1 },
        prefightChampionId: 2,
        prefightChampionStars: 5,
        prefightChampion: { id: 2 },
      }],
      rosterEntries: [
        { id: "seven-star", championId: 1, stars: 7, rank: 1 },
        { id: "six-star", championId: 1, stars: 6, rank: 5 },
        { id: "five-star-prefight", championId: 2, stars: 5, rank: 4 },
      ],
    });

    expect(rosterMap["encounter-1"]).toMatchObject({ id: "six-star" });
    expect(rosterMap["prefight:encounter-1"]).toMatchObject({ id: "five-star-prefight" });
  });

  it("keeps old champion-only saved plans working by falling back to best roster order", () => {
    const rosterMap = projectSavedQuestPlanRosterMap({
      playerId: "player-1",
      encounters: [{
        id: "saved-1",
        questEncounterId: "encounter-1",
        selectedChampionId: 1,
        selectedChampion: { id: 1 },
        prefightChampionId: null,
      }],
      rosterEntries: [
        { id: "best-current", championId: 1, stars: 7, rank: 1 },
        { id: "old-rarity", championId: 1, stars: 6, rank: 5 },
      ],
    });

    expect(rosterMap["encounter-1"]).toMatchObject({ id: "best-current" });
  });

  it("uses saved rarity on fallback roster entries when the player no longer has that rarity", () => {
    const rosterMap = projectSavedQuestPlanRosterMap({
      playerId: "player-1",
      encounters: [{
        id: "saved-1",
        questEncounterId: "encounter-1",
        selectedChampionId: 1,
        selectedChampionStars: 6,
        selectedChampion: { id: 1 },
        prefightChampionId: null,
      }],
      rosterEntries: [{ id: "seven-star", championId: 1, stars: 7, rank: 1 }],
    });

    expect(rosterMap["encounter-1"]).toMatchObject({
      id: "fallback-saved-1",
      championId: 1,
      stars: 6,
      rank: 0,
    });
  });
});
