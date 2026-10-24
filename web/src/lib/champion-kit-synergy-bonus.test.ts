import { describe, expect, it } from "vitest"
import { buildRosterKitDetails } from "./roster-kit-details"
import type { RosterKitLink } from "./roster-kit"
import type { ChampionSynergyCard } from "./champion-synergies"

const partners = [
  { id: 1, name: "Adam Warlock", slug: "adam-warlock", images: null, rarities: [2, 3, 4, 5, 6, 7] },
  { id: 2, name: "Chee'Ilth", slug: "chee-ilth", images: null, rarities: [2, 3, 4, 5, 6, 7] },
  { id: 3, name: "The Serpent", slug: "the-serpent", images: null, rarities: [2, 3, 4, 5, 6, 7] },
]
const criticalSummary = "With Adam Warlock, Chee'Ilth or The Serpent, Critical Hits inflict temporary Direct Damage Bleed, its duration scaling with Okoye's Critical Damage Multiplier and extended by this non-stacking synergy; Immunity preventing Bleed or Shock refreshes both Debuffs on the opponent."
const specialSummary = "With Adam Warlock, Chee'Ilth or The Serpent, SP2 hits inflict temporary Direct Damage Bleed, extra on Critical Hits, with duration scaling with Okoye's Critical Damage Multiplier and extended by this non-stacking synergy; Immunity preventing Bleed or Shock refreshes both Debuffs on the opponent."

function fixture() {
  const link = (id: number, source: string, overviewSummary: string, synergy = false): RosterKitLink => ({
    id, type: "ABILITY", source, overviewSummary, effectForm: "DEBUFF", effectDirection: "INFLICT",
    ability: { name: "Bleed", iconUrl: null, gameGlossaryTermId: null, description: null, gameGlossaryTerm: null, categories: [] },
    synergyChampions: synergy ? partners.map(champion => ({ champion })) : [],
  })
  const header = "Synergy: WEAPON & WARFARE WISDOM (4★/5★/6★/7★) with Adam Warlock (2★/3★/4★/5★/6★/7★) OR Chee'Ilth (2★/3★/4★/5★/6★/7★) OR The Serpent (2★/3★/4★/5★/6★/7★); does not stack: "
  const entries = [
    link(18254, "Critical Hits inflict Bleed.", "Critical Hits inflict temporary Bleed; Immunity preventing Bleed or Shock refreshes both Debuffs."),
    link(18255, "SP2 each hit inflicts Bleed, extra on Critical Hits.", "Each SP2 hit inflicts Bleed, with additional Bleed on Critical Hits."),
    link(24100, header + "Critical Hits inflict Bleed. Okoye receives 15% increased Debuff duration.", criticalSummary, true),
    link(24101, header + "SP2 each hit inflicts Bleed, extra on Critical Hits. Okoye receives 15% increased Debuff duration.", specialSummary, true),
  ]
  const cards: ChampionSynergyCard[] = [{ id: "oky_02", name: "WEAPON & WARFARE WISDOM", unique: true, rarities: [4, 5, 6, 7], partners,
    description: "[64acff]Okoye:[-] Once per fight when Okoye’s Block is broken by an Unblockable attack, inflict a Weakness Debuff reducing Attack Rating by 85% for 10 (15) seconds.\n[64acff]Synergy Champions:[-] 15% increased Debuff duration.\n[f79f0e]Unique Synergy:[-] Does not stack with duplicate synergies." }]
  const records = [
    { id: 85519, group: "base", title: "Debuffs and Critical Damage Multiplier", template: { raw: "Critical Hits inflict a Bleed and Shock Debuff." } },
    { id: 85531, group: "special2", title: "Always Active", template: { raw: "Critical Hits inflict additional Bleed. Non-Critical Hits inflict Bleed." } },
  ]
  return { entries, cards, records }
}

function build(input = fixture()) {
  return buildRosterKitDetails(input.entries, input.records, 7, input.cards, { championName: "Okoye", sigLevel: 40 })
}

describe("recorded synergy duration bonuses", () => {
  it("shows Okoye's shared catalog bonus once while preserving both native applications and original summaries", () => {
    const input = fixture()
    const original = structuredClone(input)
    const details = build(input)
    const group = details.groups["INFLICT:Bleed"][0]
    expect(group.synergies[0].links[0].bonus).toEqual({
      text: "15% increased Debuff duration.", nonStacking: true,
      sources: [
        { label: "Critical Hits", target: { recordId: "85519", chapter: "base", title: "Debuffs and Critical Damage Multiplier" } },
        { label: "Special 2", target: { recordId: "85531", chapter: "special2", title: "Always Active" } },
      ],
    })
    expect(group.nativeSources.map(source => source.target?.recordId)).toEqual(["85519", "85531"])
    expect(group.synergies[0].links[0].conditions).toEqual([criticalSummary, specialSummary])
    expect(details.entries).toEqual(input.entries)
    expect(input).toEqual(original)
  })

  it("keeps the complete awakened condition and alternative from the recorded recipient's bonus", () => {
    const input = fixture()
    input.cards[0].description = "[64acff]Okoye:[-] If Awakened, gain 15% increased Debuff duration. Otherwise, gain Level 1 of Okoye’s Signature Ability.\n[64acff]Shuri:[-] 25% increased Debuff duration."
    const bonus = build(input).groups["INFLICT:Bleed"][0].synergies[0].links[0].bonus
    expect(bonus?.text).toBe("If Awakened, gain 15% increased Debuff duration. Otherwise, gain Level 1 of Okoye’s Signature Ability.")
    expect(bonus?.text).not.toContain("25%")
  })

  it.each(["catalog-drift", "source-drift", "other-recipient", "missing-native-trigger", "same-trigger", "buff-form", "gain-direction", "unresolved-catalog"])(
    "retains the original detailed conditions for %s", change => {
      const input = fixture()
      if (change === "catalog-drift") input.cards[0].description = input.cards[0].description.replace("15% increased", "20% increased")
      if (change === "source-drift") input.entries[3].source = input.entries[3].source!.replace("15% increased", "20% increased")
      if (change === "other-recipient") input.cards[0].description = "[64acff]Shuri:[-] 15% increased Debuff duration."
      if (change === "missing-native-trigger") input.entries.splice(1, 1)
      if (change === "same-trigger") input.entries[3].source = input.entries[2].source
      if (change === "buff-form") input.entries.forEach(entry => { entry.effectForm = "BUFF" })
      if (change === "gain-direction") input.entries.forEach(entry => { entry.effectDirection = "GAIN" })
      if (change === "unresolved-catalog") input.cards[0].description = "[64acff]Synergy Champions:[-] {1}% increased Debuff duration."
      const group = build(input).groups[change === "gain-direction" ? "GAIN:Bleed" : "INFLICT:Bleed"][0]
      expect(group.synergies[0].links[0].bonus).toBeUndefined()
      expect(group.synergies[0].links[0].conditions).toEqual([criticalSummary, specialSummary])
    })
})
