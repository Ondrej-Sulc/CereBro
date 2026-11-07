import type { ChampionClass } from "@prisma/client"

export type FinderPortrait = { gameId: string; url: string | null; championClass: ChampionClass | null }
export type FinderMotifs = { crystal?: string; token?: string; piece?: string }
export type CrystalFinderArtwork = {
  portraits: FinderPortrait[]
  motifs: FinderMotifs
  selected: FinderPortrait | null
  selectedMotifs: FinderMotifs
}

/** Resolve server identity against the current draft, including clear/reset. */
export function finderIdentityForSelection<T extends { gameId: string }>(identity: T | null | undefined, selectedId: string): T | null {
  return selectedId && identity?.gameId === selectedId ? identity : null
}

/** Draft identity wins over late server responses, including during clear/reset. */
export function finderArtworkForSelection(artwork: CrystalFinderArtwork, selectedId: string) {
  if (!selectedId) return { mode: "default" as const, portraits: artwork.portraits, motifs: artwork.motifs }
  const selected = finderIdentityForSelection(artwork.selected, selectedId)
  return {
    mode: selected?.url ? "selected" as const : "fallback" as const,
    portraits: selected?.url ? [selected] : [],
    motifs: selected ? artwork.selectedMotifs : { crystal: artwork.motifs.crystal },
  }
}
