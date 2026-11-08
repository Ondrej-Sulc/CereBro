import { expect, it } from "vitest"
import { getCrystalOdds } from "@cerebro/core/data/game-crystal-odds"
import { loadCrystalPageRewards, type CrystalRewardCard } from "./data/crystal-page-rewards"
import { buildCrystalRewardPresentation, sortCrystalRewardRows, type CrystalRewardRate } from "./crystal-reward-presentation"
import { crystalStarCategoryRates } from "./crystal-odds-presentation"

it("keeps the Elder Web of Corruption's entire mixed rate group together", () => {
  const opening = loadCrystalPageRewards("elder_web_of_corruption_saga_crystal")!
  const view = opening.rewardPresentation
  expect(opening.odds?.responseSha256).toBe("9991879962a422a267543426d03efaf722d9d52171f78e319bd6c97704d0679a")
  expect(view.championOdds).toBeNull()
  expect(view.groups).toHaveLength(1)
  expect(view.groups[0]).toMatchObject({ sourceIndex: 0, name: "", isFeatured: false, guaranteed: false })
  expect(view.groups[0].rows.map(({ rate }) => [rate.label, rate.percentValue, rate.prefix])).toEqual([
    ["7-Star Ascended Champion", "4.05", undefined],
    ["7-Star Hero", "9.01", undefined],
    ["6-Star Hero", "18.02", undefined],
    ["7-Star Hero Crystal Shards", "68.92", undefined],
  ])
  // Exact hundredths, with no binary floating-point rounding or renormalization.
  expect(view.groups[0].rows.reduce((total, { rate }) => total + BigInt(rate.percentValue.replace(".", "")), 0n)).toBe(10000n)
  expect(view.groups[0].rows.map(row => row.key)).toEqual(["0:0", "0:1", "0:2", "0:3"])
  expect(view.groups[0].rows[3].variants[0].options[0].minQuantity).toBe(1000)
  expect(opening.conditionalBonuses).toHaveLength(8)
  expect(opening.conditionalBonuses.every(bonus => bonus.autoAscend)).toBe(true)
})

it.each(["elder_web_of_corruption_saga_crystal", "paragon_crystal_v2", "superior_banquet_crystal_dec24", "greater_banquet_crystal_dec25", "cfh_v33_shard_crystal", "7_star_hero_shard_crystal", "pfh_lady_deathstrike_cyberpathy_crystal"])("never splits a disclosed source group between champion and reward views for %s", id => {
  const opening = loadCrystalPageRewards(id)!
  const view = opening.rewardPresentation
  const projected = [
    ...view.groups.map(group => ({ sourceIndex: group.sourceIndex, rows: group.rows.map(row => row.rate) })),
    ...(view.championOdds?.groups ?? []),
  ]
  expect(projected.map(group => group.sourceIndex).sort()).toEqual(opening.odds!.groups!.map(group => group.sourceIndex).sort())
  for (const source of opening.odds!.groups!) expect(projected.find(group => group.sourceIndex === source.sourceIndex)?.rows).toEqual(source.rows)
})

it("retains ordinary champion-only star rates and separate overlapping Featured/All Prizes disclosures", () => {
  const ordinary = loadCrystalPageRewards("cfh_v33_shard_crystal")!
  expect(ordinary.rewardPresentation.groups).toEqual([])
  const starRates = crystalStarCategoryRates(ordinary.rewardPresentation.championOdds, [6, 5, 4])!
  expect([starRates[6].percentValue, starRates[5].percentValue, starRates[4].percentValue]).toEqual(["8.9", "44.8", "46.3"])
  const featured = loadCrystalPageRewards("pfh_lady_deathstrike_cyberpathy_crystal")!
  expect(featured.rewardPresentation.championOdds?.groups).toEqual(featured.odds!.groups)
  expect(featured.rewardPresentation.championOdds?.groups?.map(group => [group.name, group.isFeatured])).toEqual([["FEATURED PRIZES", true], ["ALL PRIZES", false]])
  expect(featured.rewardPresentation.championOdds?.groups?.[0].rows.map(row => row.percentValue)).toEqual(["0.31", "1.24", "5.12", "8.12"])
  expect(crystalStarCategoryRates(featured.rewardPresentation.championOdds, [7, 6, 5, 4])).toBeNull()
})

it("combines class fragment amounts under their original category rate", () => {
  const opening = loadCrystalPageRewards("superior_banquet_crystal_dec24")!
  const before = JSON.stringify([opening.odds, opening.otherRewards])
  const view = opening.rewardPresentation
  const fragments = view.groups.flatMap(group => group.rows).find(row => row.rate.label === "Tier 6 Class Catalyst Fragments")!
  expect(fragments.rate.percentValue).toBe("31.26")
  expect(fragments.variants).toHaveLength(6)
  expect(fragments.variants.every(variant => variant.reward.type === "ebpf")).toBe(true)
  expect(fragments.variants[0].options.map(option => option.minQuantity)).toEqual([5700, 11400, 28500])
  const keys = [...view.groups.flatMap(group => group.rows.flatMap(row => row.variants.flatMap(variant => variant.options.map(option => option.key)))), ...view.unrated.flatMap(variant => variant.options.map(option => option.key))]
  expect(keys.sort()).toEqual(opening.otherRewards.map(reward => reward.key).sort())
  expect(new Set(keys).size).toBe(keys.length)
  expect(JSON.stringify([opening.odds, opening.otherRewards])).toBe(before)
})

it("keeps repeated shard prizes attached to their separate source quantities", () => {
  const view = loadCrystalPageRewards("superior_banquet_crystal_dec25")!.rewardPresentation
  const first = view.groups.find(group => group.name === "PRIZE 1")!.rows.find(row => row.rate.label === "7-Star Hero Crystal Shards")!
  const second = view.groups.find(group => group.name === "PRIZE 2")!.rows.find(row => row.rate.label === "7-Star Hero Crystal Shards")!
  expect(first.rate.percentValue).toBe("4")
  expect(first.variants.flatMap(variant => variant.options.map(option => option.minQuantity))).toEqual([5000])
  expect(second.rate.percentValue).toBe("82.5")
  expect(second.variants.flatMap(variant => variant.options.map(option => option.minQuantity))).toEqual([100, 250])
})

it("retains separate guaranteed Gold and ISO prize groups", () => {
  const groups = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation.groups
  const guaranteed = groups.filter(group => group.guaranteed)
  expect(guaranteed.map(group => group.name)).toEqual(["PRIZE 2", "PRIZE 3"])
  expect(guaranteed.flatMap(group => group.rows.map(row => row.rate.percentValue))).toEqual(["100", "100"])
  expect(guaranteed.flatMap(group => group.rows.flatMap(row => row.variants))).toHaveLength(7)
})

it("keeps Paragon's champion and nested-crystal categories in one complete group", () => {
  const view = loadCrystalPageRewards("paragon_crystal_v2")!.rewardPresentation
  expect(view.championOdds).toBeNull()
  expect(view.groups[0].rows.map(row => row.rate.sourceIndex)).toEqual([0, 1, 2, 3, 4, 5])
  expect(view.groups[0].rows.slice(4).map(row => row.variants[0].reward.href)).toEqual(["/crystals/sg_5star_nexus_crystal", "/crystals/sg_6star_nexus_crystal"])
})

const gold = (categoryId: string): CrystalRewardCard => ({ type: "res", data: "sc", sourceIndex: 0, quantity: 10,
  categoryId, key: `${categoryId}:0`, displayName: "Gold", href: null, imageUrl: null, selection: null })

it.each([false, true])("leaves ambiguous prize bindings unassigned instead of mixing amounts (%s)", sameCategory => {
  const recorded = getCrystalOdds("alliance_crystal")!
  const rate = { sourceIndex: 0, label: "Gold", percentValue: "100", rateBasis: "server-disclosed-category" as const }
  const odds = { ...recorded, groups: [0, 1].map(sourceIndex => ({ sourceIndex, name: `PRIZE ${sourceIndex + 1}`, isFeatured: false, rows: [rate], sumValidation: "not-inferred-across-source-groups" as const })) }
  const rewards = sameCategory ? [{ id: "shared", rewards: [gold("shared")] }] : [{ id: "first", rewards: [gold("first")] }, { id: "second", rewards: [gold("second")] }]
  const view = buildCrystalRewardPresentation(odds, rewards)
  expect(view.groups.flatMap(group => group.rows).every(row => row.variants.length === 0)).toBe(true)
  expect(view.unrated).toHaveLength(sameCategory ? 1 : 2)
})

it("retains all rewards without assigning rates when there is no disclosure", () => {
  const view = buildCrystalRewardPresentation(null, [{ id: "only", rewards: [gold("only")] }])
  expect(view.hasRates).toBe(false)
  expect(view.groups).toEqual([])
  expect(view.unrated[0].options[0].quantity).toBe(10)
})

it.each(["superior_banquet_crystal_dec24", "superior_banquet_crystal_dec25", "greater_banquet_crystal_dec22", "jubilant_crystal_dec25", "paragon_crystal_v2", "7_star_hero_shard_crystal"])("preserves every source rate and direct non-champion reward exactly once for %s", id => {
  const opening = loadCrystalPageRewards(id)!
  const view = opening.rewardPresentation
  const original = opening.odds?.groups?.flatMap(group => group.rows.map(rate => ({ key: `${group.sourceIndex}:${rate.sourceIndex}`, rate }))) ?? []
  const projected = [...view.groups.flatMap(group => group.rows.map(({ key, rate }) => ({ key, rate }))),
    ...(view.championOdds?.groups ?? []).flatMap(group => group.rows.map(rate => ({ key: `${group.sourceIndex}:${rate.sourceIndex}`, rate })))]
  expect(projected.sort((a, b) => a.key.localeCompare(b.key))).toEqual(original.sort((a, b) => a.key.localeCompare(b.key)))
  const options = [...view.groups.flatMap(group => group.rows.flatMap(row => row.variants.flatMap(variant => variant.options))), ...view.unrated.flatMap(variant => variant.options)]
  expect(options.sort((a, b) => a.key.localeCompare(b.key))).toEqual([...opening.otherRewards].sort((a, b) => a.key.localeCompare(b.key)))
})

it("keeps full and fragmented materials under distinct rates and preserves a disclosed zero", () => {
  const full: CrystalRewardCard = { ...gold("materials"), type: "ebp", data: "t6_basic", displayName: "Tier 6 Basic Catalyst" }
  const fragment: CrystalRewardCard = { ...full, key: "materials:1", sourceIndex: 1, type: "ebpf", quantity: 5700 }
  const recorded = getCrystalOdds("alliance_crystal")!
  const odds = { ...recorded, groups: [{ ...recorded.groups![0], rows: [
    { sourceIndex: 0, label: "Tier 6 Basic Catalyst", percentValue: "0", rateBasis: "server-disclosed-category" as const },
    { sourceIndex: 1, label: "Tier 6 Basic Catalyst Fragments", percentValue: "100", prefix: "<", rateBasis: "server-disclosed-category" as const },
  ] }] }
  const view = buildCrystalRewardPresentation(odds, [{ id: "materials", rewards: [full, fragment] }])
  expect(view.groups[0].rows.map(row => [row.rate.percentValue, row.variants[0].reward.type])).toEqual([["0", "ebp"], ["100", "ebpf"]])
  expect(view.groups[0].guaranteed).toBe(false)
  expect(view.groups[0].rows[1].rate.prefix).toBe("<")
})

it("uses explicit type and data identity before translated labels", () => {
  const recorded = getCrystalOdds("alliance_crystal")!
  const reward = { ...gold("prize"), displayName: "Translated resource" }
  const odds = { ...recorded, groups: [{ ...recorded.groups![0], rows: [
    { sourceIndex: 0, label: "Gold", rewardType: "res", rewardData: "sc", percentValue: "25.00001", rateBasis: "server-disclosed-category" as const },
  ] }] }
  const view = buildCrystalRewardPresentation(odds, [{ id: "prize", rewards: [reward] }])
  expect(view.groups[0].rows[0].variants[0].options).toEqual([reward])
  expect(view.groups[0].rows[0].rate.percentValue).toBe("25.00001")
})

it("sorts recorded numeric category rates high to low, retaining zero and source order for ties", () => {
  const rows: CrystalRewardRate[] = ["10", "2", "0", "2.00", "0.000000004", "0.000000003", "1e-10", "1E-9", "100"].map((percentValue, sourceIndex) => ({
    key: `0:${sourceIndex}`, rate: { sourceIndex, percentValue, rateBasis: "server-disclosed-category", ...(sourceIndex === 8 ? { prefix: "<" } : {}) },
    variants: [], visual: { imageUrl: null, href: null, kind: "item" },
  }))
  const original = structuredClone(rows)
  Object.freeze(rows)
  expect(sortCrystalRewardRows(rows).map(row => row.key)).toEqual(["0:8", "0:0", "0:1", "0:3", "0:4", "0:5", "0:7", "0:6", "0:2"])
  expect(rows).toEqual(original)
  expect(sortCrystalRewardRows(rows).every(row => rows.includes(row))).toBe(true)
})

it("sorts collapsed families by their category rate without changing any options or prize boundaries", () => {
  const view = loadCrystalPageRewards("superior_banquet_crystal_dec24")!.rewardPresentation
  const original = structuredClone(view)
  const sorted = view.groups.map(group => ({ ...group, rows: sortCrystalRewardRows(group.rows) }))
  expect(sorted.map(group => [group.sourceIndex, group.name, group.guaranteed])).toEqual(view.groups.map(group => [group.sourceIndex, group.name, group.guaranteed]))
  for (const [index, group] of sorted.entries()) {
    expect(new Set(group.rows)).toEqual(new Set(view.groups[index].rows))
    const rates = group.rows.map(row => Number(row.rate.percentValue))
    expect(rates).toEqual([...rates].sort((a, b) => b - a))
  }
  const fragments = sorted.flatMap(group => group.rows).find(row => row.rate.label === "Tier 6 Class Catalyst Fragments")!
  expect(fragments.rate.percentValue).toBe("31.26")
  expect(fragments.variants).toHaveLength(6)
  expect(fragments.variants[0].options.map(option => option.minQuantity)).toEqual([5700, 11400, 28500])
  expect(view).toEqual(original)
})
