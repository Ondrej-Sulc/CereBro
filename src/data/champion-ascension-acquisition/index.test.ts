import { describe, expect, it } from "vitest"
import { getChampionAscensionAcquisitionSources as read } from "./index"
import { getChampionAscension } from "../game-ascension"
import snapshot from "./catalog.json"

const asOf = "2026-11-07T12:00:00Z"
describe("reviewed non-crystal ascension sources", () => {
  it("preserves all 26 research dispositions, two separate definitions and 22 exact store bindings", () => {
    const mechanisms = snapshot.routes.filter(route => route.kind !== "definition" && route.gameId !== "carina_white")
    expect(mechanisms).toHaveLength(26)
    expect(new Set(mechanisms.map(route => route.gameId)).size).toBe(26)
    expect(mechanisms.filter(route => route.id.startsWith("reclamation-"))).toHaveLength(9)
    expect(snapshot.routes.filter(route => route.kind === "definition")).toHaveLength(2)
    expect(snapshot.routes.reduce((count, route) => count + route.offers.filter(offer => offer.sourceId === "store-nov5").length, 0)).toBe(22)
    for (const mechanism of mechanisms) {
      const result = read(mechanism.gameId, 7, asOf)
      expect(result.routes).toHaveLength(1)
      expect(result.routes[0]).toMatchObject({ gameId: mechanism.gameId, rarity: 7 })
      expect(result.routes[0].sources.every(source => source.reviewedAt === "2026-11-07")).toBe(true)
      expect(read(mechanism.gameId, undefined, asOf).routes.every(route => route.rarity === 7)).toBe(true)
      expect(read(mechanism.gameId, 6, asOf).routes).toEqual([])
    }
  })
  it("isolates exact identity and star, preserving unknown and known-empty paths", () => {
    expect(read("hulk", 7, asOf).paths[0].state).toBe("recorded_empty")
    expect(read("missing", 7, asOf).paths[0].state).toBe("unknown")
    expect(read("magik", 6, asOf).routes).toEqual([])
    expect(read("magik_legacy", 7, asOf).routes).toEqual([])
    expect(read("storm_realm", 7, asOf).routes).toEqual([])
    expect(read("maestro_overseer", 7, asOf).routes).toEqual([])
    expect(read("starlord_kittypryde", 7, asOf).routes).toEqual([])
    for (const id of ["guillotine_nameless", "groot_king_deathless", "vision_deathless", "shehulk_deathless", "thanos_deathless_trophy"]) {
      expect(read(id, 7, asOf).paths[0].state).toBe("recorded_empty")
      expect(read(id, 7, asOf).routes).toEqual([])
      expect(read(id, 6, asOf).paths[0].materialKind).toBe("shared")
    }
    expect(read("blade", 7, asOf).routes[0].id).not.toBe(read("blade_stellar", 7, asOf).routes[0].id)
  })
  it("reads lower-star recipes from exact canonical paths without personal-token gaps", () => {
    for (const star of [4, 5, 6]) {
      const result = read("hulk", star, asOf), path = result.paths[0]
      expect(path.materialKind).toBe("shared")
      expect(path.steps[0].costs.map(({ name: _name, ...cost }) => cost)).toEqual(getChampionAscension("hulk", star)!.steps[0].cost)
      expect(path.guidance).toContain("shared Primordial Dust")
      expect(result.routes).toEqual([])
    }
    expect(read("hulk", undefined, asOf).paths.map(path => path.rarity)).toEqual([7, 6, 5, 4, 3, 2, 1])
  })
  it("retains reward quantities and separate historical Chavez evidence versions", () => {
    const magik = read("magik", 7, asOf).routes[0]
    expect(magik.offers.find(o => o.id === "event_090226_magik_a2")!.rewards).toContainEqual({ type: "inv", id: "ascension_token_champion_magik", quantity: 2, role: "ascension_material" })
    expect(magik.offers.filter(o => o.price).map(o => o.price!.quantity)).toEqual([10, 15])
    const chavez = read("americachavez", 7, asOf).routes[0]
    expect(chavez.offers.filter(o => o.sourceId === "store-nov5").every(o => o.price === null)).toBe(true)
    expect(chavez.offers.find(o => o.price?.quantity === 50)!.rewards).toContainEqual({ type: "inv", id: "ascension_token_class_mystic", quantity: 1, role: "ascension_material" })
    expect(chavez.offers.find(o => o.id === "saga_america_chavez_tokens_bundle")!.rewards).toContainEqual({ type: "inv", id: "ascension_token_class_mystic", quantity: 5, role: "ascension_material" })
  })
  it("does not turn canonical token costs into objective payouts or invent weekly order", () => {
    for (const id of ["maestro_trophy", "starlord_stellar", "blade_stellar", "green_goblin_stellar", "magneto_marvelnow", "blade", "wong", "storm"]) {
      const route = read(id, 7, asOf).routes[0]
      expect(route.requiredTokenIds).toHaveLength(1)
      expect(route.offers).toEqual([])
      expect(route.missingEvidence.length).toBeGreaterThan(0)
    }
    const starLord = read("starlord_stellar", 7, asOf).routes[0]
    expect(starLord.starScope).toBe("recorded_path_match")
    expect(read("starlord_stellar", 6, asOf).routes).toEqual([])
    const thor = read("thor_ragnarok", 7, asOf).routes[0]
    expect(thor.offers.every(o => o.price === null)).toBe(true)
    expect(thor.offers[1].purchaseLimit).toBe(2)
    for (const id of ["mrfantastic_victorious", "invisiblewoman_victorious", "humantorch_victorious", "thing_victorious"]) {
      const row = read(id, 7, asOf).routes[0]
      expect(row.offers[0].rewards).toHaveLength(1)
      expect(row.offers[0].purchaseLimit).toBe(2)
      expect(row.missingEvidence.join(" ")).toContain("initial")
    }
  })
  it("keeps five unresolved cases out of obtainable-route rows", () => {
    for (const id of ["arnimzola", "scarletwitch_current", "cable", "deadpool", "scream"]) expect(read(id, 7, asOf).routes).toEqual([])
    expect(read("arnimzola", 7, asOf).definitions[0].availability).toBe("definition_only")
    expect(read("scarletwitch_current", 7, asOf).definitions[0].offers[0].binding).toContain("sigil_store_ascension_sw_token")
  })
  it("joins the independently restored exact Carina path to one mastery grant", () => {
    const canonical = getChampionAscension("carina_white", 7)
    expect(canonical).toMatchObject({ blueprintId: "carina_white_t7", maxLevel: 1 })
    const result = read("carina_white", 7, asOf)
    expect(result.routes).toHaveLength(1)
    const route = result.routes[0]
    expect(route.offers).toHaveLength(1)
    expect(route.offers[0].binding).toBe("epilogue_ch04_q04.masteryCompletionRewards")
    expect(route.offers[0].rewards.map(({ role: _role, ...reward }) => reward)).toEqual(canonical!.steps[0].cost)
    expect(route.sources.find(source => source.kind === "quest_capture")!.capturedAt).toBe("2026-11-05T06:49:32.001200+00:00")
    expect(read("carina_white", 6, asOf).routes).toEqual([])
    expect(read("carina_white", 6, asOf).paths[0].state).toBe("unknown")
    expect(read("carina_boss", 7, asOf).routes).toEqual([])
  })
  it("keeps historical, upcoming, dated event, undated stock and challenge status distinct", () => {
    expect(read("spiderham", 7, asOf).routes[0]).toMatchObject({ availability: "historical", periodStatus: "past" })
    expect(read("medusa", 7, asOf).routes[0]).toMatchObject({ availability: "upcoming", periodStatus: "upcoming", window: { start: "2026-11-20", end: null, timeZone: null } })
    expect(read("medusa", 7, "2026-11-21").routes[0]).toMatchObject({ availability: "activity_dependent", periodStatus: "start_passed_end_unknown" })
    expect(read("magneto_marvelnow", 7, asOf).routes[0]).toMatchObject({ availability: "activity_dependent", periodStatus: "within_announced_period" })
    expect(read("magik", 7, asOf).routes[0]).toMatchObject({ availability: "current_stock_unverified", periodStatus: "start_passed_end_unknown" })
    expect(read("starlord_stellar", 7, asOf).routes[0].periodStatus).toBe("not_dated")
    expect(read("medusa", 7, asOf).paths[0].maxLevel).toBe(2)
    expect(read("doctordoom", 7, asOf).paths[0].maxLevel).toBe(2)
  })
  it("does not present an old objective announcement as an ended event without a deadline", () => {
    for (const date of [asOf, "2027-01-01"]) {
      const route = read("blade_stellar", 7, date).routes[0]
      expect(route).toMatchObject({ availability: "activity_dependent", periodStatus: "not_dated", window: null })
      expect(route.conditions.join(" ")).toContain("already live then")
      expect(route.missingEvidence.join(" ")).toContain("deadline and current activity status")
    }
    expect(read("spiderham", 7, asOf).routes[0].periodStatus).toBe("past")
  })
  it("returns defensive copies and lean selected-champion data", () => {
    const first = read("magik", undefined, asOf)
    first.routes[0].offers.find(o => o.rewards.length)!.rewards[0].quantity = 999
    first.paths[0].steps[0].costs[0].quantity = 999
    first.routes[0].sources[0].publisher = "changed"
    const next = read("magik", undefined, asOf)
    expect(JSON.stringify(next)).not.toContain("999")
    expect(JSON.stringify(next)).not.toContain("changed")
    expect(Buffer.byteLength(JSON.stringify(next))).toBeLessThan(16000)
    expect(() => read("magik", 0, asOf)).toThrow()
    expect(() => read("magik", 7, "nonsense")).toThrow()
  })
})
