import snapshot from "./catalog.json"
import { createCrystalOddsCatalog } from "../../domain/crystal-odds"

// Keep the complete recorded status catalog on the server; pass one exact opening to clients.
const catalog = createCrystalOddsCatalog(snapshot)

export const crystalOddsSource = catalog.source
export const crystalOddsCounts = catalog.counts
export const getCrystalOdds = catalog.getCrystalOdds
