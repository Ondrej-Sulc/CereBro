import { expect, it } from "vitest"
import { buildCrystalOddsVisuals, crystalStarCategoryRates, crystalRatePercentage } from "./crystal-odds-presentation"
import type { CrystalOddsOpening } from "@cerebro/core/domain/crystal-odds"

const odds = (label: string): CrystalOddsOpening => ({ status: "captured", attempts: [], groups: [{ sourceIndex: 0, name: "PRIZE 1", isFeatured: false, sumValidation: "not-inferred-across-source-groups", rows: [{ sourceIndex: 0, percentValue: "1.5", rateBasis: "server-disclosed-category", label }] }] })
const candidate = (type: string, data: string, displayName: string, imageUrl = "/art.webp", href: string | null = null) => ({ type, data, displayName, imageUrl, href })

it("annotates star filters only with a complete, unambiguous set of disclosed category rates", () => {
  const input = odds("7-Star Hero")
  input.groups![0].name = null
  input.groups![0].rows.push({ sourceIndex: 1, label: "6-Star Hero", percentValue: "0", prefix: "<", rateBasis: "server-disclosed-category" })
  const before = JSON.stringify(input)
  expect(crystalStarCategoryRates(input, [7, 6])).toEqual({
    "7": { key: "0:0", label: "7-Star Hero", percentValue: "1.5", prefix: undefined },
    "6": { key: "0:1", label: "6-Star Hero", percentValue: "0", prefix: "<" },
  })
  expect(crystalStarCategoryRates(input, [7, 6, 5])).toBeNull()
  expect(crystalStarCategoryRates(input, [7])).toBeNull()
  expect(JSON.stringify(input)).toBe(before)
  input.groups![0].isFeatured = true
  expect(crystalStarCategoryRates(input, [7, 6])).toBeNull()
  input.groups![0].isFeatured = false
  input.groups![0].name = "PRIZE 1"
  expect(crystalStarCategoryRates(input, [7, 6])).toBeNull()
  input.groups![0].name = null
  input.groups![0].rows[0].rewardData = "jessica_jones"
  expect(crystalStarCategoryRates(input, [7, 6])).toBeNull()
  delete input.groups![0].rows[0].rewardData
  input.groups![0].rows[1].label = "7-Star Champion"
  expect(crystalStarCategoryRates(input, [7, 6])).toBeNull()
  input.groups![0].rows[1].label = "6-Star Jessica Jones"
  expect(crystalStarCategoryRates(input, [7, 6])).toBeNull()
  input.groups![0].rows[1].label = "6-Star Hero"
  input.groups!.push({ ...input.groups![0], sourceIndex: 1 })
  expect(crystalStarCategoryRates(input, [7, 6])).toBeNull()
})

it("preserves disclosed zero, tiny values and percentage precision across reward views", () => {
  expect(crystalRatePercentage("0")).toBe("0.00")
  expect(crystalRatePercentage("0.0000000001")).toBe("1.00e-10")
  expect(crystalRatePercentage("31.260001")).toBe("31.260001")
})

it("uses fragment artwork without substituting the full material", () => {
  const visuals = buildCrystalOddsVisuals(odds("Tier 3 Alpha Catalyst Fragments"), [candidate("ebp", "rare_event", "TIER 3 ALPHA CATALYST", "/full.webp"), candidate("ebpf", "rare_event", "TIER 3 ALPHA CATALYST", "/fragment.webp")])
  expect(visuals["0:0"]).toMatchObject({ imageUrl: "/fragment.webp", href: null, kind: "material" })
})

it("resolves exact nested crystals and singular/plural shard labels", () => {
  const crystal = buildCrystalOddsVisuals(odds("Jubilant Crystal"), [candidate("gs", "jubilant_crystal_dec25", "JUBILANT CRYSTAL", "/jubilant.webp", "/crystals/jubilant_crystal_dec25")])
  expect(crystal["0:0"]).toMatchObject({ imageUrl: "/jubilant.webp", href: "/crystals/jubilant_crystal_dec25" })
  const shards = buildCrystalOddsVisuals(odds("7-Star Hero Crystal Shards"), [candidate("gf", "7_star_hero_shard_crystal", "7-STAR HERO CRYSTAL SHARD", "/shard.webp")])
  expect(shards["0:0"].imageUrl).toBe("/shard.webp")
})

it("does not choose an arbitrary class or link ambiguous same-name crystal definitions", () => {
  const classes = buildCrystalOddsVisuals(odds("Tier 6 Class Catalyst"), [candidate("ebp", "t6_cosmic", "TIER 6 COSMIC CATALYST", "/cosmic.webp"), candidate("ebp", "t6_tech", "TIER 6 TECH CATALYST", "/tech.webp")])
  expect(classes["0:0"]).toMatchObject({ imageUrl: null, href: null, kind: "material" })
  const ambiguous = buildCrystalOddsVisuals(odds("Hero Crystal"), [candidate("gs", "one", "Hero Crystal", "/shared.webp", "/crystals/one"), candidate("gs", "two", "Hero Crystal", "/shared.webp", "/crystals/two")])
  expect(ambiguous["0:0"]).toMatchObject({ imageUrl: null, href: null })
})

it("shares an icon across amounts of the same resource without creating amounts or rates", () => {
  const input = odds("Gold")
  const before = JSON.stringify(input)
  const visuals = buildCrystalOddsVisuals(input, [candidate("res", "sc", "Gold", "/gold.webp"), candidate("res", "sc", "Gold", "/gold.webp")])
  expect(visuals["0:0"]).toEqual({ imageUrl: "/gold.webp", href: null, kind: "resource" })
  expect(JSON.stringify(input)).toBe(before)
  expect(buildCrystalOddsVisuals(null, [])).toEqual({})
})

it("prefers disclosed type/data identity over a shared display label", () => {
  const input = odds("Hero Crystal")
  input.groups![0].rows[0] = { ...input.groups![0].rows[0], rewardType: "gs", rewardData: "two" }
  const visuals = buildCrystalOddsVisuals(input, [candidate("gs", "one", "Hero Crystal", "/one.webp", "/crystals/one"), candidate("gs", "two", "Hero Crystal", "/two.webp", "/crystals/two")])
  expect(visuals["0:0"]).toMatchObject({ imageUrl: "/two.webp", href: "/crystals/two" })
})
