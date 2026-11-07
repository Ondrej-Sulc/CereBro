// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { VirtuosoMockContext } from "react-virtuoso"
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => router }))
vi.mock("next/link", () => ({ default: ({ href, onNavigate, scroll: _scroll, prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean | null; scroll?: boolean; onNavigate?: (event: { preventDefault: () => void }) => void }) => <a {...props} href={href} onClick={event => { event.preventDefault(); onNavigate?.({ preventDefault: () => {} }) }} /> }))
vi.mock("next/image", () => ({ default: ({ fill: _fill, priority: _priority, ...props }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => <img {...props} /> }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: async () => [
  { gameId: "hulk", name: "Hulk", slug: "hulk", class: "SCIENCE", images: { p_64: "/hulk-avatar.png", full_primary: "/hulk-header.png" }, obtainable: ["7"] },
  { gameId: "phoenix_dark", name: "Dark Phoenix", slug: "dark-phoenix", class: "MUTANT", images: null, obtainable: ["6", "7"] },
  { gameId: "unknown-source", name: "Unknown source champion", slug: "unknown-source", class: "TECH", images: null, obtainable: ["7"] },
  { gameId: "guillotine_nameless", name: "Guillotine (Deathless)", slug: "guillotine-deathless", class: "MYSTIC", images: null, obtainable: ["6", "7"] },
] } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import { loadCrystalComparison, loadCrystalFinder } from "@/lib/data/crystals"
import { CrystalComparisonView } from "./crystal-comparison"
import { CrystalChampionFinder } from "./crystal-champion-finder"
import { CrystalPicker } from "./crystal-picker"
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox"
import { ChampionAscensionSourceContent } from "@/components/champion-ascension-source-content"
import { parseCrystalReturnTo } from "@/lib/crystal-browse-return"

let root: Root
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  router.push.mockReset(); router.replace.mockReset()
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.useRealTimers(); vi.unstubAllGlobals()
  if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
})
async function type(value: string, selector = 'input[type="search"]') {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>(selector)!
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function click(element: HTMLElement | null) { expect(element).toBeTruthy(); await act(async () => element!.click()) }
async function tick(ms = 300) { await act(async () => vi.advanceTimersByTimeAsync(ms)) }
async function renderFinder(data: Awaited<ReturnType<typeof loadCrystalFinder>>) {
  await act(async () => root.render(<VirtuosoMockContext.Provider value={{ viewportHeight: 300, itemHeight: 52 }}><CrystalChampionFinder data={data} /></VirtuosoMockContext.Provider>))
}

it("shares one ordered category layout for main and recorded pools while keeping finder filters and page counts", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "agathaharkness", rarity: "7" }))
  const layout = document.querySelector('[data-crystal-category-layout]')!
  expect([...layout.querySelectorAll('[data-crystal-category]')].map(section => section.getAttribute("data-crystal-category"))).toEqual(["main", "spotlight", "events", "other"])
  for (const section of layout.querySelectorAll('[data-crystal-category]')) {
    expect(section.querySelector(`[id="${section.getAttribute("aria-labelledby")}"]`)).toBeTruthy()
  }
  expect(document.querySelector('[aria-label="Matching crystal categories"]')).toBeTruthy()
  expect(layout.contains(document.querySelector('[aria-label="Matching crystal categories"]'))).toBe(false)
  await renderFinder(await loadCrystalFinder({ champion: "agathaharkness", rarity: "7", category: "events" }))
  expect([...document.querySelectorAll('[data-crystal-category]')].map(section => section.getAttribute("data-crystal-category"))).toEqual(["main", "events"])
  expect(document.querySelector('[data-crystal-category="events"] header')?.textContent).toContain("4 families")
  expect(document.querySelector('[data-crystal-category="events"]')?.querySelectorAll('[data-compact-crystal-card]')).toHaveLength(4)
})

it("uses compact normal family cards for singletons, pairs and larger groups with exact opening links and finder context", async () => {
  const data = await loadCrystalFinder({ champion: "agathaharkness", rarity: "7" })
  await renderFinder(data)
  const grids = [...document.querySelectorAll('[data-compact-crystal-grid]')]
  expect(grids.map(grid => grid.children.length)).toEqual([1, 2, 4, 2])
  expect(document.querySelectorAll('[data-compact-crystal-card]')).toHaveLength(9)
  const titan = document.querySelector('[data-crystal-family="7_star_titan_hero_shard_crystal"]')!
  expect(titan.textContent).toContain("18 champions")
  expect(titan.textContent).toContain("AGATHA HARKNESS recorded at 7★")
  expect(new URL(titan.querySelector<HTMLAnchorElement>('a:not([data-crystal-opening])')!.href).pathname).toBe("/crystals/7_star_titan_hero_shard_crystal")
  expect([...titan.querySelectorAll<HTMLAnchorElement>('a[data-crystal-opening]')].map(a => new URL(a.href).pathname)).toEqual([
    "/crystals/7_star_nexus_titan_hero_shard_crystal", "/crystals/7_star_nexus_colossal_titan_hero_crystal",
  ])
  expect(titan.textContent).toContain("Colossal Nexus · Choose 1 of 5")
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('[data-compact-crystal-card] a')) {
    const url = new URL(anchor.href)
    expect(url.searchParams.get("rarity")).toBe("7")
    expect(url.searchParams.get("returnTo")).toBe("/crystals/champions?champion=agathaharkness&rarity=7")
  }
  expect(document.querySelector('a a, a button')).toBeNull()
  expect(document.body.textContent).not.toContain("Possible champion reward")
  await renderFinder(await loadCrystalFinder({ champion: "agathaharkness", rarity: "6" }))
  expect(document.querySelector('[data-crystal-family="7_star_titan_hero_shard_crystal"]')).toBeNull()
  expect(document.querySelector('[aria-label="Find crystals by champion stars"] [aria-current]')?.textContent).toBe("6★")
  const allStars = await loadCrystalFinder({ champion: "agathaharkness" })
  await renderFinder(allStars)
  const card = document.querySelector('[data-compact-crystal-card]')!
  const family = [...allStars.main, ...allStars.other].find(f => f.id === card.getAttribute("data-crystal-family"))!
  expect(card.textContent).toContain(`${family.championCount} champions · all stars`)
  expect(card.textContent).toContain(allStars.matchingRarities[family.id].map(star => `${star}★`).join(" · "))
  for (const anchor of card.querySelectorAll<HTMLAnchorElement>("a")) {
    expect(new URL(anchor.href).searchParams.has("rarity")).toBe(false)
    expect(new URL(anchor.href).searchParams.get("returnTo")).toBe("/crystals/champions?champion=agathaharkness")
  }
})

it("attaches finder navigation between its compact intro and champion controls, including Ascension mode", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "gwenom", rarity: "7", reward: "ascension" }))
  const nav = document.querySelector('nav[aria-label="Crystal tools"]')!
  const header = document.querySelector("h1")!.closest("header")!
  expect(header.contains(nav)).toBe(true)
  expect(header.lastElementChild).toBe(nav)
  expect(header.nextElementSibling?.querySelector('button[role="combobox"]')).not.toBeNull()
  expect(document.querySelectorAll("h1")).toHaveLength(1)
  expect(document.querySelectorAll('nav[aria-label="Crystal tools"]')).toHaveLength(1)
  expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Find a champion")
  expect(nav.querySelector('a:first-child')?.getAttribute("href")).toBe("/crystals")
  expect(document.querySelector('button[role="combobox"]')?.textContent).toMatch(/gwenom/i)
})

it.each([undefined, "7"])("adds the whole shared seven-star source presentation to All sources at %s stars", async rarity => {
  const data = await loadCrystalFinder({ champion: "gwenom", q: "Gwenom", rarity })
  await renderFinder(data)
  const section = document.querySelector('[data-ascension-section]')!
  expect(section).not.toBeNull()
  expect(document.querySelectorAll('[data-ascension-section]')).toHaveLength(1)
  expect(section.textContent).toContain("7★ Ascension")
  expect(section.querySelector('[data-material-path="7"]')).not.toBeNull()
  expect(section.querySelector('[data-material-path="6"]')).toBeNull()
  expect(document.body.textContent).toContain("Crystal pools")
  expect(document.querySelector('[data-crystal-category-layout] [data-crystal-category]:not([data-crystal-category="main"]) [data-compact-crystal-card]')).toBeTruthy()
  const link = section.querySelector<HTMLAnchorElement>('[data-ascension-source] a')!
  expect(new URL(link.href).searchParams.get("rarity")).toBe("7")
  expect(new URL(link.href).searchParams.get("returnTo")).toBe(parseCrystalReturnTo(`/crystals/champions?champion=gwenom&q=Gwenom${rarity ? "&rarity=7" : ""}`))
  const text = section.textContent
  await act(async () => root.render(<ChampionAscensionSourceContent showDataNotes={false} championName={data.selected!.name} data={{ observedAt: data.ascensionObservedAt, crystals: data.ascensionSources, acquisition: data.ascensionAcquisition! }} returnTo="/champions/gwenom?rarity=7&tab=crystals" />))
  expect(document.querySelector('[data-ascension-section]')?.textContent).toBe(text)
})

it("keeps All sources normal lookup and omits unsupported seven-star or explicit lower-star panels", async () => {
  for (const champion of ["magik", "gwenom", "carina_white"]) {
    await renderFinder(await loadCrystalFinder({ champion, rarity: "6" }))
    expect(document.querySelector('[data-ascension-section]')).toBeNull()
    expect(document.querySelector('[aria-label="Find crystals by champion stars"] [aria-current]')?.textContent).toBe("6★")
  }
  for (const champion of ["hulk", "unknown-source"]) {
    await renderFinder(await loadCrystalFinder({ champion }))
    expect(document.querySelector('[data-ascension-section]')).toBeNull()
    expect(document.querySelector('[aria-label="Recorded ascension eligibility"]')).toBeNull()
  }
  await openChampionPicker()
  await type("Hulk", 'input[cmdk-input]'); await tick(20)
  expect(championOption("Hulk")).not.toBeNull()
})

it("includes reviewed methods, neutral source gaps and canonical Carina A1 in All sources", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "magik" }))
  expect(document.querySelector('[data-ascension-method]')?.textContent).toContain("Limbo")
  const a2 = document.querySelector('[aria-label="7-star upgrade cost to A2"]')!
  expect(a2.textContent).toMatch(/500.*dust/i)
  expect(a2.textContent).toContain("Gold")
  await renderFinder(await loadCrystalFinder({ champion: "cable" }))
  expect(document.querySelector('[data-ascension-section]')?.textContent).toContain("We have not verified an obtainable source")
  await renderFinder(await loadCrystalFinder({ champion: "carina_white" }))
  expect(document.querySelector('[data-material-path="7"]')?.textContent).toContain("Recorded path to A1")
  expect(document.querySelector('[data-ascension-method]')?.textContent).toContain("epilogue_ch04_q04.masteryCompletionRewards")
  expect(document.body.textContent).not.toContain("A1 → A2")
})

it("attaches comparison navigation below its intro with neither primary destination current", async () => {
  await act(async () => root.render(<CrystalComparisonView data={await loadCrystalComparison({})} />))
  const nav = document.querySelector('nav[aria-label="Crystal tools"]')!
  const header = document.querySelector("h1")!.closest("header")!
  expect(header.contains(nav)).toBe(true)
  expect(header.lastElementChild).toBe(nav)
  expect(nav.querySelector("[aria-current]")).toBeNull()
  expect(document.querySelector('[aria-label="Selected crystals"]')).not.toBeNull()
})

it("finds exact seven-star outcomes, retains source/return state and restores normal lookup", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "gwenom", rarity: "6", reward: "ascension" }))
  expect(document.querySelector('[aria-label="Champion source focus"] [aria-current="page"]')?.textContent).toBe("7\u2605 Ascension")
  expect(document.querySelector('[aria-label="Find crystals by champion stars"]')).toBeNull()
  expect(document.querySelector('[data-ascension-source]')?.textContent).toContain("Champion outcome bonus")
  expect(document.querySelector('[data-ascension-source]')?.textContent).toContain("Automatic ascension when applicable")
  const link = document.querySelector<HTMLAnchorElement>('[data-ascension-source] a')!
  expect(link.href).toContain("/crystals/vfh_gwenom_broken_justice_crystal?")
  expect(new URL(link.href).searchParams.get("rarity")).toBe("7")
  const origin = new URL(new URL(link.href).searchParams.get("returnTo")!, "http://localhost")
  expect(origin.searchParams.get("rarity")).toBe("7")
  expect(origin.searchParams.get("champion")).toBe("gwenom")
  expect(origin.searchParams.get("reward")).toBe("ascension")
  expect(document.querySelector('[data-material-path="6"]')).toBeNull()
  await click(document.querySelector('[aria-label="Champion source focus"] a:not([href*="reward="])'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=gwenom&rarity=7", { scroll: false })
  await renderFinder(await loadCrystalFinder({ champion: "gwenom", rarity: "7" }))
  await click(document.querySelector('[aria-label="Find crystals by champion stars"] a[href*="rarity=6"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=gwenom&rarity=6", { scroll: false })
})

it("distinguishes direct champion-token sources and retains unrelated acquisition sources", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "venomtheduck", rarity: "7", reward: "ascension" }))
  expect(document.querySelector('[data-ascension-source]')?.textContent).toContain("Champion token reward")
  expect(document.querySelector('[data-ascension-source]')?.textContent).toContain("does not establish a champion drop")
  await renderFinder(await loadCrystalFinder({ champion: "phoenix_dark", rarity: "7", reward: "ascension" }))
  expect(document.body.textContent).toContain("Phoenix Force")
  expect(document.body.textContent).toContain("No ascension path recorded at 7★")
  expect(document.querySelector('a[href="/crystals?reward=ascension"]')).not.toBeNull()
})

it("selects a champion outside crystal pools and shows the same evidence and requirements as champion pages", async () => {
  await renderFinder(await loadCrystalFinder({ rarity: "7" }))
  await openChampionPicker()
  await type("Dark Phoenix", 'input[cmdk-input]'); await tick(20)
  await click(championOption("Dark Phoenix"))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=phoenix_dark&rarity=7", { scroll: false })
  await renderFinder(await loadCrystalFinder({ champion: "phoenix_dark", rarity: "7" }))
  expect(document.body.textContent).toContain("How to obtain")
  expect(document.body.textContent).toContain("Phoenix Force")
  expect(document.body.textContent).toContain("Past event")
  expect(document.body.textContent).toContain("Thronebreaker")
  expect(document.querySelector('a[href="https://playcontestofchampions.com/news/heart-of-fire-event/"]')).not.toBeNull()
  expect(document.body.textContent).not.toContain("Try another star level")
  await renderFinder(await loadCrystalFinder({ champion: "phoenix_dark", rarity: "6" }))
  expect(document.body.textContent).toContain("Sunstorm")
  expect(document.body.textContent).not.toContain("Phoenix Force")
})

it("shows illustrated collection pieces and keeps unrecorded acquisition sources neutral", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "guillotine_nameless", rarity: "7" }))
  expect(document.querySelector('[aria-label="Collection pieces"]')?.querySelectorAll("img")).toHaveLength(5)
  expect(document.body.textContent).toContain("Necropolis completion")
  await renderFinder(await loadCrystalFinder({ champion: "unknown-source", rarity: "7" }))
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).toContain("Unknown source champion")
  expect(document.body.textContent).toContain("No acquisition source recorded")
  expect(document.body.textContent).not.toMatch(/unobtainable|cannot be obtained/i)
})
async function openChampionPicker() {
  await click(document.querySelector('button[role="combobox"]'))
  await tick(20)
}
const championOption = (name: string) => [...document.querySelectorAll<HTMLElement>('[cmdk-item]')].find(item => item.textContent?.trim().toLowerCase() === name.toLowerCase()) ?? null

it("filters typed picker search immediately by seven-star focus, ignoring stale focus responses", async () => {
  await renderFinder(await loadCrystalFinder({ rarity: "6" }))
  await click(document.querySelector('[aria-label="Champion source focus"] a[href*="reward=ascension"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?rarity=7&reward=ascension", { scroll: false })
  await openChampionPicker()
  await type("Hulk", 'input[cmdk-input]'); await tick(20)
  expect(championOption("Hulk")).toBeNull()
  expect(document.querySelector('[aria-label="Find crystals by champion stars"]')).toBeNull()
  await renderFinder(await loadCrystalFinder({ rarity: "7", reward: "ascension" }))
  await click(document.querySelector('[aria-label="Champion source focus"] a:not([href*="reward="])'))
  expect(championOption("Hulk")).not.toBeNull()
  // A repeated Ascension response cannot restore the old focus or its picker filter.
  await renderFinder(await loadCrystalFinder({ rarity: "7", reward: "ascension" }))
  expect(championOption("Hulk")).not.toBeNull()
  await click(championOption("Hulk"))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=hulk&rarity=7", { scroll: false })
})

it("preserves unsupported explicit identity and explains empty versus unknown rules with recovery", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "hulk", rarity: "7", reward: "ascension" }))
  expect(document.querySelector('button[role="combobox"]')?.textContent).toContain("Hulk")
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).toContain("Hulk")
  expect(document.body.textContent).toContain("No ascension path recorded at 7★")
  expect(document.body.textContent).toContain("blueprint has no ascension tiers")
  expect(document.body.textContent).not.toContain("Use 6\u2605")
  expect(document.querySelector('[data-material-path]')).toBeNull()
  await click(document.querySelector('[aria-label="Recorded ascension eligibility"] a'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=hulk&rarity=7", { scroll: false })
  expect(document.querySelector('[data-ascension-source]')).toBeNull()
  await renderFinder(await loadCrystalFinder({ champion: "unknown-source", rarity: "7", reward: "ascension" }))
  expect(document.body.textContent).toContain("Ascension eligibility not recorded at 7★")
  expect(document.body.textContent).not.toMatch(/cannot ascend|not ascendable|unobtainable/i)
  await click([...document.querySelectorAll<HTMLAnchorElement>('a')].find(link => link.textContent?.includes("View all acquisition sources"))!)
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=unknown-source&rarity=7", { scroll: false })
})

it("normalizes unique and ambiguous legacy searches without substituting champion identity", async () => {
  await renderFinder(await loadCrystalFinder({ q: "Gwenom", rarity: "1", reward: "ascension" }))
  expect(document.querySelector('button[role="combobox"]')?.textContent).toMatch(/gwenom/i)
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).toMatch(/gwenom.*7/i)
  expect(document.querySelector('[data-material-path="7"]')).not.toBeNull()
  await renderFinder(await loadCrystalFinder({ q: "Hulk", rarity: "1", reward: "ascension", champion: "hulk" }))
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).toContain("Hulk")
  expect(document.body.textContent).toContain("No ascension path recorded at 7\u2605")
  await renderFinder(await loadCrystalFinder({ q: "hulk", rarity: "1", reward: "ascension" }))
  expect(document.querySelector('[aria-label="Matching champions"]')?.textContent).not.toMatch(/6\u2605|5\u2605|4\u2605/)
  expect([...document.querySelectorAll('[aria-label="Matching champions"] li')].every(row => row.textContent?.includes("7\u2605"))).toBe(true)
})

it("swaps compared pools and filters an overlap group without losing stars or typed search", async () => {
  const data = await loadCrystalComparison({ rarity: "7" })
  await act(async () => root.render(<CrystalComparisonView data={data} />))
  await type("hulk")
  await click(document.querySelector<HTMLAnchorElement>('[aria-label="Champion overlap"] a[href*="section=shared"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/compare?left=7_star_hero_shard_crystal&right=7_star_titan_hero_shard_crystal&rarity=7&q=hulk&section=shared", { scroll: false })
  await click(document.querySelector<HTMLButtonElement>('button[aria-label="Swap crystals"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/compare?left=7_star_titan_hero_shard_crystal&right=7_star_hero_shard_crystal&rarity=7&q=hulk&section=shared", { scroll: false })
  await tick(1000)
  expect(router.replace).not.toHaveBeenCalled()
  await act(async () => root.render(<CrystalComparisonView data={data} />))
  // A history navigation supplies committed URL state, just as in the catalog filters.
  const restored = await loadCrystalComparison({ q: "doom", rarity: "7", section: "left" })
  await act(async () => root.render(<CrystalComparisonView data={restored} />))
  expect(document.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("doom")
}, 10000)

it("chooses champions in the shared combo box without navigating while typing, and retains stars", async () => {
  const data = await loadCrystalFinder({ champion: "hulk", rarity: "7" })
  await renderFinder(data)
  expect(document.querySelector<HTMLAnchorElement>('[aria-label="Selected champion"] a')?.getAttribute("href")).toBe("/champions/hulk?rarity=7")
  expect(document.querySelector('button[role="combobox"]')?.textContent).toContain("Hulk")
  expect(document.querySelector('input[type="search"]')).toBeNull()
  await openChampionPicker()
  await type("Gwenom", 'input[cmdk-input]')
  await tick(1000)
  expect(router.push).not.toHaveBeenCalled()
  expect(router.replace).not.toHaveBeenCalled()
  await click(championOption("Gwenom"))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=gwenom&rarity=7", { scroll: false })
  expect(document.querySelector('[cmdk-input]')).toBeNull()
  const response = await loadCrystalFinder({ champion: "gwenom", rarity: "7" })
  await renderFinder(response)
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).toMatch(/gwenom/i)
  expect(document.body.textContent).toContain("EN-POINTE GRACE CRYSTAL")
  await click(document.querySelector<HTMLAnchorElement>('[aria-label="Find crystals by champion stars"] a[href*="rarity=6"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=gwenom&rarity=6", { scroll: false })
})

it("preserves a newer champion choice when an earlier result arrives", async () => {
  const data = await loadCrystalFinder({})
  await renderFinder(data)
  await openChampionPicker()
  await type("Gwenom", 'input[cmdk-input]'); await tick(20)
  await click(championOption("Gwenom"))
  await openChampionPicker()
  await type("Hulk", 'input[cmdk-input]'); await tick(20)
  await click(championOption("Hulk"))
  const earlier = await loadCrystalFinder({ champion: "gwenom" })
  await renderFinder(earlier)
  expect(document.querySelector('[data-ascension-section]')).toBeNull()
  expect(document.querySelector('button[role="combobox"]')?.textContent).toContain("Hulk")
  expect(document.querySelector('[data-finder-portrait]')).toBeNull()
  expect(document.querySelector('[data-artwork-identity]')?.getAttribute("data-artwork-identity")).toBe("hulk")
  expect(document.querySelector("h1")?.textContent).toBe("Hulk")
  expect(document.querySelector('[data-finder-profile]')).toBeNull()
  expect(document.querySelector('[aria-label="Jump to source section"]')).toBeNull()
  expect(document.querySelector('[aria-busy="true"]')?.textContent).toBe("")
  await renderFinder(await loadCrystalFinder({ champion: "hulk" }))
  expect(document.querySelector('[data-ascension-section]')).toBeNull()
  expect(document.querySelector('[data-finder-portrait="hulk"] img')?.getAttribute("src")).toBe("/hulk-header.png")
  await click(document.querySelector('[aria-label="Find crystals by champion stars"] a[href*="rarity=7"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=hulk&rarity=7", { scroll: false })
})

it.each(["all", "ascension"])("selects a searched champion with the keyboard in %s focus", async reward => {
  await renderFinder(await loadCrystalFinder({ rarity: "6", reward }))
  await openChampionPicker()
  await type("Gwenom", 'input[cmdk-input]'); await tick(20)
  await act(async () => document.querySelector('input[cmdk-input]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  expect(router.push).toHaveBeenLastCalledWith(reward === "ascension" ? "/crystals/champions?champion=gwenom&rarity=7&reward=ascension" : "/crystals/champions?champion=gwenom&rarity=6", { scroll: false })
  expect(document.querySelector('[cmdk-input]')).toBeNull()
})

it("restores legacy champion searches and clears the selection without losing stars", async () => {
  const legacy = await loadCrystalFinder({ q: "Gwenom", rarity: "7" })
  await renderFinder(legacy)
  expect(document.querySelector('button[role="combobox"]')?.textContent).toMatch(/gwenom/i)
  await click(document.querySelector('button[role="combobox"] [role="button"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?rarity=7", { scroll: false })
  expect(document.querySelector('button[role="combobox"]')?.textContent).toContain("Select a champion")
  expect(document.querySelector('[data-finder-artwork="default"] [data-finder-portrait="hulk"]')).not.toBeNull()
  expect(document.querySelector("h1")?.textContent).toBe("Find a champion")
  expect(document.querySelector('[data-finder-profile]')).toBeNull()
  // Repeated/late committed props must not resurrect the cleared portrait.
  await renderFinder(legacy)
  expect(document.querySelector('[data-finder-artwork="default"] [data-finder-portrait="hulk"]')).not.toBeNull()
  await renderFinder(await loadCrystalFinder({ champion: "hulk", rarity: "6" }))
  expect(document.querySelector('button[role="combobox"]')?.textContent).toContain("Hulk")
  await openChampionPicker()
  expect(document.querySelector('input[cmdk-input]')).toBeTruthy()
})

it("replaces unavailable selected portraits with decorative crystal art, never a different champion", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "hulk", reward: "ascension" }))
  const artwork = document.querySelector('[data-finder-artwork="selected"]')!
  expect(artwork.querySelectorAll('[data-finder-portrait]')).toHaveLength(1)
  expect(artwork.querySelector('[data-finder-motif="piece"]')).toBeNull()
  await act(async () => artwork.querySelector('img[src="/hulk-header.png"]')!.dispatchEvent(new Event("error")))
  expect(document.querySelector('[data-finder-portrait]')).toBeNull()
  expect(document.querySelector('[data-finder-artwork="fallback"] [data-finder-motif="crystal"] img')).not.toBeNull()
  expect(document.querySelector('button[role="combobox"]')?.textContent).toContain("Hulk")
  await renderFinder(await loadCrystalFinder({ champion: "gwenom" }))
  expect(document.querySelector('[data-finder-portrait]')).toBeNull()
  expect(document.querySelector('[data-finder-motif="piece"]')).toBeNull()
  const fallback = document.querySelector('[data-finder-motif="crystal"] img')!
  await act(async () => fallback.dispatchEvent(new Event("error")))
  expect(document.querySelector('[data-finder-artwork] svg')).not.toBeNull()
})

it("searches crystals in a focused dialog, aborts obsolete queries and selects a pool", async () => {
  const select = vi.fn()
  let firstSignal: AbortSignal | undefined
  let resolveOld: (value: Response) => void = () => {}
  const fetcher = vi.fn().mockImplementationOnce((_url: string, init: RequestInit) => { firstSignal = init.signal as AbortSignal; return new Promise<Response>(resolve => { resolveOld = resolve }) }).mockResolvedValueOnce(new Response(JSON.stringify({ total: 1, options: [{ id: "titan", name: "Titan result", artworkUrl: null, rarities: [7], championCount: 18, isMainPool: true }] }), { status: 200 }))
  vi.stubGlobal("fetch", fetcher)
  await act(async () => root.render(<CrystalPicker selectedId="hero" label="Choose crystal" onSelect={select} />))
  await click(document.querySelector("button")); await tick(0)
  expect(document.activeElement).toBe(document.querySelector('input[type="search"]'))
  await type("titan")
  expect(firstSignal?.aborted).toBe(true)
  await tick(250)
  await act(async () => resolveOld(new Response(JSON.stringify({ total: 1, options: [{ id: "old", name: "Obsolete", rarities: [7], championCount: 1 }] }))))
  expect(document.body.textContent).not.toContain("Obsolete")
  const option = [...document.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes("Titan result"))!
  await click(option)
  expect(select).toHaveBeenCalledExactlyOnceWith("titan")
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it("offers a retry after crystal picker failures", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce(new Response(JSON.stringify({ total: 0, options: [] })))
  vi.stubGlobal("fetch", fetcher)
  await act(async () => root.render(<CrystalPicker selectedId="hero" label="Choose crystal" onSelect={vi.fn()} />))
  await click(document.querySelector("button")); await tick(0)
  expect(document.body.textContent).toContain("Could not load crystals")
  await click([...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Try again")!)
  await tick(0)
  expect(document.body.textContent).toContain("No crystals found")
})

it("shows only seven-star reviewed methods and hides stale methods during champion navigation", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "magik", rarity: "6", reward: "ascension" }))
  expect(document.querySelector('[data-ascension-method]')?.textContent).toContain("Limbo")
  expect(document.body.textContent).toContain("Current stock unverified")
  expect(document.querySelector('[data-material-path="6"]')).toBeNull()
  await openChampionPicker()
  await type("Cable", 'input[cmdk-input]'); await tick(20)
  expect(championOption("Cable")).not.toBeNull()
  await click(championOption("Cable"))
  expect(document.querySelector('[data-ascension-method]')).toBeNull()
  await renderFinder(await loadCrystalFinder({ champion: "magik", rarity: "7", reward: "ascension" }))
  expect(document.querySelector('[data-ascension-method]')).toBeNull()
  await renderFinder(await loadCrystalFinder({ champion: "cable", rarity: "7", reward: "ascension" }))
  expect(document.body.textContent).toContain("We have not verified an obtainable source")
  expect(document.body.textContent).not.toContain("Limbo")
  await click(document.querySelector('button[role="combobox"] [role="button"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?rarity=7&reward=ascension", { scroll: false })
})

it("keeps announced weekly methods bounded to the selected champion and their unverified week", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "blade", rarity: "7", reward: "ascension" }))
  expect(document.querySelectorAll('[data-ascension-method]')).toHaveLength(1)
  expect(document.querySelector('[data-ascension-method]')?.textContent).toContain("Reclamation")
  expect(document.body.textContent).toMatch(/exact week|week.*unverified/i)
  expect(document.body.textContent).not.toContain("Available now")
})

it("keeps seven-star source gaps neutral and omits lower-star paths for unsupported Hulk", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "cable", rarity: "7", reward: "ascension" }))
  expect(document.body.textContent).toContain("We have not verified an obtainable source")
  expect(document.body.textContent).not.toContain("Cannot ascend")
  await renderFinder(await loadCrystalFinder({ champion: "hulk", reward: "ascension" }))
  expect(document.querySelector('[data-material-path]')).toBeNull()
  expect(document.body.textContent).not.toContain("7★ · Recorded path")
})

it("retains selected Hulk artwork and identity when entering seven-star focus from normal six-star lookup", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "hulk", rarity: "6" }))
  await click(document.querySelector('[aria-label="Champion source focus"] a[href*="reward=ascension"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=hulk&rarity=7&reward=ascension", { scroll: false })
  expect(document.querySelector('[data-finder-portrait="hulk"]')).not.toBeNull()
  expect(document.querySelector('button[role="combobox"]')?.textContent).toContain("Hulk")
  await renderFinder(await loadCrystalFinder({ champion: "hulk", rarity: "7", reward: "ascension" }))
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).toContain("Hulk")
  expect(document.body.textContent).toContain("No ascension path recorded at 7\u2605")
  expect(document.querySelector('[data-material-path]')).toBeNull()
})

it("retains legacy search and the pagination request across focus changes without exposing stale sources", async () => {
  const all = await loadCrystalFinder({ champion: "magik", q: "Magik", page: "2" })
  await renderFinder(all)
  expect(all.page).toBe(2)
  expect(document.querySelector('[data-ascension-method]')).not.toBeNull()
  await click(document.querySelector('[aria-label="Champion source focus"] a[href*="reward=ascension"]'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=magik&rarity=7&q=Magik&reward=ascension&page=2", { scroll: false })
  expect(document.querySelector('[data-ascension-section]')).toBeNull()
  // The focused server bounds this champion's one source page, keeping identity and query.
  await renderFinder(await loadCrystalFinder({ champion: "magik", q: "Magik", rarity: "7", reward: "ascension", page: "2" }))
  expect(document.querySelectorAll('[data-ascension-section]')).toHaveLength(1)
  await click(document.querySelector('[aria-label="Champion source focus"] a:not([href*="reward="])'))
  expect(router.push).toHaveBeenLastCalledWith("/crystals/champions?champion=magik&rarity=7&q=Magik", { scroll: false })
  expect(document.querySelector('[data-ascension-section]')).toBeNull()
})

it("puts the focused challenge before separate champion acquisition, with one source heading and closed evidence", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "blade_stellar", reward: "ascension" }))
  const source = document.querySelector('[data-ascension-method]')!
  expect(source.textContent).toContain("with only Blade (Stellar-Forged)")
  expect(source.textContent).toContain("separate from collecting his five pieces")
  expect(source.textContent).toContain("Past event")
  const acquisition = document.querySelector<HTMLDetailsElement>('#finder-champion-acquisition')!
  expect(acquisition.open).toBe(false)
  expect(source.compareDocumentPosition(acquisition) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(document.querySelectorAll('[data-ascension-section]')).toHaveLength(1)
  expect(document.querySelectorAll('details[aria-label="About this data"]')).toHaveLength(1)
  expect(document.querySelector<HTMLDetailsElement>('details[aria-label="About this data"]')?.open).toBe(false)
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).not.toContain("Recorded sources")
  expect(document.querySelector('[aria-label="7-star upgrade cost to A2"]')?.closest('details')).toBeNull()
  await renderFinder(await loadCrystalFinder({ champion: "magik", rarity: "7" }))
  expect(document.querySelector('#finder-champion-acquisition')!.compareDocumentPosition(document.querySelector('[data-ascension-section]')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

it("keeps Blade's pieces and challenge useful with one quiet host disclosure and no empty crystal category", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "blade_stellar", rarity: "7" }))
  const notes = document.querySelector<HTMLDetailsElement>('details[aria-label="About this data"]')!
  expect(document.querySelectorAll('details[aria-label="About this data"]')).toHaveLength(1)
  expect(notes.open).toBe(false)
  expect(notes.querySelector("summary")?.textContent).toBe("About this data")
  expect(notes.querySelector('time[datetime="2026-11-06"]')).not.toBeNull()
  expect(notes.querySelector('time[datetime="2026-11-07"]')).not.toBeNull()
  const main = document.querySelector("main") ?? document.getElementById("root")!
  const visible = main.cloneNode(true) as HTMLElement
  visible.querySelectorAll("details:not([open])").forEach(detail => detail.replaceWith(detail.querySelector("summary")!.cloneNode(true)))
  expect(visible.textContent).not.toMatch(/Matching.*pieces|Historical sources|From in-game item descriptions|Reviewed|No direct crystal|No main-pool|Exact objective|Evidence & data dates|Current access unverified|Partial reward details|Stars matched to recorded path/)
  expect(document.querySelector('[role="status"]')?.textContent).not.toContain("0 recorded crystal")
  expect(visible.textContent).toContain("with only Blade (Stellar-Forged)")
  expect(visible.textContent).toContain("separate from collecting his five pieces")
  expect(visible.textContent).toContain("Past event")
  const collection = document.querySelector('[aria-label="Collection pieces"]')!
  expect(collection.querySelectorAll("img")).toHaveLength(5)
  expect(collection.querySelectorAll('a[target="_blank"]')).toHaveLength(5)
  expect(collection.textContent).toContain("Act 9.4 timed objective")
  expect(collection.textContent).toContain("Complete Act 9.4 within the original objective window")
  expect(document.querySelector('[data-ascension-method] a')?.getAttribute("href")).toContain("playcontestofchampions.com")
  expect(document.querySelector('[aria-label="7-star upgrade cost to A2"]')?.closest("details")).toBeNull()
})


it.each([undefined, "7", "6"])("consolidates selected identity in the banner at %s stars and links the exact champion page", async rarity => {
  const data = await loadCrystalFinder({ champion: "hulk", rarity })
  await renderFinder(data)
  const hero = document.querySelector('[aria-label="Selected champion"]')!
  expect(hero.querySelector("h1")?.textContent).toBe("Hulk")
  expect(hero.textContent).toContain("Find a champion")
  expect(hero.textContent).toContain(rarity ? `${rarity}\u2605` : "All star levels")
  expect(hero.querySelector('a[data-finder-profile]')?.getAttribute("href")).toBe(data.selected!.profileHref)
  expect(hero.querySelector('a[data-finder-profile]')?.textContent).toContain("View champion")
  expect(document.querySelectorAll('[data-finder-portrait]')).toHaveLength(1)
  expect(document.querySelector('button[role="combobox"] img')).toBeNull()
  expect(document.body.textContent).not.toContain("Change champion")
  await openChampionPicker()
  await type("Hulk", 'input[cmdk-input]'); await tick(20)
  expect(championOption("Hulk")?.querySelector('img')).not.toBeNull()
})

it.each([
  { champion: "agathaharkness", rarity: "7" },
  { champion: "agathaharkness", rarity: "6" },
  { champion: "blade_stellar", rarity: "7" },
  { champion: "blade_stellar", reward: "ascension" },
  { champion: "cable", reward: "ascension" },
  { champion: "hulk", reward: "ascension" },
  { champion: "unknown-source" },
])("only jumps to rendered source sections for %j", async params => {
  await renderFinder(await loadCrystalFinder(params))
  expect([...document.querySelectorAll("h2")].some(h => h.textContent === "Sources")).toBe(false)
  const firstSection = document.querySelector('[aria-busy] > section')!
  const firstHeading = firstSection.querySelector('h2')!
  expect(firstHeading, "The first result section owns its heading").not.toBeNull()
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[aria-label="Jump to source section"] a')) {
    expect(document.querySelector(link.hash), link.hash).not.toBeNull()
    expect((firstHeading.closest("header") ?? firstHeading.parentElement!).contains(link)).toBe(true)
  }
  if (params.champion === "agathaharkness" && params.rarity === "7") {
    expect([...document.querySelectorAll('[aria-label="Jump to source section"] a')].map(a => a.getAttribute("href"))).toEqual(["#finder-champion-acquisition", "#finder-ascension"])
  }
  if (params.rarity === "6" || params.champion === "hulk") {
    expect(document.querySelector('[aria-label="Jump to source section"] a[href="#finder-ascension"]')).toBeNull()
  }
})

it("focuses real jump destinations and opens separate acquisition methods in focused mode", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "blade_stellar", reward: "ascension" }))
  const methods = document.querySelector<HTMLDetailsElement>('#finder-champion-acquisition')!
  expect(methods.open).toBe(false)
  await click(document.querySelector('[aria-label="Jump to source section"] a[href="#finder-champion-acquisition"]'))
  expect(methods.open).toBe(true)
  expect(document.activeElement).toBe(methods.querySelector('summary'))
  expect(window.location.hash).toBe("#finder-champion-acquisition")
  expect(methods.scrollIntoView).toHaveBeenLastCalledWith({ block: "start" })
  await click(document.querySelector('[aria-label="Jump to source section"] a[href="#finder-ascension"]'))
  expect(document.activeElement).toBe(document.querySelector('#finder-ascension'))
  expect(window.location.hash).toBe("#finder-ascension")
  await renderFinder(await loadCrystalFinder({ champion: "agathaharkness", rarity: "7" }))
  await click(document.querySelector('[aria-label="Jump to source section"] a[href="#finder-champion-acquisition"]'))
  expect(document.activeElement).toBe(document.querySelector('#finder-champion-acquisition'))
  expect(document.activeElement?.querySelector('h2')?.textContent).toBe("Crystal pools")
})

it("keeps source-only names and long names in the banner even without a profile or portrait", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "antivenomoid_cosmic", rarity: "7" }))
  expect(document.querySelector("h1")?.textContent).toBe("ANTI-VENOMOID (COSMIC)")
  expect(document.querySelector('[data-finder-profile]')).toBeNull()
  expect(document.querySelector('[data-finder-portrait]')).toBeNull()
  await renderFinder(await loadCrystalFinder({ champion: "blade_stellar", rarity: "7" }))
  expect(document.querySelector("h1")?.textContent).toBe("BLADE (STELLAR-FORGED)")
})

it.each(["Enter", " "])("keeps the shared combobox portrait by default and clears its name-only variant with %j", async key => {
  const props = { champions: [{ id: "hulk", name: "Hulk", portraitUrl: "/hulk-avatar.png" }], value: "hulk", onSelect: vi.fn() }
  await act(async () => root.render(<ChampionCombobox {...props} />))
  expect(document.querySelector('button[role="combobox"] img')).not.toBeNull()
  await act(async () => root.render(<ChampionCombobox {...props} showSelectedPortrait={false} />))
  expect(document.querySelector('button[role="combobox"] img')).toBeNull()
  const clear = document.querySelector<HTMLElement>('[aria-label="Clear champion"]')!
  expect(clear.tabIndex).toBe(0)
  await act(async () => clear.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })))
  expect(props.onSelect).toHaveBeenCalledExactlyOnceWith("")
})


it("uses the exact lower-star profile and waits for the new star projection before relinking", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "phoenix_dark", rarity: "6" }))
  expect(document.querySelector('[data-finder-profile]')?.getAttribute("href")).toBe("/champions/dark-phoenix?rarity=6")
  await click(document.querySelector('[aria-label="Find crystals by champion stars"] a[href*="rarity=7"]'))
  expect(document.querySelector('[data-finder-profile]')).toBeNull()
  expect(document.querySelector('[aria-label="Selected champion"]')?.textContent).toContain("7\u2605")
  await renderFinder(await loadCrystalFinder({ champion: "phoenix_dark", rarity: "7" }))
  expect(document.querySelector('[data-finder-profile]')?.getAttribute("href")).toBe("/champions/dark-phoenix?rarity=7")
})

it("finishes an unresolved explicit identity with recovery guidance", async () => {
  await renderFinder(await loadCrystalFinder({ champion: "not-a-real-champion" }))
  expect(document.querySelector("h1")?.textContent).toBe("Champion not found")
  expect(document.querySelector('[data-finder-portrait]')).toBeNull()
  expect(document.querySelector('[data-finder-profile]')).toBeNull()
  expect(document.body.textContent).toContain("Try another name")
})
