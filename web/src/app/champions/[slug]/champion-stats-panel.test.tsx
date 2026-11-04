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

it("keeps zero and unavailable ratings distinct with their original labels", () => {
  const root = render({ ...stat, criticalRating: null, armorRating: 0 })
  expect(row(root, "Critical rating").querySelector("dd")?.textContent).toBe("—")
  expect(row(root, "Armor rating").querySelector("dd")?.textContent).toBe("0")
})

it("retains the missing-stats state without invented rating icons or numbers", () => {
  const root = document.createElement("div")
  root.innerHTML = renderToStaticMarkup(createElement(ChampionStatsPanel, { view: { ...view, selectedStat: undefined } }))
  expect(root.textContent).toContain("Build stats are not available for this champion yet.")
  expect(root.querySelectorAll("[data-stat-icon]")).toHaveLength(0)
})
