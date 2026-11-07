import snapshot from "./catalog.json"
import artwork from "./artwork.json"
import { createCrystalCatalog } from "../../domain/champion-crystals"
import { getCrystalAvailability, getCrystalAvailabilityReview, isCrystalAcquisitionSource } from "./availability"

// Server consumers import this entry point; clients receive a single champion projection.
const catalog = createCrystalCatalog(snapshot, artwork)

export const getChampionCrystals = (gameId: string | null) => {
  const result = catalog.forChampion(gameId)
  const asOf = new Date().toISOString().slice(0, 10)
  return { ...result, crystals: result.crystals.flatMap(crystal => {
    const sourceIds = crystal.sourceIds.filter(isCrystalAcquisitionSource)
    const availabilitySourceId = sourceIds.includes(crystal.family?.id ?? "") ? crystal.family!.id : sourceIds[0]
    return sourceIds.length ? [{ ...crystal, sourceIds, availabilitySourceId, availability: getCrystalAvailability(availabilitySourceId, asOf) }] : []
  }) }
}
export function getChampionCrystalSummary(gameId: string | null) {
  const result = getChampionCrystals(gameId)
  const otherCounts: Record<string, number> = {}
  for (const crystal of result.crystals.filter(item => !item.isMainPool)) {
    for (const rarity of crystal.rarities) otherCounts[rarity] = (otherCounts[rarity] ?? 0) + 1
  }
  // The champion preview uses icons and exact opening identities. Banners and
  // availability evidence belong to crystal details; archives load on demand.
  return { ...result, crystals: result.crystals.filter(item => item.isMainPool).map(crystal => ({
    name: crystal.name, sourceIds: crystal.sourceIds, rarities: crystal.rarities,
    isMainPool: crystal.isMainPool, selection: crystal.selection,
    artworkUrl: crystal.artworkUrl, family: crystal.family,
  })), otherCounts }
}
export const crystalCatalogSource = catalog.source
let families: ReturnType<typeof reviewedFamilies> | undefined
const reviewedFamilies = () => catalog.listCrystalFamilies().map(family => ({ ...family,
  availabilityReview: getCrystalAvailabilityReview(family.variants.flatMap(variant => variant.sourceIds)),
}))
export const getCrystalFamilies = () => families ??= reviewedFamilies()
export const getCrystalDetails = (id: string) => {
  const details = catalog.getCrystalDetails(id)
  return details ? { ...details, availabilityReview: getCrystalAvailabilityReview(details.variants.flatMap(variant => variant.sourceIds)) } : null
}
export const getCrystalPresentation = (id: string) => catalog.getCrystalPresentation(id)
export const getCrystalChampions = () => catalog.listCrystalChampions()
