import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { expect, it } from "vitest"
import { CrystalFinderArtwork } from "./crystal-finder-artwork"
import type { CrystalFinderArtwork as Artwork } from "@/lib/crystal-finder-artwork"

const artwork: Artwork = {
  portraits: ["ironman", "storm", "gwenom", "hulk", "guillotine_nameless"].map(gameId => ({ gameId, url: `/${gameId}.png`, championClass: null })),
  motifs: { crystal: "/crystal.webp", token: "/token.webp", piece: "/piece.webp" },
  selected: { gameId: "hulk", url: "/hulk-full.png", championClass: "SCIENCE" },
  selectedMotifs: { crystal: "/crystal.webp", token: "/science-token.webp" },
}

it("renders the reserved decorative composition in SSR with responsive images and no keyboard targets", () => {
  const document = new JSDOM(renderToStaticMarkup(<CrystalFinderArtwork artwork={artwork} selectedId="" />)).window.document
  const composition = document.querySelector('[data-finder-artwork="default"][aria-hidden="true"]')!
  expect(composition.querySelectorAll('[data-finder-portrait] img')).toHaveLength(5)
  expect([...composition.querySelectorAll('[data-finder-motif]')].map(node => node.getAttribute("data-finder-motif"))).toEqual(["crystal", "token"])
  expect([...composition.querySelectorAll("img")].every(image => image.alt === "" && image.srcset && image.sizes)).toBe(true)
  expect(composition.querySelector("a, button, [tabindex]")).toBeNull()
  expect(document.querySelectorAll('link[rel="preload"][as="image"]')).toHaveLength(1)
})

it("SSR features the exact selected champion and omits unrelated collection artwork", () => {
  const document = new JSDOM(renderToStaticMarkup(<CrystalFinderArtwork artwork={artwork} selectedId="hulk" />)).window.document
  expect([...document.querySelectorAll('[data-finder-portrait]')].map(node => node.getAttribute("data-finder-portrait"))).toEqual(["hulk"])
  expect(document.querySelector('[data-finder-portrait] img')?.getAttribute("src")).toContain("hulk-full.png")
  expect(document.querySelector('[data-finder-motif="piece"]')).toBeNull()
})

it("keeps an associated personal piece visible with its selected champion", () => {
  const selected = { gameId: "guillotine_nameless", url: "/guillotine-full.png", championClass: "MYSTIC" as const }
  const document = new JSDOM(renderToStaticMarkup(<CrystalFinderArtwork artwork={{ ...artwork, selected, selectedMotifs: { crystal: "/crystal.webp", piece: "/piece.webp" } }} selectedId={selected.gameId} />)).window.document
  expect(document.querySelector('[data-finder-motif="piece"] img')?.getAttribute("src")).toContain("piece.webp")
})
