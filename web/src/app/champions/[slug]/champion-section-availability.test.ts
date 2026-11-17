import { describe, expect, it } from "vitest"
import { prepareChampionAbilityTextView } from "@/lib/champion-ability-text"
import type { ChampionDetailsView } from "./champion-details-types"
import { getChampionSectionAvailability } from "./champion-section-availability"

const view: ChampionDetailsView = {
  champion: { id: 1, name: "Legacy", shortName: "Legacy", slug: "legacy", gameId: "legacy", isPlayable: false, class: "SCIENCE", images: {}, gameSynergies: [], tags: [], abilities: [], abilityTexts: [], abilityCurves: [], attacks: [], stats: [], prestigeData: [], duels: [] },
  portraitUrl: "", heroUrl: "", secondaryUrl: "", accent: "#fff", selectedStat: undefined,
  selectedRarity: "", selectedRank: "", rarityOptions: [], rankOptions: [], sigLevel: 200, maxSig: 200, ascensionLevel: 0,
  prestige: null, health: null, attack: null, maxStats: {}, abilities: [], immunities: [], glossaryById: new Map(),
  descriptionView: prepareChampionAbilityTextView({ records: [] }),
  setRarity() {}, setRank() {}, setSigLevel() {}, setAscensionLevel() {},
}

describe("champion sections follow recorded content", () => {
  it("offers no empty sections for an identity-only NPC", () => {
    expect(getChampionSectionAvailability(view).sections).toEqual([])
    const empty = prepareChampionAbilityTextView({ records: [{ id: 1, group: "base", title: null, template: { raw: "   " } }] })
    expect(getChampionSectionAvailability({ ...view, descriptionView: empty }).sections).toEqual([])
  })
  it("keeps full native text and biography without requiring curated effects or collectible builds", () => {
    const descriptions = prepareChampionAbilityTextView({ records: [{ id: 2, group: "base", title: "Abilities", template: { raw: "Gain Fury." } }] })
    expect(getChampionSectionAvailability({ ...view, descriptionView: descriptions }).sections).toEqual([{ value: "abilities", label: "Full abilities" }])
    const biography = prepareChampionAbilityTextView({ records: [{ id: 3, group: "bio", title: null, template: { raw: "A forgotten defender." } }] })
    expect(getChampionSectionAvailability({ ...view, descriptionView: biography }).sections).toEqual([{ value: "abilities", label: "Biography" }])
  })
  it("retains useful overview details and does not infer encounters from a game ID", () => {
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, hasQuestEncounters: true } }).sections).toEqual([{ value: "overview", label: "Overview" }])
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, tags: [{ id: 1, name: "Boss", category: null }] } }).sections).toEqual([{ value: "overview", label: "Overview" }])
  })
  it("distinguishes attacks-only data from empty move shells", () => {
    const attack = { id: 1, type: "L1" as const, hits: [{ id: 1, properties: [] }] }
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, attacks: [attack] } }).sections).toEqual([{ value: "stats", label: "Attacks" }])
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, attacks: [{ ...attack, hits: [] }] } }).sections).toEqual([])
  })
  it("hides non-applicable acquisition while retaining recorded playable sources", () => {
    const availability = { observedAt: "2026-11-17T00:00:00Z", crystals: [], otherCounts: { "7": 1 } }
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, crystalAvailability: availability } }).sections).toEqual([])
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, isPlayable: true, crystalAvailability: availability } }).sections).toEqual([{ value: "crystals", label: "How to obtain" }])
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, isPlayable: true, crystalAvailability: { ...availability, otherCounts: { "7": 0 } } } }).sections).toEqual([])
  })
  it("uses valid enabled synergies across recorded rarities rather than raw row count", () => {
    const synergy = { id: "source", name: "Team", description: "Gain Fury.", enabled: true, unique: false, requiredHeroGroups: false,
      members: [{ role: "OWNER" as const, rarity: 6, champion: { id: 1, name: "Legacy", slug: "legacy", images: {} } }, { role: "REQUIRED" as const, rarity: 6, champion: { id: 2, name: "Partner", slug: "partner", images: {} } }] }
    expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, gameSynergies: [synergy] } }).sections).toEqual([{ value: "synergies", label: "Synergies" }])
    for (const row of [{ ...synergy, enabled: false }, { ...synergy, requiredHeroGroups: true }, { ...synergy, members: [synergy.members[0]] }]) {
      expect(getChampionSectionAvailability({ ...view, champion: { ...view.champion, gameSynergies: [row] } }).sections).toEqual([])
    }
  })
})
