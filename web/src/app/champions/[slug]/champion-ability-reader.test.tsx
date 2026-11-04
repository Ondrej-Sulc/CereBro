// @vitest-environment jsdom

import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { prepareChampionAbilityTextView, type ChampionAbilityTextRecord } from "@/lib/champion-ability-text"
import { buildDescriptionTemplate } from "@cerebro/core/services/mcocGameDescriptionsImportService"
import { ChampionAbilityReader } from "./champion-ability-reader"
import type { ChampionDetailsView, GlossaryTerm } from "./champion-details-types"

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

function effectView(records: ChampionAbilityTextRecord[]): ChampionDetailsView {
  const glossaryById = new Map<string, GlossaryTerm>(["Disorient", "Energize", "Fury"].map(name => [name.toLowerCase(), {
    id: name.toLowerCase(), name, description: `${name} definition.`, category: null,
    iconUrl: `/icons/${name.toLowerCase()}.svg`, raw: { color_primary: "cc3333" },
  }]))
  return { ...view, glossaryById, descriptionView: prepareChampionAbilityTextView({ records }) }
}

it("uses the named effect as a decorative line marker and removes its repeated heading", async () => {
  const disorient = "Inflicts a Disorient Debuff for 12 seconds."
  const energize = "Cosmic Mode: Gain an Energize Buff, granting 25% increased Combat Power Rate."
  const effects = effectView([
    { id: 11, group: "base", title: "Disorient", template: { raw: disorient } },
    { id: 12, group: "base", title: "Energize", template: buildDescriptionTemplate("[00aaff]Cosmic Mode:[-] Gain an [k=glossary/energize]Energize[/k] Buff, granting 25% increased Combat Power Rate.") },
  ])
  await act(async () => root.render(<ChampionAbilityReader view={effects} chapter="base" onSelectChapter={() => {}} />))
  expect(document.querySelectorAll("h4")).toHaveLength(0)
  for (const [id, effect, text] of [[11, "Disorient", disorient], [12, "Energize", energize]]) {
    const row = document.getElementById(`ability-record-${id}`)!
    expect(row.textContent).toBe(text)
    const marker = row.querySelector(`[data-ability-effect="${effect}"]`)
    expect(marker?.getAttribute("aria-hidden")).toBe("true")
    expect(marker?.textContent).toBe("")
  }
  const glossary = document.getElementById("ability-record-12")!.querySelector("button")!
  expect(glossary.textContent).toBe("Energize")
  await act(async () => glossary.click())
  expect(document.body.textContent).toContain("Energize definition.")
})

it("retains headings that supply context and does not assign their icon to unrelated continuation lines", async () => {
  const effects = effectView([
    { id: 21, group: "base", title: "Fury", template: { raw: "Gain a Fury Buff." } },
    { id: 22, group: "base", title: null, template: { raw: "This can stack up to 5 times." } },
    { id: 23, group: "base", title: "Gamma Power", template: { raw: "Gain charges after blocking." } },
  ])
  await act(async () => root.render(<ChampionAbilityReader view={effects} chapter="base" onSelectChapter={() => {}} />))
  expect([...document.querySelectorAll("h4")].map(n => n.textContent)).toEqual(["Fury", "Gamma Power"])
  expect(document.getElementById("ability-record-21")?.querySelector('[data-ability-effect="Fury"]')).not.toBeNull()
  expect(document.getElementById("ability-record-22")?.querySelector("[data-ability-effect]")).toBeNull()
  expect(document.getElementById("ability-record-23")?.querySelector("[data-ability-effect]")).toBeNull()
  await search("stack")
  expect([...document.querySelectorAll("h4")].map(n => n.textContent)).toEqual(["Fury"])
  expect(document.getElementById("ability-record-22")?.textContent).toBe("This can stack up to 5 times.")
  expect(document.querySelectorAll("[data-ability-effect]")).toHaveLength(0)
})

it("uses only the source heading's effect for a multi-effect line and keeps a plain marker when its icon is unavailable", async () => {
  const effects = effectView([
    { id: 31, group: "base", title: "Disorient", template: { raw: "Inflict Disorient and gain Fury." } },
    { id: 32, group: "base", title: "Fury and Energize", template: { raw: "Gain Fury and Energize Buffs." } },
    { id: 33, group: "base", title: "Energize", template: { raw: "Gain an Energize Buff." } },
  ])
  effects.glossaryById.set("energize", { ...effects.glossaryById.get("energize")!, iconUrl: null })
  await act(async () => root.render(<ChampionAbilityReader view={effects} chapter="base" onSelectChapter={() => {}} />))
  expect([...document.querySelectorAll("[data-ability-effect]")].map(n => n.getAttribute("data-ability-effect"))).toEqual(["Disorient"])
  expect([...document.querySelectorAll("h4")].map(n => n.textContent)).toEqual(["Fury and Energize", "Energize"])
})

it("keeps effect search, source anchors and linked-passage focus after simplifying the headings", async () => {
  const effects = effectView([
    { id: 41, group: "base", title: "Fury", template: { raw: "Gain a Fury Buff." } },
    { id: 42, group: "base", title: "Energize", template: { raw: "Gain an Energize Buff." } },
  ])
  await act(async () => root.render(<ChampionAbilityReader view={effects} chapter="base" targetRecordId="42" onSelectChapter={() => {}} />))
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.activeElement).toBe(document.getElementById("ability-record-42"))
  await search("Energize")
  expect(document.querySelector('[role="status"]')?.textContent).toContain("1 passage")
  expect(document.querySelector("mark")?.textContent).toBe("Energize")
  expect(document.getElementById("ability-record-42")?.querySelector('[data-ability-effect="Energize"]')).not.toBeNull()
  expect(document.querySelectorAll("h4")).toHaveLength(0)
})

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
