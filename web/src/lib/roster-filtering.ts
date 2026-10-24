import type { ChampionClass } from "@prisma/client";
import { EFFECT_FORMS, EFFECT_DIRECTIONS } from "@cerebro/core/domain/ability-source";
import type { Champion } from "@/types/champion";
import type { ProfileRosterEntry } from "@/app/profile/roster/types";
import { isChampionObtainableAs } from "./champion-obtainable";
import { getRosterAscensionLevel } from "./roster-ascension-filter";
import { prepareRosterKit, matchesPreparedRosterKitFilters, type RosterKitFilters } from "./roster-kit";

export type FacetCounts = Readonly<Record<string, number>>;
export type RosterFacetCounts = Record<"stars" | "ranks" | "ascension" | "classes" | "tags" | "abilities" | "categories" | "immunities" | "forms" | "directions", FacetCounts>;

export type RosterFiltersState = RosterKitFilters & {
  search: string;
  classes: ChampionClass[];
  stars: number[];
  ranks: number[];
  ascension: number[];
  tags: string[];
  tagLogic: "AND" | "OR";
  showUnowned: boolean;
};

function indexEntry(entry: ProfileRosterEntry) {
  const kit = prepareRosterKit(entry.champion.abilities ?? [], entry.stars || undefined);
  return {
    entry, kit,
    searchName: entry.champion.name.toLowerCase(),
    tags: new Set((entry.champion.tags ?? []).map(tag => tag.name)),
    abilities: new Set(kit.abilities.map(ability => ability.name)),
    categories: new Set(kit.abilities.flatMap(ability => ability.categories)),
    immunities: new Set(kit.protections.map(protection => protection.name)),
  };
}

/** Stable data preparation stays independent of search, sort and selected filters. */
export function createRosterFilterIndex(roster: ProfileRosterEntry[], champions: Champion[]) {
  const owned = roster.map(indexEntry);
  const ownedIds = new Set(roster.map(entry => entry.championId));
  const ownedStars = new Set(roster.map(entry => `${entry.championId}:${entry.stars}`));
  const unowned = champions.map(champion => indexEntry({
    id: `unowned-${champion.id}`, playerId: roster[0]?.playerId ?? "", championId: champion.id,
    stars: 0, rank: 0, sigLevel: 0, isAwakened: false, isAscended: false, ascensionLevel: 0,
    reservedForAttack: false, powerRating: 0, createdAt: new Date(), updatedAt: new Date(),
    champion: champion as unknown as ProfileRosterEntry["champion"], isUnowned: true,
  }));
  return {
    base(stars: number[], showUnowned: boolean) {
      if (!showUnowned) return owned;
      return [...owned, ...unowned.filter(({ entry }) => !stars.length
        ? !ownedIds.has(entry.championId)
        : stars.some(rarity => isChampionObtainableAs(entry.champion, rarity) && !ownedStars.has(`${entry.championId}:${rarity}`)))];
    },
  };
}

type IndexedEntry = ReturnType<typeof indexEntry>;
type BasicFacet = "classes" | "stars" | "ranks" | "ascension";

function matchesBasic(item: IndexedEntry, filters: RosterFiltersState, search: string, omit?: BasicFacet) {
  const entry = item.entry;
  return item.searchName.includes(search)
    && (omit === "classes" || !filters.classes.length || filters.classes.includes(entry.champion.class))
    && (omit === "stars" || !filters.stars.length || entry.isUnowned || filters.stars.includes(entry.stars))
    && (omit === "ranks" || !filters.ranks.length || entry.isUnowned || filters.ranks.includes(entry.rank))
    && (omit === "ascension" || !filters.ascension.length || filters.ascension.includes(getRosterAscensionLevel(entry)));
}

function matchesTags(item: IndexedEntry, filters: RosterFiltersState) {
  return !filters.tags.length || (filters.tagLogic === "AND"
    ? filters.tags.every(tag => item.tags.has(tag))
    : filters.tags.some(tag => item.tags.has(tag)));
}

/** Counts are per matching roster entry, just like the results (not per source application).
 * OR facets ignore their own selections; AND facets retain them and test each extra choice.
 * Every other facet, search term and source qualifier remains active.
 */
export function filterRosterWithFacets(index: ReturnType<typeof createRosterFilterIndex>, filters: RosterFiltersState) {
  const counts: RosterFacetCounts = {
    stars: Object.create(null), ranks: Object.create(null), ascension: Object.create(null), classes: Object.create(null),
    tags: Object.create(null), abilities: Object.create(null), categories: Object.create(null), immunities: Object.create(null),
    forms: Object.create(null), directions: Object.create(null),
  };
  const add = (facet: keyof RosterFacetCounts, value: string | number) => {
    const target = counts[facet] as Record<string, number>;
    target[value] = (target[value] ?? 0) + 1;
  };
  const search = filters.search.toLowerCase();
  const entries: ProfileRosterEntry[] = [];

  for (const item of index.base(filters.stars, filters.showUnowned)) {
    const basic = matchesBasic(item, filters, search);
    const tags = matchesTags(item, filters);
    const kit = matchesPreparedRosterKitFilters(item.kit, filters);
    if (basic && tags && kit) {
      entries.push(item.entry.isUnowned && filters.stars.length
        ? { ...item.entry, id: `${item.entry.id}-${filters.stars.join("-")}` }
        : item.entry);
    }

    if (tags && kit) {
      if (matchesBasic(item, filters, search, "classes")) add("classes", item.entry.champion.class);
      if (matchesBasic(item, filters, search, "ranks")) {
        for (const rank of [1, 2, 3, 4, 5, 6]) if (item.entry.isUnowned || item.entry.rank === rank) add("ranks", rank);
      }
      if (matchesBasic(item, filters, search, "ascension")) add("ascension", getRosterAscensionLevel(item.entry));
    }
    if (!basic) continue;
    if (kit && (filters.tagLogic === "OR" || tags)) for (const tag of item.tags) add("tags", tag);
    if (!tags) continue;

    for (const [facet, logic] of [
      ["abilities", filters.abilityLogic ?? "AND"],
      ["categories", filters.categoryLogic ?? "OR"],
      ["immunities", filters.immunityLogic ?? "AND"],
    ] as const) {
      for (const candidate of item[facet]) {
        const selected = logic === "AND" ? [...new Set([...filters[facet], candidate])] : [candidate];
        if (matchesPreparedRosterKitFilters(item.kit, { ...filters, [facet]: selected })) add(facet, candidate);
      }
    }
    for (const form of EFFECT_FORMS) {
      if (matchesPreparedRosterKitFilters(item.kit, { ...filters, effectForms: [form] })) add("forms", form);
    }
    for (const direction of EFFECT_DIRECTIONS) {
      if (matchesPreparedRosterKitFilters(item.kit, { ...filters, effectDirections: [direction] })) add("directions", direction);
    }
  }

  // Changing rarity also changes which missing owned rarities produce an unowned card.
  for (const rarity of [7, 6, 5]) {
    const candidate = { ...filters, stars: [rarity] };
    for (const item of index.base([rarity], filters.showUnowned)) {
      if (matchesBasic(item, candidate, search) && matchesTags(item, candidate) && matchesPreparedRosterKitFilters(item.kit, candidate)) add("stars", rarity);
    }
  }
  return { entries, counts };
}
