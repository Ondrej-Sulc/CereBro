// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
vi.mock("next/image", () => ({ default: ({ sizes: _sizes, ...props }: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }))
vi.mock("next/link", () => ({ default: ({ prefetch: _prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean | null }) => <a {...props} /> }))
import { loadCrystalPageRewards } from "@/lib/data/crystal-page-rewards"
import { CrystalRewardsBrowser } from "./crystal-rewards-browser"

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  container = document.createElement("div")
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals() })

async function render(id = "superior_banquet_crystal_dec24") {
  const opening = loadCrystalPageRewards(id)!
  await act(async () => root.render(<CrystalRewardsBrowser presentation={opening.rewardPresentation} />))
  return opening
}
async function search(value: string) {
  const input = container.querySelector<HTMLInputElement>('[aria-label="Search rewards"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

it("shows all four Elder Web of Corruption rates together in the original source order", async () => {
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
  expect([...container.querySelectorAll("a")].map(anchor => anchor.getAttribute("href"))).toEqual(["/crystals/sg_5star_nexus_crystal", "/crystals/sg_6star_nexus_crystal"])
  expect(container.querySelectorAll('[data-odds-row]')).toHaveLength(6)
  expect(container.querySelectorAll('[data-reward-artwork]')).toHaveLength(2)
  expect(container.textContent).toContain("Choose 1 of 3")
  expect(container.textContent).toContain("7-Star Hero")
})
