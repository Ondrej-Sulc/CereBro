import snapshot from "./catalog.json"
import { getAscensionResource, getChampionAscensionRules } from "../game-ascension"
import { createChampionAscensionAcquisitionCatalog } from "../../domain/champion-ascension-acquisition"

// Validated/indexed once per server process. Clients receive only one champion.
const catalog = createChampionAscensionAcquisitionCatalog(snapshot, { getRules: getChampionAscensionRules, getResource: getAscensionResource })
export const getChampionAscensionAcquisitionSources = catalog.forChampion
