// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ChampionClass } from "@prisma/client"
vi.mock("next/link", () => ({ default: ({ prefetch, scroll, onNavigate, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean; scroll?: boolean; onNavigate?: unknown }) => {
  void prefetch; void scroll; void onNavigate
  return <a {...props} />
} }))
vi.mock("next/image", () => ({ default: (props: ImgHTMLAttributes<HTMLImageElement>) => <img {...props} /> }))
import type { CrystalChampion } from "@/lib/data/crystals"
import { CrystalChampionGrid } from "./crystal-champion-grid"
import { CrystalPoolBrowser } from "./crystal-pool-browser"

const champions: CrystalChampion[] = [
  { gameId: "hulk", name: "Hulk", slug: "hulk", portraitUrl: "/hulk.png", championClass: ChampionClass.SCIENCE, rarities: [6, 7], obtainable: ["6", "7"], firstEditionRarities: [7] },
  { gameId: "source-only", name: "Unmapped Champion", slug: null, portraitUrl: null, championClass: null, rarities: [6], obtainable: [] },
]
const smallPool: CrystalChampion[] = [
  ["domino", "Domino", ChampionClass.MUTANT],
  ["hyperion", "Hyperion", ChampionClass.COSMIC],
  ["misterknight", "Mr. Knight", ChampionClass.SKILL],
  ["omegasentinel", "Omega Sentinel", ChampionClass.TECH],
  ["purgatory", "Purgatory", ChampionClass.MYSTIC],
  ["rhino", "Rhino", ChampionClass.SCIENCE],
].map(([gameId, name, championClass]) => ({ gameId, name, championClass: championClass as ChampionClass, slug: gameId, portraitUrl: `/${gameId}.png`, rarities: [7], obtainable: ["7"] }))
const poolData = (count: number) => ({ id: "7star_night_and_day_nexus_crystal", champions: Array.from({ length: count }, (_, i) => ({ ...smallPool[i % 6], gameId: `${smallPool[i % 6].gameId}-${i}` })), q: "", rarity: "7", championClass: "all", rarities: [7], classes: smallPool.map(c => c.championClass!), championCount: count })
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  document.body.innerHTML = '<div id="root"></div>'
  localStorage.clear()
  root = createRoot(document.getElementById("root")!)
})

it("offers a persistent names view without losing compact portrait navigation", async () => {
  await act(async () => root.render(<CrystalChampionGrid champions={champions} rarity="7" />))
  const list = document.querySelector('ul[aria-label="Champions in this crystal"]')!
  expect(list.textContent).not.toContain("Hulk")
  const toggle = [...document.querySelectorAll("button")].find(button => button.textContent === "Show names")!
  await act(async () => toggle.click())
  expect(toggle.getAttribute("aria-pressed")).toBe("true")
  expect(list.textContent).toContain("Hulk")
  expect(localStorage.getItem("cerebro:crystal-portrait-names")).toBe("true")
  await act(async () => root.render(<CrystalChampionGrid champions={[...champions]} rarity="6" />))
  expect(document.querySelector('ul[aria-label="Champions in this crystal"]')?.textContent).toContain("Hulk")
})

it("moves through the measured portrait rows with arrows and keeps one tab stop", async () => {
  const many = Array.from({ length: 9 }, (_, index) => ({ ...champions[0], gameId: `champion-${index}`, name: `Champion ${index}` }))
  await act(async () => root.render(<CrystalChampionGrid champions={many} rarity="7" />))
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-champion-portrait]')]
  buttons.forEach((button, index) => Object.defineProperty(button, "offsetTop", { value: Math.floor(index / 3) * 76 }))
  await act(async () => buttons[0].focus())
  const key = async (value: string) => { await act(async () => document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true }))) }
  await key("ArrowRight"); expect(document.activeElement).toBe(buttons[1])
  await key("ArrowDown"); expect(document.activeElement).toBe(buttons[4])
  await key("ArrowUp"); expect(document.activeElement).toBe(buttons[1])
  await key("End"); expect(document.activeElement).toBe(buttons[8])
  await key("ArrowRight"); expect(document.activeElement).toBe(buttons[8])
  await key("Home"); expect(document.activeElement).toBe(buttons[0])
  expect(buttons.filter(button => button.tabIndex === 0)).toHaveLength(1)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })

it("identifies portraits accessibly and opens details before navigating on tap", async () => {
  await act(async () => root.render(<CrystalChampionGrid champions={champions} rarity="7" />))
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-label="Hulk, 7★, Science. Show details"]')!
  expect(trigger).toBeTruthy()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.querySelector('img[src="/hulk.png"]')?.getAttribute("loading")).toBe("lazy")
  await act(async () => trigger.click())
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.querySelector("h3")?.textContent).toBe("Hulk")
  expect(dialog.textContent).toContain("7★ · Science")
  expect(dialog.textContent).toContain("First Edition available at 7★")
  expect(dialog.querySelector("a")?.getAttribute("href")).toBe("/champions/hulk?rarity=7")
  expect(trigger.getAttribute("aria-expanded")).toBe("true")
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="Close champion details"]')!.click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await vi.waitFor(() => expect(document.activeElement).toBe(trigger))
})

it("keeps exact stars in details and supports Escape and source-only rewards", async () => {
  await act(async () => root.render(<CrystalChampionGrid champions={champions} rarity="" />))
  const triggers = [...document.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="dialog"]')]
  expect(triggers).toHaveLength(2)
  await act(async () => triggers[0].click())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("6★ · 7★ · Science")
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await vi.waitFor(() => expect(document.activeElement).toBe(triggers[0]))
  await act(async () => triggers[1].click())
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.querySelector("h3")?.textContent).toBe("Unmapped Champion")
  expect(dialog.textContent).toContain("6★")
  expect(dialog.textContent).toContain("No champion page yet")
  expect(dialog.querySelector("a")).toBeNull()
})

it("does not add unsupported rarity parameters to champion profile links", async () => {
  await act(async () => root.render(<CrystalChampionGrid champions={[{ ...champions[0], obtainable: ["6"], firstEditionRarities: undefined }]} rarity="7" />))
  await act(async () => document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"]')!.click())
  expect(document.querySelector('[role="dialog"] a')?.getAttribute("href")).toBe("/champions/hulk")
  expect(document.querySelector('[role="dialog"]')?.textContent).not.toContain("First Edition")
})

it("shares one details dialog across a large pool and restores focus to the selected portrait", async () => {
  const many = Array.from({ length: 180 }, (_, index) => ({ ...champions[0], gameId: `champion-${index}`, name: `Champion ${index}` }))
  await act(async () => root.render(<CrystalChampionGrid champions={many} rarity="7" />))
  const triggers = [...document.querySelectorAll<HTMLButtonElement>('[data-champion-portrait]')]
  expect(triggers).toHaveLength(180)
  await act(async () => triggers[0].click())
  await act(async () => triggers[179].click())
  expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)
  expect(document.querySelector('[role="dialog"] h3')?.textContent).toBe("Champion 179")
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  await vi.waitFor(() => expect(document.activeElement).toBe(triggers[179]))
  expect(triggers.filter(trigger => trigger.tabIndex === 0)).toEqual([triggers[179]])
})

it("lets users focus search outside the dialog and closes details removed by filtering", async () => {
  await act(async () => root.render(<><input aria-label="Outside search" /><CrystalChampionGrid champions={champions} rarity="7" /></>))
  const trigger = document.querySelector<HTMLButtonElement>('[data-champion-portrait]')!
  await act(async () => trigger.click())
  const input = document.querySelector<HTMLInputElement>('input')!
  await act(async () => { input.focus(); await new Promise(resolve => setTimeout(resolve, 10)) })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(document.activeElement).toBe(input)
  await act(async () => trigger.click())
  await act(async () => root.render(<><input aria-label="Outside search" /><CrystalChampionGrid champions={[champions[1]]} rarity="7" /></>))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await act(async () => root.render(<><input aria-label="Outside search" /><CrystalChampionGrid champions={champions} rarity="7" /></>))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it("shows every small-pool name and exact star/class without requiring the names preference", async () => {
  await act(async () => root.render(<CrystalPoolBrowser data={{ ...poolData(6), champions: smallPool }} />))
  const list = document.querySelector('ul[aria-label="Champions in this crystal"]')!
  expect(document.querySelector('input[type="search"]')).toBeNull()
  expect(document.querySelector('[data-champion-toolbar]')).toBeNull()
  const buttons = [...list.querySelectorAll<HTMLButtonElement>('button')]
  expect(buttons).toHaveLength(6)
  buttons.forEach((button, index) => {
    const champion = smallPool[index]
    const championClass = champion.championClass!.charAt(0) + champion.championClass!.slice(1).toLowerCase()
    expect(button.textContent).toBe(`${champion.name}7★ · ${championClass}`)
    expect(button.getAttribute("aria-label")).toBe(`${champion.name}, 7★, ${championClass}. Show details`)
    expect(button.getAttribute("aria-haspopup")).toBe("dialog")
    expect(button.querySelector('img')?.getAttribute("loading")).toBe("lazy")
  })
  expect(buttons.filter(b => b.tabIndex === 0)).toEqual([buttons[0]])
  expect(localStorage.getItem("cerebro:crystal-portrait-names")).toBeNull()
})

it("keeps small cards in measured keyboard order and opens the exact champion/star with focus recovery", async () => {
  await act(async () => root.render(<CrystalChampionGrid champions={smallPool} rarity="7" layout="cards" controls={false} />))
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-champion-portrait]')]
  buttons.forEach((button, index) => Object.defineProperty(button, "offsetTop", { value: Math.floor(index / 2) * 220 }))
  await act(async () => buttons[1].focus())
  await act(async () => buttons[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })))
  expect(document.activeElement).toBe(buttons[3])
  await act(async () => buttons[3].click())
  const dialog = document.querySelector('[role="dialog"]')!
  expect(dialog.querySelector("h3")?.textContent).toBe("Omega Sentinel")
  expect(dialog.textContent).toContain("7★ · Tech")
  expect(dialog.querySelector("a")?.getAttribute("href")).toBe("/champions/omegasentinel?rarity=7")
  await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  await vi.waitFor(() => expect(document.activeElement).toBe(buttons[3]))
  expect(buttons.filter(b => b.tabIndex === 0)).toEqual([buttons[3]])
})

it.each([1, 2, 6, 8])("uses the named gallery for an unfiltered single-star pool of %i", async count => {
  await act(async () => root.render(<CrystalPoolBrowser data={poolData(count)} />))
  expect(document.querySelectorAll('[data-champion-portrait]')).toHaveLength(count)
  expect(document.querySelector('[data-champion-portrait]')?.textContent).toContain("Domino")
  expect(document.querySelector('input[type="search"]')).toBeNull()
  expect(document.querySelector('[data-champion-toolbar]')).toBeNull()
})

it.each([
  { count: 9, rarities: [7], q: "", championClass: "all" },
  { count: 6, rarities: [6, 7], q: "", championClass: "all" },
  { count: 6, rarities: [7], q: "Domino", championClass: "all" },
  { count: 6, rarities: [7], q: "", championClass: "TECH" },
  { count: 180, rarities: [7], q: "Domino", championClass: "all" },
])("retains the dense browser and its filters for $count champions, stars $rarities, query $q, class $championClass", async ({ count, ...filters }) => {
  await act(async () => root.render(<CrystalPoolBrowser data={{ ...poolData(count), ...filters }} />))
  expect(document.querySelector('input[type="search"]')).not.toBeNull()
  expect(document.querySelector('[data-champion-toolbar]')).not.toBeNull()
  expect(document.querySelector('[data-champion-portrait]')?.textContent).toBe("")
})

it("retains source-only small rewards and unknown-class metadata without inventing navigation", async () => {
  await act(async () => root.render(<CrystalChampionGrid champions={[champions[1]]} rarity="6" layout="cards" controls={false} />))
  const trigger = document.querySelector<HTMLButtonElement>('[data-champion-portrait]')!
  expect(trigger.textContent).toBe("UCUnmapped Champion6★")
  expect(trigger.getAttribute("aria-label")).toBe("Unmapped Champion, 6★. Show details")
  await act(async () => trigger.click())
  expect(document.querySelector('[role="dialog"] a')).toBeNull()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain("No champion page yet")
})

it("uses the published larger portrait only in gallery tiles and keeps compact-only sources near native size", async () => {
  const pool = [{ ...smallPool[0], galleryPortraitUrl: "/published-full.png" }, smallPool[1]]
  await act(async () => root.render(<CrystalChampionGrid champions={pool} rarity="7" layout="cards" controls={false} />))
  const images = [...document.querySelectorAll<HTMLImageElement>('[data-champion-portrait] > span > img')]
  expect(images.map(image => [image.getAttribute("src"), image.width, image.height, image.sizes])).toEqual([
    ["/published-full.png", 80, 80, "80px"], ["/hyperion.png", 64, 64, "64px"],
  ])
  await act(async () => root.render(<CrystalChampionGrid champions={pool} rarity="7" controls={false} />))
  const compact = document.querySelector<HTMLImageElement>('[data-champion-portrait] > span > img')!
  expect([compact.getAttribute("src"), compact.width, compact.height, compact.sizes, compact.getAttribute("loading")]).toEqual(["/domino.png", 64, 64, "64px", "lazy"])
})
