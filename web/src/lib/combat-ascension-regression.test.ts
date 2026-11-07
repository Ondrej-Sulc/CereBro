import { expect, it } from "vitest"
import { getChampionAscension } from "@cerebro/core/data/game-ascension"
import { getAscensionEffects } from "@cerebro/core/domain/champion-ascension"
import snapshot from "@cerebro/core/data/game-ascension/catalog.json"
import fixture from "../../../src/tests/fixtures/champion-combat-ascension.json"
import { applyAscensionToStatValue } from "./mcoc-prestige"

// Real archived base row + publisher scaling policy, not captured A1/A2 combat observations.
it.each([
  { level: 0, health: 88679, attack: 7903, cr: 0, might: 0 },
  { level: 1, health: 95773, attack: 8535, cr: 15, might: 3.6 },
  { level: 2, health: 103435, attack: 9218, cr: 30, might: 3.6 },
])("projects exact base combat stats at A$level, with separate CR and Might semantics", ({ level, health, attack, cr, might }) => {
  const rules = getChampionAscension(fixture.gameId, fixture.rarity)
  expect(rules?.blueprintId).toBe(fixture.tierId)
  expect(applyAscensionToStatValue(fixture.baseStat.health, fixture.rarity, level, rules, "health")).toBe(health)
  expect(applyAscensionToStatValue(fixture.baseStat.attack, fixture.rarity, level, rules, "attack")).toBe(attack)
  const effects = getAscensionEffects(rules, level)
  expect(effects.challengeRating).toBe(cr)
  expect(effects.mightGain).toBeCloseTo(might)
})

it("keeps the raw incremental tier values while deriving effective combat multipliers", () => {
  const rules = getChampionAscension(fixture.gameId, 7)!
  const before = structuredClone(rules)
  expect(rules.steps.map(step => step.attackBonus)).toEqual([0.07999999821186066, 0.07999999821186066])
  expect(getAscensionEffects(rules, 2).attackMultiplier).toBeCloseTo(1.1664, 7)
  expect(getAscensionEffects(rules, 2).healthMultiplier).toBeCloseTo(1.1664, 7)
  expect(rules).toEqual(before)
  // Every shipped positive seven-star path binds t1, optionally t2; no future globals.
  const positive = snapshot.blueprints.filter(row => row.rarity === 7 && row.steps.length)
  expect(positive).toHaveLength(113)
  expect(positive.filter(row => row.steps.length === 2)).toHaveLength(112)
  for (const row of positive) {
    expect(row.steps.map(step => step.tierId)).toEqual(row.steps.length === 1 ? ["7s_t1"] : ["7s_t1", "7s_t2"])
    const effects = getAscensionEffects(getChampionAscension(row.gameId, 7), 99)
    expect(effects.challengeRating).toBe(row.steps.length * 15)
    expect(effects.mightGain).toBeCloseTo(3.6)
  }
  expect(snapshot.tiers.every(tier => tier.buffIds.length === 0)).toBe(true)
})

it("composes health and attack independently from each exact step (synthetic policy test)", () => {
  const rules = getChampionAscension(fixture.gameId, 7)!
  rules.steps[0] = { ...rules.steps[0], attackBonus: .10, healthBonus: .05 }
  rules.steps[1] = { ...rules.steps[1], attackBonus: .20, healthBonus: .25 }
  expect(applyAscensionToStatValue(1001, 7, 1, rules, "attack")).toBe(1101)
  expect(applyAscensionToStatValue(1001, 7, 1, rules, "health")).toBe(1051)
  expect(applyAscensionToStatValue(1001, 7, 2, rules, "attack")).toBe(1321)
  expect(applyAscensionToStatValue(1001, 7, 2, rules, "health")).toBe(1314)
  expect(getAscensionEffects(rules, 2)).toMatchObject({ challengeRating: 30, mightGain: rules.steps[0].mightGain })
})

it("rounds combat once to an integer after all steps (synthetic policy boundary, not server proof)", () => {
  const rules = getChampionAscension(fixture.gameId, 7)!
  for (const kind of ["attack", "health"] as const) {
    expect(applyAscensionToStatValue(4, 7, 1, rules, kind)).toBe(4)
    expect(applyAscensionToStatValue(4, 7, 2, rules, kind)).toBe(5)
    expect(applyAscensionToStatValue(1000, 7, 2, rules, kind)).toBe(1166)
    expect(applyAscensionToStatValue(null, 7, 2, rules, kind)).toBeNull()
  }
})

it("retains exact caps, unsupported paths and conservative fallback behavior", () => {
  for (const kind of ["attack", "health"] as const) {
    expect(applyAscensionToStatValue(10000, 7, 2, getChampionAscension("carina_white", 7), kind)).toBe(10800)
    expect(applyAscensionToStatValue(10000, 7, 2, getChampionAscension("hulk", 7), kind)).toBe(10000)
    expect(applyAscensionToStatValue(10000, 7, 2, null, kind)).toBe(10000)
    expect(applyAscensionToStatValue(10000, 7, 2, undefined, kind)).toBe(10000)
    expect(applyAscensionToStatValue(10000, 6, 2, getChampionAscension(fixture.gameId, 7), kind)).toBe(10000)
    for (const [rarity, expected] of [[4, 13000], [5, 12000], [6, 12200]]) {
      expect(applyAscensionToStatValue(10000, rarity, 2, getChampionAscension("hulk", rarity), kind)).toBe(expected)
      expect(applyAscensionToStatValue(10000, rarity, 2, undefined, kind)).toBe(expected)
    }
  }
})
