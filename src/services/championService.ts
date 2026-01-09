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
} from "@prisma/client";
import { normalizeChampionName } from "../utils/championHelper";
import logger from "./loggerService";

export let championsByName = new Map<string, Champion>();
export let championList: Champion[] = [];

export async function loadChampions() {
  const allChampions = await prisma.champion.findMany();
  championsByName = new Map(allChampions.map(c => [normalizeChampionName(c.name), c]));
  championList = allChampions;
  logger.info(`Loaded ${allChampions.length} champions into cache.`);
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

export type ChampionAbilityLinkWithRelations = ChampionAbilityLink & {
  ability: Ability;
  synergyChampions: ChampionAbilitySynergyWithChampion[];
};

export type ChampionWithAllRelations = Champion & {
  attacks: AttackWithHits[];
  abilities: ChampionAbilityLinkWithRelations[];
  tags: Tag[];
  duels: Duel[];
};

export async function getChampionDataById(
  id: number
): Promise<ChampionWithAllRelations | null> {
  return prisma.champion.findUnique({
    where: { id },
    include: {
      attacks: { include: { hits: true } },
      abilities: {
        include: {
          ability: true,
          synergyChampions: {
            include: {
              champion: true,
            },
          },
        },
      },
      tags: true,
      duels: true,
    },
  }) as Promise<ChampionWithAllRelations | null>;
}

export async function getChampionData(
  championName: string
): Promise<ChampionWithAllRelations | null> {
  return prisma.champion.findFirst({
    where: { name: { equals: championName, mode: "insensitive" } },

    include: {
      attacks: { include: { hits: true } },
      abilities: {
        include: {
          ability: true,
          synergyChampions: {
            include: {
              champion: true,
            },
          },
        },
      },
      tags: true,
      duels: true,
    },
  }) as Promise<ChampionWithAllRelations | null>;
}


