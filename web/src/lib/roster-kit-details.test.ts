import { describe, expect, it } from "vitest"
import { buildRosterKitDetails } from "./roster-kit-details"
import type { RosterKitLink } from "./roster-kit"
import { buildRosterKitSections } from "./roster-kit"

const link = (id: number, source: string | null, extra: Partial<RosterKitLink> = {}): RosterKitLink => ({
  id, type: "ABILITY", source, effectForm: "PASSIVE", effectDirection: "GAIN", synergyChampions: [],
  ability: { name: "Amplify", iconUrl: null, gameGlossaryTermId: null, description: "Increases potency.", gameGlossaryTerm: null, categories: [] }, ...extra,
})

describe("roster effect details", () => {
  it("reuses reviewed conditions and finds the full ability target from the original source", () => {
    const original = "While Agatha is inside Rune Prison, gain an additional {1}% Amplify per active personal Amplify."
    const result = buildRosterKitDetails([link(1, original, { overviewSummary: "Inside Rune Prison, each personal Amplify grants additional Amplify." })], [
      { id: 31, group: "base", title: "Rune Prison", template: { raw: "While Agatha is inside Rune Prison, she gains an additional Amplify Passive." } },
    ])
    expect(result.groups["GAIN:Amplify"][0].nativeSources[0]).toMatchObject({ condition: "Inside Rune Prison, each personal Amplify grants additional Amplify.", target: { recordId: "31" } })
    expect(result.entries[0].source).toBe(original)
  })

  it("keeps absent conditions blank and suppresses unresolved audit prose", () => {
    const entries = [link(1, null, { type: "IMMUNITY", overviewSummary: "Agatha is immune to Amplify." }), link(2, "Legacy SP3: {1} Amplify; potency unresolved.")]
    const result = buildRosterKitDetails(entries, [])
    expect(result.groups["IMMUNITY:Amplify"]).toEqual([])
    expect(result.groups["GAIN:Amplify"]).toEqual([])
  })

  it("keeps missing immunity sources blank while retaining the separate effect definition for hover", () => {
    const entries = [link(1, null, { type: "IMMUNITY", overviewSummary: "Agatha is immune to Armor Break.",
      ability: { ...link(1, null).ability, name: "Armor Break", description: "Reduces Armor Rating and removes an Armor Up effect." } })]
    const details = buildRosterKitDetails(entries, [])
    const effect = buildRosterKitSections(details.entries, { abilities: [], immunities: ["Armor Break"], categories: [] })[0].effects[0]
    expect(details.groups["IMMUNITY:Armor Break"]).toEqual([])
    expect(effect.description).toBe("Reduces Armor Rating and removes an Armor Up effect.")
  })

  it("keeps immunity source conditions and synergy partners separate from the effect definition", () => {
    const entries = [link(1, "While in Diamond Form, she is immune to Bleed.", { type: "IMMUNITY" }),
      link(2, "Synergy: Team (7★) with Ally (7★): While Blocking, she is immune to Bleed.", {
        type: "IMMUNITY", synergyChampions: [{ champion: { name: "Ally", slug: "ally", images: null } }],
      })]
    const details = buildRosterKitDetails(entries, [])
    const effect = buildRosterKitSections(details.entries, { abilities: [], immunities: [], categories: [] })[0].effects[0]
    const group = details.groups["IMMUNITY:Amplify"][0]
    expect(group.nativeSources[0].condition).toBe("While in Diamond Form, she is immune to Bleed.")
    expect(group.synergies[0].links[0].conditions).toEqual(["While Blocking, she is immune to Bleed."])
    expect(group.synergies[0].champions[0].name).toBe("Ally")
    expect(effect.description).toBe("Increases potency.")
  })

  it("collapses repeated synergy links while retaining every distinct condition and rarity rule", () => {
    const partners = [{ champion: { name: "Ally", slug: "ally", images: null } }]
    const entries = [
      link(1, "Synergy: Team (6★) with Ally (7★): Gain Amplify.", { synergyChampions: partners }),
      link(2, "Synergy: Team (7★) with Ally (7★): Gain Amplify.", { synergyChampions: partners }),
      link(3, "Synergy: Team (7★) with Ally (7★): While Blocking, gain Amplify.", { synergyChampions: partners }),
    ]
    const cards = [{ id: "team", name: "Team", unique: false, description: "Team effects.", partners: [{ ...partners[0].champion, id: 2, rarities: [7] }] }]
    const links = buildRosterKitDetails(entries, [], undefined, cards).groups["GAIN:Amplify"][0].synergies[0].links
    expect(links).toHaveLength(1)
    expect(links[0].conditions).toEqual(["Gain Amplify.", "While Blocking, gain Amplify."])
    const unlinked = buildRosterKitDetails(entries, []).groups["GAIN:Amplify"][0].synergies[0].links
    expect(unlinked).toHaveLength(2)
    expect(unlinked.map(link => link.rarities)).toEqual([[6, 7], [7]])
    expect(buildRosterKitDetails(entries, [], 5).groups).toEqual({})
  })

  it("combines identical owner-rarity variants when the catalog contains multiple matching synergy cards", () => {
    const partners = [{ champion: { name: "Ally", slug: "ally", images: null } }]
    const entries = ["2★", "3★", "4★", "5★", "6★/7★"].map((stars, index) => link(index + 1,
      `Synergy: Team (${stars}) with Ally (7★): Gain Amplify.`, {
        synergyChampions: partners, overviewSummary: "Gain Amplify.",
      }))
    const before = structuredClone(entries)
    const cards = ["low", "high"].map(id => ({ id, name: "Team", unique: false, description: "Team effects.", partners: [{ ...partners[0].champion, id: 2, rarities: [7] }] }))
    const links = buildRosterKitDetails(entries, [], undefined, cards).groups["GAIN:Amplify"][0].synergies[0].links
    expect(links).toHaveLength(1)
    expect(links[0]).toMatchObject({ conditions: ["Gain Amplify."], rarities: [2, 3, 4, 5, 6, 7] })
    expect(links[0].synergyId).toBeUndefined()
    expect(entries).toEqual(before)
  })

  it("retains differing source mechanics even when their value-free reviewed summaries are identical", () => {
    const partners = [{ champion: { name: "Ally", slug: "ally", images: null } }]
    const entries = [
      link(1, "Synergy: Team (6★) with Ally (7★): Gain 10% Amplify.", { synergyChampions: partners, overviewSummary: "Gain Amplify." }),
      link(2, "Synergy: Team (7★) with Ally (7★): Gain 20% Amplify.", { synergyChampions: partners, overviewSummary: "Gain Amplify." }),
    ]
    const links = buildRosterKitDetails(entries, []).groups["GAIN:Amplify"][0].synergies[0].links
    expect(links).toHaveLength(2)
    expect(links.map(link => link.rarities)).toEqual([[6], [7]])
    expect(buildRosterKitDetails(entries, [], 6).groups["GAIN:Amplify"][0].synergies[0].links).toHaveLength(1)
  })
})
