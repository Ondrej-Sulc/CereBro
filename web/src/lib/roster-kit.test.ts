import { describe, expect, it } from "vitest"
import { buildRosterKitSections, matchesRosterKitFilters, matchingRosterKitSourceGroups, type RosterKitLink } from "./roster-kit"

const filters = { abilities: [], immunities: [], categories: [] }
const link = (id: number, name: string, values: Partial<RosterKitLink> = {}): RosterKitLink => ({
  id, type: "ABILITY", source: null, synergyChampions: [],
  ability: { name, iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: { raw: { color_primary: "ff0000" } }, categories: [] },
  ...values,
})

describe("roster protection potency", () => {
  const resistance = (id: number, name: string, percent: number | null, mechanism: "POTENCY" | "POTENCY_AND_DURATION" | "DAMAGE" | "DURATION" | "RESISTANCE" = "POTENCY", source: string | null = null) => link(id, "Damage Reduction", {
    effectForm: "PASSIVE", effectDirection: "GAIN", source,
    resistances: [{ effect: { name }, mechanism, percent }],
  })

  it("includes all resistances by default, with an immunity-only opt-out", () => {
    const entries = [resistance(1, "Bleed", null)]
    const selected = { ...filters, immunities: ["Bleed"] }
    expect(matchesRosterKitFilters(entries, selected)).toBe(true)
    expect(matchesRosterKitFilters(entries, { ...selected, includeResistances: false })).toBe(false)
    expect(buildRosterKitSections(entries, selected)[0].effects[0]).toMatchObject({ type: "RESISTANCE", matched: true })
    expect(buildRosterKitSections(entries, { ...selected, includeResistances: false })[0].effects[0].matched).toBe(false)
  })

  it.each([[79.99, false], [80, true], [100, true], [150, true], [null, false]] as const)("checks an inclusive 80 percent minimum against %s", (percent, expected) => {
    const entries = [resistance(1, "Bleed", percent)]
    const selected = { ...filters, immunities: ["Bleed"], minResistancePotency: 80 }
    expect(matchesRosterKitFilters(entries, selected)).toBe(expected)
    expect(buildRosterKitSections(entries, selected)[0].effects[0].matched).toBe(expected)
  })

  it.each(["DURATION", "DAMAGE", "RESISTANCE"] as const)("does not treat %s as potency", mechanism => {
    expect(matchesRosterKitFilters([resistance(1, "Bleed", 100, mechanism)], { ...filters, immunities: ["Bleed"], minResistancePotency: 80 })).toBe(false)
  })

  it("accepts combined potency/duration reduction and full immunity", () => {
    const selected = { ...filters, immunities: ["Bleed"], minResistancePotency: 80 }
    expect(matchesRosterKitFilters([resistance(1, "Bleed", 80, "POTENCY_AND_DURATION")], selected)).toBe(true)
    const immunity = link(2, "Bleed", { type: "IMMUNITY" })
    expect(matchesRosterKitFilters([immunity], { ...selected, minResistancePotency: 150 })).toBe(true)
    expect(buildRosterKitSections([immunity], selected)[0].effects[0].matched).toBe(true)
  })

  it("does not add separate sources or borrow percentages from another effect", () => {
    const entries = [resistance(1, "Bleed", 40), resistance(2, "Bleed", 40), resistance(3, "Poison", 90)]
    expect(matchesRosterKitFilters(entries, { ...filters, immunities: ["Bleed"], minResistancePotency: 80 })).toBe(false)
  })

  it("qualifies each effect before all/any matching and keeps ability qualifiers independent", () => {
    const entries = [resistance(1, "Bleed", 80), resistance(2, "Poison", 60), link(3, "Fury", { effectForm: "BUFF", effectDirection: "GAIN" })]
    const selected = { ...filters, abilities: ["Fury"], effectForms: ["BUFF"] as const, immunities: ["Bleed", "Poison"], minResistancePotency: 80 }
    expect(matchesRosterKitFilters(entries, selected)).toBe(false)
    expect(matchesRosterKitFilters(entries, { ...selected, immunityLogic: "OR" })).toBe(true)
    expect(matchesRosterKitFilters(entries, { ...selected, minResistancePotency: 60 })).toBe(true)
  })

  it("supports threshold-only searches, rarity restrictions, and temporarily disabling resistances", () => {
    const entries = [resistance(1, "Bleed", 90, "POTENCY", "Synergy: Team (7\u2605) with Ally (7\u2605): Resist Bleed.")]
    const selected = { ...filters, minResistancePotency: 80 }
    expect(matchesRosterKitFilters(entries, selected, 6)).toBe(false)
    expect(matchesRosterKitFilters(entries, selected, 7)).toBe(true)
    expect(matchesRosterKitFilters([link(2, "Fury")], selected)).toBe(false)
    expect(matchesRosterKitFilters([link(2, "Fury")], { ...selected, includeResistances: false })).toBe(true)
    expect(matchesRosterKitFilters(entries, { ...selected, immunities: ["Bleed"], includeResistances: false })).toBe(false)
    expect(buildRosterKitSections(entries, selected, 6)[0].effects).toEqual([])
  })

  it("highlights only qualifying sources and filters their grouped conditions without mutating data", () => {
    const entries = [resistance(1, "Bleed", 60, "POTENCY", "While armor is active."), resistance(2, "Bleed", 90, "POTENCY", "During a Special Attack.")]
    const effect = buildRosterKitSections(entries, { ...filters, immunities: ["Bleed"], minResistancePotency: 80 })[0].effects[0]
    expect(effect.matchedSources.map(source => source.resistance?.percent)).toEqual([90])
    const detail = (percent: number) => ({ mechanism: "POTENCY" as const, percent })
    const groups = [{ key: "PASSIVE:GAIN", effectForm: "PASSIVE" as const, effectDirection: "GAIN" as const,
      nativeSources: [60, 90].map(percent => ({ key: String(percent), label: "Native", condition: `${percent}% reduction`, target: null, resistance: detail(percent) })),
      synergies: [{ key: "team", champions: [], links: [40, 80].map(percent => ({ key: String(percent), label: "Team", conditions: [`${percent}% reduction`], resistance: detail(percent) })) }],
    }]
    const before = structuredClone(groups)
    const filtered = matchingRosterKitSourceGroups(effect, groups, 80)
    expect(filtered[0].nativeSources.map(source => source.resistance?.percent)).toEqual([90])
    expect(filtered[0].synergies[0].links.map(source => source.resistance?.percent)).toEqual([80])
    expect(groups).toEqual(before)
    expect(matchingRosterKitSourceGroups(effect, groups, 100)).toEqual([])
  })
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
