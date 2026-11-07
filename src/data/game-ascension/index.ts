import snapshot from "./catalog.json"
import { createChampionAscensionCatalog } from "../../domain/champion-ascension"
export type { ChampionAscensionEligibility } from "../../domain/champion-ascension-eligibility"

// Server/bot consumers import this dataset. Clients receive only a champion's rules
// and can import the tiny limits module without bundling the full source catalog.
const catalog = createChampionAscensionCatalog(snapshot)

export const ascensionCatalogSource = catalog.source
export const getChampionAscension = catalog.getChampionAscension
export const getChampionAscensionRules = catalog.getChampionAscensionRules
export const getChampionAscensionEligibility = catalog.getChampionAscensionEligibility
export const listChampionAscensionEligibility = catalog.listChampionAscensionEligibility
export const getChampionAscensionByBlueprintId = catalog.getChampionAscensionByBlueprintId
export const getAscensionResource = catalog.getAscensionResource
export { maxRecordedAscensionForRarity, recordedAscensionStatBonus } from "./limits"
