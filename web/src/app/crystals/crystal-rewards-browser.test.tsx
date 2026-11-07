// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
vi.mock("next/image", () => ({ default: ({ sizes: _sizes, ...props }: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }))
vi.mock("next/link", () => ({ default: ({ prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean | null }) => <a {...props} /> }))
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
async function search(value: string) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="Search rewards"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

async function sortRewards(label: "Rarest first" | "Most common first") {
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Sort rewards"]')!
  await act(async () => trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })))
  const option = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(option => option.textContent === label)!
  expect(option).toBeDefined()
  await act(async () => option.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  expect(trigger.textContent).toBe(label)
  expect(trigger.getAttribute("aria-expanded")).toBe("false")
}

const rowKeys = (host: ParentNode = container) => [...host.querySelectorAll('[data-odds-row]')].map(row => row.getAttribute("data-odds-row"))

it("shows all four Elder Web of Corruption rates together, rarest first", async () => {
  const opening = await render("elder_web_of_corruption_saga_crystal")
  const rows = [...container.querySelectorAll('[data-odds-row]')]
  expect(rows.map(row => row.getAttribute("data-odds-row"))).toEqual(["0:0", "0:1", "0:2", "0:3"])
  expect(rows.map(row => row.querySelector('[title^="Server-disclosed"]')?.getAttribute("title"))).toEqual([
    "Server-disclosed value: 4.05%", "Server-disclosed value: 9.01%", "Server-disclosed value: 18.02%", "Server-disclosed value: 68.92%",
  ])
  for (const [index, row] of rows.entries()) expect(row.textContent).toContain(opening.odds!.groups![0].rows[index].label)
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

it("searches classes and formatted amounts locally without changing category rates", async () => {
  await render()
  await search("28,500")
  const rows = [...container.querySelectorAll('[data-odds-row]')]
  expect(rows.length).toBeGreaterThan(0)
  expect(rows.every(row => row.textContent?.includes("28,500"))).toBe(true)
  expect(container.querySelector('[title="Server-disclosed value: 31.26%"]')?.textContent).toBe("31.26%")
  await search("science")
  expect([...container.querySelectorAll('[data-odds-row]')].every(row => /science/i.test(row.textContent ?? ""))).toBe(true)
  await search("no such reward")
  expect(container.querySelectorAll('[data-odds-row]')).toHaveLength(0)
  expect(container.textContent).toContain("No rewards match these filters")
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Show all rewards")!.click())
  expect(container.querySelector<HTMLInputElement>('input')?.value).toBe("")
  expect(container.querySelectorAll('[data-odds-row]')).toHaveLength(22)
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
  expect([...container.querySelectorAll("a")].map(anchor => anchor.getAttribute("href"))).toEqual(["/crystals/sg_6star_nexus_crystal", "/crystals/sg_5star_nexus_crystal"])
  expect(container.querySelectorAll('[data-odds-row]')).toHaveLength(6)
  expect(container.querySelectorAll('[data-reward-artwork]')).toHaveLength(2)
  expect(container.textContent).toContain("Choose 1 of 3")
  expect(container.textContent).toContain("7-Star Hero")
})

it("defaults to rarest first and switches direction only within each prize group", async () => {
  const opening = await render("superior_banquet_crystal_dec25")
  const original = structuredClone(opening.rewardPresentation)
  expect(container.querySelector('[aria-label="Sort rewards"]')?.textContent).toBe("Rarest first")
  for (const direction of ["rarest", "commonest"] as const) {
    if (direction === "commonest") await sortRewards("Most common first")
    const rendered = [...container.querySelectorAll('article[aria-label^="Prize "]')]
    expect(rendered.map(group => group.getAttribute("aria-label"))).toEqual(opening.rewardPresentation.groups.map(group => group.name!.replace("PRIZE", "Prize")))
    for (const [index, group] of rendered.entries()) {
      const source = opening.rewardPresentation.groups[index]
      const expected = [...source.rows].sort((a, b) => (direction === "rarest" ? 1 : -1) * (Number(a.rate.percentValue) - Number(b.rate.percentValue)))
      expect(rowKeys(group)).toEqual(expected.map(row => row.key))
    }
  }
  expect(opening.rewardPresentation).toEqual(original)
})

it("keeps expanded class/amount families open when sorting moves them between columns", async () => {
  const opening = await render()
  const fragments = opening.rewardPresentation.groups.flatMap(group => group.rows).find(row => row.rate.label === "Tier 6 Class Catalyst Fragments")!
  const row = container.querySelector<HTMLDetailsElement>(`[data-odds-row="${fragments.key}"]`)!
  const column = row.parentElement
  await act(async () => { row.open = true; row.dispatchEvent(new Event("toggle")) })
  await sortRewards("Most common first")
  const moved = container.querySelector<HTMLDetailsElement>(`[data-odds-row="${fragments.key}"]`)!
  expect(moved.parentElement).not.toBe(column)
  expect(moved.open).toBe(true)
  expect(moved.querySelectorAll('[aria-label="Reward variants"] > li')).toHaveLength(6)
  expect(moved.querySelectorAll('[title="Server-disclosed value: 31.26%"]')).toHaveLength(1)
  expect([...moved.querySelectorAll("li li")].every(option => !option.textContent?.includes("%"))).toBe(true)
  await act(async () => { moved.open = false; moved.dispatchEvent(new Event("toggle")) })
  await sortRewards("Rarest first")
  expect(container.querySelector<HTMLDetailsElement>(`[data-odds-row="${fragments.key}"]`)!.open).toBe(false)
  expect(container.querySelector('[aria-label="Prize 2"] [data-certain]')?.textContent).toBe("100.00%")
  expect(container.querySelector('[aria-label="Prize 3"] [data-certain]')?.textContent).toBe("100.00%")
})

it("retains sort through search, prize filtering, empty results and clear filters", async () => {
  await render()
  await sortRewards("Most common first")
  await search("science")
  const descending = rowKeys()
  expect(descending.length).toBeGreaterThan(1)
  await sortRewards("Rarest first")
  expect(container.querySelector<HTMLInputElement>('[aria-label="Search rewards"]')?.value).toBe("science")
  await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Show Prize 1"]')!.click())
  await sortRewards("Most common first")
  expect(container.querySelector('[aria-label="Show Prize 1"]')?.getAttribute("aria-pressed")).toBe("true")
  await search("no such reward")
  expect(rowKeys()).toEqual([])
  expect(container.querySelector('[aria-label="Sort rewards"]')?.textContent).toBe("Most common first")
  await act(async () => [...container.querySelectorAll("button")].find(button => button.textContent === "Clear filters")!.click())
  expect(container.querySelector('[aria-label="Sort rewards"]')?.textContent).toBe("Most common first")
  expect(container.querySelector('[aria-label="Show all prize groups"]')?.getAttribute("aria-pressed")).toBe("true")
  await search("science")
  expect(rowKeys()).toEqual(descending)
  await render()
  expect(container.querySelector('[aria-label="Sort rewards"]')?.textContent).toBe("Most common first")
  expect(container.querySelector<HTMLInputElement>('[aria-label="Search rewards"]')?.value).toBe("science")
  await render("elder_web_of_corruption_saga_crystal")
  expect(container.querySelector('[aria-label="Sort rewards"]')?.textContent).toBe("Rarest first")
})

it("leaves unrated rewards last in original order in either direction, with stable numeric ties and zero", async () => {
  const base = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation
  const template = base.groups[0].rows[0]
  const presentation: CrystalRewardPresentation = { ...base, groups: [{ ...base.groups[0], rows: ["10", "2", "0", "2.00"].map((percentValue, sourceIndex) => ({
    ...template, key: `0:${sourceIndex}`, rate: { ...template.rate, sourceIndex, percentValue }, variants: [],
  })) }], unrated: base.groups.filter(group => group.guaranteed).flatMap(group => group.rows.flatMap(row => row.variants)) }
  await act(async () => root.render(<CrystalRewardsBrowser presentation={presentation} />))
  const unratedKeys = () => [...container.querySelectorAll('[data-unrated]')].map(row => row.getAttribute("data-reward-category"))
  const originalUnrated = unratedKeys()
  expect(originalUnrated.length).toBeGreaterThan(0)
  expect(rowKeys()).toEqual(["0:2", "0:1", "0:3", "0:0"])
  expect(container.querySelector('[title="Server-disclosed value: 0%"]')?.textContent).toBe("0.00%")
  await sortRewards("Most common first")
  expect(rowKeys()).toEqual(["0:0", "0:1", "0:3", "0:2"])
  expect(unratedKeys()).toEqual(originalUnrated)
  const lastRated = container.querySelector('[data-odds-row="0:2"]')!
  const firstUnrated = container.querySelector('[data-unrated]')!
  expect(lastRated.compareDocumentPosition(firstUnrated) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(firstUnrated.querySelector('[title^="Server-disclosed"]')).toBeNull()
})

it("preserves exact nested destinations, selection and browse return state in both directions", async () => {
  const presentation = loadCrystalPageRewards("paragon_crystal_v2")!.rewardPresentation
  const returnTo = "/crystals?q=paragon&reward=mixed&sort=name"
  await act(async () => root.render(<CrystalBrowseBoundary returnTo={returnTo}><CrystalRewardsBrowser presentation={presentation} /></CrystalBrowseBoundary>))
  const hrefs = () => [...container.querySelectorAll("a")].map(anchor => anchor.getAttribute("href"))
  const original = hrefs()
  expect(original).toHaveLength(2)
  for (const href of original) expect(new URL(href!, "https://cerebro.test").searchParams.get("returnTo")).toBe(returnTo)
  await sortRewards("Most common first")
  expect(hrefs()).toEqual([...original].reverse())
  expect(container.textContent).toContain("Choose 1 of 3")
  expect(rowKeys()).toHaveLength(6)
})

it("keeps conditional ascension bonuses independent of sorted mixed champion rates", async () => {
  const opening = loadCrystalPageRewards("elder_web_of_corruption_saga_crystal")!
  const originalBonuses = structuredClone(opening.conditionalBonuses)
  await act(async () => root.render(<><CrystalRewardsBrowser presentation={opening.rewardPresentation} /><CrystalOpeningRules opening={opening} /></>))
  const bonusSection = container.querySelector('[data-bonus-outcome]')!.closest("section")!
  const originalMarkup = bonusSection.innerHTML
  expect(bonusSection.querySelectorAll('[data-bonus-outcome]')).toHaveLength(8)
  expect(container.querySelector('#crystal-other-rewards [data-bonus-outcome]')).toBeNull()
  await sortRewards("Most common first")
  expect(rowKeys()).toEqual(["0:3", "0:2", "0:1", "0:0"])
  expect(bonusSection.innerHTML).toBe(originalMarkup)
  expect(opening.conditionalBonuses).toEqual(originalBonuses)
})

it("preserves unknown-only rewards and renders no empty drop section or meaningless sort", async () => {
  const base = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation
  const unrated = base.groups.flatMap(group => group.rows.flatMap(row => row.variants))
  await act(async () => root.render(<CrystalRewardsBrowser presentation={{ groups: [], unrated, championOdds: null, hasRates: false }} />))
  expect(container.querySelector('[aria-label="Sort rewards"]')).toBeNull()
  expect(container.querySelector('[aria-label="Search rewards"]')).not.toBeNull()
  expect(container.querySelector('[data-crystal-odds]')).toBeNull()
  expect(container.textContent).toContain("Other rewards")
  expect(container.textContent).not.toContain("Rewards & drop rates")
  expect(rowKeys()).toEqual([])
  await act(async () => root.render(<CrystalRewardsBrowser presentation={{ ...base, groups: [], unrated: [] }} />))
  expect(container.innerHTML).toBe("")
  await act(async () => root.render(<CrystalRewardsBrowser presentation={{ ...base, groups: [{ ...base.groups[0], rows: base.groups[0].rows.slice(0, 1) }], unrated: [] }} />))
  expect(container.querySelector('[aria-label="Sort rewards"]')).toBeNull()
})
