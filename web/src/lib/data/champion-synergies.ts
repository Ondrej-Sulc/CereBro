import { unstable_cache } from "next/cache"
import { prisma } from "@/lib/prisma"
import { getGameSynergyIcon } from "@cerebro/core/domain/synergy-icons"

export const getChampionSynergies = unstable_cache(
  async (championId: number) => {
    const rows = await prisma.gameSynergy.findMany({
    where: { enabled: true, members: { some: { championId } } },
    select: {
      id: true, name: true, description: true, enabled: true, unique: true, requiredHeroGroups: true,
      raw: true,
      members: { select: {
        role: true, rarity: true,
        champion: { select: { id: true, name: true, shortName: true, class: true, slug: true, images: true } },
      } },
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    })
    return rows.map(({ raw, ...row }) => ({ ...row, iconUrl: getGameSynergyIcon(row.id, raw) }))
  },
  ["champion-game-synergies-native-icons-v2"],
  { revalidate: 3600, tags: ["champion-details"] }
)
