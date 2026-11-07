// @vitest-environment jsdom

import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { getChampionAscensionRules } from "@cerebro/core/data/game-ascension"
import { ChampionDetailsClient } from "./champion-details-client"
import { ChampionPrototype } from "./prototype/[concept]/prototype-client"
import type { ChampionDetailsProps, ChampionStatRow } from "./champion-details-types"
import prestigeFixture from "../../../../../src/tests/fixtures/champion-prestige-ascension.json"
import combatFixture from "../../../../../src/tests/fixtures/champion-combat-ascension.json"

vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react")
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(
    listener => {
      window.addEventListener("popstate", listener)
      return () => window.removeEventListener("popstate", listener)
    },
    () => window.location.search,
    () => "",
  )) }
})
vi.mock("next/image", () => ({ default: () => null }))

const stat = (rarity: number): ChampionStatRow => ({
  id: rarity, tierId: `tier${rarity}-5`, rarity, rarityLabel: null, rank: 5, level: 65, challengeRating: 250,
  health: 10000, attack: 1000, healthRating: null, attackRating: null, prestige: null,
  armorRating: null, armorPenetration: null, criticalRating: null, criticalResistance: null,
  criticalDamageRating: null, blockProficiency: null, blockPenetration: null, specialDamageMultiplier: null,
  energyResistance: null, physicalResistance: null, baseAbilityIds: [], sigAbilityIds: [],
})
function props(gameId: string): ChampionDetailsProps {
  return {
    champion: {
      id: 1, name: gameId, shortName: gameId, slug: gameId, gameId, class: "SCIENCE", images: {},
      gameSynergies: [], tags: [], abilities: [], abilityTexts: [], abilityCurves: [], attacks: [],
      stats: [stat(7), stat(6)], prestigeData: [], duels: [], ascensionRules: getChampionAscensionRules(gameId),
    },
    glossaryTerms: [], maxStatsByTier: {},
  }
}
let root: Root
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() })
  document.body.innerHTML = '<div id="root"></div>'
  root = createRoot(document.getElementById("root")!)
  const push = window.history.pushState.bind(window.history)
  vi.spyOn(window.history, "pushState").mockImplementation((data, unused, url) => {
    push(data, unused, url)
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
  const replace = window.history.replaceState.bind(window.history)
  vi.spyOn(window.history, "replaceState").mockImplementation((data, unused, url) => {
    replace(data, unused, url)
    window.dispatchEvent(new PopStateEvent("popstate"))
  })
})
afterEach(async () => {
  await act(async () => root.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
async function openBuild() {
  const button = [...document.querySelectorAll("button")].find(item => item.textContent === "Adjust build")!
  await act(async () => button.click())
}
function metric(kind: "health" | "attack") {
  const label = document.querySelector(`[aria-label="Selected build stats"] [data-stat-icon="${kind}"]`)?.parentElement
  return `${label?.nextElementSibling?.textContent}${label?.textContent}`
}
function challengerRating() {
  return [...document.querySelectorAll("dt")].find(item => item.textContent === "Challenger rating")?.nextElementSibling?.textContent
}

function guideMetric(label: string) {
  return [...document.querySelectorAll("div")].find(item => item.childElementCount === 0 && item.textContent === label)?.previousElementSibling?.textContent
}
async function renderBuild(surface: string, input: ChampionDetailsProps, level: number) {
  window.history.replaceState(null, "", `/champions/${input.champion.gameId}?tab=stats&rarity=7&rank=${input.champion.stats[0].rank}&sig=200&ascension=${level}`)
  if (surface === "detail") {
    await act(async () => root.render(<ChampionDetailsClient {...input} />))
  } else {
    await act(async () => root.render(<ChampionPrototype concept="field-guide" {...input} />))
    const label = [...document.querySelectorAll("span")].find(item => item.textContent === "Ascension · A0")!
    await act(async () => label.parentElement!.querySelectorAll("button")[level].click())
  }
}

// Archived base stats + official scaling policy; only prestige A2 is a game observation.
it.each(["detail", "prototype"].flatMap(surface => [
  { surface, level: 0, health: "88,679", attack: "7,903", prestige: "34,060" },
  { surface, level: 1, health: "95,773", attack: "8,535", prestige: "36,780" },
  { surface, level: 2, health: "103,435", attack: "9,218", prestige: "39,730" },
]))("projects the archived exact build at A$level ($surface), with separate combat and prestige rounding", async ({ surface, level, health, attack, prestige }) => {
  const input = props(prestigeFixture.gameId)
  input.champion.stats = [{ ...stat(7), ...combatFixture.baseStat, tierId: combatFixture.tierId }]
  input.champion.prestigeData = prestigeFixture.baseEndpoints.map((point, index) => ({ ...point, id: index + 1 }))
  await renderBuild(surface, input, level)
  if (surface === "detail") {
    expect(metric("health")).toBe(`${health}Health`)
    expect(metric("attack")).toBe(`${attack}Attack`)
    expect(challengerRating()).toBe(String(combatFixture.baseStat.challengeRating + 15 * level))
    // These imported combat ratings have no ascension multiplier in the raw contract.
    for (const [label, expected] of [
      ["Critical rating", "1,031"], ["Critical damage rating", "1,491"], ["Armor penetration", "0"],
      ["Block penetration", "0"], ["Special damage multiplier", "1.20×"], ["Armor rating", "1,031"],
      ["Block proficiency", "4,712"], ["Critical resistance", "468"], ["Physical resistance", "0"], ["Energy resistance", "0"],
    ]) {
      const row = [...document.querySelectorAll("dt")].find(item => item.textContent === label)!
      expect(row.nextElementSibling?.textContent).toBe(expected)
    }
  } else {
    expect(guideMetric("Health")).toBe(health)
    expect(guideMetric("Attack")).toBe(attack)
  }
  expect(document.body.textContent).toContain(prestige)
  expect(document.body.textContent).not.toContain("39,510")
  expect(input.champion.stats[0]).toMatchObject(combatFixture.baseStat)
})

it.each(["detail", "prototype"])("uses independent exact-step modifiers and final integer rounding (%s, synthetic policy test)", async surface => {
  const input = props("adamwarlock")
  input.champion.stats = [{ ...stat(7), health: 4, attack: 1001 }]
  const rules = input.champion.ascensionRules!.find(rule => rule.rarity === 7)!
  rules.steps[0].attackBonus = .10
  rules.steps[1].attackBonus = .20
  await renderBuild(surface, input, 2)
  if (surface === "detail") {
    expect(metric("health")).toBe("5Health")
    expect(metric("attack")).toBe("1,321Attack")
    expect(challengerRating()).toBe("280")
  } else {
    expect(guideMetric("Health")).toBe("5")
    expect(guideMetric("Attack")).toBe("1,321")
  }
})

it("adds exact CR steps in the prototype advanced panel without multiplying its other ratings", async () => {
  const input = props("adamwarlock")
  input.champion.stats = [{ ...stat(7), armorRating: 1031 }]
  await act(async () => root.render(<ChampionPrototype concept="dossier" {...input} />))
  const label = [...document.querySelectorAll("span")].find(item => item.textContent === "Ascension · A0")!
  const buttons = label.parentElement!.querySelectorAll("button")
  expect(document.body.textContent).toContain("Challenge rating 250")
  for (const level of [1, 2, 0, 2]) {
    await act(async () => buttons[level].click())
    expect(document.body.textContent).toContain(`Challenge rating ${250 + 15 * level}`)
    const armor = [...document.querySelectorAll("span")].find(item => item.textContent === "Armor rating")!
    expect(armor.nextElementSibling?.textContent).toBe("1,031")
  }
})

it("projects verified 7-star A2 effects and resets to the 6-star path when rarity changes", async () => {
  window.history.replaceState(null, "", "/champions/adamwarlock?tab=stats&rarity=7&rank=5&ascension=5")
  await act(async () => root.render(<ChampionDetailsClient {...props("adamwarlock")} />))
  expect(metric("health")).toBe("11,664Health")
  expect(metric("attack")).toBe("1,166Attack")
  expect(challengerRating()).toBe("280")
  await openBuild()
  const ascension = document.querySelector<HTMLSelectElement>('select[aria-label="Ascension"]')!
  expect([...ascension.options].map(option => option.textContent)).toEqual(["A0", "A1", "A2"])
  expect(ascension.value).toBe("2")
  const rarity = document.querySelector<HTMLSelectElement>('select[aria-label="Rarity"]')!
  await act(async () => {
    rarity.value = "6"
    rarity.dispatchEvent(new Event("change", { bubbles: true }))
  })
  expect([...ascension.options].map(option => option.textContent)).toEqual(["A0", "A1"])
  expect(ascension.value).toBe("0")
  await act(async () => {
    ascension.value = "1"
    ascension.dispatchEvent(new Event("change", { bubbles: true }))
  })
  expect(metric("health")).toBe("12,200Health")
  expect(metric("attack")).toBe("1,220Attack")
  expect(challengerRating()).toBe("250")
  expect(new URLSearchParams(window.location.search).get("ascension")).toBe("1")
})

it.each(["hulk", "unknown-champion"])("keeps a 7-star build without a recorded path at A0 (%s)", async gameId => {
  window.history.replaceState(null, "", `/champions/${gameId}?tab=stats&rarity=7&rank=5&ascension=2`)
  await act(async () => root.render(<ChampionDetailsClient {...props(gameId)} />))
  expect(metric("health")).toBe("10,000Health")
  expect(metric("attack")).toBe("1,000Attack")
  expect(challengerRating()).toBe("250")
  await openBuild()
  expect(document.querySelector('select[aria-label="Ascension"]')).toBeNull()
})

it.each([
  { gameId: "adamwarlock", level: 2, health: "11,664", attack: "1,166" },
  { gameId: "carina_white", level: 1, health: "10,800", attack: "1,080" },
])("preserves exact prototype stats and the recorded cap when generic 7-star stats disagree ($gameId)", async ({ gameId, level, health, attack }) => {
  await act(async () => root.render(<ChampionPrototype key={gameId} concept="field-guide" {...props(gameId)} />))
  const label = [...document.querySelectorAll("span")].find(item => item.textContent === "Ascension · A0")!
  const buttons = [...label.parentElement!.querySelectorAll("button")]
  await act(async () => buttons[level].click())
  expect(document.body.textContent).toContain(health)
  expect(document.body.textContent).toContain(attack)
  expect(buttons.map(button => button.textContent)).toEqual(Array.from({ length: level + 1 }, (_, value) => String(value)))
})
