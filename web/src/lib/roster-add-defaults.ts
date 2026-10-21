import { getMaxRank } from "./championHelper";

const STORAGE_KEY = "cerebro:roster-add-defaults";
export const ROSTER_ADD_STARS = [4, 5, 6, 7];

export interface RosterAddDefaults {
  stars: number;
  rank: number;
}

export function normalizeRosterAddDefaults(input: unknown): RosterAddDefaults {
  const value = typeof input === "object" && input !== null ? input : {};
  const stars = "stars" in value && typeof value.stars === "number" && ROSTER_ADD_STARS.includes(value.stars) ? value.stars : 6;
  const rank = "rank" in value && typeof value.rank === "number" && Number.isInteger(value.rank) ? value.rank : 1;
  return { stars, rank: Math.max(1, Math.min(rank, getMaxRank(stars))) };
}

export function loadRosterAddDefaults(fallback: RosterAddDefaults = { stars: 6, rank: 1 }): RosterAddDefaults {
  try {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) return normalizeRosterAddDefaults(JSON.parse(stored) as unknown);
    }
  } catch {
    // Optional browser preferences must not prevent manual roster entry.
  }
  return normalizeRosterAddDefaults(fallback);
}

export function saveRosterAddDefaults(defaults: RosterAddDefaults): void {
  try {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeRosterAddDefaults(defaults)));
    }
  } catch {
    // Keep the current form usable when browser storage is unavailable or full.
  }
}
