import { describe, expect, it } from "vitest"
import { buildRosterKitSections, matchesRosterKitFilters, type RosterKitLink } from "./roster-kit"

const filters = { abilities: [], immunities: [], categories: [] }
const link = (id: number, name: string, values: Partial<RosterKitLink> = {}): RosterKitLink => ({
  id, type: "ABILITY", source: null, synergyChampions: [],
  ability: { name, iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: { raw: { color_primary: "ff0000" } }, categories: [] },
  ...values,
})

describe("roster quick kit", () => {
  it("uses recorded directions, preserves both directions for the same effect, and keeps unknowns separate", () => {
    const entries = [link(1, "Weakness", { effectDirection: "GAIN", effectForm: "DEBUFF" }), link(2, "Weakness", { effectDirection: "INFLICT", effectForm: "BUFF" }), link(3, "Fury"), link(4, "Bleed", { type: "IMMUNITY" })]
    const before = structuredClone(entries)
    const sections = buildRosterKitSections(entries, filters)
    expect(sections.map(section => [section.key, section.effects.map(effect => effect.name)])).toEqual([["IMMUNITY", ["Bleed"]], ["GAIN", ["Weakness"]], ["INFLICT", ["Weakness"]], ["UNKNOWN", ["Fury"]]])
    expect(sections[1].effects[0].sources[0].effectForm).toBe("DEBUFF")
    expect(sections[2].effects[0].sources[0].effectForm).toBe("BUFF")
    expect(sections[1].effects[0].color).toBe("#ff0000")
    expect(entries).toEqual(before)
  })

  it("merges repeated synergy applications and filters them to an owned champion's rarity", () => {
    const entries = [link(1, "Fury", { effectDirection: "GAIN", source: "Synergy: Team (6★) with Ally (6★): Gain Fury." }), link(2, "Fury", { effectDirection: "GAIN", source: "Synergy: Team (7★) with Ally (7★): Gain Fury." })]
    expect(buildRosterKitSections(entries, filters, 7)[1].effects).toHaveLength(1)
    expect(buildRosterKitSections(entries, filters, 7)[1].effects[0].sources).toHaveLength(1)
    expect(buildRosterKitSections(entries, filters, 5)).toHaveLength(1)
  })

  it("keeps roster filter matches highlighted and sorted first, with immunity filters independent", () => {
    const matched = link(2, "Zeta", { effectDirection: "GAIN" })
    matched.ability.categories = [{ name: "Control" }]
    const sections = buildRosterKitSections([link(1, "Alpha", { effectDirection: "GAIN" }), matched, link(3, "Zeta", { type: "IMMUNITY" })], { ...filters, categories: ["Control"] })
    expect(sections[1].effects.map(effect => [effect.name, effect.matched])).toEqual([["Zeta", true], ["Alpha", false]])
    expect(sections[0].effects[0].matched).toBe(false)
  })

  it("requires the effect, form and direction on the same application", () => {
    const entries = [
      link(1, "Bleed", { effectDirection: "GAIN", effectForm: "DEBUFF" }),
      link(2, "Bleed", { effectDirection: "INFLICT", effectForm: "PASSIVE" }),
      link(3, "Weakness", { effectDirection: "INFLICT", effectForm: "DEBUFF" }),
    ]
    const selected = { ...filters, abilities: ["Bleed"], effectForms: ["DEBUFF"] as const, effectDirections: ["INFLICT"] as const }
    expect(matchesRosterKitFilters(entries, selected)).toBe(false)
    const passive = { ...selected, effectForms: ["DEBUFF", "PASSIVE"] as const }
    expect(matchesRosterKitFilters(entries, passive)).toBe(true)
    const sections = buildRosterKitSections(entries, passive)
    expect(sections.find(section => section.key === "GAIN")!.effects[0].matched).toBe(false)
    const bleed = sections.find(section => section.key === "INFLICT")!.effects.find(effect => effect.name === "Bleed")!
    expect(bleed.matched).toBe(true)
    expect(bleed.matchedSources.map(source => source.effectForm)).toEqual(["PASSIVE"])
    expect(sections.find(section => section.key === "INFLICT")!.effects.find(effect => effect.name === "Weakness")!.matched).toBe(false)
  })

  it("keeps AND/OR selection and immunity matching independent of ability qualifiers", () => {
    const entries = [link(1, "Bleed", { effectDirection: "INFLICT", effectForm: "DEBUFF" }), link(2, "Poison", { type: "IMMUNITY" })]
    const selected = { ...filters, abilities: ["Bleed", "Shock"], effectDirections: ["INFLICT"] as const, immunities: ["Poison"] }
    expect(matchesRosterKitFilters(entries, selected)).toBe(false)
    expect(matchesRosterKitFilters(entries, { ...selected, abilityLogic: "OR" })).toBe(true)
    expect(matchesRosterKitFilters(entries, { ...filters, immunities: ["Bleed"] })).toBe(false)
    expect(matchesRosterKitFilters(entries, { ...filters, effectForms: ["UNKNOWN"] })).toBe(false)
    expect(matchesRosterKitFilters([link(3, "Bleed")], { ...filters, effectForms: ["UNKNOWN"] })).toBe(true)
  })

  it("excludes unavailable rarity sources from filtering and from match details", () => {
    const entries = [link(1, "Bleed", { effectDirection: "INFLICT", effectForm: "DEBUFF", source: "Synergy: Team (7★) with Ally (7★): Inflict Bleed." })]
    const selected = { ...filters, abilities: ["Bleed"], effectDirections: ["INFLICT"] as const }
    expect(matchesRosterKitFilters(entries, selected, 6)).toBe(false)
    expect(matchesRosterKitFilters(entries, selected, 7)).toBe(true)
    expect(buildRosterKitSections(entries, selected, 6)[0].effects).toEqual([])
  })
})
