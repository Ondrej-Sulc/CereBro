import { renderToStaticMarkup } from "react-dom/server"
import type { ImgHTMLAttributes } from "react"
import { expect, it, vi } from "vitest"
const relics = vi.hoisted(() => vi.fn())

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND") },
  permanentRedirect: (href: string) => { throw new Error(`REDIRECT:${href}`) },
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock("next/image", () => ({ default: ({ fill, priority, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
  void fill; void priority
  // eslint-disable-next-line @next/next/no-img-element -- DOM boundary for server-page rendering.
  return <img alt={alt} {...props} />
} }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: async () => [] }, gameRelic: { findMany: relics } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import CrystalPage from "./[id]/page"
import LegacyCrystalPage from "./openings/[id]/page"
import LegacyCatalogPage from "./openings/page"
import { clearCache } from "@/lib/cache"

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

it("loads current catalog metadata before rendering a relic-only crystal at the unified route", async () => {
  clearCache("", true)
  relics.mockClear()
  const relic = { id: "relic_statcast_hulkling_crat", name: "Piercing Cosmic Relic of Finesse", slug: "hulkling-crat", portraitPath: "/relic.png", class: "COSMIC", rarities: [{ sourceRarityId: "t7", stars: 7 }] }
  relics.mockResolvedValue([relic, { ...relic, id: "relic_statcast_hulkling_spdm", name: "Piercing Cosmic Relic of Talent", slug: "hulkling-spdm" }])
  const page = await CrystalPage({ params: Promise.resolve({ id: "7_star_relic_statcast_nexus_crystal" }), searchParams: Promise.resolve({}) })
  expect(relics).toHaveBeenCalledTimes(1)
  const html = renderToStaticMarkup(page)
  expect(html).toContain("7-Star Piercing Cosmic Relic of Finesse")
  expect(html).toContain('href="/relics/hulkling-crat?rarity=7"')
  expect(html).toContain('src="/relic.png"')
  expect(html).not.toContain("relic_statcast_hulkling_crat")
  expect(relics).toHaveBeenCalledTimes(1)
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
