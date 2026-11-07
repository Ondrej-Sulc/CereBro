// @vitest-environment jsdom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { getChampionAcquisition } from "@cerebro/core/data/champion-acquisition"
import { getChampionAscension } from "@cerebro/core/data/game-ascension"
import { getChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition"
import { ChampionAcquisitionPanel } from "./champion-acquisition-panel"

let root: Root
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById("root")!) })
afterEach(async () => { await act(async () => root.unmount()); vi.unstubAllGlobals() })
const render = async (gameId: string, rarity: string) => act(async () => root.render(<ChampionAcquisitionPanel acquisition={getChampionAcquisition(gameId, "2026-11-06T00:00:00Z")} availability={{ observedAt: "2026-11-05T14:05:24Z", crystals: [] }} selectedRarity={rarity} championName="Dark Phoenix" />))

it("shows a historical event with exact stars, dates, requirements and an evidence link", async () => {
  await render("phoenix_dark", "7")
  expect(document.querySelector("h2")?.textContent).toBe("How to obtain")
  expect(document.body.textContent).toContain("Phoenix Force")
  expect(document.body.textContent).not.toContain("Sunstorm")
  expect(document.body.textContent).toContain("Past event")
  expect(document.body.textContent).toContain("Thronebreaker")
  expect(document.querySelector('time[datetime="2025-05-07T18:00:00Z"]')).not.toBeNull()
  expect(document.querySelector('a[href="https://playcontestofchampions.com/news/heart-of-fire-event/"]')).not.toBeNull()
  expect(document.body.textContent).not.toContain("Available now")
  await render("phoenix_dark", "6")
  expect(document.body.textContent).toContain("Sunstorm")
  expect(document.body.textContent).not.toContain("Phoenix Force")
})

it("keeps unknown stars neutral and does not invent a route from another rarity", async () => {
  await render("phoenix_dark", "5")
  expect(document.body.textContent).not.toContain("Heart of Fire")
  expect(document.body.textContent).toContain("No acquisition source recorded")
  expect(document.body.textContent).not.toMatch(/unobtainable|cannot be obtained/i)
})

it("shows Vision's 7-star selector without leaking it into his lower-star crystal view", async () => {
  const availability = { observedAt: "2026-11-05T14:05:24Z", crystals: [{ name: "6-Star Hero Crystal", sourceIds: ["6_star_hero"], rarities: [6], isMainPool: true, selection: null }] }
  const acquisition = getChampionAcquisition("vision", "2026-11-06T00:00:00Z")
  await act(async () => root.render(<ChampionAcquisitionPanel acquisition={acquisition} availability={availability} selectedRarity="7" championName="Vision" />))
  expect(document.body.textContent).toContain("Trophy Champion selector")
  expect(document.body.textContent).toContain("Past event")
  expect(document.querySelector('a[href="https://playcontestofchampions.com/news/the-banquet-summary/"]')).not.toBeNull()
  await act(async () => root.render(<ChampionAcquisitionPanel acquisition={acquisition} availability={availability} selectedRarity="6" championName="Vision" />))
  expect(document.body.textContent).toContain("6-Star Hero Crystal")
  expect(document.body.textContent).not.toContain("Trophy Champion selector")
})

it("shows exact piece requirements and retains normal crystal browsing", async () => {
  await render("starlord_stellar", "7")
  expect(document.body.textContent).toContain("Collect pieces")
  expect(document.body.textContent).toContain("five")
  expect(document.body.textContent).not.toContain("Availability varies")
  expect([...document.querySelectorAll("h3")].some(heading => heading.textContent?.includes("Crystal pools"))).toBe(false)
  expect(document.querySelector('a[href="/crystals?rarity=7"]')).not.toBeNull()
})

it("consolidates collection provenance and omits empty pool shells on the shared champion host", async () => {
  await render("blade_stellar", "7")
  const notes = document.querySelector<HTMLDetailsElement>('details[aria-label="About this data"]')!
  expect(document.querySelectorAll('details[aria-label="About this data"]')).toHaveLength(1)
  expect(notes.open).toBe(false)
  expect(notes.querySelector("summary")?.textContent).toBe("About this data")
  expect(notes.querySelector('time[datetime="2026-11-06"]')).not.toBeNull()
  expect(notes.textContent).toContain("In-game item descriptions")
  expect(document.body.textContent).not.toMatch(/Matching 7-star pieces|From in-game item descriptions|Requirements and availability can change|No direct crystal/)
  expect(document.querySelector('[aria-label="Collection pieces"]')?.querySelectorAll("img")).toHaveLength(5)
})

it("keeps one host disclosure before and after lazy Ascension loads, retaining independently dated sources", async () => {
  let finish!: (value: Response) => void
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { finish = resolve })))
  await act(async () => root.render(<ChampionAcquisitionPanel acquisition={getChampionAcquisition("blade_stellar")} availability={{ observedAt: "2026-11-03T09:10:42Z", crystals: [] }} selectedRarity="7" championName="Blade (Stellar-Forged)" championSlug="blade-stellar-forged" ascensionRules={getChampionAscension("blade_stellar", 7)} />))
  expect(document.querySelectorAll('details[aria-label="About this data"]')).toHaveLength(1)
  await act(async () => finish(new Response(JSON.stringify({ observedAt: "2026-11-05T14:05:24Z", crystals: [], acquisition: getChampionAscensionAcquisitionSources("blade_stellar", 7) }))))
  const notes = document.querySelector<HTMLDetailsElement>('details[aria-label="About this data"]')!
  expect(document.querySelectorAll('details[aria-label="About this data"]')).toHaveLength(1)
  expect(notes.open).toBe(false)
  for (const date of ["2026-11-06", "2026-11-07", "2026-11-05T14:05:24Z", "2026-11-03T09:10:42Z"]) expect(notes.querySelector(`time[datetime="${date}"]`)).not.toBeNull()
  expect(document.querySelector('[data-ascension-method]')?.textContent).toContain("with only Blade (Stellar-Forged)")
  expect(document.body.textContent).not.toContain("No direct crystal")
})

it("shows five illustrated pieces, individual source links and historical labels for the selected stars", async () => {
  await render("guillotine_nameless", "7")
  const collection = document.querySelector('[aria-label="Collection pieces"]')!
  expect(collection.querySelectorAll("img")).toHaveLength(5)
  expect(collection.textContent).toContain("Cursed Handle")
  expect(collection.textContent).toContain("Necropolis completion")
  expect(collection.textContent).toContain("Past event")
  expect(collection.querySelectorAll('a[target="_blank"]')).toHaveLength(5)
  const sevenStarImages = Array.from(collection.querySelectorAll("img"), image => image.getAttribute("src"))
  await render("guillotine_nameless", "6")
  const sixStar = document.querySelector('[aria-label="Collection pieces"]')!
  expect(sixStar.textContent).not.toContain("Necropolis completion")
  expect(sixStar.textContent).toContain("Store record")
  expect(Array.from(sixStar.querySelectorAll("img"), image => image.getAttribute("src"))).not.toEqual(sevenStarImages)
})

it("keeps artwork visible when a historical source is unverified", async () => {
  await render("vision_deathless", "6")
  const collection = document.querySelector('[aria-label="Collection pieces"]')!
  expect(collection.querySelectorAll("img")).toHaveLength(5)
  expect(collection.textContent).toContain("Scarlet Visage")
  expect(collection.textContent).toContain("Source unverified")
  expect(collection.textContent).not.toContain("Available now")
})

it("distinguishes Kabam announcements from community evidence and shows descriptive source links", async () => {
  await render("green_goblin_stellar", "7")
  const collection = document.querySelector('[aria-label="Collection pieces"]')!
  expect(collection.textContent).toContain("Kabam announcement")
  expect(collection.textContent).toContain("Community guide")
  expect(collection.querySelector('a[href="https://playcontestofchampions.com/news/battlegrounds-season-42/"]')).not.toBeNull()
  expect(collection.querySelector('a[href="https://playcontestofchampions.com/news/revenge-of-legends/"]')).not.toBeNull()
  await render("thanos_deathless_trophy", "7")
  expect(document.body.textContent).toContain("Deathless Mausoleum")
  expect(document.body.textContent).toContain("Kabam announcement")
  expect(document.body.textContent).not.toContain("View source")
  expect(document.querySelector('a[href="https://playcontestofchampions.com/news/deathless-mausoleum/"]')).not.toBeNull()
})
