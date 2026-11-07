import { expect, it } from "vitest"
import type { ChampionCrystal } from "@cerebro/core/domain/champion-crystals"
import { getChampionCrystals, getChampionCrystalSummary } from "@cerebro/core/data/game-crystals"
import { getChampionCrystalGroups } from "./champion-crystal-groups"

const crystal = (id: string, category: ChampionCrystal["category"], rarities = [7]): ChampionCrystal => ({
  name: id, sourceIds: [id], category, rarities, isMainPool: category === "main", selection: null,
})

it("partitions exact-star families once in acquisition priority, including the fallback", () => {
  const rows = [crystal("event", "events"), crystal("class", "classes"), crystal("featured", "featured"),
    crystal("main", "main"), crystal("unknown", undefined), crystal("six", "featured", [6])]
  const before = structuredClone(rows)
  const groups = getChampionCrystalGroups(rows, 7)
  expect(groups.map(group => [group.id, group.count])).toEqual([["main", 1], ["featured", 1], ["classes", 1], ["events", 1], ["other", 1]])
  expect(groups.flatMap(group => group.families.map(family => family.id))).toHaveLength(5)
  expect(rows).toEqual(before)
})

it("counts families rather than opening variants and searches exact names, aliases and edition labels", () => {
  const standard = { ...crystal("hero", "main"), family: { id: "hero", name: "Hero pool", variantLabel: "Standard", variantOrder: 0 } }
  const nexus = { ...crystal("nexus", "main"), family: { ...standard.family, variantLabel: "Nexus", variantOrder: 1 }, selection: { draw: 3, pick: 1 } }
  const rows = [standard, nexus, crystal("6fh_v42_shard_crystal", "featured")]
  expect(getChampionCrystalGroups(rows, 7)[0].count).toBe(1)
  expect(getChampionCrystalGroups(rows, 7, "nexus")[0].families[0].variants).toEqual([standard, nexus])
  expect(getChampionCrystalGroups(rows, 7, "pool v42")[0].id).toBe("featured")
  expect(getChampionCrystalGroups(rows, 6, "nexus")).toEqual([])
})

it("preserves the complete reviewed source partition for current Hulk, Gwenom and Vision star cases", () => {
  for (const gameId of ["hulk", "gwenom", "vision"]) for (const rarity of [6, 7]) {
    const availability = getChampionCrystals(gameId)
    const groups = getChampionCrystalGroups(availability.crystals, rarity)
    const variants = groups.flatMap(group => group.families.flatMap(family => family.variants))
    expect(variants.flatMap(variant => variant.sourceIds).sort()).toEqual(availability.crystals.filter(crystal => crystal.rarities.includes(rarity)).flatMap(crystal => crystal.sourceIds).sort())
    expect(groups.filter(group => group.id !== "main").flatMap(group => group.families.flatMap(family => family.variants)).some(variant => variant.isMainPool)).toBe(false)
    const summary = getChampionCrystalSummary(gameId)
    const describe = (values: ReturnType<typeof getChampionCrystalGroups>) => values.map(group => ({ id: group.id, count: group.count,
      families: group.families.map(family => ({ id: family.id, sources: family.variants.flatMap(variant => variant.sourceIds) })) }))
    expect(describe(getChampionCrystalGroups([...summary.crystals, ...availability.crystals.filter(crystal => !crystal.isMainPool && crystal.rarities.includes(rarity))], rarity))).toEqual(describe(groups))
  }
  expect(getChampionCrystalGroups(getChampionCrystals("gwenom").crystals, 7).map(group => [group.id, group.count])).toEqual([["spotlight", 2]])
  expect(getChampionCrystalGroups(getChampionCrystals("vision").crystals, 7)).toEqual([])
})
