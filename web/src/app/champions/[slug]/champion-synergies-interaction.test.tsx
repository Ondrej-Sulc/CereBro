// @vitest-environment jsdom

import { act, useState } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { TooltipProvider } from "@/components/ui/tooltip"
import { buildChampionSynergyView, type ChampionSynergy } from "@/lib/champion-synergies"
import { ChampionSynergiesPanel } from "./champion-synergies-panel"

const current = { id: 1, name: "Current", slug: "current", images: null }
const partner = { id: 2, name: "Partner", slug: "partner", images: null }
const rows: ChampionSynergy[] = [
  ...["native_1", "native_alias"].map(id => ({ id, name: "NATIVE Lv. 1", description: "Current gains Fury.", unique: false, enabled: true, requiredHeroGroups: false,
    members: [{ role: "OWNER" as const, rarity: 7, champion: current }, { role: "REQUIRED" as const, rarity: 7, champion: partner }] })),
  { id: "incoming_1", name: "TEAM BONUS", description: "Current gains Precision.", unique: false, enabled: true, requiredHeroGroups: false,
    members: [{ role: "OWNER", rarity: 7, champion: partner }, { role: "REQUIRED", rarity: 7, champion: current }] },
]
const view = buildChampionSynergyView(rows, current.id, 7)
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })))
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  window.history.replaceState(null, "", "/champions/current?tab=synergies")
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const render = async (targetSynergyId: string | null = null) => {
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel {...view} rarity={7} glossaryById={new Map()} targetSynergyId={targetSynergyId} /></TooltipProvider>))
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
}
const input = () => document.querySelector<HTMLInputElement>('input[type="search"]')!

function observeCardSizes() {
  const model = { columns: 2, heights: [130.25, 65.5, 90], notify: () => {}, disconnect: vi.fn() }
  const readStyle = window.getComputedStyle.bind(window)
  vi.stubGlobal("getComputedStyle", (element: Element) => {
    const style = readStyle(element)
    style.gridTemplateColumns = model.columns === 2 ? "500px 500px" : "1012px"
    style.columnGap = "12px"
    return style
  })
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const index = Number(this.id.match(/^champion-synergy-flow_(\d)$/)?.[1])
    return new DOMRect(0, 0, 500, model.heights[index] ?? 0)
  })
  vi.stubGlobal("ResizeObserver", class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) { model.notify = () => callback([], this) }
    observe() {}
    unobserve() {}
    disconnect = model.disconnect
  })
  return model
}

async function renderFlow() {
  const cards = [0, 1, 2].map(index => ({ ...view.owned[0], id: `flow_${index}`, name: `FLOW ${index}` }))
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel owned={cards} incoming={[]} rarity={7} glossaryById={new Map()} /></TooltipProvider>))
  return [...document.querySelectorAll<HTMLElement>("article")]
}

it("fits unequal card heights into the flow without changing catalog order and remeasures expanded content", async () => {
  const sizes = observeCardSizes()
  const cards = await renderFlow()
  expect(cards.map(card => card.id)).toEqual(["champion-synergy-flow_0", "champion-synergy-flow_1", "champion-synergy-flow_2"])
  expect(cards.map(card => card.style.gridRowEnd)).toEqual(["span 143", "span 78", "span 102"])
  sizes.heights[0] = 240
  await act(async () => { sizes.notify(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(cards[0].style.gridRowEnd).toBe("span 252")
  expect(cards[1].style.gridRowEnd).toBe("span 78")
  expect(cards[0].parentElement?.dataset.cardFlow).toBe("masonry")
})

it("restores natural single-column rows and cleans up its pending measurement when filtered away", async () => {
  const sizes = observeCardSizes()
  const cards = await renderFlow()
  sizes.columns = 1
  await act(async () => { sizes.notify(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(cards.every(card => card.style.gridRowEnd === "")).toBe(true)
  expect(cards[0].parentElement?.dataset.cardFlow).toBeUndefined()
  sizes.columns = 2
  await act(async () => { sizes.notify(); await new Promise<void>(resolve => requestAnimationFrame(() => resolve())) })
  expect(cards[0].style.gridRowEnd).toBe("span 143")
  const cancel = vi.spyOn(window, "cancelAnimationFrame")
  await act(async () => { sizes.notify(); root.render(<div />) })
  expect(sizes.disconnect).toHaveBeenCalled()
  expect(cancel).toHaveBeenCalled()
})

it("adds the partner's native class crest without repeating its accessible name or changing its champion link", async () => {
  const decoratedRows = rows.map(row => ({ ...row, members: row.members.map(member => ({ ...member,
    champion: { ...member.champion, class: "SCIENCE" as const },
  })) }))
  const decorated = buildChampionSynergyView(decoratedRows, current.id, 7)
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel {...decorated} rarity={7} glossaryById={new Map()} /></TooltipProvider>))
  const article = document.getElementById("champion-synergy-native_1")!
  const link = article.querySelector<HTMLAnchorElement>('header a[href="/champions/partner"]')!
  expect(link.textContent).toBe("Partner")
  const portrait = link.querySelector('[data-partner-portrait]')!
  expect(portrait.getAttribute("aria-hidden")).toBe("true")
  expect(portrait.querySelector('[data-partner-class="SCIENCE"] img')?.getAttribute("src")).toContain("Science.png")
  expect([...portrait.querySelectorAll("img")].every(image => image.alt === "")).toBe(true)
  await act(async () => link.focus())
  expect(document.activeElement).toBe(link)
})

it("keeps an unlinked partner keyboard-accessible without inventing a missing class crest", async () => {
  const unknownRows = rows.map(row => ({ ...row, members: row.members.map(member => ({ ...member,
    champion: { ...member.champion, slug: null },
  })) }))
  const unknown = buildChampionSynergyView(unknownRows, current.id, 7)
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel {...unknown} rarity={7} glossaryById={new Map()} /></TooltipProvider>))
  const badge = document.querySelector<HTMLElement>('article header [role="group"] [tabindex="0"]')!
  expect(badge.textContent).toBe("Partner")
  expect(badge.querySelector('[data-partner-portrait]')?.getAttribute("aria-hidden")).toBe("true")
  expect(badge.querySelector('[data-partner-class]')).toBeNull()
  await act(async () => badge.focus())
  expect(document.activeElement).toBe(badge)
})

async function search(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value)
    input().dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function clickButton(label: string) {
  const button = [...document.querySelectorAll("button")].find(button => button.getAttribute("aria-label") === label || button.textContent?.startsWith(label))!
  expect(button).toBeDefined()
  await act(async () => { button.focus(); button.click() })
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
}

it("reports matching catalog families and names the empty-result scope", async () => {
  await render()
  expect(document.querySelector('[role="status"]')?.textContent).toContain("2 of 2")
  await search("Fury")
  expect(document.querySelector('[role="status"]')?.textContent).toContain("1 of 2")
  await clickButton("From teammates")
  expect(document.querySelector('[role="status"]')?.textContent).toContain("0 of 2")
  expect(document.body.textContent).toContain('No synergies match “Fury” in From teammates.')
})

it("resets an empty search and its direction without losing keyboard focus", async () => {
  await render()
  await clickButton("From teammates")
  await search("missing")
  await clickButton("Show all synergies")
  expect(input().value).toBe("")
  expect(document.activeElement).toBe(input())
  expect(document.querySelectorAll("article")).toHaveLength(2)
})

it("clears the query but preserves the chosen direction when using the search clear control", async () => {
  await render()
  await clickButton("From teammates")
  await search("missing")
  await clickButton("Clear synergy search")
  expect(input().value).toBe("")
  expect(document.activeElement).toBe(input())
  expect(document.querySelectorAll("article")).toHaveLength(1)
  expect(document.body.textContent).toContain("TEAM BONUS")
})

it("reveals and focuses a newly linked alias despite previous search and direction filters", async () => {
  await render()
  await clickButton("From teammates")
  await search("missing")
  await render("native_alias")
  expect(input().value).toBe("")
  expect(document.activeElement?.id).toBe("champion-synergy-native_alias")
  expect(document.querySelector('[data-selected="true"]')).not.toBeNull()
})

it("explains a target missing from the selected rarity instead of silently dropping it", async () => {
  await render("unavailable_1")
  expect(document.body.textContent).toContain("This linked synergy is not available for the selected 7-star build.")
  expect(document.activeElement?.getAttribute("role")).toBe("status")
})

it("restores legacy fragment targets on history and hash changes within the mounted panel", async () => {
  await render()
  await act(async () => {
    window.history.replaceState(null, "", "?tab=synergies#champion-synergy-native_alias")
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.activeElement?.id).toBe("champion-synergy-native_alias")
  expect(document.querySelector('[data-selected="true"]')?.textContent).toContain("NATIVE")
  await act(async () => {
    window.history.replaceState(null, "", "?tab=synergies#champion-synergy-incoming_1")
    window.dispatchEvent(new HashChangeEvent("hashchange"))
  })
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.activeElement?.id).toBe("champion-synergy-incoming_1")
  expect(document.querySelector('[data-selected="true"]')?.textContent).toContain("TEAM BONUS")
})

it("uses the explicit query target in preference to a stale fragment", async () => {
  window.history.replaceState(null, "", "?tab=synergies#champion-synergy-incoming_1")
  await render("native_alias")
  expect(document.activeElement?.id).toBe("champion-synergy-native_alias")
})

it("moves focus to search when dismissing an unavailable target", async () => {
  function LinkedPanel() {
    const [target, setTarget] = useState<string | null>("unavailable_1")
    return <TooltipProvider><ChampionSynergiesPanel {...view} rarity={7} glossaryById={new Map()} targetSynergyId={target} onClearTarget={() => setTarget(null)} /></TooltipProvider>
  }
  await act(async () => root.render(<LinkedPanel />))
  await clickButton("Browse all synergies")
  expect(document.body.textContent).not.toContain("This linked synergy is not available")
  expect(document.activeElement).toBe(input())
  expect(document.querySelectorAll("article")).toHaveLength(2)
})

it("explains a retained source target after changing to a rarity where it is unavailable", async () => {
  await render("native_alias")
  const changedRarity = buildChampionSynergyView(rows, current.id, 6)
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel {...changedRarity} rarity={6} glossaryById={new Map()} targetSynergyId="native_alias" /></TooltipProvider>))
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(document.body.textContent).toContain("This linked synergy is not available for the selected 6-star build.")
  expect(document.activeElement?.getAttribute("role")).toBe("status")
})

it("keeps the complete bonus visible while exposing named requirements through its associated control", async () => {
  await render()
  const article = document.getElementById("champion-synergy-native_1")!
  const toggle = article.querySelector<HTMLButtonElement>('button[aria-label^="Show partners and star requirements"]')!
  expect(toggle).not.toBeNull()
  const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!
  expect(toggle.getAttribute("aria-expanded")).toBe("false")
  expect(panel.hidden).toBe(true)
  const bonus = [...article.querySelectorAll("li")].find(item => item.textContent?.includes("Current gains Fury."))!
  expect(bonus.closest("[hidden]")).toBeNull()
  expect(article.querySelector('a[href="/champions/partner"]')?.textContent).toBe("Partner")
  await act(async () => { toggle.focus(); toggle.click() })
  expect(toggle.getAttribute("aria-expanded")).toBe("true")
  expect(panel.hidden).toBe(false)
  expect(panel.querySelector('a[aria-label="Partner available at 7 stars"]')?.textContent).toContain("7★")
  await act(async () => toggle.click())
  expect(panel.hidden).toBe(true)
  expect(document.activeElement).toBe(toggle)
})

it("retains every family level's bonus and correlated stars while opening the partner-name legend", async () => {
  const familyView = buildChampionSynergyView([...rows, { ...rows[0], id: "native_2", name: "NATIVE Lv. 2", description: "Current gains more Fury." }], current.id, 7)
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel {...familyView} rarity={7} glossaryById={new Map()} /></TooltipProvider>))
  const family = document.querySelector('article[id^="champion-synergy-family-"]')!
  const toggle = family.querySelector<HTMLButtonElement>('button[aria-label^="Show partners and star requirements"]')!
  expect(toggle).not.toBeNull()
  await act(async () => toggle.click())
  const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!
  expect(panel.hidden).toBe(false)
  expect(panel.textContent).toContain("Partner")
  expect(family.querySelectorAll("h5")).toHaveLength(2)
  for (const id of ["native_1", "native_2"]) {
    const row = document.getElementById(`champion-synergy-${id}`)!
    expect(row.closest("[hidden]")).toBeNull()
    expect(row.textContent).toContain("7★")
    expect(row.textContent).toContain("Fury.")
  }
})

it("makes the full partner name a champion link beside its exact star range", async () => {
  await render()
  const article = document.getElementById("champion-synergy-native_1")!
  const toggle = article.querySelector<HTMLButtonElement>('button[aria-controls]')!
  await act(async () => toggle.click())
  const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!
  const link = panel.querySelector<HTMLAnchorElement>('a[href="/champions/partner"]')
  expect(link).not.toBeNull()
  expect(link?.getAttribute("aria-label")).toBe("Partner available at 7 stars")
  expect(link?.textContent).toContain("Partner")
  expect(link?.textContent).toContain("7★")
})

it("closes the family legend with Escape and returns visible focus to its row control", async () => {
  const familyView = buildChampionSynergyView([...rows, { ...rows[0], id: "native_2", name: "NATIVE Lv. 2", description: "Current gains more Fury." }], current.id, 7)
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel {...familyView} rarity={7} glossaryById={new Map()} /></TooltipProvider>))
  const family = document.querySelector('article[id^="champion-synergy-family-"]')!
  const toggle = family.querySelector<HTMLButtonElement>('button[aria-controls]')!
  await act(async () => toggle.click())
  const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!
  const link = panel.querySelector<HTMLAnchorElement>('a[href="/champions/partner"]')
  expect(link).not.toBeNull()
  await act(async () => { link!.focus(); link!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })) })
  await act(async () => new Promise<void>(resolve => window.requestAnimationFrame(() => resolve())))
  expect(panel.hidden).toBe(true)
  expect(document.activeElement).toBe(toggle)
  expect(toggle.getAttribute("aria-expanded")).toBe("false")
  expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled()
})

it("keeps each current-champion star set paired with its own partner stars in the detailed panel", async () => {
  const correlated = [[4, 2], [6, 5]].map(([ownerStars, partnerStars]) => ({
    ...rows[0], id: `pair_${ownerStars}`, name: "STAR PAIRS", members: [
      { role: "OWNER" as const, rarity: ownerStars, champion: current },
      { role: "REQUIRED" as const, rarity: partnerStars, champion: partner },
    ],
  }))
  const projection = buildChampionSynergyView(correlated, current.id, null)
  await act(async () => root.render(<TooltipProvider><ChampionSynergiesPanel {...projection} rarity={null} glossaryById={new Map()} /></TooltipProvider>))
  const toggle = document.querySelector<HTMLButtonElement>('article button[aria-controls]')!
  await act(async () => toggle.click())
  const panel = document.getElementById(toggle.getAttribute("aria-controls")!)!
  expect(panel.querySelector('[role="group"][aria-label="This champion: 4★"] a')?.getAttribute("aria-label")).toBe("Partner available at 2 stars")
  expect(panel.querySelector('[role="group"][aria-label="This champion: 6★"] a')?.getAttribute("aria-label")).toBe("Partner available at 5 stars")
})
