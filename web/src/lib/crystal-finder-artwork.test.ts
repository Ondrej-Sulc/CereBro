import { expect, it } from "vitest"
import { finderArtworkForSelection, finderIdentityForSelection, type CrystalFinderArtwork } from "./crystal-finder-artwork"

const artwork: CrystalFinderArtwork = {
  portraits: [{ gameId: "hulk", url: "/hulk.png", championClass: "SCIENCE" }],
  motifs: { crystal: "/crystal.webp", token: "/cosmic-token.webp", piece: "/guillotine-piece.webp" },
  selected: { gameId: "gwenom", url: "/gwenom.png", championClass: "COSMIC" },
  selectedMotifs: { crystal: "/crystal.webp", token: "/cosmic-token.webp" },
}

it("features only the requested identity and never carries another champion's piece into selection", () => {
  expect(finderArtworkForSelection(artwork, "gwenom")).toMatchObject({ mode: "selected", portraits: [artwork.selected], motifs: artwork.selectedMotifs })
  expect(finderArtworkForSelection(artwork, "gwenom").motifs.piece).toBeUndefined()
})

it("uses generic existing art for pending, source-only and obsolete responses, and recovers the curated collage on clear", () => {
  expect(finderArtworkForSelection(artwork, "storm")).toEqual({ mode: "fallback", portraits: [], motifs: { crystal: "/crystal.webp" } })
  expect(finderArtworkForSelection({ ...artwork, selected: { gameId: "source-only", url: null, championClass: null } }, "source-only").portraits).toEqual([])
  expect(finderArtworkForSelection(artwork, "")).toEqual({ mode: "default", portraits: artwork.portraits, motifs: artwork.motifs })
})


it("uses the same draft identity guard for portrait and source-only heading data", () => {
  const source = { gameId: "source-only", name: "Source-only champion", profileHref: null }
  expect(finderIdentityForSelection(source, "source-only")).toBe(source)
  expect(finderIdentityForSelection(source, "")).toBeNull()
  expect(finderIdentityForSelection(source, "hulk")).toBeNull()
  expect(finderIdentityForSelection(null, "hulk")).toBeNull()
})
