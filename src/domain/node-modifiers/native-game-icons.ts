import { additionalNativeGameIcons } from "./native-game-icon-registry"
import { resolveNativeModifierIcon, type NativeModifierIconKey } from "./native-icons"
export { additionalNativeGameIcons }
export type AdditionalNativeGameIconKey = typeof additionalNativeGameIcons[number]["key"]
export type NativeGameModifierIconKey = NativeModifierIconKey | AdditionalNativeGameIconKey

/** Game-only extension; these keys are intentionally absent from curated choices. */
export function resolveNativeGameModifierIcon(key: unknown) {
  return resolveNativeModifierIcon(key) ?? (typeof key === "string" ? additionalNativeGameIcons.find(icon => icon.key === key) : undefined)
}
export interface GameIconOverlay {
  contract: string; baseSourceIndexSha256: string; catalogHash: string; bcgSha256: string
  definitions: { effectId: string; versionHashes: string[]; iconKey: string }[]
}
const approvedBaseSourceIndex = "9fc9209fbd623aa9ceb0500362cd51d2524c177279c1e2a57ee41bc7afb7a793"
export function gameDefinitionIconKey(record: { id: string; versionHashes: string[]; iconKey?: string | null },
  source: { catalogHash: string; bcgSha256: string }, overlay: GameIconOverlay): string | null {
  const fallback = record.iconKey ?? null
  if (overlay.contract !== "cerebro.node-game-icon-overlay/v3" || overlay.baseSourceIndexSha256 !== approvedBaseSourceIndex ||
    overlay.catalogHash !== source.catalogHash || overlay.bcgSha256 !== source.bcgSha256) return fallback
  const matches = overlay.definitions.filter(binding => binding.effectId === record.id)
  if (matches.length !== 1) return fallback
  const binding = matches[0]
  if (JSON.stringify([...record.versionHashes].sort()) !== JSON.stringify([...binding.versionHashes].sort()) ||
    !additionalNativeGameIcons.some(icon => icon.key === binding.iconKey)) return fallback
  return binding.iconKey
}
