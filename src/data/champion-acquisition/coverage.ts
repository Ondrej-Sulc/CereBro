import { getChampionCrystals } from "../game-crystals"
import { getChampionAcquisition } from "./index"

export type AcquisitionAuditChampion = {
  name: string
  gameId: string | null
  slug: string | null
  obtainable: readonly string[]
  stats: ReadonlyArray<{ rarity: number | null }>
}

/** Audit every obtainable star, including variants whose stats are not imported.
 * Stats availability records page visibility; neither templates nor missing
 * direct drops establish player availability.
 */
export function auditChampionAcquisitionCoverage(champions: readonly AcquisitionAuditChampion[]) {
  let selectableVariants = 0, metadataVariants = 0
  const variants = champions.flatMap(champion => {
    if (!champion.gameId) return []
    const importedStars = new Set(champion.stats.map(stat => stat.rarity))
    const rarities = [...new Set(champion.obtainable.map(Number))].filter(rarity => Number.isInteger(rarity) && rarity >= 1 && rarity <= 7)
    metadataVariants += rarities.length
    selectableVariants += rarities.filter(rarity => importedStars.has(rarity)).length
    const crystals = getChampionCrystals(champion.gameId).crystals
    const crystalStars = [...new Set(crystals.flatMap(crystal => crystal.rarities))].sort((a, b) => a - b)
    const methods = getChampionAcquisition(champion.gameId).methods
    return rarities.filter(rarity => !crystalStars.includes(rarity)).map(rarity => {
      const methodIds = methods.filter(method => method.rarities.includes(rarity)).map(method => method.id)
      return { name: champion.name, gameId: champion.gameId!, slug: champion.slug, rarity, hasImportedStats: importedStars.has(rarity), otherCrystalStars: crystalStars, methodIds, status: methodIds.length ? "reviewed_route" as const : "evidence_missing" as const }
    })
  }).sort((a, b) => a.name.localeCompare(b.name) || b.rarity - a.rarity)
  return { counts: { champions: champions.length, metadataVariants, selectableVariants, variantsWithoutDirectCrystals: variants.length, variantsWithReviewedRoutes: variants.filter(variant => variant.status === "reviewed_route").length, unreviewedVariants: variants.filter(variant => variant.status === "evidence_missing").length, variantsWithoutImportedStats: variants.filter(variant => !variant.hasImportedStats).length }, variants }
}
