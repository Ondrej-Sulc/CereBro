import { renderToStaticMarkup } from "react-dom/server"
import { JSDOM } from "jsdom"
import { expect, it } from "vitest"
import { CrystalCatalogArtwork } from "./crystal-catalog-artwork"
import type { CrystalCatalogArtworkItem } from "@/lib/crystal-catalog-artwork"

const artwork: CrystalCatalogArtworkItem[] = ["hero", "empowered", "ascension", "event", "catalyst"].map((slot, index) => ({
  slot: slot as CrystalCatalogArtworkItem["slot"], id: `crystal-${index}`, url: `https://storage.googleapis.com/champion-images/crystals/primary/${index}.webp`,
}))
const render = (items: CrystalCatalogArtworkItem[]) => new JSDOM(renderToStaticMarkup(<CrystalCatalogArtwork artwork={items} />)).window.document

it("keeps the five crystal images decorative, responsive and out of keyboard navigation", () => {
  const document = render(artwork)
  const composition = document.querySelector('[data-catalog-artwork="composition"]')!
  expect(composition.getAttribute("aria-hidden")).toBe("true")
  const images = [...composition.querySelectorAll("img")]
  expect(images).toHaveLength(5)
  expect(images.every(image => image.alt === "" && image.sizes.includes("vw") && image.srcset)).toBe(true)
  expect(composition.querySelector("a, button, [tabindex]")).toBeNull()
  expect(document.querySelectorAll('link[rel="preload"][as="image"]')).toHaveLength(1)
})

it("flows surviving crystals together without changing their artwork or roles", () => {
  const document = render(artwork.slice(2))
  const fallback = document.querySelector('[data-catalog-artwork="fallback"]')!
  expect(fallback.getAttribute("aria-hidden")).toBe("true")
  expect([...fallback.querySelectorAll("[data-crystal-slot]")].map(node => node.getAttribute("data-crystal-slot"))).toEqual(["ascension", "event", "catalyst"])
  expect(fallback.querySelectorAll("img")).toHaveLength(3)
})

it("keeps an empty artwork fallback decorative without requesting a substitute image", () => {
  const document = render([])
  expect(document.querySelector('[data-catalog-artwork="fallback"][aria-hidden="true"] svg')).not.toBeNull()
  expect(document.querySelector("img")).toBeNull()
})
