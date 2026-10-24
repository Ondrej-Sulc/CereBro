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

  it("shows identical Punisher Bleed synergy variants once per application, retaining partner rarities", () => {
    const partner = { id: 2, name: "Punisher 2099", slug: "punisher-2099", images: null }
    const variants = [[2], [3], [4], [5], [6, 7]]
    const applications = [
      { form: "DEBUFF" as const, raw: "+25% Fury and Bleed Ability Accuracy. Critical Hits: inflict {1} Bleed for {2} seconds.", summary: "Cross Training increases Critical Hit Bleed Ability Accuracy." },
      { form: "PASSIVE" as const, raw: "+25% Fury and Bleed Ability Accuracy. Signature: inflict {1} Bleed when an enemy Bleed Debuff expires.", summary: "Cross Training increases signature Bleed Ability Accuracy." },
    ]
    const entries = variants.flatMap((rarities, index) => applications.map((application, offset) => link(index * 2 + offset,
      `Synergy: CROSS TRAINING (2★/3★/4★/5★/6★/7★) with Punisher 2099 (${rarities.map(r => `${r}★`).join("/")}); does not stack: ${application.raw}`, {
        ability: { ...link(0, null).ability, name: "Bleed" }, effectForm: application.form, effectDirection: "INFLICT",
        synergyChampions: [{ champion: partner }], overviewSummary: application.summary,
      })))
    const cards = variants.map((rarities, index) => ({ id: `pn2099_${index}`, name: "Cross Training", unique: true,
      description: "+25% Fury and Bleed Ability Accuracy.", rarities: [2, 3, 4, 5, 6, 7], partners: [{ ...partner, rarities }] }))
    const original = structuredClone(entries)

    for (const rarity of [undefined, 6]) {
      const groups = buildRosterKitDetails(entries, [], rarity, cards).groups["INFLICT:Bleed"]
      expect(groups).toHaveLength(2)
      groups.forEach((group, index) => {
        expect(group.synergies).toHaveLength(1)
        expect(group.synergies[0]).toMatchObject({ champions: [partner], partnerRarities: [2, 3, 4, 5, 6, 7],
          links: [{ conditions: [applications[index].summary], rarities: [2, 3, 4, 5, 6, 7] }] })
        expect(group.synergies[0].links[0].synergyId).toBeUndefined()
      })
    }
    expect(entries).toEqual(original)
  })

  it("keeps partner rarity variants separate when mechanics or owner availability differ", () => {
    const partner = { name: "Ally", slug: "ally", images: null }
    const entries = [
      link(1, "Synergy: Team (6★) with Ally (6★): Gain 10% Amplify.", { synergyChampions: [{ champion: partner }], overviewSummary: "Gain Amplify." }),
      link(2, "Synergy: Team (6★) with Ally (7★): Gain 20% Amplify.", { synergyChampions: [{ champion: partner }], overviewSummary: "Gain Amplify." }),
      link(3, "Synergy: Team (7★) with Ally (5★): Gain 10% Amplify.", { synergyChampions: [{ champion: partner }], overviewSummary: "Gain Amplify." }),
    ]
    expect(buildRosterKitDetails(entries, []).groups["GAIN:Amplify"][0].synergies).toHaveLength(3)
  })

  it("does not broaden correlated requirements for multiple partners", () => {
    const partners = ["Ally", "Other"].map(name => ({ champion: { name, slug: name.toLowerCase(), images: null } }))
    const entries = [
      link(1, "Synergy: Team (7★) with Ally (6★), Other (7★): Gain Amplify.", { synergyChampions: partners }),
      link(2, "Synergy: Team (7★) with Ally (7★), Other (6★): Gain Amplify.", { synergyChampions: partners }),
    ]
    expect(buildRosterKitDetails(entries, []).groups["GAIN:Amplify"][0].synergies).toHaveLength(2)
  })

  it("keeps differing catalog bonuses separate behind identical recorded templates and summaries", () => {
    const partner = { id: 2, name: "Ally", slug: "ally", images: null }
    const entries = [6, 7].map(rarity => link(rarity, `Synergy: Team (7★) with Ally (${rarity}★): Gain {1}% Amplify.`, {
      synergyChampions: [{ champion: partner }], overviewSummary: "Gain Amplify.",
    }))
    const cards = [6, 7].map((rarity, index) => ({ id: `team_${rarity}`, name: "Team", unique: false,
      description: `Gain ${10 + index * 10}% Amplify.`, partners: [{ ...partner, rarities: [rarity] }] }))
    const rows = buildRosterKitDetails(entries, [], 7, cards).groups["GAIN:Amplify"][0].synergies
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.links[0].synergyId)).toEqual(["team_6", "team_7"])
  })

  it("only merges complete equivalent source rows, preserving application-specific availability", () => {
    const partner = { id: 2, name: "Ally", slug: "ally", images: null }
    const entries = [
      link(1, "Synergy: Team (7★) with Ally (6★): Gain Amplify when attacking.", { synergyChampions: [{ champion: partner }] }),
      link(2, "Synergy: Team (7★) with Ally (6★): Gain Amplify when blocking.", { synergyChampions: [{ champion: partner }] }),
      link(3, "Synergy: Team (7★) with Ally (7★): Gain Amplify when attacking.", { synergyChampions: [{ champion: partner }] }),
    ]
    const cards = [6, 7].map(rarity => ({ id: `team_${rarity}`, name: "Team", unique: false,
      description: "Team effects.", partners: [{ ...partner, rarities: [rarity] }] }))
    const rows = buildRosterKitDetails(entries, [], 7, cards).groups["GAIN:Amplify"][0].synergies
    expect(rows).toHaveLength(2)
    expect(rows.map(row => row.links[0].conditions.length)).toEqual([2, 1])
  })
})
