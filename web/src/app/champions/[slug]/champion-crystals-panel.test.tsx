// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { ChampionCrystal, ChampionCrystalAvailability } from "@cerebro/core/domain/champion-crystals"
import { ChampionCrystalsPanel } from "./champion-crystals-panel"

const crystal = (id: string, category: ChampionCrystal["category"] = "events", rarities = [7]): ChampionCrystal => ({
  name: id.toUpperCase(), sourceIds: [id], rarities, category, isMainPool: category === "main", selection: null,
})
const data = (crystals: ChampionCrystal[]): ChampionCrystalAvailability => ({ observedAt: "2026-11-03T09:10:42+00:00", crystals })
const availability = data([crystal("titan", "main"), crystal("six", "main", [6]), crystal("old_event")])
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
const render = async (availability: ChampionCrystalAvailability, rarity = "7", slug = "hulk") => act(async () => root.render(<ChampionCrystalsPanel availability={availability} selectedRarity={rarity} championName={slug} championSlug={slug} embedded />))
const group = (id: string) => document.querySelector<HTMLElement>(`[data-crystal-category="${id}"]`)!
const cards = (id: string) => group(id).querySelectorAll("[data-crystal-family]")
const more = async (id: string) => act(async () => group(id).querySelector<HTMLButtonElement>('button[aria-controls]')!.click())
const search = async (value: string) => act(async () => {
  const input = document.querySelector<HTMLInputElement>('input[type="search"]')!
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
})
const select = async (value: string) => act(async () => {
  const input = document.querySelector<HTMLSelectElement>("select")!
  input.value = value
  input.dispatchEvent(new Event("change", { bubbles: true }))
})

it("keeps category headings, bounded previews and expansion controls in one ordered shared layout", async () => {
  await render(data([crystal("titan", "main"), crystal("spot_a", "spotlight"), crystal("spot_b", "spotlight"),
    ...Array.from({ length: 4 }, (_, i) => crystal(`event_${i}`)), crystal("other", "other")]))
  const layout = document.querySelector('[data-crystal-category-layout]')!
  expect([...layout.querySelectorAll('[data-crystal-category]')].map(section => section.getAttribute("data-crystal-category"))).toEqual(["main", "spotlight", "events", "other"])
  for (const section of layout.querySelectorAll('[data-crystal-category]')) {
    expect(section.querySelector(`[id="${section.getAttribute("aria-labelledby")}"]`)).toBeTruthy()
  }
  const control = group("events").querySelector<HTMLButtonElement>('button[aria-controls]')!
  expect(group("events").querySelector(`[id="${control.getAttribute("aria-controls")}"]`)).toBeTruthy()
  expect(control.getAttribute("aria-expanded")).toBe("false")
  await more("events")
  expect(cards("events")).toHaveLength(4)
  expect([...layout.querySelectorAll('[data-crystal-category]')].map(section => section.getAttribute("data-crystal-category"))).toEqual(["main", "spotlight", "events", "other"])
  await act(async () => [...group("events").querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.startsWith("Show less"))!.click())
  expect(cards("events")).toHaveLength(3)
  await search("event_3")
  expect(layout.querySelectorAll('[data-crystal-category]')).toHaveLength(1)
  expect(cards("events")).toHaveLength(1)
  await search("missing")
  expect(layout.querySelectorAll('[data-crystal-category]')).toHaveLength(0)
  expect(document.body.textContent).toContain("No matching crystals")
})

it("shows accurate category totals, bounds every preview, and exposes all remaining categories", async () => {
  const rows = [crystal("titan", "main"), ...Array.from({ length: 30 }, (_, i) => crystal(`featured_${i}`, "featured")),
    crystal("class", "classes"), crystal("spotlight", "spotlight"), crystal("mode", "modes"), crystal("event", "events"), { ...crystal("unknown"), category: undefined }]
  await render(data(rows))
  expect([...document.querySelectorAll("[data-crystal-category]")].map(el => el.getAttribute("data-crystal-category"))).toEqual(["main", "featured", "classes", "spotlight", "modes", "events", "other"])
  expect(cards("featured")).toHaveLength(3)
  expect(group("featured").querySelector("h4")?.textContent).toBe("Featured rotations 30")
  expect(cards("modes")).toHaveLength(0)
  expect(document.querySelectorAll("[data-crystal-family]")).toHaveLength(6)
  expect(document.querySelectorAll("[data-compact-crystal-grid]")).toHaveLength(4)
  expect(document.querySelectorAll("[data-compact-crystal-card]")).toHaveLength(6)
  expect(document.querySelector('[role="status"]')?.textContent).toContain("36 crystal pools")
  await more("modes")
  expect(cards("modes")).toHaveLength(1)
  await act(async () => group("modes").querySelector<HTMLButtonElement>('button:not([aria-controls])')!.click())
  expect(cards("modes")).toHaveLength(0)
  // Every source remains reachable; expansion never repeats main pools or keys.
  for (const id of ["featured", "events", "other"]) {
    while (group(id).querySelector('button[aria-controls]')) await more(id)
  }
  expect(cards("featured")).toHaveLength(30)
  expect(new Set([...document.querySelectorAll("[data-crystal-family]")].map(el => el.getAttribute("data-crystal-family"))).size).toBe(document.querySelectorAll("[data-crystal-family]").length)
  await act(async () => group("featured").querySelector<HTMLButtonElement>('button:not([aria-controls])')!.click())
  expect(cards("featured")).toHaveLength(3)
})

it("bounds main-pool previews and allows complete expansion too", async () => {
  await render(data(Array.from({ length: 7 }, (_, i) => crystal(`main_${i}`, "main"))))
  expect(cards("main")).toHaveLength(3)
  await more("main")
  expect(cards("main")).toHaveLength(7)
})

it("searches hidden records and closed categories as well as main pools, with coherent filtering and recovery", async () => {
  await render(data([crystal("main", "main"), crystal("featured", "featured"), crystal("class", "classes"), crystal("spotlight", "spotlight"),
    ...Array.from({ length: 20 }, (_, i) => crystal(`event_${i}`))]))
  expect(cards("events")).toHaveLength(0)
  await search("event_19")
  expect(document.body.textContent).toContain("EVENT_19")
  expect(cards("events")).toHaveLength(1)
  expect(document.querySelector('[role="status"]')?.textContent).toContain("1 crystal pool matching")
  await search("main")
  expect(cards("main")).toHaveLength(1)
  await select("main")
  await search("event_19")
  expect(document.body.textContent).toContain("No matching crystals")
  expect(document.querySelector('option[value="main"]')?.textContent).toContain("(0)")
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find(el => el.textContent === "Clear filters")!.click())
  expect(document.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("")
  expect(document.querySelector<HTMLSelectElement>("select")?.value).toBe("all")
  expect(cards("events")).toHaveLength(0)
})

it("resets expansion on search, star, champion and snapshot changes without requiring a parent key", async () => {
  const rows = data([...Array.from({ length: 20 }, (_, i) => crystal(`event_${i}`)), crystal("six", "main", [6])])
  await render(rows)
  await more("events")
  expect(cards("events")).toHaveLength(15)
  await search("event")
  expect(cards("events")).toHaveLength(3)
  await render(rows, "6")
  expect(document.body.textContent).toContain("SIX")
  expect(document.body.textContent).not.toContain("EVENT_0")
  expect(document.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe("")
  await render(rows, "7", "gwenom")
  expect(cards("events")).toHaveLength(3)
  await more("events")
  await render({ ...rows, observedAt: "2026-11-04T09:10:42+00:00" }, "7", "gwenom")
  expect(cards("events")).toHaveLength(3)
})

it("loads selected-star categories on mounting the lazy tab even when main pools exist; retains them on failure and retry", async () => {
  const fetchPools = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, json: async () => data([crystal("event")]) })
  vi.stubGlobal("fetch", fetchPools)
  await render({ ...data([crystal("main", "main")]), otherCounts: { "7": 1 } })
  expect(fetchPools).toHaveBeenCalledTimes(1)
  expect(document.body.textContent).toContain("MAIN")
  expect(document.body.textContent).toContain("Could not load")
  await act(async () => [...document.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === "Try again")!.click())
  expect(fetchPools).toHaveBeenCalledTimes(2)
  expect(fetchPools.mock.calls[0][0]).toBe("/api/champions/hulk/crystals?rarity=7")
  expect(cards("events")).toHaveLength(1)
})

it("shows recorded categories by default without a main pool or a network request for supplied data", async () => {
  const fetchPools = vi.fn()
  vi.stubGlobal("fetch", fetchPools)
  await render(data([crystal("event")]))
  expect(document.body.textContent).not.toContain("No main-pool")
  expect(cards("events")).toHaveLength(1)
  expect(fetchPools).not.toHaveBeenCalled()
})

it("does not request or leak lower-star sources when the selected stars have no recorded crystals", async () => {
  const fetchPools = vi.fn()
  vi.stubGlobal("fetch", fetchPools)
  await render({ ...data([crystal("six", "main", [6])]), otherCounts: { "6": 4 } })
  expect(document.body.textContent).toBe("")
  expect(document.body.textContent).not.toContain("SIX")
  expect(document.body.textContent).not.toMatch(/unobtainable|cannot be obtained/i)
  expect(fetchPools).not.toHaveBeenCalled()
})

it("aborts a stale star request and ignores its eventual response", async () => {
  let finish!: (value: unknown) => void
  const fetchPools = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue({ ok: true, json: async () => data([crystal("six_event", "events", [6])]) })
  vi.stubGlobal("fetch", fetchPools)
  const summary = { ...data([]), otherCounts: { "7": 1, "6": 1 } }
  await render(summary)
  await render(summary, "6")
  expect(fetchPools.mock.calls[0][1].signal.aborted).toBe(true)
  await act(async () => finish({ ok: true, json: async () => data([crystal("stale")]) }))
  expect(document.body.textContent).toContain("SIX_EVENT")
  expect(document.body.textContent).not.toContain("STALE")
})

it("rejects a newer pool snapshot and exposes reload recovery", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ...data([crystal("event")]), observedAt: "2026-11-04T09:10:42+00:00" }) }))
  await render({ ...data([crystal("main", "main")]), otherCounts: { "7": 1 } })
  expect(document.body.textContent).toContain("Reload this page")
  expect(document.querySelector('[data-crystal-family="event"]')).toBeNull()
})

it.each([false, true])("retains source icons, exact opening links, selected stars and champion return context without artwork galleries (embedded %s)", async embedded => {
  const rows = [
    { ...crystal("basic", "main"), artworkUrl: "/images/basic.webp", bannerArtworkUrl: "/images/banner.webp", family: { id: "basic", name: "Hero pool", variantLabel: "Standard", variantOrder: 0 } },
    { ...crystal("nexus", "main"), selection: { draw: 3, pick: 1 }, family: { id: "basic", name: "Hero pool", variantLabel: "Nexus", variantOrder: 1 } },
    { ...crystal("epoch", "main"), selection: { draw: 5, pick: 1 }, family: { id: "basic", name: "Hero pool", variantLabel: "Epoch Nexus", variantOrder: 2 } },
    { ...crystal("six_nexus", "main", [6]), family: { id: "basic", name: "Hero pool", variantLabel: "Six only", variantOrder: 3 } },
  ]
  await act(async () => root.render(<ChampionCrystalsPanel availability={data(rows)} selectedRarity="7" championName="Hulk" championSlug="hulk" embedded={embedded} />))
  expect(document.querySelectorAll("[data-crystal-family]")).toHaveLength(1)
  expect(new URL(document.querySelector<HTMLAnchorElement>('[data-crystal-family] a')!.href).pathname).toBe("/crystals/basic")
  expect([...document.querySelectorAll('[data-crystal-opening]')].map(el => el.textContent)).toEqual(["Nexus · Choose 1 of 3", "Epoch Nexus · Choose 1 of 5"])
  expect(document.body.textContent).not.toContain("Standard · One reward")
  expect(document.body.textContent).toContain("Choose 1 of 3")
  expect(document.body.textContent).toContain("Choose 1 of 5")
  expect(document.body.textContent).not.toContain("Six only")
  expect(document.body.textContent).toContain("7★")
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>('[data-crystal-family] a')) {
    const url = new URL(anchor.href)
    expect(url.searchParams.get("rarity")).toBe("7")
    expect(url.searchParams.get("returnTo")).toBe("/champions/hulk?rarity=7&tab=crystals")
  }
  expect([...document.querySelectorAll<HTMLAnchorElement>("a[data-crystal-opening]")].map(el => new URL(el.href).pathname)).toEqual(["/crystals/nexus", "/crystals/epoch"])
  expect(document.querySelectorAll("img[data-game-crystal-artwork]")).toHaveLength(1)
  expect(document.querySelector("img")?.getAttribute("src")).toContain("basic.webp")
  expect(document.querySelector("img")?.getAttribute("alt")).toBe("")
  expect(document.querySelector("img")?.parentElement?.getAttribute("aria-hidden")).toBe("true")
  expect(document.querySelector('[data-crystal-family] button, details, a a, a button')).toBeNull()
  expect(document.body.textContent).not.toContain("Artwork")
  expect([...document.images].some(img => img.getAttribute("src")?.includes("banner"))).toBe(false)
})

it("links the exact matching variant when its family anchor is absent at the selected stars", async () => {
  await render(data([{ ...crystal("nexus", "main"), family: { id: "basic", name: "Hero pool", variantLabel: "Nexus", variantOrder: 1 } }]))
  expect(new URL(document.querySelector<HTMLAnchorElement>('[data-crystal-family] a')!.href).pathname).toBe("/crystals/nexus")
})

it("keeps recorded selection quantities together with their exact source, without synthesizing pool totals", async () => {
  await render(data([{ ...crystal("two_of_five", "events"), selection: { draw: 5, pick: 2 } }]))
  const link = document.querySelector<HTMLAnchorElement>('[data-crystal-family] a')!
  expect(link.textContent).toContain("Selection · Choose 2 of 5")
  expect(link.getAttribute("aria-label")).toContain("Selection · Choose 2 of 5")
  expect(new URL(link.href).pathname).toBe("/crystals/two_of_five")
  expect(document.querySelectorAll('[data-crystal-family] a')).toHaveLength(1)
  expect(document.querySelector('[data-crystal-champion-count]')).toBeNull()
  expect(document.querySelector('a a')).toBeNull()
})

it("leaves embedded provenance to the host without repeated boilerplate or invented counts", async () => {
  await render(availability)
  expect(document.querySelector("time")).toBeNull()
  expect(document.body.textContent).not.toContain("without drop rates")
  expect(document.body.textContent).not.toContain("Possible champion reward")
  expect(document.querySelector('[data-crystal-champion-count]')).toBeNull()
  expect(document.body.textContent).not.toContain("Availability unverified")
  await act(async () => root.render(<ChampionCrystalsPanel availability={availability} selectedRarity="7" championName="Hulk" />))
  expect(document.body.textContent).toContain("3 Nov 2026")
  expect(document.body.textContent).toContain("without drop rates")
})
