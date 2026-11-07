import { expect, it } from "vitest"
import snapshot from "./catalog.json"
import { ascensionCatalogSource, getChampionAscension, getChampionAscensionByBlueprintId, getChampionAscensionRules, getChampionAscensionEligibility, listChampionAscensionEligibility, getAscensionResource } from "./index"
import { hasRecordedAscensionPath } from "../../domain/champion-ascension-eligibility"
import { ASCENSION_BOUNDS_SOURCE, maxRecordedAscensionForRarity, recordedAscensionStatBonus } from "./limits"
import { createChampionAscensionCatalog, getAscensionEffects } from "../../domain/champion-ascension"

it("loads verified six-star and champion-specific seven-star rules from the shipped snapshot", () => {
  const six = getChampionAscension("hulk", 6)
  expect(six).toMatchObject({ blueprintId: "hulk_t6", maxLevel: 1 })
  expect(getAscensionEffects(six, 1).attackMultiplier).toBeCloseTo(1.22)
  expect(getChampionAscension("hulk", 7)).toMatchObject({ blueprintId: "hulk_t7", maxLevel: 0, steps: [] })
  const gwenom = getChampionAscension("gwenom", 7)
  expect(gwenom?.maxLevel).toBe(2)
  expect(getAscensionEffects(gwenom, 2)).toMatchObject({ challengeRating: 30 })
  expect(getAscensionEffects(gwenom, 2).healthMultiplier).toBeCloseTo(1.1664)
  expect(getChampionAscensionRules("gwenom").some(rule => rule.rarity === 7 && rule.maxLevel === 2)).toBe(true)
})

it("retains exact materialized tokens and resolved resource labels", () => {
  const rules = getChampionAscension("adamwarlock", 7)!
  expect(rules.steps[0].cost).toEqual([
    { type: "inv", id: "ascension_token_champion_adamwarlock", quantity: 1 },
    { type: "inv", id: "ascension_token_class_cosmic", quantity: 1 },
  ])
  expect(getAscensionResource("inv", "primordial_dust_t2")).toMatchObject({ metadataResolved: true, name: "TIER 2 PRIMORDIAL DUST", artwork: { reference: "inventory/primordial_dust_t2.png", onCdn: false } })
  expect(getAscensionResource("inv", "ascension_token_champion_medusa")).toMatchObject({ metadataResolved: false })
})

it("includes only the verified collectible Carina event blueprint with its exact A1 costs", () => {
  expect(snapshot.blueprints).toHaveLength(1941)
  expect(snapshot.blueprints.filter(row => row.isEventCharacter).map(row => row.id)).toEqual(["carina_white_t7"])
  expect(snapshot.blueprints.every(row => row.userCollection)).toBe(true)
  const rules = getChampionAscension("carina_white", 7)
  expect(rules).toMatchObject({ blueprintId: "carina_white_t7", maxLevel: 1, observedAt: "2026-11-03T09:10:42+00:00" })
  expect(rules?.steps.map(step => step.tierId)).toEqual(["7s_t1"])
  expect(rules?.steps[0].cost).toEqual([
    { type: "inv", id: "ascension_token_champion_carina_white", quantity: 1 },
    { type: "inv", id: "ascension_token_class_cosmic", quantity: 1 },
  ])
  expect(getChampionAscensionByBlueprintId("carina_white_t7")).toEqual(rules)
  const eligibility = getChampionAscensionEligibility("carina_white")
  expect(eligibility).toEqual({ ascendableRarities: [7], recordedRarities: [7] })
  expect(hasRecordedAscensionPath(eligibility, 7)).toBe(true)
  expect(hasRecordedAscensionPath(eligibility, 6)).toBe(false)
  expect(hasRecordedAscensionPath(eligibility)).toBe(true)
  expect(listChampionAscensionEligibility().filter(row => row.ascendableRarities.includes(7))).toHaveLength(113)
})

it("excludes unreviewed event/NPC variants and tuning while retaining exact player Magik", () => {
  expect(snapshot.tiers.some(row => row.id.endsWith("_def"))).toBe(false)
  for (const id of ["tuning_normal_t7", "carina_white_t6", "carina_white_ep", "carina_white_leg", "magik_legacy_t7"])
    expect(getChampionAscensionByBlueprintId(id)).toBeNull()
  expect(getChampionAscension("carina_white", 6)).toBeNull()
  expect(getChampionAscension("magik", 7)).toMatchObject({ blueprintId: "magik_t7", maxLevel: 2 })
  expect(getChampionAscension("not-a-champion", 7)).toBeNull()
})

it("ships sanitized provenance and client bounds matching the complete reader", () => {
  expect(ascensionCatalogSource.bcg.sha256).toBe("9e95551a68cfeeebf395f49b0bff676c5a2406ba7c30795c228cc48bd89ede61")
  expect(ASCENSION_BOUNDS_SOURCE.bcgSha256).toBe(ascensionCatalogSource.bcg.sha256)
  expect(ASCENSION_BOUNDS_SOURCE.observedAt).toBe(ascensionCatalogSource.observedAt)
  expect(JSON.stringify(snapshot)).not.toMatch(/[A-Z]:[\\/]|Users[\\/]|CodexArtifacts/)
  const catalog = createChampionAscensionCatalog(snapshot)
  expect([1, 2, 3, 4, 5, 6, 7].map(maxRecordedAscensionForRarity)).toEqual([0, 0, 0, 1, 1, 1, 2])
  for (let rarity = 1; rarity <= 7; rarity++) expect(maxRecordedAscensionForRarity(rarity)).toBe(catalog.maxRecordedAscensionForRarity(rarity))
  for (const rarity of [null, undefined, 0, 99, 6.5, Number.NaN]) expect(maxRecordedAscensionForRarity(rarity)).toBe(0)
})

it("derives lightweight uniform stat fallbacks from eligible source paths", () => {
  expect(recordedAscensionStatBonus(4, 1, "attack")).toBeCloseTo(.30)
  expect(recordedAscensionStatBonus(5, 1, "health")).toBeCloseTo(.20)
  expect(recordedAscensionStatBonus(6, 1, "attack")).toBeCloseTo(.22)
  // Carina's A1-only path differs from the A2 paths: no uniform seven-star fallback.
  expect(recordedAscensionStatBonus(7, 2, "health")).toBe(0)
  expect(recordedAscensionStatBonus(7, 99, "attack")).toBe(0)
  expect(recordedAscensionStatBonus(3, 1, "attack")).toBe(0)
  expect(recordedAscensionStatBonus(6, Number.NaN, "health")).toBe(0)
})
