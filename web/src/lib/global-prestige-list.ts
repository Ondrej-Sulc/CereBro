import { ChampionClass } from "@prisma/client";
import type { ChampionImages } from "@/types/champion";
import { isChampionObtainableAs } from "./champion-obtainable";
import {
  clampAscensionLevelForRarity,
  clampSigForRarity,
  createMcocPrestigeProjector,
} from "./mcoc-prestige";
import { isSagaChampionTag } from "./saga-champion-tag";

export type GlobalPrestigeOwnershipFilter = "all" | "owned" | "missing";

export type GlobalPrestigeListOptions = {
  rarity: number;
  rank: number;
  sig: number;
  ascensionLevel: number;
  classFilter: ChampionClass[];
  ownership: GlobalPrestigeOwnershipFilter;
  sagaOnly: boolean;
  search: string;
  limit: number;
};

export type GlobalPrestigeRosterOwnership = {
  rosterId: string;
  rank: number;
  sigLevel: number;
  ascensionLevel: number;
  currentPrestige: number;
};

export type GlobalPrestigeListEntry = {
  globalRank: number;
  championId: number;
  championName: string;
  championClass: ChampionClass;
  championImage: ChampionImages;
  championSlug: string | null;
  targetRarity: number;
  targetRank: number;
  targetSig: number;
  targetAscensionLevel: number;
  targetPrestige: number;
  isOwned: boolean;
  ownership: GlobalPrestigeRosterOwnership | null;
  ownedGapLabel: string;
};

export type GlobalPrestigeListResult = {
  options: GlobalPrestigeListOptions;
  entries: GlobalPrestigeListEntry[];
  totalMatching: number;
};

export type GlobalPrestigeChampion = {
  id: number;
  name: string;
  slug: string | null;
  class: ChampionClass;
  images: ChampionImages;
  obtainable: string[];
  isPlayable: boolean;
  tags: Array<{ name: string }>;
};

export type GlobalPrestigeRosterEntry = {
  id: string;
  championId: number;
  stars: number;
  rank: number;
  sigLevel?: number | null;
  ascensionLevel?: number | null;
};

export type GlobalPrestigeRow = {
  championId: number;
  rarity: number;
  rank: number;
  sig: number;
  prestige: number;
};

type GlobalPrestigeSearchParams =
  | URLSearchParams
  | Record<string, string | string[] | null | undefined>;

const VALID_RARITIES = [7, 6, 5] as const;
const VALID_LIMITS = [30, 50, 100] as const;
const DEFAULT_SIG = 200;
const DEFAULT_ASCENSION_LEVEL = 0;
const DEFAULT_LIMIT = 100;

export function buildGlobalPrestigeList({
  champions,
  roster,
  prestigeRows,
  options,
}: {
  champions: GlobalPrestigeChampion[];
  roster: GlobalPrestigeRosterEntry[];
  prestigeRows: GlobalPrestigeRow[];
  options: GlobalPrestigeListOptions;
}): GlobalPrestigeListResult {
  const normalizedOptions = normalizeGlobalPrestigeListOptionValues(options, options.rank);
  const projector = createMcocPrestigeProjector(prestigeRows);
  const rosterByChampionAtRarity = new Map(
    roster
      .filter(entry => entry.stars === normalizedOptions.rarity)
      .map(entry => [entry.championId, entry])
  );
  const search = normalizedOptions.search.trim().toLowerCase();

  const rankedEntries = champions
    .filter(champion => champion.isPlayable)
    .filter(champion => isChampionObtainableAs(champion, normalizedOptions.rarity))
    .filter(champion => normalizedOptions.classFilter.length === 0 || normalizedOptions.classFilter.includes(champion.class))
    .filter(champion => !normalizedOptions.sagaOnly || champion.tags.some(isSagaChampionTag))
    .filter(champion => !search || champion.name.toLowerCase().includes(search))
    .map(champion => {
      const targetPrestige = projector.project({
        championId: champion.id,
        rarity: normalizedOptions.rarity,
        rank: normalizedOptions.rank,
        sigLevel: normalizedOptions.sig,
        ascensionLevel: normalizedOptions.ascensionLevel,
      });
      if (targetPrestige <= 0) return null;

      const ownedRosterEntry = rosterByChampionAtRarity.get(champion.id) ?? null;
      const ownership = ownedRosterEntry
        ? {
            rosterId: ownedRosterEntry.id,
            rank: ownedRosterEntry.rank,
            sigLevel: ownedRosterEntry.sigLevel ?? 0,
            ascensionLevel: ownedRosterEntry.ascensionLevel ?? 0,
            currentPrestige: projector.project({
              championId: ownedRosterEntry.championId,
              rarity: ownedRosterEntry.stars,
              rank: ownedRosterEntry.rank,
              sigLevel: ownedRosterEntry.sigLevel ?? 0,
              ascensionLevel: ownedRosterEntry.ascensionLevel ?? 0,
            }),
          }
        : null;

      return {
        globalRank: 0,
        championId: champion.id,
        championName: champion.name,
        championClass: champion.class,
        championImage: champion.images,
        championSlug: champion.slug,
        targetRarity: normalizedOptions.rarity,
        targetRank: normalizedOptions.rank,
        targetSig: normalizedOptions.sig,
        targetAscensionLevel: normalizedOptions.ascensionLevel,
        targetPrestige,
        isOwned: ownership !== null,
        ownership,
        ownedGapLabel: ownership
          ? `Owned R${ownership.rank} S${ownership.sigLevel} A${ownership.ascensionLevel}`
          : `Missing ${normalizedOptions.rarity}\u2605`,
      } satisfies GlobalPrestigeListEntry;
    })
    .filter((entry): entry is GlobalPrestigeListEntry => entry !== null)
    .sort((a, b) => b.targetPrestige - a.targetPrestige || a.championName.localeCompare(b.championName))
    .map((entry, index) => ({ ...entry, globalRank: index + 1 }));

  const ownershipFilteredEntries = rankedEntries.filter(entry => {
    if (normalizedOptions.ownership === "owned") return entry.isOwned;
    if (normalizedOptions.ownership === "missing") return !entry.isOwned;
    return true;
  });

  return {
    options: normalizedOptions,
    entries: ownershipFilteredEntries.slice(0, normalizedOptions.limit),
    totalMatching: ownershipFilteredEntries.length,
  };
}

export function normalizeGlobalPrestigeListOptions(
  searchParams: GlobalPrestigeSearchParams,
  defaults: { targetRank: number },
  source: "url" | "api" = "url"
): GlobalPrestigeListOptions {
  const key = globalPrestigeParamKey(source);
  const requestedRarity = readNumberParam(searchParams, key.rarity, 7);
  const rarity = VALID_RARITIES.includes(requestedRarity as typeof VALID_RARITIES[number])
    ? requestedRarity
    : 7;
  return normalizeGlobalPrestigeListOptionValues({
    rarity,
    rank: readNumberParam(searchParams, key.rank, defaultGlobalPrestigeRank(rarity, defaults.targetRank)),
    sig: readNumberParam(searchParams, key.sig, DEFAULT_SIG),
    ascensionLevel: readNumberParam(searchParams, key.ascensionLevel, DEFAULT_ASCENSION_LEVEL),
    classFilter: readClassListParam(searchParams, key.classFilter),
    ownership: readOwnershipParam(searchParams, key.ownership),
    sagaOnly: readBooleanParam(searchParams, key.sagaOnly),
    search: (readParam(searchParams, key.search) ?? "").trim(),
    limit: readNumberParam(searchParams, key.limit, DEFAULT_LIMIT),
  }, defaults.targetRank);
}

export function normalizeGlobalPrestigeListOptionValues(
  options: GlobalPrestigeListOptions,
  defaultTargetRank: number
): GlobalPrestigeListOptions {
  const rarity = VALID_RARITIES.includes(options.rarity as typeof VALID_RARITIES[number])
    ? options.rarity
    : 7;
  const maxRank = maxRankForGlobalPrestigeRarity(rarity);
  const defaultRank = defaultGlobalPrestigeRank(rarity, defaultTargetRank);
  const rank = Math.min(Math.max(Math.round(options.rank || defaultRank), 1), maxRank);
  const sig = clampSigForRarity(options.sig, rarity);
  const ascensionLevel = clampAscensionLevelForRarity(options.ascensionLevel, rarity);
  const validClasses = Object.values(ChampionClass);
  const classFilter = options.classFilter.filter((value): value is ChampionClass => validClasses.includes(value));
  const ownership = options.ownership === "owned" || options.ownership === "missing" ? options.ownership : "all";
  const limit = VALID_LIMITS.includes(options.limit as typeof VALID_LIMITS[number]) ? options.limit : DEFAULT_LIMIT;

  return {
    rarity,
    rank,
    sig,
    ascensionLevel,
    classFilter,
    ownership,
    sagaOnly: Boolean(options.sagaOnly),
    search: options.search.trim(),
    limit,
  };
}

export function defaultGlobalPrestigeRank(rarity: number, targetRank: number) {
  if (rarity === 7) return Math.min(Math.max(Math.round(targetRank || 1), 1), 6);
  return 5;
}

export function maxRankForGlobalPrestigeRarity(rarity: number) {
  return rarity === 7 ? 6 : 5;
}

function globalPrestigeParamKey(source: "url" | "api") {
  if (source === "api") {
    return {
      rarity: "rarity",
      rank: "rank",
      sig: "sig",
      ascensionLevel: "ascensionLevel",
      classFilter: "classFilter",
      ownership: "ownership",
      sagaOnly: "saga",
      search: "search",
      limit: "limit",
    };
  }

  return {
    rarity: "globalRarity",
    rank: "globalRank",
    sig: "globalSig",
    ascensionLevel: "globalAscension",
    classFilter: "globalClassFilter",
    ownership: "globalOwnership",
    sagaOnly: "globalSaga",
    search: "globalSearch",
    limit: "globalLimit",
  };
}

function readNumberParam(searchParams: GlobalPrestigeSearchParams, key: string, fallback: number) {
  const value = readParam(searchParams, key);
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanParam(searchParams: GlobalPrestigeSearchParams, key: string) {
  return readParam(searchParams, key) === "true";
}

function readClassListParam(searchParams: GlobalPrestigeSearchParams, key: string) {
  const validClasses = Object.values(ChampionClass);
  return (readParam(searchParams, key) ?? "")
    .split(",")
    .filter((value): value is ChampionClass => validClasses.includes(value as ChampionClass));
}

function readOwnershipParam(searchParams: GlobalPrestigeSearchParams, key: string): GlobalPrestigeOwnershipFilter {
  const value = readParam(searchParams, key);
  if (value === "owned" || value === "missing") return value;
  return "all";
}

function readParam(searchParams: GlobalPrestigeSearchParams, key: string) {
  if (searchParams instanceof URLSearchParams) return searchParams.get(key);
  const value = searchParams[key];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}
