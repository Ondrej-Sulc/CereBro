// @vitest-environment jsdom

import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import { ChampionAbilityReader } from "./champion-ability-reader"
import type { ChampionDetailsView } from "./champion-details-types"

const view: ChampionDetailsView = {
  champion: { id: 1, name: "Test champion", shortName: "Test", slug: "test", gameId: null, class: "MYSTIC", images: {}, gameSynergies: [], tags: [], abilities: [], abilityTexts: [], abilityCurves: [], attacks: [], stats: [], prestigeData: [], duels: [] },
  portraitUrl: "", heroUrl: "", secondaryUrl: "", accent: "#a855f7", selectedStat: undefined,
  selectedRarity: "7", selectedRank: "6", rarityOptions: [7], rankOptions: [6], sigLevel: 200, maxSig: 200, ascensionLevel: 0,
  prestige: null, health: null, attack: null, maxStats: {}, abilities: [], immunities: [], glossaryById: new Map(),
  descriptionView: prepareChampionAbilityTextView({ records: [
    { id: 1, group: "signature", title: "Signature Ability", template: { raw: "Gain Fury." } },
    { id: 2, group: "base", title: "Basic attacks", template: { raw: "Inflict Bleed." } },
  ] }),
  setRarity: () => {}, setRank: () => {}, setSigLevel: () => {}, setAscensionLevel: () => {},
}

let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function Reader({ initialTarget = null }: { initialTarget?: string | null }) {
  const [chapter, setChapter] = useState<string | null>("signature")
  const [target, setTarget] = useState(initialTarget)
  return <ChampionAbilityReader view={view} chapter={chapter} targetRecordId={target} onSelectChapter={next => { setChapter(next); setTarget(null) }} onClearTarget={() => { setTarget(null); setChapter(null) }} />
}

async function search(value: string) {
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search ability text"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
  })
}

it.each([null, "1"])("names the active search scope and searches the full kit without losing the query (target %s)", async initialTarget => {
  await act(async () => root.render(<Reader initialTarget={initialTarget} />))
  await search("Bleed")
  expect(document.querySelector('[role="status"]')?.textContent).toContain("0 passages")
  const recovery = [...document.querySelectorAll("button")].find(button => button.textContent === "Search all abilities")
  expect(recovery, "a scoped search offers full-kit recovery").toBeDefined()
  expect(document.getElementById("champion-descriptions")?.textContent).toContain("in Signature Ability")
  await act(async () => recovery!.click())
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Search ability text"]')?.value).toBe("Bleed")
  expect(document.activeElement).toBe(document.querySelector('input[aria-label="Search ability text"]'))
  expect(document.querySelector('[role="status"]')?.textContent).toContain("1 passage")
  expect(document.querySelectorAll("mark")).toHaveLength(1)
  expect(document.querySelector("mark")?.textContent).toBe("Bleed")
})

it("opens a linked passage without smooth motion when reduced motion is requested", async () => {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
  await act(async () => root.render(<ChampionAbilityReader view={view} chapter={null} targetRecordId="2" onSelectChapter={() => {}} />))
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "instant" })
  expect(document.activeElement).toBe(document.getElementById("ability-record-2"))
})

it("clears an old search when navigating to a new linked passage", async () => {
  await act(async () => root.render(<ChampionAbilityReader view={view} chapter={null} targetRecordId={null} onSelectChapter={() => {}} />))
  await search("absent term")
  expect(document.querySelector('[role="status"]')?.textContent).toContain("0 passages")
  await act(async () => root.render(<ChampionAbilityReader view={view} chapter={null} targetRecordId="2" onSelectChapter={() => {}} />))
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Search ability text"]')?.value).toBe("")
  expect(document.getElementById("ability-record-2")?.textContent).toContain("Inflict Bleed.")
})

it.each(["Clear ability search", "Clear search"])("returns focus to the reader after %s", async label => {
  await act(async () => root.render(<Reader />))
  await search("missing term")
  const reset = [...document.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === label || button.textContent === label)!
  expect(reset).toBeDefined()
  await act(async () => { reset.focus(); reset.click() })
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  const input = document.querySelector<HTMLInputElement>('input[aria-label="Search ability text"]')!
  expect(input.value).toBe("")
  expect(document.activeElement).toBe(input)
  expect(document.querySelector('[role="status"]')?.textContent).toContain("Signature Ability")
})

it("explains an unavailable linked passage and lets the reader browse all abilities", async () => {
  await act(async () => root.render(<Reader initialTarget="999" />))
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  const notice = [...document.querySelectorAll<HTMLElement>('[role="status"]')].find(element => element.textContent?.includes("linked ability passage is not available"))
  expect(notice).toBeDefined()
  expect(document.activeElement).toBe(notice)
  const browse = [...document.querySelectorAll("button")].find(button => button.textContent === "Browse all abilities")!
  await act(async () => { browse.focus(); browse.click() })
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.body.textContent).not.toContain("linked ability passage is not available")
  expect(document.querySelector('[role="status"]')?.textContent).toContain("2 passages in All abilities")
  expect(document.activeElement).toBe(document.querySelector('input[aria-label="Search ability text"]'))
})

it("focuses the same linked passage when its data becomes available", async () => {
  const missingView = { ...view, descriptionView: prepareChampionAbilityTextView({ records: [] }) }
  await act(async () => root.render(<ChampionAbilityReader view={missingView} chapter={null} targetRecordId="2" onSelectChapter={() => {}} />))
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.body.textContent).toContain("linked ability passage is not available")
  await act(async () => root.render(<ChampionAbilityReader view={view} chapter={null} targetRecordId="2" onSelectChapter={() => {}} />))
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.body.textContent).not.toContain("linked ability passage is not available")
  expect(document.activeElement).toBe(document.getElementById("ability-record-2"))
})
