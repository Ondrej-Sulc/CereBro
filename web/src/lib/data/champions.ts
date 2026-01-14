import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import { Champion } from "@/types/champion";

// Cache for 1 hour
const CACHE_TTL = 3600;

export async function getCachedChampions(): Promise<Champion[]> {
  return await getFromCache("all-champions-full", CACHE_TTL, async () => {
    const champions = await prisma.champion.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        images: true,
        class: true,
        shortName: true,
        releaseDate: true,
        obtainable: true,
        discordEmoji: true,
        fullAbilities: true,
        createdAt: true,
        updatedAt: true,
        abilities: {
          select: {
            ability: {
              select: { name: true }
            }
          }
        },
        tags: {
          select: { name: true }
        }
      }
    });
    return champions as unknown as Champion[];
  });
}
