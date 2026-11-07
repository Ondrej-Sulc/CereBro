import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import { Champion } from "@/types/champion";
import { attachResistances, getResistanceIndex } from "./champion-resistances";
import { withChampionAscensionEligibility } from "../champion-ascension-payload";

// Cache for 1 hour
const CACHE_TTL = 3600;

const ABILITY_SELECT = {
  id: true,
  type: true,
  source: true,
  effectForm: true,
  effectDirection: true,
  ability: {
    select: {
      id: true,
      name: true,
      iconUrl: true,
      gameGlossaryTermId: true,
      description: true,
      gameGlossaryTerm: { select: { raw: true } },
      categories: { select: { name: true } },
    },
  },
  synergyChampions: {
    select: {
      champion: { select: { name: true, images: true } },
    },
  },
} as const;

export async function getCachedChampions(): Promise<Champion[]> {
  const champions = await getFromCache("all-champions-full-v8", CACHE_TTL, async () => {
    const champions = await prisma.champion.findMany({
      where: { isPlayable: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        gameId: true,
        name: true,
        slug: true,
        images: true,
        class: true,
        shortName: true,
        releaseDate: true,
        obtainable: true,
        discordEmoji: true,
        fullAbilities: true,
        isPlayable: true,
        createdAt: true,
        updatedAt: true,
        abilities: { select: ABILITY_SELECT },
        tags: { select: { id: true, name: true } },
      },
    });
    return champions.map(withChampionAscensionEligibility);
  });
  const resistanceIndex = await getResistanceIndex();
  return champions.map(champion => ({ ...champion, abilities: attachResistances(champion.abilities, resistanceIndex) })) as unknown as Champion[];
}

export async function getCachedAllChampions(): Promise<Champion[]> {
  const champions = await getFromCache("all-champions-full-total-v7", CACHE_TTL, async () => {
    const champions = await prisma.champion.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        gameId: true,
        name: true,
        slug: true,
        images: true,
        class: true,
        shortName: true,
        releaseDate: true,
        obtainable: true,
        discordEmoji: true,
        fullAbilities: true,
        isPlayable: true,
        createdAt: true,
        updatedAt: true,
        abilities: { select: ABILITY_SELECT },
        tags: { select: { id: true, name: true } },
      },
    });
    return champions.map(withChampionAscensionEligibility);
  });
  const resistanceIndex = await getResistanceIndex();
  return champions.map(champion => ({ ...champion, abilities: attachResistances(champion.abilities, resistanceIndex) })) as unknown as Champion[];
}
