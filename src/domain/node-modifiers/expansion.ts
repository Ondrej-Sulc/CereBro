import type { ModifierDefinition, NodeModifierCatalog } from "./catalog"
import type { ModifierUseProjection } from "./uses"
import type { GameModifierRecord } from "./public-catalog"

export interface ExpandedModifierDetail {
  contract: string; catalogHash: string
  definition: ModifierDefinition & { versions: (ModifierDefinition["versions"][number] & { nativeIconKey?: string | null })[] }
  projection: ModifierUseProjection
}
export interface ExpandedModifierIndex {
  contract: string; catalogHash: string; profileHash: string; profile: NodeModifierCatalog["profile"]
  records: GameModifierRecord[]
  stats: { permanentVariants: number; permanentLayouts: number; retainedHistoricalLayouts: number; distinctBuffIds: number; fullVersions: number; distinctApplications: number; recordedTileAssignments: number; verifiedApplicationIconAssignments: number; sourceContexts: number; questLayouts: number }
}
export function verifiedExpandedDetail(index: ExpandedModifierIndex, id: string, detail: ExpandedModifierDetail | undefined) {
  const summary = index.records.find(record => record.id === id)
  if (!summary || !detail || detail.catalogHash !== index.catalogHash || detail.definition.id !== id || detail.projection.modifierCatalogHash !== index.catalogHash) return undefined
  const hashes = detail.definition.versions.map(version => version.hash).sort()
  return JSON.stringify(hashes) === JSON.stringify([...summary.versionHashes].sort()) ? detail : undefined
}
