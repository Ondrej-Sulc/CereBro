import snapshot from "./catalog.json"
import { createCrystalOpeningCatalog } from "../../domain/crystal-openings"

// Server-only full-catalog entry point. Send bounded page projections to clients.
const catalog = createCrystalOpeningCatalog(snapshot)

export const crystalOpeningsSource = catalog.source
export const crystalOpeningsCoverage = catalog.coverage
export const listCrystalOpenings = catalog.listCrystalOpenings
export const getCrystalOpening = catalog.getCrystalOpening
export const getCrystalOpeningCategory = catalog.getCrystalOpeningCategory
export const assertCrystalOpeningsSourceHash = catalog.assertSourceHash
