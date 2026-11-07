// @vitest-environment jsdom
import { act, StrictMode, type AnchorHTMLAttributes } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
vi.mock("next/link", () => ({ default: ({ href, prefetch: _prefetch, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; prefetch?: boolean | null }) => <a {...props} href={href} onClick={event => { onClick?.(event); event.preventDefault() }} /> }))
import { CrystalBrowseBoundary } from "./crystal-browse-boundary"
import { CrystalIntentLink } from "./crystal-intent-link"
import { ChampionAscensionSourceContent } from "@/components/champion-ascension-source-content"
import { getChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition"
import { CrystalFamilyGrid } from "./crystal-catalog-browser"
import { CompactCrystalFamilyGrid } from "@/components/compact-crystal-family-grid"
import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { crystalBrowseOpeningSummary } from "@/lib/data/crystal-browse-catalog"
import { consumeCrystalBrowseScroll, parseCrystalReturnTo } from "@/lib/crystal-browse-return"

let root: Root
const frames = new Map<number, FrameRequestCallback>()
const scrollTo = vi.fn()
const origin = "/crystals?q=banquet&sort=name&page=3"
let serial = 0
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++serial, callback); return serial })
  vi.stubGlobal("cancelAnimationFrame", (id: number) => { frames.delete(id) })
  vi.stubGlobal("scrollTo", scrollTo)
  vi.stubGlobal("scrollY", 1840)
  frames.clear(); scrollTo.mockClear(); sessionStorage.clear()
  window.history.replaceState(null, "", origin)
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals(); window.history.replaceState(null, "", "/") })

it.each([
  "/crystals/champions?champion=gwenom&q=Gwenom&category=events&page=2",
  "/crystals/champions?champion=gwenom&rarity=7&page=2",
  "/crystals/champions?champion=gwenom&rarity=7&reward=ascension&page=2",
  "/champions/gwenom?rarity=7&tab=crystals",
])("preserves host filters and scroll when opening an exact source from %s", async finder => {
  window.history.replaceState(null, "", finder)
  await act(async () => root.render(<CrystalBrowseBoundary returnTo={finder}><ChampionAscensionSourceContent championName="Gwenom" returnTo={finder} data={{ observedAt: "2026-11-05T14:05:24Z", acquisition: getChampionAscensionAcquisitionSources("gwenom", 7), crystals: [{
    id: "vfh_gwenom_broken_justice_crystal", key: "exact-binding", name: "Broken Justice", artworkUrl: null, rarities: [7],
    kind: "champion-bonus", autoAscend: true, categoryId: "category", rewardIndex: 0, rewards: [],
  }] }} /></CrystalBrowseBoundary>))
  const link = document.querySelector<HTMLAnchorElement>('[data-ascension-source] a')!
  expect(new URL(link.href).pathname).toBe("/crystals/vfh_gwenom_broken_justice_crystal")
  expect(new URL(link.href).searchParams.get("returnTo")).toBe(parseCrystalReturnTo(finder))
  await act(async () => link.click())
  expect(consumeCrystalBrowseScroll(finder, sessionStorage)).toBe(1840)
})

it("uses the explicit source host context even inside a different browse boundary", async () => {
  const champion = "/champions/gwenom?rarity=7&tab=crystals"
  await act(async () => root.render(<CrystalBrowseBoundary returnTo={origin}><CrystalIntentLink href="/crystals/exact-opening?rarity=7" returnTo={champion}>Open source</CrystalIntentLink></CrystalBrowseBoundary>))
  expect(new URL(document.querySelector<HTMLAnchorElement>('a')!.href).searchParams.get("returnTo")).toBe(champion)
})

it.each([
  "/crystals/champions?champion=hulk&rarity=7&q=Hulk&category=events&page=2",
  "/champions/hulk?rarity=7&tab=crystals",
])("preserves the normal compact card's exact opening and full host/scroll context from %s", async host => {
  window.history.replaceState(null, "", host)
  await act(async () => root.render(<CrystalBrowseBoundary returnTo={host}><CompactCrystalFamilyGrid rarity="7" target={{ name: "Hulk" }} returnTo={host.startsWith("/champions/") ? host : undefined} families={[{
    id: "hero", name: "Hero pool", artworkUrl: null,
    variants: ["hero", "nexus", "epoch"].map((id, i) => ({ name: id, sourceIds: [id], rarities: [7], isMainPool: true,
      selection: i ? { draw: i === 1 ? 3 : 5, pick: 1 } : null,
      family: { id: "hero", name: "Hero pool", variantLabel: ["Standard", "Nexus", "Epoch Nexus"][i], variantOrder: i },
    })),
  }]} /></CrystalBrowseBoundary>))
  const links = [...document.querySelectorAll<HTMLAnchorElement>('[data-compact-crystal-card] a')]
  expect(links.map(link => new URL(link.href).pathname)).toEqual(["/crystals/hero", "/crystals/nexus", "/crystals/epoch"])
  expect([...document.querySelectorAll<HTMLAnchorElement>('a[data-crystal-opening]')].map(link => new URL(link.href).pathname)).toEqual(["/crystals/nexus", "/crystals/epoch"])
  for (const link of links) {
    const url = new URL(link.href)
    expect(url.searchParams.get("returnTo")).toBe(parseCrystalReturnTo(host))
    expect(url.searchParams.get("rarity")).toBe("7")
    await act(async () => link.click())
    expect(consumeCrystalBrowseScroll(host, sessionStorage)).toBe(1840)
  }
  expect(document.querySelector('a a')).toBeNull()
})

it("links a seven-star browse card to its matching Nexus and retains browse filters and scroll", async () => {
  const browse = "/crystals?reward=ascension&q=empowered&category=other&sort=name&page=2"
  window.history.replaceState(null, "", browse)
  const opening = getCrystalOpening("greater_empowered_nexus_crystal")!
  const summary = crystalBrowseOpeningSummary(opening)
  await act(async () => root.render(<CrystalBrowseBoundary returnTo={browse}><CrystalFamilyGrid rarity="" families={[{
    id: "ordinary-family-representative", name: opening.name, artworkUrl: null, isMainPool: false, category: "other", ...summary,
    availabilitySourceId: opening.id, variants: [{ id: opening.id, name: opening.name, sourceIds: [opening.id], isMainPool: false,
      category: "other", rarities: summary.rarities, selection: opening.selection ?? null }],
  }]} /></CrystalBrowseBoundary>))
  const link = document.querySelector<HTMLAnchorElement>(`a[aria-label="View ${opening.name} contents"]`)!
  expect(new URL(link.href).pathname).toBe(`/crystals/${opening.id}`)
  expect(new URL(link.href).searchParams.get("returnTo")).toBe(parseCrystalReturnTo(browse))
  expect(link.textContent).toContain("Choose 1 of 3")
  await act(async () => link.click())
  expect(consumeCrystalBrowseScroll(browse, sessionStorage)).toBe(1840)
})

it("restores the original catalog position after nested crystals, including Strict Mode mounts", async () => {
  await act(async () => root.render(<StrictMode><CrystalBrowseBoundary returnTo={origin}><CrystalIntentLink href="/crystals/greater_banquet_crystal_dec22">Open crystal</CrystalIntentLink></CrystalBrowseBoundary></StrictMode>))
  const link = document.querySelector<HTMLAnchorElement>("a")!
  expect(new URL(link.href).searchParams.get("returnTo")).toBe(parseCrystalReturnTo(origin))
  await act(async () => link.click())
  window.history.replaceState(null, "", "/crystals/greater_banquet_crystal_dec22")
  vi.stubGlobal("scrollY", 75)
  await act(async () => root.render(<StrictMode><CrystalBrowseBoundary returnTo={origin}><CrystalIntentLink href="/crystals/jubilant_crystal_dec25">Open nested crystal</CrystalIntentLink></CrystalBrowseBoundary></StrictMode>))
  await act(async () => document.querySelector<HTMLAnchorElement>("a")!.click())
  await act(async () => root.unmount())
  root = createRoot(document.getElementById("root")!)
  window.history.replaceState(null, "", origin)
  await act(async () => root.render(<StrictMode><CrystalBrowseBoundary returnTo={origin}><p>Catalog restored</p></CrystalBrowseBoundary></StrictMode>))
  await act(async () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(0)) })
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({ top: 1840, behavior: "instant" })
  expect(consumeCrystalBrowseScroll(origin, sessionStorage)).toBeNull()
})
