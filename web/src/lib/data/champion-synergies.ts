import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"

export const getChampionSynergies = unstable_cache(
  async (championId: number) => prisma.gameSynergy.findMany({
    where: { enabled: true, members: { some: { championId } } },
    select: {
      id: true, name: true, description: true, enabled: true, unique: true, requiredHeroGroups: true,
      members: { select: {
        role: true, rarity: true,
        champion: { select: { id: true, name: true, shortName: true, class: true, slug: true, images: true } },
      } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  }),
  ["champion-game-synergies-class-v1"],
  { revalidate: 3600, tags: ["champion-details"] }
)
