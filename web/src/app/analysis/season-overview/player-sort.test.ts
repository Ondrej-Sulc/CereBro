import { describe, expect, it } from "vitest";
import { PlayerStats } from "./types";
import { sortPlayers } from "./player-sort";

function player(overrides: Partial<PlayerStats>): PlayerStats {
  return {
    playerId: overrides.playerId ?? overrides.playerName ?? "player",
    playerName: overrides.playerName ?? "Player",
    avatar: null,
    fights: 0,
    deaths: 0,
    pathFights: 0,
    pathDeaths: 0,
    miniBossFights: 0,
    miniBossDeaths: 0,
    bossFights: 0,
    bossDeaths: 0,
    battlegroup: 1,
    warStats: [],
    rating: 0,
    ratingPerFight: 0,
    normalizedRating: 0,
    grade: "C",
    ratingBreakdown: {
      baseFightScore: 0,
      soloBonus: 0,
      totalRating: 0,
      ratingPerFight: 0,
    },
    ...overrides,
  };
}

describe("season overview player sorting", () => {
  it("sorts by rating with fights, deaths, and name as tie breakers", () => {
    const result = sortPlayers(
      [
        player({ playerName: "Bravo", fights: 6, deaths: 0, normalizedRating: 90 }),
        player({ playerName: "Alpha", fights: 8, deaths: 1, normalizedRating: 90 }),
        player({ playerName: "Charlie", fights: 8, deaths: 0, normalizedRating: 80 }),
      ],
      { key: "rating", order: "desc" }
    );

    expect(result.map((p) => p.playerName)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("sorts deathless players first when ordering by deaths", () => {
    const result = sortPlayers(
      [
        player({ playerName: "Two Deaths", fights: 12, deaths: 2, normalizedRating: 99 }),
        player({ playerName: "Deathless Low Volume", fights: 8, deaths: 0, normalizedRating: 70 }),
        player({ playerName: "Deathless High Volume", fights: 10, deaths: 0, normalizedRating: 65 }),
      ],
      { key: "deaths", order: "asc" }
    );

    expect(result.map((p) => p.playerName)).toEqual([
      "Deathless High Volume",
      "Deathless Low Volume",
      "Two Deaths",
    ]);
  });

  it("sorts efficiency by solo rate before fight volume", () => {
    const result = sortPlayers(
      [
        player({ playerName: "Ninety Percent", fights: 10, deaths: 1, normalizedRating: 90 }),
        player({ playerName: "Perfect Low Volume", fights: 6, deaths: 0, normalizedRating: 70 }),
        player({ playerName: "Perfect High Volume", fights: 9, deaths: 0, normalizedRating: 60 }),
      ],
      { key: "efficiency", order: "desc" }
    );

    expect(result.map((p) => p.playerName)).toEqual([
      "Perfect High Volume",
      "Perfect Low Volume",
      "Ninety Percent",
    ]);
  });

  it("uses player name as the final deterministic tie breaker", () => {
    const result = sortPlayers(
      [
        player({ playerName: "Charlie", fights: 10, deaths: 0, normalizedRating: 90 }),
        player({ playerName: "Alpha", fights: 10, deaths: 0, normalizedRating: 90 }),
        player({ playerName: "Bravo", fights: 10, deaths: 0, normalizedRating: 90 }),
      ],
      { key: "rating", order: "desc" }
    );

    expect(result.map((p) => p.playerName)).toEqual(["Alpha", "Bravo", "Charlie"]);
  });
});
