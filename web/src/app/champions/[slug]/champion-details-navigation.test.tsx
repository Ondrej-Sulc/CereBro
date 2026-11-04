// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { ChampionDetailsClient } from "./champion-details-client"
import type { ChampionDetailsProps, ChampionStatRow } from "./champion-details-types"

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
vi.mock("./champion-stats-panel", () => ({ ChampionStatsPanel: () => <p>Combat ratings probe</p> }))
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
let root: Root
let clipboardDescriptor: PropertyDescriptor | undefined
const writeClipboard = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined)
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} })
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
  expect(document.body.textContent).toContain("Combat ratings probe")
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
