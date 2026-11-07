import { renderToStaticMarkup } from "react-dom/server"
import type { ImgHTMLAttributes } from "react"
import { expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND") },
  permanentRedirect: (href: string) => { throw new Error(`REDIRECT:${href}`) },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} /> }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: async () => [] } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import CrystalPage from "./[id]/page"
import LegacyCrystalPage from "./openings/[id]/page"
import LegacyCatalogPage from "./openings/page"

it("redirects the old full catalog into the crystal catalog with search, order and pagination preserved", async () => {
  await expect(LegacyCatalogPage({ searchParams: Promise.resolve({ q: "banquet", sort: "name", page: "3" }) }))
    .rejects.toThrow("REDIRECT:/crystals?q=banquet&sort=name&page=3")
})

it("serves mixed and reward-only crystals at the same unified route", async () => {
  const page = await CrystalPage({ params: Promise.resolve({ id: "superior_banquet_crystal_dec25" }), searchParams: Promise.resolve({}) })
  const html = renderToStaticMarkup(page)
  expect(html).toContain('aria-label="Crystal page sections"')
  expect(html).toContain("Rewards &amp; drop rates")
  expect(html).toContain("data-reward-artwork")
  expect(html).toContain('href="/crystals/jubilant_crystal_dec25"')
})

it("redirects old reward links to the exact opening and retains champion filters", async () => {
  await expect(LegacyCrystalPage({ params: Promise.resolve({ id: "paragon_nexus_crystal" }), searchParams: Promise.resolve({ rarity: "7", q: "hulk", class: "SCIENCE" }) }))
    .rejects.toThrow("REDIRECT:/crystals/paragon_nexus_crystal?rarity=7&q=hulk&class=SCIENCE")
})

it("rejects unknown crystal IDs in both routes", async () => {
  const input = { params: Promise.resolve({ id: "no-such-crystal" }), searchParams: Promise.resolve({}) }
  await expect(CrystalPage(input)).rejects.toThrow("NOT_FOUND")
  await expect(LegacyCrystalPage(input)).rejects.toThrow("NOT_FOUND")
})
