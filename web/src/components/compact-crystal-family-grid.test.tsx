// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { ChampionCrystal } from "@cerebro/core/domain/champion-crystals"
import { CompactCrystalFamilyGrid, type CompactCrystalFamily } from "./compact-crystal-family-grid"
import { CrystalBrowseBoundary } from "@/app/crystals/crystal-browse-boundary"
import { consumeCrystalBrowseScroll, parseCrystalReturnTo } from "@/lib/crystal-browse-return"

vi.mock("next/link", () => ({ default: ({ href, prefetch, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean | null }) => {
  void prefetch
  return <a {...props} href={href} onClick={event => { onClick?.(event); event.preventDefault() }} />
} }))

const opening = (id: string, label: string, selection: ChampionCrystal["selection"] = null, rarities = [7]): ChampionCrystal => ({
  name: id, sourceIds: [id], rarities, isMainPool: true, selection,
  family: { id: "hero_shard", name: "Hero pool", variantLabel: label, variantOrder: 0 },
})
const standard = opening("hero_basic", "Standard")
const shard = opening("hero_shard", "Shard version")
const nexus = opening("hero_nexus", "Nexus", { pick: 1, draw: 3 })
const epoch = opening("hero_epoch", "Epoch Nexus", { pick: 1, draw: 5 })
const family = (variants: ChampionCrystal[]): CompactCrystalFamily => ({ id: "hero_shard", name: "Hero pool", artworkUrl: null, variants })
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("scrollY", 1420)
  // The mock link stays on the host. Keep its pending return-restoration frame
  // from consuming the scroll record that this test checks after each click.
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1))
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  sessionStorage.clear()
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/") })
const render = async (value: CompactCrystalFamily, rarity = "7") => act(async () => root.render(<CompactCrystalFamilyGrid families={[value]} rarity={rarity} target={{ name: "Hulk" }} />))
const links = () => [...document.querySelectorAll<HTMLAnchorElement>("[data-compact-crystal-card] a")]
const path = (link: HTMLAnchorElement) => new URL(link.href).pathname

it.each([
  [nexus, shard, standard, epoch],
  [shard, epoch, nexus, standard],
  [standard, nexus, epoch, shard],
])("prefers the exact Standard opening over array order and the family representative (%#)", async (...variants) => {
  await render(family(variants))
  expect(path(links()[0])).toBe("/crystals/hero_basic")
  expect(links()[0].getAttribute("aria-label")).toBe("View Hero pool contents")
  expect(document.querySelector('[data-crystal-opening="hero_basic"]')).toBeNull()
  expect(document.body.textContent).not.toContain("Standard · One reward")
  expect(links().slice(1).map(path).sort()).toEqual(["/crystals/hero_epoch", "/crystals/hero_nexus", "/crystals/hero_shard"])
})

it.each([
  "/crystals/champions?champion=hulk&rarity=7&q=Hero&category=events&page=3",
  "/champions/hulk?rarity=7&tab=crystals",
])("keeps exact alternative quantities, keyboard order and host/scroll context from %s", async host => {
  window.history.replaceState(null, "", host)
  await act(async () => root.render(<CrystalBrowseBoundary returnTo={host}><CompactCrystalFamilyGrid families={[family([nexus, standard, epoch])]} rarity="7" target={{ name: "Hulk" }} returnTo={host.startsWith("/champions/") ? host : undefined} /></CrystalBrowseBoundary>))
  expect(links().map(path)).toEqual(["/crystals/hero_basic", "/crystals/hero_nexus", "/crystals/hero_epoch"])
  expect(links().slice(1).map(link => link.textContent)).toEqual(["Nexus · Choose 1 of 3", "Epoch Nexus · Choose 1 of 5"])
  expect(document.querySelector('nav[aria-label="Hero pool openings"]')?.querySelectorAll("a")).toHaveLength(2)
  expect(document.querySelector("a a, a button, a nav")).toBeNull()
  expect(document.querySelector('[tabindex="-1"]')).toBeNull()
  for (const link of links()) {
    const url = new URL(link.href)
    expect(url.searchParams.get("rarity")).toBe("7")
    expect(url.searchParams.get("returnTo")).toBe(parseCrystalReturnTo(host))
    expect(link.getAttribute("aria-label")).toContain("Hero pool")
    await act(async () => link.focus())
    expect(document.activeElement).toBe(link)
    await act(async () => link.click())
    expect(consumeCrystalBrowseScroll(host, sessionStorage)).toBe(1420)
  }
})

it("omits routine Standard chips, including equivalent Standard aliases, without changing the projection", async () => {
  const value = family([standard, opening("hero_other_standard", "Standard")])
  const before = JSON.stringify(value)
  await render(value)
  expect(links().map(path)).toEqual(["/crystals/hero_basic"])
  expect(document.querySelector("nav")).toBeNull()
  expect(JSON.stringify(value)).toBe(before)
})

it("preserves the family representative and its selection context when Standard is absent", async () => {
  const representative = { ...nexus, sourceIds: ["hero_nexus", "hero_shard"] }
  await render(family([epoch, representative]))
  expect(links().map(path)).toEqual(["/crystals/hero_shard", "/crystals/hero_epoch"])
  expect(links()[0].textContent).toContain("Nexus · Choose 1 of 3")
  expect(links()[0].getAttribute("aria-label")).toContain("Nexus · Choose 1 of 3")
  expect(document.querySelectorAll('[data-crystal-opening]')).toHaveLength(1)
})

it("keeps a single ungrouped selection's pick/draw quantities in its primary link without duplicating it", async () => {
  const selection = { ...opening("two_of_five", "Selection", { pick: 2, draw: 5 }), family: undefined }
  await render({ ...family([selection]), id: "two_of_five", name: "Recorded selection" })
  expect(links().map(path)).toEqual(["/crystals/two_of_five"])
  expect(links()[0].textContent).toContain("Selection · Choose 2 of 5")
  expect(links()[0].getAttribute("aria-label")).toContain("Selection · Choose 2 of 5")
  expect(document.querySelector("nav")).toBeNull()
  expect(document.querySelector('[data-crystal-champion-count]')).toBeNull()
})

it("filters exact stars before choosing Standard or a fallback and omits families with no matching source", async () => {
  const value = family([{ ...standard, rarities: [6] }, nexus, epoch])
  await render(value)
  expect(links().map(path)).toEqual(["/crystals/hero_nexus", "/crystals/hero_epoch"])
  expect(links()[0].textContent).toContain("Nexus · Choose 1 of 3")
  await render(value, "5")
  expect(document.querySelector('[data-compact-crystal-card]')).toBeNull()
})

it("retains only supplied counts and exact matching stars for the all-stars Finder projection", async () => {
  await act(async () => root.render(<CompactCrystalFamilyGrid families={[{ ...family([standard, nexus]), championCount: 18, championCountsByRarity: { "7": 8 } }]} rarity="" target={{ name: "Hulk", rarities: { hero_shard: [7, 6] } }} heading="h5" />))
  expect(document.querySelector("h5")?.textContent).toBe("Hero pool")
  expect(document.body.textContent).toContain("7★ · 6★")
  expect(document.querySelector('[data-crystal-champion-count]')?.textContent).toBe("18 champions · all stars")
  for (const link of links()) expect(new URL(link.href).searchParams.has("rarity")).toBe(false)
  await render(family([standard, nexus]))
  expect(document.querySelector('[data-crystal-champion-count]')).toBeNull()
})
