import { PlayerStats } from "./types";

export type PlayerSortKey = "rating" | "efficiency" | "fights" | "deaths";
export type PlayerSortOrder = "asc" | "desc";

export interface PlayerSortState {
  key: PlayerSortKey;
  order: PlayerSortOrder;
}

export const DEFAULT_PLAYER_SORT: PlayerSortState = {
  key: "rating",
  order: "desc",
};

export const PLAYER_SORT_LABELS: Record<PlayerSortKey, string> = {
  rating: "Rating",
  efficiency: "Efficiency",
  fights: "Fights",
  deaths: "Deaths",
};

export function getPlayerSoloRate(player: Pick<PlayerStats, "fights" | "deaths">): number {
  if (player.fights <= 0) return 0;
  return Math.max(0, (player.fights - player.deaths) / player.fights);
}

function compareNumber(a: number, b: number, order: PlayerSortOrder): number {
  return order === "asc" ? a - b : b - a;
}

function compareName(a: PlayerStats, b: PlayerStats): number {
  return a.playerName.localeCompare(b.playerName);
}

function compareBySortKey(a: PlayerStats, b: PlayerStats, sort: PlayerSortState): number {
  switch (sort.key) {
    case "rating":
      return compareNumber(a.normalizedRating, b.normalizedRating, sort.order);
    case "efficiency":
      return compareNumber(getPlayerSoloRate(a), getPlayerSoloRate(b), sort.order);
    case "fights":
      return compareNumber(a.fights, b.fights, sort.order);
    case "deaths":
      return compareNumber(a.deaths, b.deaths, sort.order);
  }
}

function compareTieBreakers(a: PlayerStats, b: PlayerStats, sort: PlayerSortState): number {
  if (sort.key !== "fights" && a.fights !== b.fights) {
    return b.fights - a.fights;
  }

  if (sort.key !== "deaths" && a.deaths !== b.deaths) {
    return a.deaths - b.deaths;
  }

  if (sort.key !== "rating" && a.normalizedRating !== b.normalizedRating) {
    return b.normalizedRating - a.normalizedRating;
  }

  return compareName(a, b);
}

export function comparePlayersBySort(a: PlayerStats, b: PlayerStats, sort: PlayerSortState): number {
  const primary = compareBySortKey(a, b, sort);
  if (primary !== 0) return primary;

  return compareTieBreakers(a, b, sort);
}

export function sortPlayers(players: PlayerStats[], sort: PlayerSortState): PlayerStats[] {
  return [...players].sort((a, b) => comparePlayersBySort(a, b, sort));
}

export function togglePlayerSort(
  current: PlayerSortState,
  key: PlayerSortKey
): PlayerSortState {
  if (current.key === key) {
    return {
      key,
      order: current.order === "asc" ? "desc" : "asc",
    };
  }

  return {
    key,
    order: key === "deaths" ? "asc" : "desc",
  };
}
