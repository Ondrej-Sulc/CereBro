import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import { Champion } from "@/types/champion";

// Cache for 1 hour
const CACHE_TTL = 3600;

const ABILITY_SELECT = {
  type: true,
  source: true,
  ability: {
    select: {
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
  return await getFromCache("all-champions-full-v3", CACHE_TTL, async () => {
    const champions = await prisma.champion.findMany({
      where: { isPlayable: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
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
    return champions as unknown as Champion[];
  });
}

export async function getCachedAllChampions(): Promise<Champion[]> {
  return await getFromCache("all-champions-full-total-v2", CACHE_TTL, async () => {
    const champions = await prisma.champion.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
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
    return champions as unknown as Champion[];
  });
}
