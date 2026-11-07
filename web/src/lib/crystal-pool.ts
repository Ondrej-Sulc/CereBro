import type { ChampionClass } from "@prisma/client"
import type { CrystalChampion } from "./data/crystals"

export type CrystalPoolState = { q: string; rarity: string; championClass: string; page: number }
const normalize = (value: string) => value.normalize("NFKD").toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "")

/** The server and the loaded pool use the same filtering and cosmetic-star rules. */
export function filterCrystalPool(champions: CrystalChampion[], state: Pick<CrystalPoolState, "q" | "rarity" | "championClass">) {
  const query = normalize(state.q), rarity = Number(state.rarity)
  const matching = champions.filter(champion => (!rarity || champion.rarities.includes(rarity)) && (!query || normalize(champion.name).includes(query)))
  const classCounts: Partial<Record<ChampionClass, number>> = {}
  for (const champion of matching) if (champion.championClass) classCounts[champion.championClass] = (classCounts[champion.championClass] ?? 0) + 1
  const filtered = matching.filter(champion => state.championClass === "all" || champion.championClass === state.championClass).map(champion => {
    if (!rarity || !champion.firstEditionRarities?.length) return champion
    const firstEditionRarities = champion.firstEditionRarities.filter(value => value === rarity)
    return { ...champion, firstEditionRarities: firstEditionRarities.length ? firstEditionRarities : undefined }
  })
  return { champions: filtered, total: filtered.length, classCounts, matchingBeforeClass: matching.length }
}
