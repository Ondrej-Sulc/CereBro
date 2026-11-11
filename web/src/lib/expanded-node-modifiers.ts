import "server-only"
import snapshot from "@cerebro/core/data/game-node-modifiers/v2/index.json"
import portraitSnapshot from "@cerebro/core/data/game-node-modifiers/v2/portraits.json"
import { loadStoredExpandedModifier } from "./expanded-node-detail-storage"
import { verifiedExpandedDetail, type ExpandedModifierIndex } from "@cerebro/core/domain/node-modifiers/expansion"
import type { DefenderArtwork } from "@cerebro/core/data/game-node-modifiers/artwork"
import gameIconOverlay from "@cerebro/core/data/game-node-modifiers/v3-native-icons/overlay.json"
import { gameDefinitionIconKey } from "@cerebro/core/domain/node-modifiers/native-game-icons"

// Additive presentation only: the approved v2 snapshot bytes/identities stay fixed.
const iconSource = { catalogHash: snapshot.catalogHash, bcgSha256: snapshot.profile.bcgSha256 }
export const expandedNodeIndex: ExpandedModifierIndex = { ...snapshot, records: snapshot.records.map(record =>
  ({ ...record, iconKey: gameDefinitionIconKey(record, iconSource, gameIconOverlay) })) }
export const expandedNodePortraits: Record<string, DefenderArtwork> = portraitSnapshot.catalogHash === snapshot.catalogHash && portraitSnapshot.bcgSha256 === snapshot.profile.bcgSha256 ? portraitSnapshot.bindings : {}
export async function getExpandedNodeModifier(id: string) {
  if (!expandedNodeIndex.records.some(row => row.id === id)) return undefined
  return verifiedExpandedDetail(expandedNodeIndex, id, await loadStoredExpandedModifier(id))
}
