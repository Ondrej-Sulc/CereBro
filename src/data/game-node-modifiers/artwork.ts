import snapshot from "./artwork.json"
import type { ModifierDefinition, NodeModifierCatalog } from "../../domain/node-modifiers/catalog"
import { modifierUseProjection } from "./uses"
import { nativeModifierIcons, resolveNativeModifierIcon } from "../../domain/node-modifiers/native-icons"
import bindings from "./icon-bindings.json"

interface IconBinding {
  effectId: string; versionHash: string; status: string; src?: string
}
export interface DefenderArtwork {
  gameId: string; status: string; src?: string
  public: { name: string | null; href: string | null } | null
}
interface ArtworkProjection {
  modifierCatalogHash: string; modifierUsesHash: string
  icons: IconBinding[]; portraits: DefenderArtwork[]
}
const artwork: ArtworkProjection = snapshot
const current = (catalog: NodeModifierCatalog) => artwork.modifierCatalogHash === catalog.contentHash && artwork.modifierUsesHash === modifierUseProjection.contentHash

/** Missing, stale or ambiguous art has no substitute effect icon. */
export function modifierIcon(catalog: NodeModifierCatalog, definition: ModifierDefinition) {
  if (!current(catalog)) return undefined
  const icons = definition.versions.map(version => artwork.icons.find(icon => icon.effectId === definition.id && icon.versionHash === version.hash))
  if (icons.some(icon => icon?.status !== "verified" || !icon.src)) return undefined
  const paths = new Set(icons.map(icon => icon?.src))
  return paths.size === 1 ? icons[0]?.src : undefined
}
export function modifierIconKey(catalog: NodeModifierCatalog, definition: ModifierDefinition) {
  const src = modifierIcon(catalog, definition)
  return src ? nativeModifierIcons.find(icon => icon.src === src)?.key : undefined
}
/** Server-side exact version bridge for future quest integration; no name matching. */
export function modifierVersionIconKey(effectId: string, versionHash: string, catalogHash: string) {
  if (bindings.artworkHash !== snapshot.contentHash || bindings.modifierCatalogHash !== catalogHash) return undefined
  const binding = bindings.bindings.find(binding => binding.effectId === effectId && binding.versionHash === versionHash)
  const icon = resolveNativeModifierIcon(binding?.iconKey)
  const evidence = snapshot.icons.find(row => row.effectId === effectId && row.versionHash === versionHash && row.status === "verified")
  return icon && evidence?.src === icon.src ? icon.key : undefined
}
export function defenderArtwork(catalog: NodeModifierCatalog, gameId: string | null) {
  return current(catalog) && gameId ? artwork.portraits.find(portrait => portrait.gameId === gameId) : undefined
}
export function modifierArtworkEvidence(definition: ModifierDefinition) {
  return { contract: snapshot.contract, contentHash: snapshot.contentHash, profile: snapshot.profile,
    icons: snapshot.icons.filter(icon => icon.effectId === definition.id), portraits: snapshot.portraits }
}
