import { prisma } from "./prismaService";
import {
  Champion,
  Attack,
  Hit,
  ChampionAbilityLink,
  Ability,
  Tag,
  ChampionAbilitySynergy,
  Duel,
  ChampionAbilityCurve,
  ChampionStats,
} from "@prisma/client";
import { CHAMPION_EFFECT_INCLUDE, attachChampionSynergies } from "./championEffectService";
import type { ChampionEffectSource } from "../domain/champion-effects";
import type { ChampionSynergy } from "../domain/champion-synergies";
import { normalizeChampionName } from "../utils/championHelper";
import logger from "./loggerService";

export let championsByName = new Map<string, Champion>();
export let championList: Champion[] = [];
export let allChampionsByName = new Map<string, Champion>();
export let allChampionList: Champion[] = [];

export async function loadChampions() {
  const allChampions = await prisma.champion.findMany();
  allChampionList = allChampions;
  allChampionsByName = new Map(allChampions.map(c => [normalizeChampionName(c.name), c]));
  
  const playableChampions = allChampions.filter(c => c.isPlayable);
  championsByName = new Map(playableChampions.map(c => [normalizeChampionName(c.name), c]));
  championList = playableChampions;
  
  logger.info(`Loaded ${allChampions.length} champions total, ${playableChampions.length} playable champions into cache.`);
}

export async function getChampionByName(name: string) {
  return await prisma.champion.findUnique({ where: { name } });
}

export async function getChampionById(id: number) {
  return await prisma.champion.findUnique({ where: { id } });
}

// Define the expected type for an Attack with its related Hits.

// This is derived from the Prisma query include statement.

export type AttackWithHits = Attack & { hits: Hit[] };

// Define the expected type for a ChampionAbilityLink with its related Ability.

// This is derived from the Prisma query include statement.

export type ChampionAbilitySynergyWithChampion = ChampionAbilitySynergy & {
  champion: Champion;
};

export type ChampionAbilityLinkWithRelations = ChampionAbilityLink & Pick<ChampionEffectSource, "overviewSummary" | "resistances"> & {
  ability: Ability;
  synergyChampions: ChampionAbilitySynergyWithChampion[];
};

export type ChampionWithAllRelations = Champion & {
  attacks: AttackWithHits[];
  abilities: ChampionAbilityLinkWithRelations[];
  tags: Tag[];
  duels: Duel[];
  abilityTexts?: Array<{ id: number; championId: number; group: string; title: string | null; sortOrder: number; template: unknown }>;
  abilityCurves?: ChampionAbilityCurve[];
  stats?: Array<Pick<ChampionStats, "rarity" | "rank" | "challengeRating" | "attack" | "health" | "sigAbilityIds">>;
  gameSynergies?: ChampionSynergy[];
};

export async function getChampionDataById(
  id: number
): Promise<ChampionWithAllRelations | null> {
  const champion = await prisma.champion.findUnique({
    where: { id },
    include: {
      attacks: { include: { hits: true } },
      abilities: { include: CHAMPION_EFFECT_INCLUDE },
      abilityTexts: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      abilityCurves: true,
      stats: { orderBy: [{ rarity: "desc" }, { rank: "desc" }] },
      tags: true,
      duels: true,
    },
  });
  return champion ? (await attachChampionSynergies([champion]))[0] : null;
}

export async function getChampionData(
  championName: string
): Promise<ChampionWithAllRelations | null> {
  const champion = await prisma.champion.findFirst({
    where: { name: { equals: championName, mode: "insensitive" } },

    include: {
      attacks: { include: { hits: true } },
      abilities: { include: CHAMPION_EFFECT_INCLUDE },
      abilityTexts: { orderBy: [{ group: "asc" }, { sortOrder: "asc" }] },
      abilityCurves: true,
      stats: { orderBy: [{ rarity: "desc" }, { rank: "desc" }] },
      tags: true,
      duels: true,
    },
  });
  return champion ? (await attachChampionSynergies([champion]))[0] : null;
}

let _prestigeThresholdsCache: Map<string, number> | null = null;

export async function getMinPrestigeThresholds() {
  if (_prestigeThresholdsCache) {
    return _prestigeThresholdsCache;
  }

  const thresholds = await prisma.championPrestige.groupBy({
    by: ['rarity', 'rank'],
    where: {
      sig: 0,
      NOT: [
        { rarity: 1 }
      ]
    },
    _min: {
      prestige: true
    }
  });

  const thresholdMap = new Map<string, number>();
  thresholds.forEach(t => {
    if (t._min.prestige) {
      thresholdMap.set(`${t.rarity}-${t.rank}`, t._min.prestige);
    }
  });

  _prestigeThresholdsCache = thresholdMap;
  return thresholdMap;
}


