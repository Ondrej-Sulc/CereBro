import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";

// Cache for 1 hour
const CACHE_TTL = 3600;

export async function getCachedChampions() {
  return await getFromCache("all-champions-full", CACHE_TTL, async () => {
    return await prisma.champion.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        images: true,
        class: true,
        shortName: true,
        releaseDate: true,
        obtainable: true,
        prestige: true,
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
  });
}
