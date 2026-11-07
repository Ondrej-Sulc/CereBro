import { renderToStaticMarkup } from "react-dom/server"
import { expect, it, vi } from "vitest"
import type { ImgHTMLAttributes } from "react"
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} /> }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: async () => [{ gameId: "hulk", name: "Hulk", slug: "hulk", class: "SCIENCE", images: null, obtainable: ["7"] }] } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
import { loadCrystalCatalog, loadCrystalDetails, loadCrystalComparison } from "@/lib/data/crystals"
import { CrystalComparisonView } from "./crystal-comparison"
import { CrystalCatalogView, CrystalDetailView } from "./crystal-views"
import { CrystalFamilyGrid } from "./crystal-catalog-browser"
import { parseCrystalReturnTo } from "@/lib/crystal-browse-return"

it("shows each comparison capture separately when opening and archived content dates differ", async () => {
  const data = await loadCrystalComparison({ rarity: "7" })
  if (!data.left || !data.right) throw new Error("Expected two comparison fixture pools")
  const older = "2026-11-03T09:10:42+00:00", newer = "2026-11-05T14:05:24+00:00"
  const html = renderToStaticMarkup(<CrystalComparisonView data={{ ...data, observedAt: null,
    left: { ...data.left, observedAt: older }, right: { ...data.right, observedAt: newer },
  }} />)
  expect(html.match(/aria-label="About this data"/g)).toHaveLength(1)
  expect(html).toContain("First crystal contents captured")
  expect(html).toContain("Second crystal contents captured")
  expect(html).toContain(`dateTime="${older}"`)
  expect(html).toContain(`dateTime="${newer}"`)
  expect(html.match(/<summary>.*?<\/summary>/)?.[0]).not.toContain("<time")
})

it("uses one catalog with Main pools as a category and all reward filters available immediately", async () => {
  const html = renderToStaticMarkup(<CrystalCatalogView data={await loadCrystalCatalog({})} />)
  expect(html).not.toContain('aria-label="Crystal catalog"')
  expect(html).not.toContain("All recorded")
  expect(html).toContain('aria-label="Filter crystals by rewards"')
  expect(html).toContain("Ascension")
  expect(html).toContain("category=main")
  expect(html).toContain('id="crystal-group-main"')
  const headings = [...html.matchAll(/id="crystal-group-([a-z]+)"/g)].map(match => match[1])
  expect(headings[0]).toBe("main")
})

it("gives a small mixed crystal a rewards-first layout without redundant champion filters", async () => {
  const data = (await loadCrystalDetails("superior_banquet_crystal_dec24", {}))!
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  expect(html).toContain('data-crystal-layout="rewards"')
  expect(html).toContain('aria-label="Crystal page sections"')
  expect(html).toContain('href="#crystal-other-rewards"')
  expect(html).toContain('href="#champion-pool-title"')
  expect(html).not.toContain('placeholder="Search champions…"')
  expect(html).not.toContain('aria-label="Filter by class"')
  expect(html).toContain("JESSICA JONES")
  expect(html).toContain("0.03%")
  expect(html).toContain("31.26%")
})

it("keeps event context and its evidence inside the crystal header", async () => {
  const html = renderToStaticMarkup(<CrystalDetailView data={(await loadCrystalDetails("superior_banquet_crystal_dec24", {}))!} />)
  expect(html.indexOf('aria-label="Crystal availability"')).toBeLessThan(html.indexOf('data-crystal-content'))
  expect(html).toContain("Recorded for the 2024 Grand Banquet")
  expect(html).toContain("Official announcement")
})

it("goes straight from the Abyss crystal header to its pool when rates are unavailable", async () => {
  const data = (await loadCrystalDetails("abyss_7star_sg_mutant_nexus_crystal", {}))!
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  expect(html).not.toContain('id="opening-odds-title"')
  expect(html).not.toContain("returned no rate table")
  const headerEnd = html.indexOf("</section>")
  expect(html.indexOf('aria-label="About this data"')).toBeLessThan(headerEnd)
  expect(html.indexOf('aria-label="Opening options"')).toBeLessThan(headerEnd)
  expect(html.indexOf('id="champion-pool-title"')).toBeGreaterThan(headerEnd)
})

it("carries browsing context into crystal links and back out of the detail page", async () => {
  const returnTo = "/crystals?q=banquet&category=events&sort=name&page=3"
  const data = (await loadCrystalDetails("jubilant_crystal_dec25", { returnTo }))!
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => new URL(match[1].replaceAll("&amp;", "&"), "https://cerebro.test"))
  expect(links.some(url => url.pathname === "/crystals" && url.searchParams.get("q") === "banquet" && url.searchParams.get("page") === "3" && url.searchParams.get("sort") === "name")).toBe(true)
  expect(links.some(url => url.pathname === "/crystals/7_star_nexus_titan_hero_shard_crystal" && url.searchParams.get("returnTo") === parseCrystalReturnTo(returnTo))).toBe(true)
})

it("keeps the secondary comparison action seeded with the detail pool and selected stars", async () => {
  const returnTo = "/crystals?category=main&rarity=6&sort=name&page=2"
  const data = (await loadCrystalDetails("paragon_nexus_crystal", { rarity: "6", returnTo }))!
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
  const compare = links.find(([, , label]) => label.startsWith("Compare pool"))!
  expect(compare).toBeDefined()
  const url = new URL(compare[1].replaceAll("&amp;", "&"), "https://cerebro.test")
  expect(url.pathname).toBe("/crystals/compare")
  expect(Object.fromEntries(url.searchParams)).toEqual({ left: "paragon_crystal_v2", rarity: "6" })
  expect(links.some(([, href]) => href.replaceAll("&amp;", "&") === parseCrystalReturnTo(returnTo))).toBe(true)
})

it("keeps cards clickable without default-opening chips or repeated action footers", async () => {
  const data = await loadCrystalCatalog({ rarity: "7" })
  const html = renderToStaticMarkup(<CrystalFamilyGrid families={data.families} rarity="7" />)
  expect(html.includes("Standard opening")).toBe(false)
  expect(html.includes("View contents")).toBe(false)
  expect(html.includes("Choose 1 of 3")).toBe(true)
  expect(html.includes("Choose 1 of 5")).toBe(true)
  expect(html.includes('aria-label="View 7-STAR HERO CRYSTAL contents"')).toBe(true)
})

it.each([
  { q: "aug26", month: "Aug 2026", champion: "yelenabelova", rarity: "", ranges: ["7", "6_7", "5_6", "4_5", "3_4"] },
  { q: "jul26", month: "Jul 2026", champion: "arcade", rarity: "", ranges: ["7", "6_7", "5_6", "4_5", "3_4"] },
  { q: "apr26", month: "Apr 2026", champion: "bastion", rarity: "", ranges: ["6", "5_6", "4_5", "3_4"] },
  { q: "nov23", month: "Nov 2023", champion: "attuma", rarity: "", ranges: ["5_6", "4_5", "3_4"] },
  { q: "aug26", month: "Aug 2026", champion: "yelenabelova", rarity: "7", ranges: ["7", "6_7"] },
  { q: "jul26", month: "Jul 2026", champion: "arcade", rarity: "6", ranges: ["6_7", "5_6"] },
])("keeps $q / $rarity monthly pools as individually named native destinations", async ({ q, month, champion, rarity, ranges }) => {
  const data = await loadCrystalCatalog({ category: "calendar", q, rarity, sort: "newest" })
  const html = renderToStaticMarkup(<CrystalCatalogView data={data} />)
  expect(html).toContain('data-crystal-editions="monthly-login"')
  expect(html).toContain(`data-single-champion="${champion}"`)
  expect(data.total).toBe(1)
  expect(data.crystalCount).toBe(ranges.length)
  const nav = html.match(/<nav\b[^>]*aria-label="Login crystal pools for [^"]+"[^>]*>([\s\S]*?)<\/nav>/)![1]
  const links = [...nav.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
  expect(links).toHaveLength(ranges.length)
  links.forEach(([ , attributes, content ], index) => {
    const range = ranges[index]
    const label = `${range.replace("_", "–")}★`
    const href = attributes.match(/href="([^"]+)"/)![1].replaceAll("&amp;", "&")
    const url = new URL(href, "https://cerebro.test")
    expect(url.pathname).toBe(`/crystals/login_crystal_${range}_star_${q}`)
    expect(url.searchParams.get("rarity") ?? "").toBe(rarity)
    expect(url.searchParams.get("returnTo")).toBe(parseCrystalReturnTo(`/crystals?q=${q}&category=calendar${rarity ? `&rarity=${rarity}` : ""}&sort=newest`))
    expect(attributes).toContain(`aria-label="${label} Login Crystal, ${month}"`)
    expect(content).toContain(label)
  })
  expect(nav).not.toMatch(/role="tab|aria-(?:current|selected|pressed)=/)
  expect(html).not.toMatch(/<strong>\d+<\/strong> champions/)
})

it("keeps source-specific availability evidence on details rather than catalog cards", async () => {
  const catalog = await loadCrystalCatalog({ scope: "all", q: "jessies_crystal" })
  expect(renderToStaticMarkup(<CrystalCatalogView data={catalog} />)).not.toContain("Player availability unverified")
  const details = (await loadCrystalDetails("jessies_crystal", {}))!
  const html = renderToStaticMarkup(<CrystalDetailView data={details} />)
  expect(html).toContain("Player availability unverified")
  expect(html).toContain("jessies_crystal")
  expect(html).toContain('href="/crystals/7_star_hero_shard_crystal"')
  const standard = (await loadCrystalDetails("7_star_hero_shard_crystal", {}))!
  expect(renderToStaticMarkup(<CrystalDetailView data={standard} />)).not.toContain("Player availability unverified")
})

it("opens and names the exact variant matched by an availability filter", async () => {
  const catalog = await loadCrystalCatalog({ scope: "all", q: "7_star_hero_shard_crystal", availability: "unverified" })
  const html = renderToStaticMarkup(<CrystalCatalogView data={catalog} />)
  expect(html).toContain('href="/crystals/7star_nexus_crystal?returnTo=')
  expect(html).toContain("Nexus opening")
  expect(html).not.toContain("Availability unverified")
})

it("keeps the catalog free of sparse availability filters and repetitive status badges", async () => {
  const html = renderToStaticMarkup(<CrystalCatalogView data={await loadCrystalCatalog({ scope: "all", rarity: "7" })} />)
  expect(html).not.toContain('aria-label="Filter crystals by availability"')
  expect(html).not.toContain("Availability unverified")
  expect(html).not.toContain("Recurring pool")
})

it("retains reviewed event context on details without a generic unverified panel", async () => {
  const unknown = (await loadCrystalDetails("7star_nexus_crystal", {}))!
  expect(renderToStaticMarkup(<CrystalDetailView data={unknown} />)).not.toContain('aria-label="Crystal availability"')
  const event = (await loadCrystalDetails("greater_banquet_crystal_dec22", {}))!
  const html = renderToStaticMarkup(<CrystalDetailView data={event} />)
  expect(html).toContain('aria-label="Crystal availability"')
  expect(html).toContain("Past event")
})

it("has one browse destination and illustrated reward-only cards with no empty champion count", async () => {
  const data = await loadCrystalCatalog({ scope: "all", q: "t7_class_cat_crystal" })
  const html = renderToStaticMarkup(<CrystalCatalogView data={data} />)
  expect(html).toContain('href="/crystals/t7_class_cat_crystal?returnTo=')
  expect(html).toContain('aria-label="Filter crystals by rewards"')
  expect(html).toContain("Materials &amp; more")
  expect(html).not.toContain('href="/crystals/openings"')
  expect(html).not.toContain("Full catalog")
  expect(html).not.toMatch(/<strong>0<\/strong> champions/)
})

it("shows rates on Paragon and illustrated extra crystal drops beneath the champion pool", async () => {
  const data = (await loadCrystalDetails("paragon_crystal_v2", { rarity: "7", q: "hulk" }))!
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  expect(html).toContain("Rewards &amp; drop rates")
  expect(html).toContain("1.25%")
  expect(html).toContain("8.30%")
  expect(html).toContain('href="/crystals/sg_5star_nexus_crystal"')
  expect(html).toContain('href="/crystals/sg_6star_nexus_crystal"')
  expect(html.match(/data-reward-artwork/g)).toHaveLength(2)
  expect(html.indexOf('id="crystal-other-rewards"')).toBeGreaterThan(html.indexOf('aria-label="Champions in this crystal"'))
  expect(html).not.toContain("/crystals/openings/")
  expect(html).not.toContain("Explore all recorded reward groups for an exact opening")
})

it("links catalog cards to stable family pages with the selected star filter", async () => {
  const data = await loadCrystalCatalog({ rarity: "7" })
  const html = renderToStaticMarkup(<CrystalCatalogView data={data} />)
  expect(html).toContain('href="/crystals/7_star_hero_shard_crystal?rarity=7&amp;returnTo=')
  expect(html).toContain("Main pools")
  expect(html).toContain("5 Nov 2026")
  expect(html).toContain("on sale")
})

it.each(["paragon_crystal_v2", "abyss_7star_sg_mutant_nexus_crystal"])("retains the source-bound banner on crystal details for %s", async id => {
  const data = (await loadCrystalDetails(id, { rarity: "7" }))!
  expect(data.bannerArtworkUrl).toBeTruthy()
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  const banner = html.match(/<img\b[^>]*data-crystal-artwork-role="banner"[^>]*>/g) ?? []
  expect(banner).toHaveLength(1)
  expect(banner[0]).toContain(`src="${data.bannerArtworkUrl}"`)
  expect(banner[0]).toContain(`alt="In-game banner for ${data.name}"`)
})

it("shows opening options for one shared pool without a variant switcher", async () => {
  const data = (await loadCrystalDetails("7star_nexus_crystal", { rarity: "7", q: "hulk" }))!
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  expect(html).toContain("Choose 1 of 3")
  expect(html).toContain("Epoch Nexus")
  expect(html).toContain('aria-label="Opening options"')
  expect(html).not.toContain('aria-label="Crystal opening variants"')
  expect(html).not.toContain("variant=")
  expect(html).not.toContain('name="variant"')
  expect(html).toContain('aria-label="Hulk, 7★, Science. Show details"')
  expect(html).toContain("Champion pool")
  expect(html).toContain('href="#champion-pool-title"')
  expect(html).toContain("data-crystal-odds")
  expect(html).toContain('data-crystal-artwork-role="banner"')
  const beforeBanner = html.slice(0, html.indexOf('data-crystal-artwork-role="banner"'))
  expect(beforeBanner.match(/<details\b/g)?.length ?? 0).toBe(beforeBanner.match(/<\/details>/g)?.length ?? 0)
  expect(html).not.toMatch(/hologram/i)
  expect(html).not.toMatch(/owned|missing from your roster/i)
})

it("keeps class and star choices visible, preserves other filters and offers a clear empty-state recovery", async () => {
  const data = (await loadCrystalDetails("paragon_crystal_v2", { rarity: "7", q: "no-such-champion", class: "SCIENCE", variant: "paragon_nexus_crystal" }))!
  const html = renderToStaticMarkup(<CrystalDetailView data={data} />)
  expect(html).toContain('aria-label="Filter by class"')
  expect(html).toContain('aria-label="Filter by stars"')
  expect(html).toContain("Clear filters")
  expect(html).toContain("No matching champions")
  expect(html).toContain("q=no-such-champion")
  expect(html).not.toContain("variant=")
  expect(html).not.toContain('<select name="class"')
})

it("groups the recorded catalog and preserves category filters through search and pagination", async () => {
  const all = await loadCrystalCatalog({ scope: "all", rarity: "7" })
  const html = renderToStaticMarkup(<CrystalCatalogView data={all} />)
  expect(html).toContain('aria-label="Crystal categories"')
  expect(html).toContain("Champion spotlights")
  expect(html).toContain("Incursions &amp; rewards")
  expect(html).toContain("category=classes")
  const spotlight = await loadCrystalCatalog({ scope: "all", category: "spotlight", rarity: "7" })
  const filtered = renderToStaticMarkup(<CrystalCatalogView data={spotlight} />)
  expect(filtered.match(/<a\b[^>]*aria-current="page"[^>]*>/g)?.some(anchor => anchor.includes("category=spotlight"))).toBe(true)
  expect(filtered).toContain("category=spotlight&amp;page=2")
  expect(filtered).not.toContain("<select")
  expect(filtered).not.toContain('type="submit"')
})
