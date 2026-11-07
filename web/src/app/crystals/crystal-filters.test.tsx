// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest"
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("next/link", () => ({ default: ({ href, onNavigate, scroll: _scroll, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean | null; scroll?: boolean; onNavigate?: (event: { preventDefault: () => void }) => void }) => <a {...props} href={href} onClick={event => { event.preventDefault(); onNavigate?.({ preventDefault: () => {} }) }} /> }))
vi.mock("next/image", () => ({ default: ({ priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => <img {...props} /> }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: async () => [
  { gameId: "hulk", name: "Hulk", slug: "hulk", class: "SCIENCE", images: null, obtainable: ["7"] },
  { gameId: "lizard", name: "Lizard", slug: "lizard", class: "SCIENCE", images: null, obtainable: ["6", "7"] },
] } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import { loadCrystalCatalog, loadCrystalDetails } from "@/lib/data/crystals"
import { CrystalCatalogView } from "./crystal-catalog-browser"
import { CrystalDetailView } from "./crystal-views"

let catalog: Awaited<ReturnType<typeof loadCrystalCatalog>>
let pool: NonNullable<Awaited<ReturnType<typeof loadCrystalDetails>>>
let root: Root
beforeAll(async () => {
  catalog = await loadCrystalCatalog({ scope: "all", rarity: "6" })
  pool = (await loadCrystalDetails("7_star_hero_shard_crystal", { rarity: "7" }))!
})
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  router.push.mockReset(); router.replace.mockReset()
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.useRealTimers(); vi.unstubAllGlobals() })
const input = () => document.querySelector<HTMLInputElement>('input[type="search"]')!

it("attaches the primary destinations to the catalog header before its filters without carrying a crystal search into champion lookup", async () => {
  const data = await loadCrystalCatalog({ q: "banquet", rarity: "6" })
  await act(async () => root.render(<CrystalCatalogView data={data} />))
  const nav = document.querySelector('nav[aria-label="Crystal tools"]')!
  const header = document.querySelector("h1")!.closest("header")!
  expect(header).not.toBeNull()
  expect(header.contains(nav)).toBe(true)
  expect(header.lastElementChild).toBe(nav)
  expect(header.nextElementSibling?.getAttribute("aria-label")).toBe("Crystal filters")
  expect(document.querySelectorAll('nav[aria-label="Crystal tools"]')).toHaveLength(1)
  expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Browse crystals")
  expect(nav.querySelector('a:last-child')?.getAttribute("href")).toBe("/crystals/champions")
  expect(header.querySelector('[data-catalog-artwork="composition"]')).not.toBeNull()
  const notes = header.querySelector<HTMLDetailsElement>('details[aria-label="About this data"]')!
  await act(async () => notes.querySelector("summary")!.click())
  expect(notes.open).toBe(true)
  expect(header.contains(notes)).toBe(true)
  expect(input().value).toBe("banquet")
})

it.each([
  "abyss_7star_sg_mutant_nexus_crystal",
  "7_star_hero_shard_crystal",
  "paragon_crystal_v2",
  "jubilant_crystal_dec25",
  "elder_web_of_corruption_saga_crystal",
])("renders %s without duplicate sibling keys", async id => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    const details = await loadCrystalDetails(id, {})
    expect(details).not.toBeNull()
    await act(async () => root.render(<CrystalDetailView data={details!} />))
    const hasRates = details!.opening?.odds?.status === "captured" && details!.opening.odds.groups?.some(group => group.rows.length > 0)
    expect(Boolean(document.querySelector('[data-crystal-odds]'))).toBe(Boolean(hasRates))
    expect(document.querySelector('[aria-labelledby="champion-pool-title"]')).not.toBeNull()
    expect(errors.mock.calls.filter(args => String(args[0]).includes("same key"))).toEqual([])
  } finally {
    errors.mockRestore()
  }
})

async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value)
    input().dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function tick(ms = 300) { await act(async () => vi.advanceTimersByTime(ms)) }
async function click(selector: string, text: string) {
  const element = [...document.querySelectorAll<HTMLElement>(selector)].find(item => (item.querySelector("strong")?.textContent ?? item.textContent)?.trim() === text)!
  expect(element).toBeTruthy()
  await act(async () => element.click())
}

it("keeps the complete Elder rate group unchanged while filtering champions and retains the Ascension return link", async () => {
  const id = "elder_web_of_corruption_saga_crystal"
  const returnTo = "/crystals?reward=ascension"
  const data = (await loadCrystalDetails(id, { returnTo }))!
  window.history.replaceState(null, "", `/crystals/${id}?returnTo=${encodeURIComponent(returnTo)}`)
  await act(async () => root.render(<CrystalDetailView data={data} />))
  const readRates = () => [...document.querySelectorAll('#crystal-other-rewards [data-odds-row]')].map(row => [row.getAttribute("data-odds-row"), row.textContent])
  const before = readRates()
  expect(before.map(([key]) => key)).toEqual(["0:0", "0:1", "0:2", "0:3"])
  expect(document.querySelector('[aria-label="Filter by stars"]')?.textContent).not.toContain("%")
  await click('[aria-label="Filter by stars"] a', "7★")
  await act(async () => document.querySelector<HTMLAnchorElement>('[aria-label="Filter by class"] [aria-label^="Science,"]')!.click())
  await type("lizard")
  await tick()
  expect(readRates()).toEqual(before)
  const params = new URLSearchParams(window.location.search)
  expect(Object.fromEntries(params)).toMatchObject({ rarity: "7", class: "SCIENCE", q: "lizard", returnTo })
  expect([...document.querySelectorAll('a')].some(anchor => anchor.getAttribute("href") === returnTo)).toBe(true)
  expect(data.opening?.odds?.responseSha256).toBe("9991879962a422a267543426d03efaf722d9d52171f78e319bd6c97704d0679a")
})

it("resets both local filters and cancels the old search when navigating to another crystal", async () => {
  const first = (await loadCrystalDetails("jubilant_crystal_dec25", { q: "punisher" }))!
  const next = (await loadCrystalDetails("paragon_crystal_v2", {}))!
  expect(next.opening?.odds?.status).toBe("captured")
  window.history.replaceState(null, "", `/crystals/${first.id}`)
  await act(async () => root.render(<CrystalDetailView data={first} />))
  const oddsInput = document.querySelector<HTMLInputElement>('[aria-label="Search rewards"]')!
  const poolInput = document.querySelector<HTMLInputElement>('[aria-labelledby="champion-pool-title"] input[type="search"]')!
  await act(async () => {
    for (const [element, value] of [[oddsInput, "gold"], [poolInput, "hulk"]] as const) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value)
      element.dispatchEvent(new Event("input", { bubbles: true }))
    }
  })
  expect(oddsInput.value).toBe("gold")
  expect(poolInput.value).toBe("hulk")

  window.history.replaceState(null, "", `/crystals/${next.id}`)
  await act(async () => root.render(<CrystalDetailView data={next} />))
  expect(document.querySelector('[aria-label="Search rewards"]')).toBeNull()
  expect(document.querySelector<HTMLInputElement>('[aria-labelledby="champion-pool-title"] input[type="search"]')!.value).toBe("")
  expect(document.querySelectorAll('[data-odds-row]')).toHaveLength((next.opening?.odds?.groups ?? []).reduce((count, group) => count + group.rows.length, 0))
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(next.championCount)
  await tick(1000)
  expect(window.location.pathname + window.location.search).toBe(`/crystals/${next.id}`)
})

it("automatically searches after a brief pause, without a submit button or star dropdown", async () => {
  await act(async () => root.render(<CrystalCatalogView data={catalog} />))
  expect(document.querySelector('button[type="submit"], select')).toBeNull()
  await type("ti")
  await tick(200)
  await type("titan")
  await tick(299)
  expect(router.replace).not.toHaveBeenCalled()
  expect(document.querySelector('[role="status"]')?.textContent).toBe("Updating crystals…")
  await tick(1)
  expect(router.replace).toHaveBeenCalledExactlyOnceWith("/crystals?rarity=6&q=titan", { scroll: false })
})

it("combines typed search with a sort change and resets pagination immediately", async () => {
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, page: 3 }} />))
  await type("banquet")
  await click('[aria-label="Sort crystals"] a', "A–Z")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?rarity=6&q=banquet&sort=name", { scroll: false })
  expect(document.querySelector('[aria-label="Sort crystals"] [aria-current="page"]')?.textContent).toBe("A–Z")
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
})

it("switches between edition order and recommended order without losing filters", async () => {
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, category: "modes", page: 3 }} />))
  await type("incursion")
  await click('[aria-label="Sort crystals"] a', "Newest editions")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?rarity=6&q=incursion&category=modes&sort=newest", { scroll: false })
  await click('[aria-label="Sort crystals"] a', "Recommended")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?rarity=6&q=incursion&category=modes", { scroll: false })
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
})

it("makes a legacy availability-filtered URL visible and clearable without restoring the facet row", async () => {
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, page: 3, availability: "past_event" }} />))
  expect(document.querySelector('[aria-label="Filter crystals by availability"]')).toBeNull()
  expect(document.querySelector('[aria-label="Remove availability filter"]')?.textContent).toContain("Past events")
  await type("banquet")
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Remove availability filter"]')!.click())
  expect(router.push).toHaveBeenLastCalledWith("/crystals?rarity=6&q=banquet", { scroll: false })
  expect(document.querySelector('[aria-label="Remove availability filter"]')).toBeNull()
  await type("greater banquet")
  await tick()
  expect(router.replace).toHaveBeenLastCalledWith("/crystals?rarity=6&q=greater+banquet", { scroll: false })
})

it("combines reward types with live search, clears champion stars for items and preserves the reward filter", async () => {
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, page: 3 }} />))
  await type("banquet")
  await click('[aria-label="Filter crystals by rewards"] a', "Materials & more")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?q=banquet&reward=items", { scroll: false })
  expect(document.querySelector('[aria-label="Filter crystals by stars"]')).toBeNull()
  await click('[aria-label="Sort crystals"] a', "A–Z")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?q=banquet&reward=items&sort=name", { scroll: false })
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
  await click('[aria-label="Filter crystals by rewards"] a', "All rewards")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?q=banquet&sort=name", { scroll: false })
})

it("applies 7★ Ascension immediately, clears champion-only stars and preserves it through live search and sorting", async () => {
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, page: 3 }} />))
  await type("metamorphosis")
  await act(async () => document.querySelector<HTMLAnchorElement>('[data-ascension-filter]')!.click())
  expect(router.push).toHaveBeenLastCalledWith("/crystals?q=metamorphosis&reward=ascension", { scroll: false })
  expect(document.querySelector('[aria-label="Filter crystals by stars"]')).toBeNull()
  expect(document.querySelector('[data-ascension-filter]')?.getAttribute("aria-current")).toBe("page")
  expect(document.querySelector('[data-ascension-filter] strong')?.textContent).toBe("7★ Ascension")
  expect(document.querySelector('[data-ascension-filter]')?.getAttribute("aria-label")).toBe("Remove 7★ Ascension filter")
  expect(document.getElementById("crystal-ascension-filter-note")?.textContent).toContain("specific champion drops")
  expect(document.getElementById("crystal-ascension-filter-note")?.textContent).toContain("7-star A2 also needs dust")
  await click('[aria-label="Sort crystals"] a', "Newest editions")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?q=metamorphosis&reward=ascension&sort=newest", { scroll: false })
  await type("empowered"); await tick()
  expect(router.replace).toHaveBeenLastCalledWith("/crystals?q=empowered&reward=ascension&sort=newest", { scroll: false })
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Clear all crystal filters"]')!.click())
  expect(router.push).toHaveBeenLastCalledWith("/crystals?sort=newest", { scroll: false })
  expect(document.getElementById("crystal-ascension-filter-note")).toBeNull()
})

it("toggles the prominent Ascension action off without clearing search or sort", async () => {
  const data = await loadCrystalCatalog({ reward: "ascension", q: "metamorphosis", sort: "name" })
  await act(async () => root.render(<CrystalCatalogView data={data} />))
  expect(document.querySelectorAll('[data-ascension-filter]')).toHaveLength(1)
  expect(document.querySelector('a[href="/crystals/champions?rarity=7&reward=ascension"]')).not.toBeNull()
  await act(async () => document.querySelector<HTMLAnchorElement>('[aria-label="Remove 7★ Ascension filter"]')!.click())
  expect(router.push).toHaveBeenLastCalledWith("/crystals?q=metamorphosis&sort=name", { scroll: false })
  expect(document.querySelector('[data-ascension-filter]')?.hasAttribute("aria-current")).toBe(false)
})

it("combines unsubmitted text with immediate star/category choices and resets pagination", async () => {
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, page: 3 }} />))
  await type("nexus")
  await click('[aria-label="Filter crystals by stars"] a', "7★")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?rarity=7&q=nexus", { scroll: false })
  expect(document.querySelector('[aria-label="Filter crystals by stars"] [aria-current="page"]')?.textContent).toBe("7★")
  const category = document.querySelector<HTMLAnchorElement>('[aria-label="Crystal categories"] a[href*="category=classes"]')!
  await act(async () => category.click())
  expect(router.push).toHaveBeenLastCalledWith("/crystals?rarity=7&q=nexus&category=classes", { scroll: false })
  const main = document.querySelector<HTMLAnchorElement>('[aria-label="Crystal categories"] a[href*="category=main"]')!
  await act(async () => main.click())
  expect(router.push).toHaveBeenLastCalledWith("/crystals?rarity=7&q=nexus&category=main", { scroll: false })
  expect(main.getAttribute("aria-current")).toBe("page")
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
})

it("keeps newer input when an earlier search response arrives", async () => {
  await act(async () => root.render(<CrystalCatalogView data={catalog} />))
  await type("ti"); await tick()
  await type("titan")
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, q: "ti" }} />))
  expect(input().value).toBe("titan")
  await tick()
  expect(router.replace).toHaveBeenLastCalledWith("/crystals?rarity=6&q=titan", { scroll: false })
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, q: "titan" }} />))
  expect(input().value).toBe("titan")
  expect(document.querySelector('[role="status"]')?.textContent).not.toContain("Updating")
})

it("restores committed filters on external navigation and cancels a queued search", async () => {
  await act(async () => root.render(<CrystalCatalogView data={catalog} />))
  await type("titan")
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, q: "hulk", rarity: "7" }} />))
  expect(input().value).toBe("hulk")
  expect(document.querySelector('[aria-label="Filter crystals by stars"] [aria-current="page"]')?.textContent).toBe("7★")
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
  await act(async () => root.render(<CrystalCatalogView data={catalog} />))
  expect(input().value).toBe("")
})

it("clears all catalog filters together while retaining sort", async () => {
  await act(async () => root.render(<CrystalCatalogView data={{ ...catalog, category: "classes", reward: "mixed", availability: "past_event", sort: "name", page: 3 }} />))
  await type("nexus")
  await click("button", "Clear all")
  expect(router.push).toHaveBeenLastCalledWith("/crystals?sort=name", { scroll: false })
  expect(input().value).toBe("")
  expect(document.querySelector('[aria-label="Filter crystals by stars"] [aria-current="page"]')?.textContent).toBe("All")
  expect(document.querySelector('[aria-label="Filter crystals by rewards"] [aria-current="page"]')?.textContent).toBe("All rewards")
  expect(document.querySelector('[aria-label="Remove availability filter"]')).toBeNull()
  expect(document.querySelector('button[aria-label="Clear all crystal filters"]')).toBeNull()
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
})

it("waits for IME composition before searching and still supports Enter", async () => {
  await act(async () => root.render(<CrystalCatalogView data={catalog} />))
  await act(async () => input().dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true })))
  await type("titan"); await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
  await act(async () => input().dispatchEvent(new CompositionEvent("compositionend", { bubbles: true })))
  await tick()
  expect(router.replace).toHaveBeenCalledTimes(1)
  await type("titan nexus")
  await act(async () => input().closest("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })))
  expect(router.replace).toHaveBeenLastCalledWith("/crystals?rarity=6&q=titan+nexus", { scroll: false })
  await tick(1000)
  expect(router.replace).toHaveBeenCalledTimes(2)
})

it("applies the same live search to champion pools and combines it with class changes", async () => {
  await act(async () => root.render(<CrystalDetailView data={pool} />))
  await type("hulk")
  const science = document.querySelector<HTMLAnchorElement>('[aria-label="Filter by class"] a[href*="class=SCIENCE"]')!
  await act(async () => science.click())
  expect(window.location.pathname + window.location.search).toBe("/crystals/7_star_hero_shard_crystal?rarity=7&q=hulk&class=SCIENCE")
  await click("button", "Clear filters")
  expect(window.location.pathname + window.location.search).toBe("/crystals/7_star_hero_shard_crystal?rarity=7")
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
  expect(router.push).not.toHaveBeenCalled()
})

it("can clear an initially filtered pool locally and cancels a queued URL update on Back", async () => {
  const details = (await loadCrystalDetails("paragon_crystal_v2", { q: "hulk", rarity: "7" }))!
  await act(async () => root.render(<CrystalDetailView data={details} />))
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(details.total)
  await click("button", "Clear filters")
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(details.championCount)
  await type("gwenom")
  await act(async () => {
    window.history.replaceState(null, "", "/crystals/paragon_crystal_v2?rarity=5")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await tick(1000)
  expect(window.location.search).toBe("?rarity=5")
  expect(input().value).toBe("")
  expect(router.replace).not.toHaveBeenCalled()
})

it("filters an already loaded champion pool immediately without server navigation and keeps shareable URLs", async () => {
  const details = (await loadCrystalDetails("paragon_crystal_v2", {}))!
  window.history.replaceState(null, "", "/crystals/paragon_crystal_v2")
  await act(async () => root.render(<CrystalDetailView data={details} />))
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(details.championCount)
  await type("hulk")
  const expected = details.champions.filter(champion => champion.name.toLowerCase().includes("hulk"))
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(expected.length)
  expect(document.querySelector('[role="status"]')?.textContent).not.toContain("Updating")
  expect(router.push).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
  await tick()
  expect(window.location.search).toBe("?q=hulk")
  await click('[aria-label="Filter by stars"] a', "7★")
  expect(window.location.search).toBe("?rarity=7&q=hulk")
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(expected.filter(champion => champion.rarities.includes(7)).length)
  await act(async () => {
    window.history.replaceState(null, "", "/crystals/paragon_crystal_v2?rarity=5")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  expect(input().value).toBe("")
  expect(document.querySelector('[aria-label="Filter by stars"] [aria-current="page"]')?.textContent).toContain("5★")
  expect(router.push).not.toHaveBeenCalled()
})

it("can expand the loaded gallery, search it, and collapse it without losing champions or category rates", async () => {
  const details = (await loadCrystalDetails("paragon_crystal_v2", {}))!
  window.history.replaceState(null, "", "/crystals/paragon_crystal_v2")
  await act(async () => root.render(<CrystalDetailView data={details} />))
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Expand champion pool"]')!.click())
  expect(document.querySelector('[aria-label="Collapse champion pool"]')?.getAttribute("aria-expanded")).toBe("true")
  await type("hulk")
  expect(document.querySelector('[aria-label="Collapse champion pool"]')).toBeNull()
  await click("button", "Clear filters")
  expect(document.querySelector('[aria-label="Collapse champion pool"]')?.getAttribute("aria-expanded")).toBe("true")
  await act(async () => document.querySelector<HTMLButtonElement>('[aria-label="Collapse champion pool"]')!.click())
  expect(document.querySelector('[aria-label="Expand champion pool"]')?.getAttribute("aria-expanded")).toBe("false")
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(details.championCount)
  expect(document.querySelector('#crystal-other-rewards [data-odds-row="0:0"]')?.textContent).toContain("1.25%")
  expect(router.push).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
})
