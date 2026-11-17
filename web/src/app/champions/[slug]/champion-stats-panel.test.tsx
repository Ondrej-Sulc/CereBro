// @vitest-environment jsdom

import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import { ChampionStatsPanel } from "./champion-stats-panel"
import type { ChampionDetailsView, ChampionStatRow } from "./champion-details-types"

const stat: ChampionStatRow = {
  id: 1, tierId: "7-6", rarity: 7, rarityLabel: null, rank: 6, level: 75, challengeRating: 250,
  health: 100, attack: 10, healthRating: null, attackRating: null, prestige: null,
  criticalRating: 792, criticalDamageRating: 1491, armorPenetration: 0, blockPenetration: 0,
  criticalResistance: 0, armorRating: 622, blockProficiency: 4712, physicalResistance: 0, energyResistance: 0,
  specialDamageMultiplier: 1.234, baseAbilityIds: [], sigAbilityIds: [],
}
const view: ChampionDetailsView = {
  champion: { id: 1, name: "Test", shortName: "Test", slug: "test", gameId: null, class: "MYSTIC", images: {}, gameSynergies: [], tags: [], abilities: [], abilityTexts: [], abilityCurves: [], attacks: [], stats: [stat], prestigeData: [], duels: [] },
  portraitUrl: "", heroUrl: "", secondaryUrl: "", accent: "#9333ea", selectedStat: stat,
  selectedRarity: "7", selectedRank: "6", rarityOptions: [7], rankOptions: [6], sigLevel: 200, maxSig: 200,
  ascensionLevel: 0, prestige: null, health: 100, attack: 10, maxStats: {}, abilities: [], immunities: [], glossaryById: new Map(),
  descriptionView: prepareChampionAbilityTextView({ records: [] }),
  setRarity: () => {}, setRank: () => {}, setSigLevel: () => {}, setAscensionLevel: () => {},
}
function render(selectedStat: ChampionStatRow | undefined = stat) {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(createElement(ChampionStatsPanel, { view: { ...view, selectedStat } }))
  return root
}
function row(root: HTMLElement, label: string) {
  const heading = [...root.querySelectorAll("dt")].find(n => n.textContent === label)
  expect(heading, label).toBeDefined()
  return heading!.parentElement!
}

it("associates each game stat glyph with its named rating while keeping the value readable", () => {
  const root = render()
  const expected = [
    ["Critical rating", "criticalRating", "792"], ["Critical damage rating", "criticalDamageRating", "1,491"],
    ["Armor penetration", "armorPenetration", "0"], ["Block penetration", "blockPenetration", "0"],
    ["Critical resistance", "criticalResistance", "0"], ["Armor rating", "armorRating", "622"],
    ["Block proficiency", "blockProficiency", "4,712"], ["Physical resistance", "physicalResistance", "0"],
    ["Energy resistance", "energyResistance", "0"],
  ]
  for (const [label, key, value] of expected) {
    const rating = row(root, label)
    const icon = rating.querySelector(`[data-stat-icon="${key}"]`)
    expect(icon, label).not.toBeNull()
    expect(icon?.getAttribute("aria-hidden")).toBe("true")
    expect(rating.querySelector("dt")?.textContent).toBe(label)
    expect(rating.querySelector("dd")?.textContent).toBe(value)
  }
  expect(row(root, "Special damage multiplier").querySelector("dd")?.textContent).toBe("1.23×")
})

it("keeps recorded zero ratings while hiding unavailable ratings", () => {
  const root = render({ ...stat, criticalRating: null, armorRating: 0 })
  expect([...root.querySelectorAll("dt")].some(node => node.textContent === "Critical rating")).toBe(false)
  expect(row(root, "Armor rating").querySelector("dd")?.textContent).toBe("0")
  expect(row(root, "Armor rating").querySelector("dd")?.getAttribute("data-empty")).not.toBe("true")
})

it("renders nothing when both stats and attack hits are absent", () => {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(createElement(ChampionStatsPanel, { view: { ...view, selectedStat: undefined, health: null, attack: null } }))
  expect(root.innerHTML).toBe("")
  expect(root.querySelectorAll("[data-stat-icon]")).toHaveLength(0)
})

it("uses projected summary values once and preserves unknown versus zero", () => {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(createElement(ChampionStatsPanel, { view: { ...view, prestige: null, health: 123456, attack: 0 } }))
  const summary = root.querySelector('[aria-label="Selected build stats"]')!
  expect([...summary.querySelectorAll("dt")].map(node => node.textContent)).toEqual(["Health", "Attack"])
  expect([...summary.querySelectorAll("dd")].map(node => node.textContent)).toEqual(["123,456", "0"])
  expect(root.querySelectorAll('[data-stat-icon="health"]')).toHaveLength(1)
  expect(root.querySelectorAll('[data-stat-icon="attack"]')).toHaveLength(1)
  expect(root.querySelector('[aria-label="View prestige chart"]')).toBeNull()
})

it("shows attacks without empty stat headings, summaries or placeholder moves", () => {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(createElement(ChampionStatsPanel, { view: {
    ...view, selectedStat: undefined, health: null, attack: null,
    champion: { ...view.champion, attacks: [
      { id: 1, type: "L1", hits: [{ id: 1, properties: ["Contact", "Physical"] }] },
      { id: 2, type: "S1", hits: [] },
    ] },
  } }))
  expect(root.textContent).toContain("Attack breakdown")
  expect(root.textContent).toContain("Light 1")
  expect(root.textContent).not.toContain("Combat ratings")
  expect(root.textContent).not.toContain("Special 1")
  expect(root.textContent).not.toContain("Build stats are not available")
  expect(root.querySelector('[aria-label="Selected build stats"]')).toBeNull()
  expect(root.firstElementChild?.getAttribute("aria-labelledby")).toBe("champion-attacks-heading")
  for (const section of root.querySelectorAll("section[aria-labelledby]")) {
    expect(root.querySelector(`#${section.getAttribute("aria-labelledby")}`)).not.toBeNull()
  }
})

it("shows only the rating panel with recorded values and omits empty child lists", () => {
  const emptyRatings: ChampionStatRow = { ...stat,
    criticalRating: null, criticalDamageRating: null, armorPenetration: 0, blockPenetration: null,
    specialDamageMultiplier: null, criticalResistance: null, armorRating: null, blockProficiency: null,
    physicalResistance: null, energyResistance: null,
  }
  const root = render(emptyRatings)
  expect(root.querySelector('[aria-labelledby="champion-ratings-offense"]')).not.toBeNull()
  expect(root.querySelector('[aria-labelledby="champion-ratings-defense"]')).toBeNull()
  expect(root.querySelectorAll("dl")).not.toHaveLength(0)
  expect([...root.querySelectorAll("dl")].every(list => list.children.length > 0)).toBe(true)
  expect(root.textContent).not.toContain("Attack breakdown")
  expect(root.textContent).not.toContain("No attack hit data")
  expect(row(root, "Armor penetration").querySelector("dd")?.textContent).toBe("0")
})

it("does not display nonfinite numbers as recorded stats", () => {
  const root = render({ ...stat, criticalRating: Number.NaN, specialDamageMultiplier: Number.POSITIVE_INFINITY })
  expect(root.textContent).not.toContain("NaN")
  expect(root.textContent).not.toContain("Infinity")
  expect([...root.querySelectorAll("dt")].some(node => node.textContent === "Critical rating")).toBe(false)
})

it("offers a prestige chart only when the selected build has a recorded curve", () => {
  const renderCurve = (prestigeData: ChampionDetailsView["champion"]["prestigeData"]) => {
    const root = document.createElement("div")
    root.innerHTML = renderToStaticMarkup(createElement(ChampionStatsPanel, { view: {
      ...view, prestige: 1234, champion: { ...view.champion, prestigeData },
    } }))
    return root
  }
  expect(renderCurve([]).querySelector('[aria-label="View prestige chart"]')).toBeNull()
  const endpoints = [
    { id: 1, rarity: 7, rank: 6, sig: 0, prestige: 1000 },
    { id: 2, rarity: 7, rank: 6, sig: 1, prestige: 1100 },
    { id: 3, rarity: 7, rank: 6, sig: 200, prestige: 2000 },
  ]
  expect(renderCurve(endpoints).querySelector('[aria-label="View prestige chart"]')).not.toBeNull()
  expect(renderCurve(endpoints.map(point => ({ ...point, rank: 5 }))).querySelector('[aria-label="View prestige chart"]')).toBeNull()
})
