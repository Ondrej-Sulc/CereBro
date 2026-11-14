// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
vi.mock("next/image", () => ({ default: ({ sizes, alt = "", ...props }: ImgHTMLAttributes<HTMLImageElement>) => {
  void sizes
  // eslint-disable-next-line @next/next/no-img-element -- DOM boundary for the real reward component tests.
  return <img alt={alt} {...props} />
} }))
vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean | null }) => {
  void prefetch
  return <a {...props} />
} }))
import { loadCrystalPageRewards } from "@/lib/data/crystal-page-rewards"
import type { CrystalRewardPresentation } from "@/lib/crystal-reward-presentation"
import { CrystalBrowseBoundary } from "./crystal-browse-boundary"
import { CrystalOpeningRules } from "./crystal-reward-cards"
import { CrystalRewardsBrowser } from "./crystal-rewards-browser"

let container: HTMLDivElement
let root: Root
const scrollIntoViewDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView")
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  if (scrollIntoViewDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollIntoViewDescriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
  vi.unstubAllGlobals()
})

async function render(id = "superior_banquet_crystal_dec24") {
  const opening = loadCrystalPageRewards(id)!
  await act(async () => root.render(<CrystalRewardsBrowser key={`rewards:${id}`} presentation={opening.rewardPresentation} />))
  return opening
}
function expectNoRewardToolbar() {
  expect(container.querySelector('[aria-label="Search rewards"], [aria-label="Sort rewards"], [aria-label="Clear reward search"]')).toBeNull()
  expect(container.querySelector('input, select, [role="combobox"], [role="toolbar"]')).toBeNull()
  expect(container.textContent).not.toMatch(/Clear filters|Show all rewards|No rewards match/)
}

const rowKeys = (host: ParentNode = container) => [...host.querySelectorAll('[data-odds-row]')].map(row => row.getAttribute("data-odds-row"))

it("shows six class-colored rank gems with rank and star overlays on their disclosed rate rows", async () => {
  await render("7star_rankup_gem_crystal_r4")
  expect(container.querySelectorAll('[data-odds-row]')).toHaveLength(6)
  const images = [...container.querySelectorAll<HTMLImageElement>('img[data-reward-artwork]')]
  expect(images).toHaveLength(6)
  expect(new Set(images.map(image => image.getAttribute('src'))).size).toBe(6)
  expect(images.every(image => image.getAttribute('src')?.startsWith('/game-rewards/full/'))).toBe(true)
  expect(container.querySelectorAll('[data-reward-rank="3-4"]')).toHaveLength(6)
  expect(container.querySelectorAll('[data-reward-stars="7"]')).toHaveLength(6)
  expect(container.querySelector('[data-unrated]')).toBeNull()
})

it("shows all four Elder Web of Corruption rates together, most common first without a toolbar", async () => {
  const opening = await render("elder_web_of_corruption_saga_crystal")
  const rows = [...container.querySelectorAll('[data-odds-row]')]
  expect(rows.map(row => row.getAttribute("data-odds-row"))).toEqual(["0:3", "0:2", "0:1", "0:0"])
  expect(rows.map(row => row.querySelector('[title^="Server-disclosed"]')?.getAttribute("title"))).toEqual([
    "Server-disclosed value: 68.92%", "Server-disclosed value: 18.02%", "Server-disclosed value: 9.01%", "Server-disclosed value: 4.05%",
  ])
  for (const row of rows) {
    const sourceIndex = Number(row.getAttribute("data-odds-row")!.split(":")[1])
    expect(row.textContent).toContain(opening.odds!.groups![0].rows[sourceIndex].label)
  }
  expectNoRewardToolbar()
  expect(container.querySelector('[aria-label="Reward prize groups"]')).toBeNull()
  expect(container.querySelectorAll('[data-certain]')).toHaveLength(0)
  expect(container.textContent).not.toContain("Guaranteed")
})

it("combines class artwork and exact amounts under one source category rate", async () => {
  const opening = await render()
  const fragments = opening.rewardPresentation.groups.flatMap(group => group.rows).find(row => row.rate.label === "Tier 6 Class Catalyst Fragments")!
  const row = container.querySelector<HTMLDetailsElement>(`[data-odds-row="${fragments.key}"]`)!
  expect(row.open).toBe(false)
  expect(row.querySelector("summary")?.textContent).toContain("6 classes")
  expect(row.querySelectorAll('[title="Server-disclosed value: 31.26%"]')).toHaveLength(1)
  await act(async () => row.querySelector("summary")!.click())
  expect(row.open).toBe(true)
  const variants = row.querySelectorAll('[aria-label="Reward variants"] > li')
  expect(variants).toHaveLength(6)
  expect([...variants].map(variant => variant.querySelector("strong")?.textContent)).toEqual(["Science", "Cosmic", "Mutant", "Mystic", "Tech", "Skill"])
  expect([...variants].every(variant => variant.querySelector("strong")?.title.includes("CATALYST"))).toBe(true)
  expect(new Set([...variants].map(variant => variant.querySelector("img")?.getAttribute("src"))).size).toBe(6)
  for (const variant of variants) {
    expect([...variant.querySelectorAll("li")].map(option => option.textContent)).toEqual(["×5,700", "×11,400", "×28,500"])
    expect(variant.textContent).not.toContain("%")
  }
  expect(row.textContent).toContain("Individual option rates are not disclosed")
  expect(container.querySelectorAll('[data-odds-row]')).toHaveLength(22)
  expect(container.querySelectorAll('#crystal-other-rewards-title')).toHaveLength(1)
})

it("keeps guaranteed extras in their original groups with expandable exact denominations", async () => {
  await render()
  const gold = container.querySelector('[aria-label="Prize 2"]')!
  const iso = container.querySelector('[aria-label="Prize 3"]')!
  expect(gold.querySelector('[data-certain]')?.textContent).toBe("100.00%")
  expect(iso.querySelector('[data-certain]')?.textContent).toBe("100.00%")
  expect(gold.querySelector("summary")?.textContent).toContain("4 amount options")
  expect([...gold.querySelectorAll("li")].map(option => option.textContent)).toEqual(["×250,000", "×500,000", "×1,000,000", "×2,500,000"])
  expect(iso.querySelectorAll('[aria-label="Reward variants"] > li')).toHaveLength(6)
  expect(gold.textContent).not.toContain("ISO-8")
  expect(iso.textContent).not.toContain("Gold")
})

it("filters repeated shard prizes without sharing their percentages or quantities", async () => {
  await render("superior_banquet_crystal_dec25")
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show Prize 2"]')!.click())
  expect(container.querySelector('[aria-label="Show Prize 2"]')?.getAttribute("aria-pressed")).toBe("true")
  expect(container.querySelector('[aria-label="Prize 1"]')).toBeNull()
  const shards = [...container.querySelectorAll('[data-odds-row]')].find(row => row.textContent?.includes("7-Star Hero Crystal Shards"))!
  expect(shards.textContent).toContain("82.50%")
  expect([...shards.querySelectorAll("li")].map(option => option.textContent)).toEqual(["×100", "×250"])
  expect(shards.textContent).not.toContain("×5,000")
})

it("keeps exact nested crystal links alongside the complete mixed disclosure", async () => {
  await render("paragon_crystal_v2")
  expect([...container.querySelectorAll("a")].map(anchor => anchor.getAttribute("href"))).toEqual(["/crystals/sg_5star_nexus_crystal", "/crystals/sg_6star_nexus_crystal"])
  expect(container.querySelectorAll('[data-odds-row]')).toHaveLength(6)
  expect(container.querySelectorAll('[data-reward-artwork]')).toHaveLength(2)
  expect(container.textContent).toContain("Choose 1 of 3")
  expect(container.textContent).toContain("7-Star Hero")
})

it("always sorts high to low inside each existing prize group without changing group order or boundaries", async () => {
  const opening = await render("superior_banquet_crystal_dec25")
  const original = structuredClone(opening.rewardPresentation)
  expectNoRewardToolbar()
  const navigation = container.querySelector('[aria-label="Reward prize groups"]')!
  expect(navigation.parentElement).toBe(container.querySelector("#crystal-other-rewards"))
  for (const selected of ["all", "PRIZE 2", "all"]) {
    const control = selected === "all" ? "Show all prize groups" : `Show ${selected.replace("PRIZE", "Prize")}`
    await act(async () => container.querySelector<HTMLButtonElement>(`[aria-label="${control}"]`)!.click())
    const rendered = [...container.querySelectorAll('article[aria-label^="Prize "]')]
    const sources = opening.rewardPresentation.groups.filter(group => selected === "all" || group.name === selected)
    expect(rendered.map(group => group.getAttribute("aria-label"))).toEqual(sources.map(group => group.name!.replace("PRIZE", "Prize")))
    for (const [index, group] of rendered.entries()) {
      const source = sources[index]
      const expected = [...source.rows].sort((a, b) => Number(b.rate.percentValue) - Number(a.rate.percentValue))
      expect(rowKeys(group)).toEqual(expected.map(row => row.key))
    }
  }
  expect(opening.rewardPresentation).toEqual(original)
})

it("keeps expanded class and amount families open across prize group changes and remembers manual closing", async () => {
  const opening = await render()
  const fragments = opening.rewardPresentation.groups.flatMap(group => group.rows).find(row => row.rate.label === "Tier 6 Class Catalyst Fragments")!
  const row = container.querySelector<HTMLDetailsElement>(`[data-odds-row="${fragments.key}"]`)!
  await act(async () => { row.open = true; row.dispatchEvent(new Event("toggle")) })
  const gold = container.querySelector<HTMLDetailsElement>('[aria-label="Prize 2"] details')!
  await act(async () => { gold.open = true; gold.dispatchEvent(new Event("toggle")) })
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show Prize 3"]')!.click())
  expect(container.querySelector(`[data-odds-row="${fragments.key}"]`)).toBeNull()
  expect(container.querySelector('[aria-label="Prize 2"]')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show all prize groups"]')!.click())
  const moved = container.querySelector<HTMLDetailsElement>(`[data-odds-row="${fragments.key}"]`)!
  expect(moved.open).toBe(true)
  const restoredGold = container.querySelector<HTMLDetailsElement>('[aria-label="Prize 2"] details')!
  expect(restoredGold.open).toBe(true)
  expect([...restoredGold.querySelectorAll("li")].map(option => option.textContent)).toEqual(["×250,000", "×500,000", "×1,000,000", "×2,500,000"])
  expect(moved.querySelectorAll('[aria-label="Reward variants"] > li')).toHaveLength(6)
  expect(moved.querySelectorAll('[title="Server-disclosed value: 31.26%"]')).toHaveLength(1)
  expect([...moved.querySelectorAll("li li")].every(option => !option.textContent?.includes("%"))).toBe(true)
  await act(async () => { moved.open = false; moved.dispatchEvent(new Event("toggle")) })
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show Prize 2"]')!.click())
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show all prize groups"]')!.click())
  expect(container.querySelector<HTMLDetailsElement>(`[data-odds-row="${fragments.key}"]`)!.open).toBe(false)
  expect(container.querySelector('[aria-label="Prize 2"] [data-certain]')?.textContent).toBe("100.00%")
  expect(container.querySelector('[aria-label="Prize 3"] [data-certain]')?.textContent).toBe("100.00%")
})

it("leaves unrated rewards last in original order, with stable numeric ties and zero", async () => {
  const base = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation
  const template = base.groups[0].rows[0]
  const presentation: CrystalRewardPresentation = { ...base, groups: [{ ...base.groups[0], rows: ["10", "2", "0", "2.00"].map((percentValue, sourceIndex) => ({
    ...template, key: `0:${sourceIndex}`, rate: { ...template.rate, sourceIndex, percentValue }, variants: [],
  })) }], unrated: base.groups.filter(group => group.guaranteed).flatMap(group => group.rows.flatMap(row => row.variants)) }
  await act(async () => root.render(<CrystalRewardsBrowser presentation={presentation} />))
  expect([...container.querySelectorAll('[data-unrated]')].map(row => row.getAttribute("data-reward-category"))).toEqual(presentation.unrated.map(variant => variant.reward.categoryId))
  expect([...container.querySelectorAll('[data-unrated] strong')].map(label => label.textContent?.toLocaleLowerCase("en"))).toEqual(presentation.unrated.map(variant => variant.label.toLocaleLowerCase("en")))
  expect(container.querySelector('[title="Server-disclosed value: 0%"]')?.textContent).toBe("0.00%")
  expect(rowKeys()).toEqual(["0:0", "0:1", "0:3", "0:2"])
  const lastRated = container.querySelector('[data-odds-row="0:2"]')!
  const firstUnrated = container.querySelector('[data-unrated]')!
  expect(lastRated.compareDocumentPosition(firstUnrated) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(firstUnrated.querySelector('[title^="Server-disclosed"]')).toBeNull()
})

it("preserves exact nested destinations, selection and browse return state in fixed rate order", async () => {
  const mixed = loadCrystalPageRewards("paragon_crystal_v2")!.rewardPresentation
  const extra = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation.groups.find(group => group.name === "PRIZE 2")!
  const presentation = { ...mixed, groups: [...mixed.groups, extra] }
  const returnTo = "/crystals?q=paragon&reward=mixed&sort=name"
  await act(async () => root.render(<CrystalBrowseBoundary returnTo={returnTo}><CrystalRewardsBrowser presentation={presentation} /></CrystalBrowseBoundary>))
  const hrefs = () => [...container.querySelectorAll("a")].map(anchor => anchor.getAttribute("href"))
  const destinations = hrefs().map(href => new URL(href!, "https://cerebro.test"))
  expect(destinations.map(url => url.pathname)).toEqual(["/crystals/sg_5star_nexus_crystal", "/crystals/sg_6star_nexus_crystal"])
  for (const destination of destinations) expect(destination.searchParams.get("returnTo")).toBe(returnTo)
  expect(container.textContent).toContain("Choose 1 of 3")
  expect(rowKeys(container.querySelector('article[aria-label="Reward group 1"]')!)).toHaveLength(6)
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show Prize 2"]')!.click())
  expect(hrefs()).toEqual([])
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show all prize groups"]')!.click())
  expect(hrefs()).toEqual(destinations.map(url => `${url.pathname}${url.search}`))
  expect(container.textContent).toContain("Choose 1 of 3")
})

it("preserves unrated amount disclosures and original source order through group selection", async () => {
  const base = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation
  const unrated = base.groups.filter(group => group.guaranteed).flatMap(group => group.rows.flatMap(row => row.variants))
  await act(async () => root.render(<CrystalRewardsBrowser presentation={{ ...base, unrated }} />))
  const originalOrder = [...container.querySelectorAll('[data-unrated]')].map(row => row.textContent)
  const gold = container.querySelector<HTMLDetailsElement>('details[data-unrated]')!
  await act(async () => { gold.open = true; gold.dispatchEvent(new Event("toggle")) })
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show Prize 1"]')!.click())
  expect(container.querySelector('[data-unrated]')).toBeNull()
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Other recorded")!.click())
  expect(rowKeys()).toEqual([])
  expect(container.querySelector<HTMLDetailsElement>('details[data-unrated]')!.open).toBe(true)
  expect([...container.querySelectorAll('[data-unrated]')].map(row => row.textContent)).toEqual(originalOrder)
  expect(container.querySelector('[data-unrated] [title^="Server-disclosed"]')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show all prize groups"]')!.click())
  expect(container.querySelector<HTMLDetailsElement>('details[data-unrated]')!.open).toBe(true)
  expect([...container.querySelectorAll('[data-unrated]')].map(row => row.textContent)).toEqual(originalOrder)
})

it("keeps conditional ascension bonuses independent of sorted mixed champion rates", async () => {
  const opening = loadCrystalPageRewards("elder_web_of_corruption_saga_crystal")!
  const originalBonuses = structuredClone(opening.conditionalBonuses)
  await act(async () => root.render(<><CrystalRewardsBrowser presentation={opening.rewardPresentation} /><CrystalOpeningRules opening={opening} /></>))
  const bonusSection = container.querySelector('[data-bonus-outcome]')!.closest("section")!
  expect(bonusSection.querySelectorAll('[data-bonus-outcome]')).toHaveLength(8)
  expect([...bonusSection.querySelectorAll('[data-bonus-outcome]')].map(outcome => outcome.getAttribute("data-bonus-outcome")).sort()).toEqual(originalBonuses.map(bonus => bonus.key).sort())
  expect(container.querySelector('#crystal-other-rewards [data-bonus-outcome]')).toBeNull()
  expect(rowKeys()).toEqual(["0:3", "0:2", "0:1", "0:0"])
  expect(opening.conditionalBonuses).toEqual(originalBonuses)
})

it("preserves unknown-only and simple rewards without any empty toolbar or drop section", async () => {
  const base = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation
  const unrated = base.groups.flatMap(group => group.rows.flatMap(row => row.variants))
  await act(async () => root.render(<CrystalRewardsBrowser presentation={{ groups: [], unrated, championOdds: null, hasRates: false }} />))
  expectNoRewardToolbar()
  expect(container.querySelector('nav')).toBeNull()
  expect([...container.querySelectorAll('[data-unrated]')].map(row => row.getAttribute("data-reward-category"))).toEqual(unrated.map(variant => variant.reward.categoryId))
  expect(container.querySelector('[data-crystal-odds]')).toBeNull()
  expect(container.textContent).toContain("Other rewards")
  expect(container.textContent).not.toContain("Rewards & drop rates")
  expect(rowKeys()).toEqual([])
  await act(async () => root.render(<CrystalRewardsBrowser presentation={{ ...base, groups: [], unrated: [] }} />))
  expect(container.innerHTML).toBe("")
  await act(async () => root.render(<CrystalRewardsBrowser presentation={{ ...base, groups: [{ ...base.groups[0], rows: base.groups[0].rows.slice(0, 1) }], unrated: [] }} />))
  expectNoRewardToolbar()
  expect(container.querySelector('nav')).toBeNull()
  expect(rowKeys()).toHaveLength(1)
})
