// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ChampionDetailsClient } from "./champion-details-client"
import type { ChampionDetailsProps, ChampionStatRow } from "./champion-details-types"
import { getChampionAscensionAcquisitionSources } from "@/lib/data/champion-ascension-acquisition"
import { getChampionAscensionRules } from "@cerebro/core/data/game-ascension"
import prestigeFixture from "../../../../../src/tests/fixtures/champion-prestige-ascension.json"
import combatFixture from "../../../../../src/tests/fixtures/champion-combat-ascension.json"

// Model Next's URL subscription at the framework boundary; use real browser history below.
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react")
  const subscribe = (listener: () => void) => {
    window.addEventListener("popstate", listener)
    return () => window.removeEventListener("popstate", listener)
  }
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search, () => "")) }
})
vi.mock("next/image", () => ({ default: () => null }))
vi.mock("./champion-kit-overview", () => ({ ChampionKitOverview: ({ onViewSynergies }: { onViewSynergies: (id: string) => void }) => <button onClick={() => onViewSynergies("catalog_alias")}>Read synergy source</button> }))
vi.mock("@/app/profile/roster/prestige-curve-chart", () => ({ PrestigeCurveChart: ({ data, currentSig }: { data: Array<{ sig: number; prestige: number }>; currentSig: number }) => <output aria-label="Prestige chart data">{data.find(point => point.sig === currentSig)?.prestige}</output> }))
vi.mock("./champion-synergies-panel", () => ({ ChampionSynergiesPanel: ({ targetSynergyId, onClearTarget }: { targetSynergyId: string | null; onClearTarget: () => void }) => <div data-synergy-probe={targetSynergyId ?? ""}><button onClick={onClearTarget}>Clear linked source</button></div> }))

const stat = (rank: number): ChampionStatRow => ({
  id: rank, tierId: `tier7-${rank}`, rarity: 7, rarityLabel: null, rank, level: 60, challengeRating: 250,
  health: 100, attack: 10, healthRating: null, attackRating: null, prestige: null,
  armorRating: null, armorPenetration: null, criticalRating: null, criticalResistance: null,
  criticalDamageRating: null, blockProficiency: null, blockPenetration: null, specialDamageMultiplier: null,
  energyResistance: null, physicalResistance: null, baseAbilityIds: [], sigAbilityIds: [],
})
const props: ChampionDetailsProps = {
  champion: { id: 1, name: "Current", shortName: "Current", slug: "current", gameId: null, class: "SCIENCE", images: {}, gameSynergies: [], tags: [], abilities: [], abilityTexts: [], abilityCurves: [], attacks: [], stats: [stat(6), stat(5)], prestigeData: [], duels: [] },
  glossaryTerms: [], maxStatsByTier: {},
}
let barResize: () => void
let heroNotifications: Array<(visible: boolean, bottom: number) => void>
let desktopMedia: EventTarget & { matches: boolean }
let root: Root
let clipboardDescriptor: PropertyDescriptor | undefined
const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  heroNotifications = []
  desktopMedia = Object.assign(new EventTarget(), { matches: false })
  vi.stubGlobal("matchMedia", () => desktopMedia)
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) { barResize = callback }
    observe() {} disconnect() {}
  })
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) {
      heroNotifications.push((visible, bottom) => callback([{ isIntersecting: visible, boundingClientRect: { bottom } } as IntersectionObserverEntry], this as unknown as IntersectionObserver))
    }
    observe() {} disconnect() {}
  })
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function(this: HTMLElement) {
    return new DOMRect(0, 64, 1280, this.hasAttribute("data-champion-context") ? 64 : this.matches("section[aria-label$=\" banner\"]") ? 250 : 0)
  })
  document.body.innerHTML = '<div id="root"></div>'
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard")
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: writeClipboard } })
  writeClipboard.mockClear()
  window.history.replaceState(null, "", "/champions/current?tab=overview&rarity=7&rank=5&sig=75")
  const nativePush = window.history.pushState.bind(window.history)
  const nativeReplace = window.history.replaceState.bind(window.history)
  vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
    nativePush(data, unused, url)
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    nativeReplace(data, unused, url)
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  root = createRoot(document.getElementById("root")!)
})
afterEach(async () => {
  await act(async () => root.unmount())
  if (clipboardDescriptor) Object.defineProperty(navigator, "clipboard", clipboardDescriptor)
  else Reflect.deleteProperty(navigator, "clipboard")
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function click(label: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.startsWith(label) || button.getAttribute("aria-label") === label)!
  expect(button).toBeDefined()
  await act(async () => button.focus())
  await act(async () => {
    if (button.getAttribute("role") === "tab") button.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    else button.click()
  })
}
async function traverse(direction: "back" | "forward") {
  await act(async () => {
    const popped = new Promise<void>(resolve => window.addEventListener("popstate", () => resolve(), { once: true }))
    window.history[direction]()
    await popped
  })
}

it("retains the exact source and build through section changes and Back/Forward", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  await click("Read synergy source")
  expect(document.querySelector('[data-synergy-probe="catalog_alias"]')).not.toBeNull()
  const sharedUrl = new URL(window.location.href)
  expect(sharedUrl.searchParams.get("synergy")).toBe("catalog_alias")
  expect(sharedUrl.searchParams.get("rank")).toBe("5")
  expect(sharedUrl.searchParams.get("sig")).toBe("75")
  await click("Stats & attacks")
  expect(new URL(window.location.href).searchParams.has("synergy")).toBe(false)
  await traverse("back")
  expect(document.querySelector('[data-synergy-probe="catalog_alias"]')).not.toBeNull()
  await traverse("forward")
  expect(document.body.textContent).toContain("Combat ratings")
})

it("reopens and copies a linked synergy with its exact source ID and selected build", async () => {
  window.history.replaceState(null, "", "/champions/current?tab=synergies&synergy=catalog_alias&rarity=7&rank=5&sig=75")
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  expect(document.querySelector('[data-synergy-probe="catalog_alias"]')).not.toBeNull()
  await click("Adjust build")
  await click("Copy page link")
  expect(writeClipboard).toHaveBeenCalledOnce()
  const copied = new URL(writeClipboard.mock.calls[0][0])
  expect(copied.searchParams.get("synergy")).toBe("catalog_alias")
  expect(copied.searchParams.get("rank")).toBe("5")
  expect(copied.searchParams.get("sig")).toBe("75")
})

it("shows decorative game glyphs beside the visible Health and Attack labels", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  expect(document.querySelector('[aria-label="Current banner"]')?.textContent).not.toMatch(/Prestige|Health|Attack/)
  expect(document.querySelector('[aria-label="Selected build stats"]')).toBeNull()
  await click("Stats & attacks")
  const icons = [...document.querySelectorAll<HTMLElement>('[aria-label="Selected build stats"] [data-stat-icon]')]
  expect(icons.map(icon => icon.dataset.statIcon)).toEqual(["health", "attack"])
  for (const icon of icons) {
    expect(icon.getAttribute("aria-hidden")).toBe("true")
    expect(icon.parentElement?.textContent).toBe(icon.dataset.statIcon === "health" ? "Health" : "Attack")
  }
})

it("opens crystal pools with the selected build and restores the previous section", async () => {
  const crystalProps: ChampionDetailsProps = { ...props, champion: { ...props.champion, crystalAvailability: {
    observedAt: "2026-11-03T09:10:42+00:00",
    crystals: [{ name: "TITAN CRYSTAL", sourceIds: ["titan"], rarities: [7], isMainPool: true, selection: null }],
  } } }
  await act(async () => root.render(<ChampionDetailsClient {...crystalProps} />))
  await click("How to obtain")
  expect(new URLSearchParams(window.location.search).get("tab")).toBe("crystals")
  expect(document.body.textContent).toContain("TITAN CRYSTAL")
  expect(new URLSearchParams(window.location.search).get("rank")).toBe("5")
  expect(new URLSearchParams(window.location.search).get("sig")).toBe("75")
  await traverse("back")
  expect(new URLSearchParams(window.location.search).get("tab")).toBe("overview")
  expect(document.body.textContent).not.toContain("TITAN CRYSTAL")
})

it("loads ascension sources within How to obtain and follows exact stars and Back navigation", async () => {
  const fetchSources = vi.fn<typeof fetch>().mockImplementation(async input => new Response(JSON.stringify({ observedAt: "2026-11-05T14:05:24Z", acquisition: getChampionAscensionAcquisitionSources("adamwarlock", String(input).endsWith("rarity=7") ? 7 : 6), crystals: String(input).endsWith("rarity=7") ? [{
    key: "exact:seven:bonus", id: "exact-seven-bonus", name: "Bound bonus crystal", artworkUrl: null,
    rarities: [7], kind: "champion-bonus", autoAscend: true, categoryId: "seven", rewardIndex: 0, rewards: [],
  }] : [] })))
  vi.stubGlobal("fetch", fetchSources)
  const acquisitionProps: ChampionDetailsProps = { ...props, champion: { ...props.champion,
    gameId: "adamwarlock", ascensionRules: getChampionAscensionRules("adamwarlock"),
    stats: [...props.champion.stats, { ...stat(5), id: 65, rarity: 6, tierId: "tier6-5" }],
    crystalAvailability: { observedAt: "2026-11-03T09:10:42+00:00", crystals: [{ name: "Ordinary hero crystal", sourceIds: ["ordinary-hero"], rarities: [7, 6], isMainPool: true, selection: null }] },
  } }
  window.history.replaceState(null, "", "/champions/current?tab=crystals&rarity=7&rank=5")
  await act(async () => root.render(<ChampionDetailsClient {...acquisitionProps} />))
  expect(document.body.textContent).toContain("Ascension sources")
  const sourceLink = document.querySelector<HTMLAnchorElement>('a[href^="/crystals/exact-seven-bonus?rarity=7"]')!
  expect(sourceLink).not.toBeNull()
  expect(new URL(sourceLink.href).searchParams.get("returnTo")).toBe("/champions/current?rarity=7&tab=crystals")
  const section = document.querySelector('[data-ascension-source]')!.closest("section")!
  expect(section.textContent).not.toContain("Ordinary hero crystal")
  await act(async () => window.history.pushState(null, "", "/champions/current?tab=crystals&rarity=6&rank=5"))
  expect(document.body.textContent).not.toContain("Bound bonus crystal")
  expect(document.body.textContent).not.toContain("Ascension sources")
  expect(fetchSources).toHaveBeenCalledTimes(1)
  expect(document.body.textContent).toContain("Ordinary hero crystal")
  await traverse("back")
  expect(document.querySelector('a[href^="/crystals/exact-seven-bonus?rarity=7&returnTo="]')).not.toBeNull()
  await click("Kit overview")
  expect(document.body.textContent).not.toContain("Ascension sources")
  await traverse("back")
  expect(document.body.textContent).toContain("Bound bonus crystal")
})

it("does not request ascension sources before How to obtain is opened", async () => {
  const fetchSources = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ observedAt: "2026-11-05T14:05:24Z", crystals: [], acquisition: getChampionAscensionAcquisitionSources("adamwarlock", 7) })))
  vi.stubGlobal("fetch", fetchSources)
  const lazyProps: ChampionDetailsProps = { ...props, champion: { ...props.champion,
    gameId: "adamwarlock", ascensionRules: getChampionAscensionRules("adamwarlock"),
  } }
  await act(async () => root.render(<ChampionDetailsClient {...lazyProps} />))
  expect(fetchSources).not.toHaveBeenCalled()
  await click("How to obtain")
  expect(fetchSources).toHaveBeenCalledTimes(1)
  expect(fetchSources.mock.calls[0][0]).toBe("/api/champions/current/ascension-sources?rarity=7")
})

it("drops a legacy source fragment on a deliberate section change and restores it with Back", async () => {
  window.history.replaceState(null, "", "/champions/current?tab=synergies#champion-synergy-catalog_alias")
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  await click("Kit overview")
  expect(window.location.hash).toBe("")
  await click("Synergies")
  expect(window.location.hash).toBe("")
  expect(document.querySelector('[data-synergy-probe=""]')).not.toBeNull()
  await traverse("back")
  await traverse("back")
  expect(window.location.hash).toBe("#champion-synergy-catalog_alias")
})

it.each([
  { position: 0, target: "", shouldRestore: true },
  { position: 499, target: "", shouldRestore: false },
  { position: 0, target: "&synergy=catalog_alias", shouldRestore: false },
])("restores section entry only when no user position or exact target supersedes it ($position, $target)", async ({ position, target, shouldRestore }) => {
  vi.stubGlobal("scrollY", position)
  window.history.replaceState(null, "", `/champions/current?tab=synergies${target}`)
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  if (shouldRestore) expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledOnce()
  else expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled()
})

async function editInput(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value)
    input.dispatchEvent(new Event("input", { bubbles: true }))
    input.dispatchEvent(new Event("change", { bubbles: true }))
  })
}
function signatureInput() {
  return document.querySelector<HTMLInputElement>('input[aria-label="Signature level value"]')!
}

it("allows clearing and replacing the signature number before applying it with Enter", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  await click("Adjust build")
  const input = signatureInput()
  await act(async () => input.focus())
  await editInput(input, "")
  expect(input.value).toBe("")
  expect(new URL(window.location.href).searchParams.get("sig")).toBe("75")
  await editInput(input, "50")
  expect(new URL(window.location.href).searchParams.get("sig")).toBe("75")
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })))
  expect(input.value).toBe("50")
  expect(new URL(window.location.href).searchParams.get("sig")).toBe("50")
  expect(document.querySelector<HTMLInputElement>('input[aria-label="Signature level"]')?.value).toBe("50")
  expect(document.activeElement).toBe(input)
})

it.each([["", "75"], ["-5", "0"], ["500", "200"], ["12.6", "13"]])("normalizes signature draft %s on blur to %s", async (draft, expected) => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  await click("Adjust build")
  const input = signatureInput()
  await act(async () => input.focus())
  await editInput(input, draft)
  expect(input.value).toBe(draft)
  await act(async () => input.blur())
  expect(input.value).toBe(expected)
  expect(new URL(window.location.href).searchParams.get("sig")).toBe(expected)
})

it("keeps signature drafts synchronized with the slider and a new rarity's limit", async () => {
  const lowerStat = { ...stat(1), id: 401, rarity: 4, tierId: "tier4-1" }
  await act(async () => root.render(<ChampionDetailsClient {...props} champion={{ ...props.champion, stats: [...props.champion.stats, lowerStat] }} />))
  await click("Adjust build")
  await editInput(document.querySelector<HTMLInputElement>('input[aria-label="Signature level"]')!, "125")
  expect(signatureInput().value).toBe("125")
  const rarity = document.querySelector<HTMLSelectElement>('select[aria-label="Rarity"]')!
  await act(async () => {
    rarity.value = "4"
    rarity.dispatchEvent(new Event("change", { bubbles: true }))
  })
  expect(signatureInput().value).toBe("99")
  expect(signatureInput().max).toBe("99")
  expect(new URL(window.location.href).searchParams.get("sig")).toBe("99")
})

it("applies a pending signature edit before copying the build link", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  await click("Adjust build")
  await act(async () => signatureInput().focus())
  await editInput(signatureInput(), "0")
  await click("Copy page link")
  expect(new URL(writeClipboard.mock.calls[0][0]).searchParams.get("sig")).toBe("0")
  expect(signatureInput().value).toBe("0")
})

function sectionPickerLabel() { return sectionPicker().getAttribute("aria-label")?.replace("Champion section: ", "") }
function sectionPicker() {
  return document.querySelector<HTMLButtonElement>('button[aria-haspopup="dialog"][aria-label^="Champion section:"]')!
}
async function openSectionPicker() {
  const trigger = sectionPicker()
  expect(trigger).not.toBeNull()
  await act(async () => { trigger.focus(); trigger.click() })
  return document.querySelector<HTMLElement>('[role="dialog"]')!
}

it("keeps summary stats in their section and opens the projected chart for the actual build", async () => {
  const input: ChampionDetailsProps = { ...props, champion: { ...props.champion,
    gameId: prestigeFixture.gameId, ascensionRules: getChampionAscensionRules(prestigeFixture.gameId),
    stats: [{ ...stat(4), ...combatFixture.baseStat, tierId: combatFixture.tierId }],
    prestigeData: prestigeFixture.baseEndpoints.map((point, index) => ({ ...point, id: index + 1 })),
  } }
  window.history.replaceState(null, "", "/champions/current?tab=overview&rarity=7&rank=4&sig=200&ascension=2")
  await act(async () => root.render(<ChampionDetailsClient {...input} />))
  expect(document.querySelector('[aria-label="Current banner"]')?.textContent).not.toMatch(/Prestige|Health|Attack/)
  expect(document.querySelector('[aria-label="Selected build stats"]')).toBeNull()
  await click("Stats & attacks")
  const summary = () => document.querySelector('[aria-label="Selected build stats"]')!
  expect([...summary().querySelectorAll("dt")].map(node => node.textContent)).toEqual(["Prestige", "Health", "Attack"])
  expect([...summary().querySelectorAll("dd > span")].map(node => node.textContent)).toEqual(["39,730", "103,435", "9,218"])
  expect(document.querySelectorAll('[data-stat-icon="health"]')).toHaveLength(1)
  expect(document.querySelectorAll('[data-stat-icon="attack"]')).toHaveLength(1)
  await click("View prestige chart")
  expect(document.querySelector('[role="dialog"][aria-labelledby="champion-prestige-chart-heading"]')).not.toBeNull()
  expect(document.querySelector('[aria-label="Prestige chart data"]')?.textContent).toBe("39730")
  const chart = document.querySelector('[role="dialog"]')!
  await act(async () => chart.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
  await vi.waitFor(() => expect(document.activeElement?.getAttribute("aria-label")).toBe("View prestige chart"))
  await click("Kit overview")
  await click("Adjust build")
  const ascension = document.querySelector<HTMLSelectElement>('select[aria-label="Ascension"]')!
  await act(async () => { ascension.value = "0"; ascension.dispatchEvent(new Event("change", { bubbles: true })) })
  await click("Done")
  expect(document.querySelector('[aria-label="Selected build stats"]')).toBeNull()
  await click("Stats & attacks")
  expect([...summary().querySelectorAll("dd > span")].map(node => node.textContent)).toEqual(["34,060", "88,679", "7,903"])
  expect(new URLSearchParams(window.location.search).get("ascension")).toBe("0")
  await click("View prestige chart")
  expect(document.querySelector('[aria-label="Prestige chart data"]')?.textContent).toBe("34060")
})

it.each([
  ["Kit overview", "overview"], ["Full abilities", "abilities"], ["Synergies", "synergies"],
  ["Stats & attacks", "stats"], ["How to obtain", "crystals"],
])("selects %s from the mobile sheet without putting stats in the banner", async (label, tab) => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const dialog = await openSectionPicker()
  await act(async () => [...dialog.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === label)!.click())
  expect(new URLSearchParams(window.location.search).get("tab")).toBe(tab)
  expect(sectionPickerLabel()).toBe(label)
  expect(document.querySelector('[aria-label="Current banner"]')?.textContent).not.toMatch(/Prestige|Health|Attack/)
  expect(document.querySelector('[aria-label="Selected build stats"]') !== null).toBe(tab === "stats")
})

it("offers every section from the last section, selects and closes with focus returned", async () => {
  window.history.replaceState(null, "", "/champions/current?tab=crystals&rarity=7&rank=5&sig=75")
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  expect(sectionPickerLabel()).toBe("How to obtain")
  const dialog = await openSectionPicker()
  expect(dialog.getAttribute("aria-labelledby")).toBeTruthy()
  expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)?.textContent).toBe("Champion sections")
  const choices = [...dialog.querySelectorAll<HTMLButtonElement>('button[aria-current]')]
  expect(choices.map(button => button.textContent)).toEqual(["Kit overview", "Full abilities", "Synergies", "Stats & attacks", "How to obtain"])
  expect(choices.map(button => button.getAttribute("aria-current"))).toEqual(["false", "false", "false", "false", "page"])
  expect(document.activeElement).toBe(choices[4])
  await act(async () => choices[0].click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(sectionPickerLabel()).toBe("Kit overview")
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(document.activeElement).toBe(sectionPicker())
  expect(document.querySelector('[role="tabpanel"][data-state="active"]')?.textContent).toContain("Read synergy source")
  expect(new URLSearchParams(window.location.search).get("tab")).toBe("overview")
  expect(new URLSearchParams(window.location.search).get("rank")).toBe("5")
  expect(new URLSearchParams(window.location.search).get("sig")).toBe("75")
  await traverse("back")
  expect(sectionPickerLabel()).toBe("How to obtain")
  await traverse("forward")
  expect(sectionPickerLabel()).toBe("Kit overview")
})

it("dismisses the section dialog with Escape without changing the URL", async () => {
  window.history.replaceState(null, "", "/champions/current?tab=abilities&chapter=base&ability=123&rarity=7&rank=5&sig=75")
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const href = window.location.href
  const dialog = await openSectionPicker()
  expect(document.activeElement?.textContent).toBe("Full abilities")
  await act(async () => dialog.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(window.location.href).toBe(href)
  // Radix restores focus after its dialog unmount cleanup.
  await vi.waitFor(() => expect(document.activeElement === sectionPicker()).toBe(true))
})

it("uses the existing destination reset contract from the mobile picker", async () => {
  window.history.replaceState(null, "", "/champions/current?tab=synergies&synergy=catalog_alias&rarity=7&rank=5&sig=75#champion-synergy-catalog_alias")
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const original = window.location.href
  const dialog = await openSectionPicker()
  await act(async () => [...dialog.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === "Stats & attacks")!.click())
  const url = new URL(window.location.href)
  expect(url.searchParams.get("tab")).toBe("stats")
  expect(url.searchParams.has("synergy")).toBe(false)
  expect(url.hash).toBe("")
  expect(sectionPickerLabel()).toBe("Stats & attacks")
  await traverse("back")
  expect(window.location.href).toBe(original)
  expect(document.querySelector('[data-synergy-probe="catalog_alias"]')).not.toBeNull()
  expect(sectionPickerLabel()).toBe("Synergies")
})

it("closes the current section without adding a duplicate history entry", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const dialog = await openSectionPicker()
  const pushes = vi.mocked(window.history.pushState).mock.calls.length
  const href = window.location.href
  await act(async () => dialog.querySelector<HTMLButtonElement>('[aria-current="page"]')!.click())
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(window.history.pushState).toHaveBeenCalledTimes(pushes)
  expect(window.location.href).toBe(href)
})

it("combines build, five subtitle-free tabs and editing in a strip outside the hero/content wrapper", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const bar = document.querySelector<HTMLElement>('[data-champion-context]')!
  expect(bar.querySelectorAll('[role="tab"]')).toHaveLength(5)
  expect([...bar.querySelectorAll('[role="tab"]')].map(tab => tab.textContent)).toEqual(["Kit overview", "Full abilities", "Synergies", "Stats & attacks", "How to obtain"])
  for (const tab of bar.querySelectorAll('[role="tab"]')) expect(tab.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
  expect(bar.textContent).not.toMatch(/Effects & immunities|Read the complete kit|Partners & team bonuses|Ratings & hit breakdowns|Crystals, quests & events/)
  expect(bar.querySelector('[aria-label="Champion build"]')?.textContent).toContain("7★R5Sig 75")
  expect(bar.querySelector('[aria-label="Adjust build"]')).not.toBeNull()
  const hero = document.querySelector('[aria-label="Current banner"]')!
  expect(hero.compareDocumentPosition(bar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  expect(bar.parentElement?.contains(document.querySelector('[data-champion-section-content]'))).toBe(true)
  expect(bar.parentElement).not.toBe(hero.parentElement)
  expect(bar.querySelector('img')).toBeNull()
})

it("reveals the current champion only after its hero leaves the visible stack and clears identity on champion change", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const name = () => document.querySelector('[aria-label="Champion build"] [title]')!
  const bar = document.querySelector('[data-champion-context]')!
  expect(bar.getAttribute('data-docked')).toBe('false')
  expect(name().getAttribute('aria-hidden')).toBe('true')
  await act(async () => heroNotifications.at(-1)!(true, 200))
  expect(name().getAttribute('data-visible')).toBe('false')
  await act(async () => heroNotifications.at(-1)!(false, 64))
  expect(bar.getAttribute('data-docked')).toBe('true')
  expect(name().getAttribute('data-visible')).toBe('true')
  expect(name().textContent).toBe('Current')
  await act(async () => heroNotifications.at(-1)!(true, 160))
  expect(bar.getAttribute('data-docked')).toBe('false')
  expect(name().getAttribute('aria-hidden')).toBe('true')
  await act(async () => root.render(<ChampionDetailsClient {...props} champion={{ ...props.champion, id: 2, name: 'Next champion', slug: 'next' }} />))
  expect(name().textContent).toBe('Next champion')
  expect(document.querySelector('[data-champion-context]')?.getAttribute('data-docked')).toBe('false')
  expect(name().getAttribute('aria-hidden')).toBe('true')
})

it("measures the strip for content/ability offsets and scrolls section changes to content below the hero", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const bar = document.querySelector<HTMLElement>('[data-champion-context]')!
  const dossier = bar.closest<HTMLElement>('[style*="--champion-accent"]')!
  expect(dossier.style.getPropertyValue('--champion-tabs-height')).toBe('64px')
  vi.spyOn(bar, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 64, 1280, 65))
  await act(async () => barResize())
  expect(dossier.style.getPropertyValue('--champion-tabs-height')).toBe('65px')
  const scroll = vi.mocked(HTMLElement.prototype.scrollIntoView)
  scroll.mockClear()
  await click('Stats & attacks')
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)) })
  expect(scroll.mock.instances).toContain(document.querySelector('[data-champion-section-content]'))
})

it("closes the section sheet on history changes and transfers focus between picker and desktop tabs on resize", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  await openSectionPicker()
  await act(async () => window.history.pushState(null, '', '/champions/current?tab=stats&rarity=7&rank=5&sig=75'))
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await openSectionPicker()
  await act(async () => { desktopMedia.matches = true; desktopMedia.dispatchEvent(new Event('change')) })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(document.activeElement?.getAttribute('role')).toBe('tab')
  expect(document.activeElement?.textContent).toBe('Stats & attacks')
  await act(async () => { desktopMedia.matches = false; desktopMedia.dispatchEvent(new Event('change')) })
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) })
  expect(document.activeElement).toBe(sectionPicker())
  expect(new URLSearchParams(window.location.search).get('sig')).toBe('75')
})


it("keeps all four build values as the mobile edit chip content, including A0", async () => {
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const chip = document.querySelector('[data-champion-context] button[aria-label="Adjust build"]')!
  const values = [...chip.querySelectorAll('[aria-hidden="true"] > span')].filter(el => el.children.length === 2)
  expect(values.map(el => el.textContent)).toEqual(["7\u2605Rank 5", "Sig 75A0"])
  expect(chip.getAttribute('title')).toBe('Adjust build: 7-star, Rank 5, Signature 75, Ascension 0')
})

it("uses the header edge for docking identity and initializes restored scroll before paint", async () => {
  const nativeBounds = HTMLElement.prototype.getBoundingClientRect
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    if (this.matches('section[aria-label$=" banner"]')) return new DOMRect(0, -200, 1280, 250)
    return nativeBounds.call(this)
  })
  await act(async () => root.render(<ChampionDetailsClient {...props} />))
  const name = document.querySelector('[aria-label="Champion build"] [title]')!
  expect(document.querySelector('[data-champion-context]')?.getAttribute('data-docked')).toBe('true')
  expect(name.getAttribute('data-visible')).toBe('true')
  await act(async () => heroNotifications.at(-1)!(true, 100))
  expect(name.getAttribute('data-visible')).toBe('false')
  await act(async () => heroNotifications.at(-1)!(false, 63))
  expect(name.getAttribute('data-visible')).toBe('true')
})
