import manifest from "./manifest.json"
import palette from "./palette.json"
import { createRewardArtworkCatalog, createRewardColorPalette } from "../../domain/reward-artwork"
import { crystalOpeningsSource } from "../game-crystal-openings"

// Server-only sidecar; callers project selected reward images into client data.
const colorPalette = createRewardColorPalette(palette)
const catalog = createRewardArtworkCatalog(manifest, { gachaSha256: crystalOpeningsSource.gachaSha256, colorPalette })
export const getRewardArtwork = catalog.getRewardArtwork
export const getRewardArtworkStatus = catalog.getRewardArtworkStatus
export const rewardArtworkSource = catalog.source
export const rewardArtworkCoverage = catalog.coverage
export const rewardClassColors = colorPalette.colors
export const rewardColorPaletteSource = colorPalette.source
