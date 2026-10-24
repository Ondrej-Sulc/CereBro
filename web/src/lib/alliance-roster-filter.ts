import type { AllianceRosterEntry } from "@/app/actions/alliance-roster";
import { createOwnedRosterFilterIndex, filterRosterWithFacets, type RosterFiltersState } from "./roster-filtering";
import { prepareRosterKit } from "./roster-kit";
import { rosterKitOptions } from "./roster-kit-options";

export type AllianceBattlegroupFilter = "ALL" | "1" | "2" | "3" | "UNASSIGNED";

export function createAllianceRosterFilters(): RosterFiltersState {
  return { search: "", classes: [], stars: [], ranks: [], ascension: [], tags: [], tagLogic: "AND", showUnowned: false,
    abilities: [], categories: [], immunities: [], abilityLogic: "AND", categoryLogic: "OR", immunityLogic: "AND",
    effectForms: [], effectDirections: [], includeResistances: true, minResistancePotency: null };
}

export function createAllianceRosterFilterIndex(entries: AllianceRosterEntry[]) {
  return createOwnedRosterFilterIndex(entries);
}

export function allianceRosterOptions(entries: AllianceRosterEntry[]) {
  const champions = [...new Map(entries.map(entry => [entry.championId, entry.champion])).values()];
  const links = champions.flatMap(champion => champion.abilities);
  const options = (names: string[]) => [...new Set(names)].sort((a, b) => a.localeCompare(b)).map(name => ({ id: name, name }));
  return {
    ...rosterKitOptions(links),
    tags: options(champions.flatMap(champion => champion.tags.map(tag => tag.name))),
    categories: options(prepareRosterKit(links).abilities.flatMap(ability => ability.categories)),
  };
}

/** Scope the shared index before faceting; per-player caps affect display only. */
export function filterAllianceRosterWithFacets(index: ReturnType<typeof createAllianceRosterFilterIndex>, filters: RosterFiltersState,
  battlegroup: AllianceBattlegroupFilter, limit: number | null) {
  const scoped = { base: (stars: number[], showUnowned: boolean) => index.base(stars, showUnowned).filter(({ entry }) =>
    battlegroup === "ALL" || (battlegroup === "UNASSIGNED" ? entry.battlegroup === null : entry.battlegroup === Number(battlegroup))) };
  const result = filterRosterWithFacets(scoped, { ...filters, showUnowned: false });
  const championsByPlayer = new Map<string, AllianceRosterEntry[]>();
  const matchingByPlayer = new Map<string, number>();
  for (const entry of [...result.entries].sort((a, b) => b.stars - a.stars || b.rank - a.rank || a.champion.name.localeCompare(b.champion.name))) {
    matchingByPlayer.set(entry.playerId, (matchingByPlayer.get(entry.playerId) ?? 0) + 1);
    const champions = championsByPlayer.get(entry.playerId) ?? [];
    if (limit === null || champions.length < limit) champions.push(entry);
    championsByPlayer.set(entry.playerId, champions);
  }
  return { ...result, championsByPlayer, matchingByPlayer };
}
