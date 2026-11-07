import { expect, it } from "vitest"
import { listCrystalOpenings, getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { getCrystalBrowseEntries } from "./crystal-browse-catalog"
import { compareCrystalsNewestFirst } from "@cerebro/core/domain/crystal-chronology"
import { hasCrystalSevenStarAscensionRewards } from "@cerebro/core/domain/crystal-ascension-rewards"
import { getAscensionResource, getChampionAscensionRules } from "@cerebro/core/data/game-ascension"

it("indexes the exact seven-star ascension sources within every crystal family", () => {
  const entries = getCrystalBrowseEntries()
  for (const entry of entries) {
    expect(entry.ascensionSourceIds).toEqual(entry.variants.flatMap(variant => variant.sourceIds).filter(id => hasCrystalSevenStarAscensionRewards(getCrystalOpening(id)!, { getRules: getChampionAscensionRules, getResource: getAscensionResource })))
  }
  expect(entries.find(entry => entry.id === "valiant_metamorphosis_crystal")?.ascensionSourceIds).toContain("valiant_metamorphosis_crystal")
  expect(entries.find(entry => entry.id === "7_star_hero_shard_crystal")?.ascensionSourceIds).toEqual([])
})

it("covers every exact opening once while preserving explicitly grouped champion families", () => {
  const entries = getCrystalBrowseEntries()
  const ids = entries.flatMap(entry => entry.variants.flatMap(variant => variant.sourceIds))
  expect(new Set(ids).size).toBe(ids.length)
  expect([...ids].sort()).toEqual(listCrystalOpenings().map(opening => opening.id).sort())
  const hero = entries.find(entry => entry.id === "7_star_hero_shard_crystal")!
  expect(hero.variants.flatMap(variant => variant.sourceIds)).toContain("7star_nexus_crystal")
  expect(hero.championCount).toBe(180)
  expect(entries.filter(entry => entry.isMainPool)).toHaveLength(11)
})

it("keeps preordered catalog views equivalent to the original ordering rules", () => {
  const entries = getCrystalBrowseEntries()
  const newest = [...entries].sort((a, b) => compareCrystalsNewestFirst(
    { ...a, sourceIds: a.variants.flatMap(variant => variant.sourceIds) },
    { ...b, sourceIds: b.variants.flatMap(variant => variant.sourceIds) }))
  expect(getCrystalBrowseEntries("newest")).toEqual(newest)
  const alphabetical = [...entries].sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"))
  expect(getCrystalBrowseEntries("name")).toEqual(alphabetical)
  expect(getCrystalBrowseEntries()).toBe(entries)
})

it("uses current direct rewards for counts and separates mixed crystals from item-only outcomes", () => {
  const entries = getCrystalBrowseEntries()
  expect(entries.find(entry => entry.id === "paragon_crystal_v2")).toMatchObject({ rewardKind: "mixed", championCount: 303, hasRates: true })
  expect(entries.find(entry => entry.id === "superior_banquet_crystal_dec25")).toMatchObject({ rewardKind: "items", championCount: 0, hasPity: true })
  const empire = entries.find(entry => entry.id === "valiant_empire_of_doom_saga_crystal")!
  const raw = getCrystalOpening(empire.id)!
  const ids = new Set(raw.categories.flatMap(category => category.rewards.filter(reward => reward.type === "hero" || reward.type === "hcos").map(reward => reward.gameId)))
  expect(empire.championCount).toBe(ids.size)
})

it("records a single champion only when every direct champion reward resolves to that identity", () => {
  const entries = getCrystalBrowseEntries()
  const login = entries.find(entry => entry.id === "login_crystal_7_star_nov26")!
  const rewards = getCrystalOpening(login.id)!.categories.flatMap(category => category.rewards).filter(reward => reward.type === "hero" || reward.type === "hcos")
  expect(login.singleChampion?.gameId).toBe(rewards[0].gameId)
  expect(login.singleChampion?.name).toBe(rewards[0].displayName)
  expect(entries.find(entry => entry.id === "7_star_hero_shard_crystal")?.singleChampion).toBeNull()
})
