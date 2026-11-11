import manifest from "./manifest.json"
import palette from "./palette.json"
import corrections from "./corrections.json"
import { createRewardArtworkCatalog, createRewardColorPalette, createLocalRewardArtworkCatalog, type RewardArtworkRole } from "../../domain/reward-artwork"
import { crystalOpeningsSource } from "../game-crystal-openings"

// Server-only sidecar; callers project selected reward images into client data.
const colorPalette = createRewardColorPalette(palette)
const catalog = createRewardArtworkCatalog(manifest, { gachaSha256: crystalOpeningsSource.gachaSha256, colorPalette })
const corrected = createLocalRewardArtworkCatalog(corrections, { gachaSha256: crystalOpeningsSource.gachaSha256, colorPalette })
if (JSON.stringify(corrected.source.registries) !== JSON.stringify(catalog.source.registries)) throw new Error("Reward correction registry mismatch")
for (const row of corrections.assets) {
  const original = catalog.getRewardArtwork(row.type, row.data, row.role as RewardArtworkRole)
  if (original && (original.reference !== row.reference || original.inputSha256 !== row.inputSha256)) throw new Error("Reward correction changes its native texture")
}
export function getRewardArtwork(type: string | null | undefined, data: string | null | undefined, role?: RewardArtworkRole) {
  return corrected.getRewardArtwork(type, data, role) ?? catalog.getRewardArtwork(type, data, role)
}
export function getRewardArtworkStatus(type: string, data: string, role?: RewardArtworkRole) {
  const asset = getRewardArtwork(type, data, role)
  return asset ? { status: "resolved" as const, asset } : catalog.getRewardArtworkStatus(type, data, role)
}
export const rewardArtworkSource = catalog.source
export const rewardArtworkCoverage = catalog.coverage
export const rewardArtworkCorrectionCoverage = corrected.coverage
export const rewardClassColors = colorPalette.colors
export const rewardColorPaletteSource = colorPalette.source
