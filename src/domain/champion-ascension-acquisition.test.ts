import { describe, expect, it } from "vitest"
import snapshot from "../data/champion-ascension-acquisition/catalog.json"
import { createChampionAscensionAcquisitionCatalog } from "./champion-ascension-acquisition"
import { getChampionAscensionRules, getAscensionResource } from "../data/game-ascension"

const deps = { getRules: getChampionAscensionRules, getResource: getAscensionResource }
const asOf = "2026-11-07"
describe("ascension acquisition catalog validation", () => {
  it("rejects duplicate identities, dangling sources and extra fields", () => {
    const duplicate = structuredClone(snapshot); duplicate.routes.push(duplicate.routes[0])
    expect(() => createChampionAscensionAcquisitionCatalog(duplicate, deps)).toThrow(/Duplicate/)
    const dangling = structuredClone(snapshot); dangling.routes[0].sourceIds = ["missing"]
    expect(() => createChampionAscensionAcquisitionCatalog(dangling, deps)).toThrow(/source/)
    expect(() => createChampionAscensionAcquisitionCatalog({ ...snapshot, current: true }, deps)).toThrow()
  })
  it("rejects inverted/invalid dates, bad quantities, unsupported stars and mismatched tokens", () => {
    for (const mutate of [
      (data: typeof snapshot) => { data.routes[0].window = { start: "2026-12-01", end: "2026-11-01", timeZone: null, label: "invalid" } },
      (data: typeof snapshot) => { data.routes[0].offers[0].price!.quantity = 0 },
      (data: typeof snapshot) => { data.routes[0].rarity = 6 },
      (data: typeof snapshot) => { data.routes[0].requiredTokenIds = ["ascension_token_champion_storm_realm"] },
    ]) {
      const data = structuredClone(snapshot); mutate(data)
      expect(() => createChampionAscensionAcquisitionCatalog(data, deps)).toThrow()
    }
  })
  it("rejects static prices, wrong-role token rewards and date-based live claims", () => {
    const staticPrice = structuredClone(snapshot)
    staticPrice.routes[0].offers.find(o => o.sourceId === "store-nov5")!.price = { currency: "Units", quantity: 1 }
    expect(() => createChampionAscensionAcquisitionCatalog(staticPrice, deps)).toThrow(/price/)
    const wrongRole = structuredClone(snapshot)
    wrongRole.routes[0].offers.find(o => o.sourceId === "store-nov5")!.rewards[0].role = "champion"
    expect(() => createChampionAscensionAcquisitionCatalog(wrongRole, deps)).toThrow()
    expect(() => createChampionAscensionAcquisitionCatalog({ ...snapshot, routes: [{ ...snapshot.routes[0], availability: "available_now" }] }, deps)).toThrow()
  })
  it("handles exact timed boundaries and inclusive date-only end days without inventing endpoints", () => {
    const catalog = createChampionAscensionAcquisitionCatalog(snapshot, deps)
    expect(catalog.forChampion("spiderham", 7, "2026-06-26T17:59:59Z").routes[0].periodStatus).toBe("upcoming")
    expect(catalog.forChampion("spiderham", 7, "2026-06-26T18:00:00Z").routes[0].periodStatus).toBe("within_announced_period")
    expect(catalog.forChampion("spiderham", 7, "2026-06-26T18:00:00Z").routes[0].availability).toBe("activity_dependent")
    expect(catalog.forChampion("spiderham", 7, "2026-07-06T18:00:00Z").routes[0].periodStatus).toBe("past")
    expect(catalog.forChampion("magneto_marvelnow", 7, "2026-12-09").routes[0].periodStatus).toBe("within_announced_period")
    expect(catalog.forChampion("magneto_marvelnow", 7, "2026-12-10").routes[0].periodStatus).toBe("past")
    expect(catalog.forChampion("medusa", 7, "2027-02-01").routes[0].periodStatus).toBe("start_passed_end_unknown")
    expect(catalog.forChampion("thor_ragnarok", 7, asOf).routes[0].periodStatus).toBe("not_dated")
  })
  it("guards Carina solely by exact canonical path and mastery reward, never creating eligibility", () => {
    const catalog = createChampionAscensionAcquisitionCatalog(snapshot, { ...deps, getRules: () => [] })
    expect(catalog.forChampion("carina_white", 7, asOf).routes).toEqual([])
    expect(catalog.forChampion("carina_white", 6, asOf).routes).toEqual([])
    const carina = { gameId: "carina_white", rarity: 7, blueprintId: "carina_white_t7", maxLevel: 1, observedAt: "2026-11-03T09:10:42Z", steps: [{ level: 1, tierId: "7s_t1", cost: [{ type: "inv" as const, id: "ascension_token_champion_carina_white", quantity: 1 }, { type: "inv" as const, id: "ascension_token_class_cosmic", quantity: 1 }], attackBonus: 0, healthBonus: 0, challengeRating: 0, mightGain: 0, buffIds: [] }] }
    const guarded = createChampionAscensionAcquisitionCatalog(snapshot, { ...deps, getRules: id => id === "carina_white" ? [carina] : [] })
    expect(guarded.forChampion("carina_white", 7, asOf).routes[0].offers[0].binding).toBe("epilogue_ch04_q04.masteryCompletionRewards")
    carina.maxLevel = 2
    expect(guarded.forChampion("carina_white", 7, asOf).routes).toEqual([])
  })
})
