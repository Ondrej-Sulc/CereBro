// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { ChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition-types"
import { getChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition"
import { ChampionAscensionAcquisition } from "./champion-ascension-acquisition"

vi.mock("next/image", () => ({ default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} /> }))
let root: Root
const data: ChampionAscensionAcquisitionSources = {
  gameId: "magik", reviewedAt: "2026-11-07", evaluatedAsOf: "2026-11-07T12:00:00Z", accountStatus: "unverified",
  paths: [{ rarity: 7, state: "recorded_path", blueprintId: "magik_t7", observedAt: "2026-11-03T09:10:42Z", maxLevel: 2, materialKind: "champion_specific", steps: [], guidance: "Exact champion and class tokens are required.", materialFinderHref: "/crystals?reward=ascension" }],
  definitions: [], routes: [{ id: "limbo", gameId: "magik", rarity: 7, kind: "exchange", title: "Limbo Token exchanges", description: "Separate A1 and A2 packs.", confidence: "high", starScope: "explicit", requiredTokenIds: ["ascension_token_champion_magik"], availability: "current_stock_unverified", periodStatus: "start_passed_end_unknown", window: { start: "2026-09-09", end: null, timeZone: null, label: "Announced from 9 September 2026; end not established." }, conditions: ["Thronebreaker required."], missingEvidence: ["Current stock not verified."], offers: [], sources: [{ id: "s4", title: "September 4th Livestream Summary", kind: "official_stream_summary", publisher: "The MCoC Team", publishedAt: "2026-09-04", reviewedAt: "2026-11-07", url: "https://playcontestofchampions.com/news/september-4th-livestream-summary/" }] }],
}
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById("root")!) })
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
const render = async (value = data, rarity = "7", hasCrystalSources = false) => act(async () => root.render(<ChampionAscensionAcquisition data={value} selectedRarity={rarity} hasCrystalSources={hasCrystalSources} />))

it("shows method, exact stars, conditions, uncertain stock and direct official evidence compactly", async () => {
  await render()
  const row = document.querySelector('[data-ascension-method="limbo"]')!
  expect(row.textContent).toContain("Currency exchange · 7★")
  expect(row.textContent).toContain("Current stock unverified")
  expect(row.textContent).toContain("Thronebreaker required")
  expect(row.textContent).toContain("Announced from 9 September 2026")
  expect(row.querySelector('a')?.getAttribute("href")).toBe(data.routes[0].sources[0].url)
  expect(row.querySelector('details')?.open).toBe(false)
  expect(row.textContent).not.toMatch(/available now|can ascend/i)
})

it("keeps diagnostic capture gaps and review dates out of the default method copy", async () => {
  await render(getChampionAscensionAcquisitionSources("blade_stellar", 7, "2026-11-07"))
  const row = document.querySelector('[data-ascension-method]')!
  const visible = row.cloneNode(true) as HTMLElement
  visible.querySelectorAll("details").forEach(detail => detail.remove())
  expect(visible.textContent).toContain("with only Blade (Stellar-Forged)")
  expect(visible.textContent).toContain("Activity-dependent")
  expect(visible.textContent).not.toContain("Past event")
  expect(visible.textContent).not.toMatch(/Exact objective|Partial reward details|Stars matched|Reviewed/)
  expect(row.querySelector<HTMLDetailsElement>("details")?.open).toBe(false)
  expect(row.querySelector("details")?.textContent).toContain("7★ applicability")
  expect(document.querySelector('[aria-label="7-star upgrade cost to A2"]')?.textContent).toContain("Gold")
})

it("projects only seven-star paths from generic all-star data, including actual A2 dust costs", async () => {
  const all = getChampionAscensionAcquisitionSources("magik", undefined, "2026-11-07")
  await render(all, "")
  expect([...document.querySelectorAll('[data-material-path]')].map(row => row.getAttribute("data-material-path"))).toEqual(["7"])
  const a2 = document.querySelector('[aria-label="7-star upgrade cost to A2"]')!
  for (const cost of all.paths.find(path => path.rarity === 7)!.steps[1].costs) {
    expect(a2.textContent).toContain(cost.quantity.toLocaleString("en"))
    expect(a2.textContent).toContain(cost.name ?? cost.id)
  }
  expect(a2.textContent).toMatch(/dust/i)
  expect(a2.textContent).toContain("Gold")
  await render(all, "6")
  expect(document.body.textContent).toBe("")
})

it("filters methods to exact stars and distinguishes unverified material sources from no path", async () => {
  await render({ ...data, routes: [], definitions: [] })
  expect(document.body.textContent).toContain("We have not verified an obtainable source")
  expect(document.body.textContent).not.toContain("Cannot ascend")
  await render({ ...data, paths: [{ ...data.paths[0], rarity: 6, state: "unknown", steps: [], guidance: "Eligibility metadata is unknown." }] }, "6")
  expect(document.querySelector('[data-ascension-method]')).toBeNull()
  expect(document.body.textContent).not.toContain("Limbo Token")
})

it("never treats historical, upcoming or activity-dependent methods as current availability", async () => {
  await render({ ...data, routes: [
    { ...data.routes[0], id: "past", availability: "historical", periodStatus: "past" },
    { ...data.routes[0], id: "future", availability: "upcoming", periodStatus: "upcoming" },
    { ...data.routes[0], id: "weekly", availability: "activity_dependent", periodStatus: "within_announced_period" },
  ] })
  expect(document.body.textContent).toContain("Past event")
  expect(document.body.textContent).toContain("Upcoming")
  expect(document.body.textContent).toContain("Activity-dependent")
  expect(document.body.textContent).not.toContain("Available now")
})

it("keeps bundle rewards separate from upgrade costs, preserves unknown price, and exposes evidence only on demand", async () => {
  await render({ ...data, routes: [{ ...data.routes[0], offers: [{
    id: "recorded-offer", label: "Recorded A2 pack", sourceId: "static", binding: "GameStore/recorded-offer", price: null, purchaseLimit: 2,
    conditions: ["Prior A1 purchase required."], rewards: [{ type: "inv", id: "ascension_token_champion_magik", quantity: 1, role: "ascension_material", name: "Magik Ascension Token", imageUrl: "https://storage.googleapis.com/champion-images/recorded-token.webp" }],
  }] }] })
  const details = document.querySelector<HTMLDetailsElement>('[data-ascension-method] details')!
  expect(details.open).toBe(false)
  expect(details.querySelector('summary')?.textContent).toContain("bundle contents")
  expect(details.textContent).toContain("1 Magik Ascension Token")
  expect(details.textContent).toContain("Purchase limit: 2")
  expect(details.textContent).toContain("Prior A1 purchase required")
  expect(details.querySelector('img')?.src).toBe("https://storage.googleapis.com/champion-images/recorded-token.webp")
  expect(document.body.textContent).not.toMatch(/free|sufficient|price:/i)
  expect(details.querySelector('time')?.getAttribute("datetime")).toBe("2026-09-04")
  const preview = document.querySelector('[aria-label="Recorded material rewards"]')!
  expect(preview.textContent).toContain("1 Magik Ascension Token")
  expect(preview.textContent).toContain("Limit 2")
  expect(preview.closest('details')).toBeNull()
})
