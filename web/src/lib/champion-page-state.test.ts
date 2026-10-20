import { describe, expect, it } from "vitest"
import { championPageSearchParams, readChampionPageState } from "./champion-page-state"

const stats = [{ rarity: 6, rank: 4 }, { rarity: 7, rank: 6 }, { rarity: 7, rank: 5 }, { rarity: 4, rank: 5 }]
const read = (query: string) => readChampionPageState(new URLSearchParams(query), stats)

describe("shared champion page state", () => {
  it("defaults to the highest available rarity and rank, regardless of stat order", () => {
    expect(read("")).toEqual({ tab: "overview", rarity: "7", rank: "6", sig: 200, ascension: 0, ability: null, chapter: null })
  })

  it("restores a linked passage and the complete build, including an unawakened signature", () => {
    expect(read("tab=abilities&rarity=7&rank=5&sig=0&ascension=3&ability=42")).toEqual({
      tab: "abilities", rarity: "7", rank: "5", sig: 0, ascension: 3, ability: "42", chapter: null,
    })
  })

  it("uses available tiers and rarity-specific limits for stale or out-of-range links", () => {
    expect(read("tab=bogus&rarity=6&rank=6&sig=999&ascension=5&ability=42")).toEqual({
      tab: "overview", rarity: "6", rank: "4", sig: 200, ascension: 0, ability: null, chapter: null,
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
})
