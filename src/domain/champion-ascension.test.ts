import { expect, it } from "vitest"
import { createChampionAscensionCatalog, getAscensionEffects, clampRecordedAscensionLevel } from "./champion-ascension"

const cost = [{ type: "inv" as const, id: "dust", quantity: 200 }]
const tier = (id: string, bonus: number, mightGain = 0, challengeRating = 0) => ({ id, cost, attackBonus: bonus, healthBonus: bonus, mightGain, challengeRating, buffIds: [] })
const step = (level: number, value: ReturnType<typeof tier>) => ({ level, tierId: value.id, cost: value.cost, attackBonus: value.attackBonus, healthBonus: value.healthBonus, mightGain: value.mightGain, challengeRating: value.challengeRating, buffIds: [] })
function fixture() {
  const six = tier("6s_t1", .22), seven1 = tier("7s_t1", .08, 3.6, 15), seven2 = tier("7s_t2", .08, 0, 15)
  return { version: 1, source: { observedAt: "2026-11-03T09:10:42+00:00", capturedAt: "2026-11-05T14:03:52+00:00", bcg: { fileName: "bcg.bin.gz", sha256: "a".repeat(64), fileSha256: "b".repeat(64), bytes: 100, mtimeUtc: "2026-11-03T09:11:20+00:00" }, gameStore: null, metadata: [{ assembly: "Marvel.Runtime.dll", sha256: "c".repeat(64) }], schemaSha256: "d".repeat(64) },
    tiers: [six, seven1, seven2],
    blueprints: [
      { id: "hulk_t6", gameId: "hulk", name: "HULK", rarity: 6, heroClass: "chemical", userCollection: true, isEventCharacter: false, eligibleTierIds: [six.id], maxRecordedLevel: 1, steps: [step(1, six)] },
      { id: "hulk_t7", gameId: "hulk", name: "HULK", rarity: 7, heroClass: "chemical", userCollection: true, isEventCharacter: false, eligibleTierIds: [], maxRecordedLevel: 0, steps: [] },
      { id: "gwenom_t7", gameId: "gwenom", name: "GWENOM", rarity: 7, heroClass: "cosmic", userCollection: true, isEventCharacter: false, eligibleTierIds: [seven1.id, seven2.id], maxRecordedLevel: 2, steps: [step(1, seven1), step(2, seven2)] },
    ], resources: [{ type: "inv", id: "dust", metadataResolved: true, name: "DUST" }],
    coverage: { sourceBlueprints: 4, excludedBlueprints: 1, blueprints: 3, collectibleBlueprints: 3, globalTiers: 3, sourceGlobalTiers: 4, excludedGlobalTierIds: ["7s_t15_def"], costResources: 1 },
  }
}

it("distinguishes explicit no-tier records from missing champions and rarities", () => {
  const catalog = createChampionAscensionCatalog(fixture())
  expect(catalog.getChampionAscension("hulk", 7)).toMatchObject({ blueprintId: "hulk_t7", maxLevel: 0, steps: [] })
  for (const [gameId, rarity] of [["unknown", 7], ["hulk", 5], [null, 7], ["hulk", null], ["hulk", 99]] as const) expect(catalog.getChampionAscension(gameId, rarity)).toBeNull()
  expect(catalog.getChampionAscensionRules("hulk").map(rule => rule.rarity)).toEqual([7, 6])
  expect(catalog.getChampionAscensionByBlueprintId("hulk_t6")?.maxLevel).toBe(1)
  expect(catalog.getChampionAscensionByBlueprintId("7s_t15_def")).toBeNull()
})

it("projects star-specific eligibility from player blueprint paths, including known empty paths", () => {
  const data = fixture()
  for (const variant of [
    { id: "event_t7", gameId: "event", isEventCharacter: true },
    { id: "npc_t7", gameId: "npc", userCollection: false },
  ]) {
    data.blueprints.push({ ...data.blueprints[2], ...variant })
    data.coverage.sourceBlueprints++; data.coverage.blueprints++
  }
  const catalog = createChampionAscensionCatalog(data)
  expect(catalog.getChampionAscensionEligibility("hulk")).toEqual({ ascendableRarities: [6], recordedRarities: [7, 6] })
  expect(catalog.getChampionAscensionEligibility("gwenom")).toEqual({ ascendableRarities: [7], recordedRarities: [7] })
  for (const id of ["unknown", "event", "npc", null]) {
    expect(catalog.getChampionAscensionEligibility(id)).toEqual({ ascendableRarities: [], recordedRarities: [] })
  }
  expect(catalog.listChampionAscensionEligibility().map(row => row.gameId).sort()).toEqual(["gwenom", "hulk"])
  const mutable = catalog.getChampionAscensionEligibility("hulk")
  mutable.ascendableRarities.push(7)
  catalog.listChampionAscensionEligibility()[0].recordedRarities.length = 0
  expect(catalog.getChampionAscensionEligibility("hulk")).toEqual({ ascendableRarities: [6], recordedRarities: [7, 6] })
})

it("composes combat multipliers independently of additive CR/Might and prestige", () => {
  const catalog = createChampionAscensionCatalog(fixture())
  expect(getAscensionEffects(catalog.getChampionAscension("hulk", 6), 1)).toEqual({ attackMultiplier: 1.22, healthMultiplier: 1.22, challengeRating: 0, mightGain: 0 })
  const effects = getAscensionEffects(catalog.getChampionAscension("gwenom", 7), 2)
  expect(effects).toMatchObject({ challengeRating: 30, mightGain: 3.6 })
  expect(effects.attackMultiplier).toBeCloseTo(1.1664)
  expect(effects.healthMultiplier).toBeCloseTo(1.1664)
  expect(getAscensionEffects(catalog.getChampionAscension("hulk", 7), 5)).toEqual({ attackMultiplier: 1, healthMultiplier: 1, challengeRating: 0, mightGain: 0 })
  expect(getAscensionEffects(null, 5)).toEqual({ attackMultiplier: 1, healthMultiplier: 1, challengeRating: 0, mightGain: 0 })
})

it("clamps finite levels and derives rarity bounds only from collectible rule paths", () => {
  const catalog = createChampionAscensionCatalog(fixture()), rules = catalog.getChampionAscension("gwenom", 7)
  expect(clampRecordedAscensionLevel(rules, 5)).toBe(2)
  expect(clampRecordedAscensionLevel(rules, 1.6)).toBe(2)
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY]) expect(clampRecordedAscensionLevel(rules, value)).toBe(0)
  expect(catalog.maxRecordedAscensionForRarity(7)).toBe(2)
  expect(catalog.maxRecordedAscensionForRarity(6)).toBe(1)
  expect(catalog.maxRecordedAscensionForRarity(3)).toBe(0)
})

it("does not index NPC/event variants and rejects conflicting collectible identities", () => {
  const data = fixture()
  data.blueprints.push({ ...data.blueprints[2], id: "gwenom_event_t7", gameId: "event", isEventCharacter: true })
  data.coverage.sourceBlueprints++; data.coverage.blueprints++
  const catalog = createChampionAscensionCatalog(data)
  expect(catalog.getChampionAscension("event", 7)).toBeNull()
  expect(catalog.getChampionAscensionByBlueprintId("gwenom_event_t7")).toBeNull()
  const conflict = fixture()
  conflict.blueprints.push({ ...conflict.blueprints[2], id: "gwenom_legacy_t7" })
  conflict.coverage.sourceBlueprints++; conflict.coverage.blueprints++; conflict.coverage.collectibleBlueprints++
  expect(() => createChampionAscensionCatalog(conflict)).toThrow(/Conflicting collectible/)
})

it("validates source provenance, tier order, references and modifier parity", () => {
  const provenance = fixture(); provenance.source.bcg.sha256 = "unverified"
  expect(() => createChampionAscensionCatalog(provenance)).toThrow()
  const machinePath = { ...fixture(), source: { ...fixture().source, localPath: "C:/Users/private/cache.bin" } }
  expect(() => createChampionAscensionCatalog(machinePath)).toThrow()
  const mismatch = fixture(); mismatch.blueprints[2].steps[0].healthBonus = .5
  expect(() => createChampionAscensionCatalog(mismatch)).toThrow(/modifier/)
  const missingResource = fixture(); missingResource.resources = []
  expect(() => createChampionAscensionCatalog(missingResource)).toThrow(/resource|coverage/i)
})

it("returns isolated public payloads so callers cannot mutate cached rules", () => {
  const catalog = createChampionAscensionCatalog(fixture())
  const rules = catalog.getChampionAscension("hulk", 6)!
  rules.steps[0].cost[0].quantity = 999
  expect(catalog.getChampionAscension("hulk", 6)?.steps[0].cost[0].quantity).toBe(200)
  expect(catalog.getAscensionResource("inv", "dust")).toMatchObject({ name: "DUST", metadataResolved: true })
  expect(catalog.getAscensionResource("inv", "missing")).toBeNull()
})
