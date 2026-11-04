import { describe, expect, it } from "vitest"
import { championPageHref, championPageSearchParams, readChampionPageState, readChampionSynergyHash } from "./champion-page-state"

const stats = [{ rarity: 6, rank: 4 }, { rarity: 7, rank: 6 }, { rarity: 7, rank: 5 }, { rarity: 4, rank: 5 }]
const read = (query: string) => readChampionPageState(new URLSearchParams(query), stats)

describe("shared champion page state", () => {
  it("round-trips an exact synergy source ID and clears it outside Synergies", () => {
    const state = read("tab=synergies&synergy=comp_009&rarity=7&rank=5&sig=0")
    expect(state).toMatchObject({ synergy: "comp_009", tab: "synergies", rank: "5", sig: 0 })
    expect(readChampionPageState(championPageSearchParams("", state), stats)).toEqual(state)
    expect(championPageSearchParams("synergy=comp_009", { ...state, tab: "overview" }).has("synergy")).toBe(false)
    expect(read("tab=abilities&synergy=comp_009")).toMatchObject({ synergy: null })
  })
  it("defaults to the highest available rarity and rank, regardless of stat order", () => {
    expect(read("")).toEqual({ tab: "overview", rarity: "7", rank: "6", sig: 200, ascension: 0, ability: null, chapter: null, synergy: null })
  })

  it("restores a linked passage and the complete build, including an unawakened signature", () => {
    expect(read("tab=abilities&rarity=7&rank=5&sig=0&ascension=3&ability=42")).toEqual({
      tab: "abilities", rarity: "7", rank: "5", sig: 0, ascension: 3, ability: "42", chapter: null, synergy: null,
    })
  })

  it("uses available tiers and rarity-specific limits for stale or out-of-range links", () => {
    expect(read("tab=bogus&rarity=6&rank=6&sig=999&ascension=5&ability=42")).toEqual({
      tab: "overview", rarity: "6", rank: "4", sig: 200, ascension: 0, ability: null, chapter: null, synergy: null,
    })
    expect(read("rarity=4&sig=200").sig).toBe(99)
    expect(read("sig=-1&ascension=-2")).toMatchObject({ sig: 0, ascension: 0 })
    expect(read("rarity=8&rank=99")).toMatchObject({ rarity: "7", rank: "6" })
  })

  it("rejects malformed numbers rather than propagating NaN or fractional build values", () => {
    expect(read("sig=NaN&ascension=2.5&ability=abc")).toMatchObject({ sig: 200, ascension: 0, ability: null })
    expect(read("sig=99999999999999999999999").sig).toBe(200)
  })

  it("preserves unrelated query parameters and removes a passage when leaving abilities", () => {
    const state = { ...read("tab=abilities&ability=42"), tab: "stats" as const }
    const params = championPageSearchParams("variant=dossier&ability=42", state)
    expect(params.get("variant")).toBe("dossier")
    expect(params.has("ability")).toBe(false)
    expect(readChampionPageState(params, stats)).toEqual({ ...state, ability: null })
  })

  it("handles champions without stat tiers", () => {
    expect(readChampionPageState(new URLSearchParams("rarity=7&rank=6"), [])).toMatchObject({ rarity: "", rank: "" })
  })

  it("round-trips ability chapter links and drops them outside the reader", () => {
    const state = read("tab=abilities&chapter=special2&sig=75")
    expect(state.chapter).toBe("special2")
    expect(readChampionPageState(championPageSearchParams("", state), stats)).toEqual(state)
    const params = championPageSearchParams("chapter=special2", { ...state, tab: "stats" })
    expect(params.has("chapter")).toBe(false)
    expect(read("tab=abilities&chapter=all").chapter).toBeNull()
    expect(read("tab=abilities&chapter=%3Cscript%3E").chapter).toBeNull()
    expect(read("tab=overview&chapter=base").chapter).toBeNull()
  })

  it("preserves legacy synergy destinations for build edits but clears them on deliberate navigation", () => {
    const href = "https://cerebro.test/champions/test?variant=dossier&tab=synergies#champion-synergy-comp_009"
    const state = read("tab=synergies&sig=100")
    expect(championPageHref(href, state)).toContain("#champion-synergy-comp_009")
    expect(championPageHref(href, state, true)).not.toContain("#")
    expect(championPageHref(href, { ...state, tab: "stats" })).not.toContain("#")
    const replacement = championPageHref(href, { ...state, synergy: "incoming_1" })
    expect(replacement).toContain("synergy=incoming_1")
    expect(replacement).not.toContain("#")
    expect(replacement).toContain("variant=dossier")
    expect(championPageHref(href.replace("#champion-synergy-comp_009", "#other-context"), state, true)).toContain("#other-context")
  })

  it("accepts legacy encoded source IDs while rejecting malformed or oversized targets", () => {
    expect(readChampionSynergyHash("#champion-synergy-family%3Alevel_2")).toBe("family:level_2")
    expect(readChampionSynergyHash("#other-context")).toBeNull()
    expect(readChampionSynergyHash("#champion-synergy-%broken")).toBeNull()
    expect(readChampionSynergyHash("#champion-synergy-")).toBeNull()
    for (const value of ["", "invalid id", "\0", "x".repeat(201)]) expect(read(`tab=synergies&synergy=${encodeURIComponent(value)}`).synergy).toBeNull()
  })
})
