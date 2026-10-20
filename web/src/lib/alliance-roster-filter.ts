import type { ChampionClass } from "@prisma/client";
import { matchesRosterAscensionFilter, type RosterAscensionState } from "./roster-ascension-filter";

interface AllianceRosterFilterEntry extends RosterAscensionState {
  championClass: ChampionClass;
  stars: number;
  rank: number;
}

interface AllianceRosterFilters {
  classes: ChampionClass[];
  stars: string;
  ranks: string[];
  ascensionLevels: number[];
}

export function matchesAllianceRosterFilters(entry: AllianceRosterFilterEntry, filters: AllianceRosterFilters): boolean {
  if (filters.classes.length > 0 && !filters.classes.includes(entry.championClass)) return false;
  if (filters.stars !== "ALL" && entry.stars !== Number(filters.stars)) return false;
  if (filters.ranks.length > 0 && !filters.ranks.includes(String(entry.rank))) return false;
  return matchesRosterAscensionFilter(entry, filters.ascensionLevels);
}
