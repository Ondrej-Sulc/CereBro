import { describe, expect, it } from "vitest"
import { buildChampionKitEffects, buildChampionKitOverviewEffects, filterChampionKitEffects, findChampionKitAbilityTarget, getChampionKitSourceTags, groupChampionKitAbilitiesByDirection, groupChampionKitSources, summarizeChampionKitSource } from "./champion-kit"
import { prepareChampionAbilityTextView } from "./champion-ability-text"

const ability = { name: "Fury", iconUrl: null, gameGlossaryTermId: "fury", categories: [] }
const partner = { name: "Havok", slug: "havok", images: null }

describe("champion kit overview", () => {
  it("groups abilities by each source's recorded direction, keeping mixed effects in both sections and immunities separate", () => {
    const effects = buildChampionKitOverviewEffects([
      { id: 1, type: "ABILITY", source: "SP1", effectForm: "DEBUFF", effectDirection: "GAIN", ability, synergyChampions: [] },
      { id: 2, type: "ABILITY", source: "Synergy", effectForm: "BUFF", effectDirection: "INFLICT", ability, synergyChampions: [{ champion: partner }] },
      { id: 3, type: "ABILITY", source: "Always active", effectForm: "PASSIVE", effectDirection: "UNKNOWN", ability, synergyChampions: [] },
      { id: 4, type: "IMMUNITY", source: null, ability, synergyChampions: [] },
    ], new Map())
    const original = structuredClone(effects)
    const sections = groupChampionKitAbilitiesByDirection(effects)
    expect(sections.map(section => section.direction)).toEqual(["GAIN", "INFLICT", "UNKNOWN"])
    expect(sections.map(section => section.effects.map(effect => effect.name))).toEqual([["Fury"], ["Fury"], ["Fury"]])
    expect(sections.map(section => section.effects[0].sources)).toEqual([
      [effects[0].sources[0]], [effects[0].sources[1]], [effects[0].sources[2]],
    ])
    expect(sections[1].effects[0].sources[0].champions).toEqual([partner])
    expect(effects).toEqual(original)
    expect(groupChampionKitAbilitiesByDirection([effects[1]])).toEqual([])
    expect(groupChampionKitAbilitiesByDirection(sections[0].effects).map(section => section.direction)).toEqual(["GAIN"])
  })

  it("summarizes the primary trigger without collecting mechanics or modifiers from the rest of the source", () => {
    expect(summarizeChampionKitSource("Charging Heavy (legacy trigger retained): if struck while active, Unstoppable goes on cooldown for {2} seconds; signature reduces cooldown. Shared text:79813 pauses Buffs. SP2 pauses Buffs until {1} hits.")).toBe("Charging Heavy")
    expect(summarizeChampionKitSource("SP2 first hit grants non-stacking +{1} Cruelty for 20 seconds. Signature modifies this effect.")).toBe("Special 2")
    expect(summarizeChampionKitSource("Signature ability: Light and Medium Intercepts inflict an additional Shock with +{1}% Ability Accuracy.")).toBe("Signature ability")
  })

  it("uses short source labels instead of returning any of the detailed prose or missing values", () => {
    expect(summarizeChampionKitSource("Light and Medium Attacks: 40% chance to inflict {1} Energy Damage over 20 seconds.")).toBe("Light & Medium attacks")
    expect(summarizeChampionKitSource("While charging a Heavy Attack, gain {1}% Attack (text:123).")).toBe("Charging Heavy")
    expect(summarizeChampionKitSource("Heavy final hit inflicts a non-stacking {1}% Disorient for 20 seconds.")).toBe("Heavy attacks")
    expect(summarizeChampionKitSource("SP1 and SP2 grant a Fury for {2} seconds.")).toBe("Special 1 & 2")
    expect(summarizeChampionKitSource("While the Opponent has a Buff, gain {1} Energy Resistance.")).toBe("Opponent has Buffs")
    expect(summarizeChampionKitSource("When either champion Intercepts or Punishes a Special, gain 5% Amplify.")).toBe("Either champion intercepts / punishes")
    expect(summarizeChampionKitSource("While Agatha is inside Rune Prison, gain an additional Amplify.")).toBe("Inside Rune Prison")
    expect(summarizeChampionKitSource("While opponent is inside Rune Prison, inflict 20% Atrophy.")).toBe("Opponent in Rune Prison")
    expect(summarizeChampionKitSource("Reduce Critical Damage Rating by {1}% (value unresolved; text:456).")).toBe("Base kit")
    expect(summarizeChampionKitSource("")).toBe("Base kit")
  })

  it("selects only the explicit synergy variant for the current champion rarity and retains unrecorded requirements", () => {
    const links = [5, 6, 7].map(rarity => ({ id: rarity, type: "ABILITY" as const,
      source: `Synergy: THE GOVERNESS (${rarity}★) with Havok (2★/3★/4★/5★/6★/7★); does not stack: Gain Block Proficiency.`,
      ability, synergyChampions: [{ champion: partner }],
    }))
    const legacy = { ...links[0], id: 10, source: "Synergy" }
    expect(buildChampionKitOverviewEffects([...links, legacy], new Map(), 7)[0].sources.map(source => source.rawLabel)).toEqual([links[2].source, "Synergy"])
    expect(buildChampionKitOverviewEffects(links, new Map(), 6)[0].sources[0].rawLabel).toBe(links[1].source)
    expect(buildChampionKitOverviewEffects(links, new Map(), 4)).toEqual([])
    expect(buildChampionKitOverviewEffects(links, new Map())[0].sources).toHaveLength(3)
    // The partner's star levels do not decide whether this champion can bring the synergy.
    expect(buildChampionKitOverviewEffects([{ ...links[2], source: "Synergy: EXAMPLE (7★) with Havok (3★): Gain Fury." }], new Map(), 7)).toHaveLength(1)
  })

  it("keeps synergy-only effects and their partners, showing a short synergy source instead of its full prose", () => {
    const links = [
      { id: 1, type: "ABILITY" as const, source: "Charging Heavy: gain Unstoppable for {2} seconds.", ability: { ...ability, name: "Unstoppable" }, synergyChampions: [] },
      { id: 2, type: "ABILITY" as const, source: "Synergy: WHY THE BONG FACE? with Doctor Bong: Personal Unstoppable becomes Unstoppabong.", ability: { ...ability, name: "Unstoppabong" }, synergyChampions: [{ champion: partner }] },
      { id: 3, type: "ABILITY" as const, source: "Heavy attack gains additional Fury.", ability, synergyChampions: [{ champion: partner }] },
      { id: 4, type: "IMMUNITY" as const, source: "Synergy: A teammate grants this immunity.", ability, synergyChampions: [] },
    ]
    const effects = buildChampionKitOverviewEffects(links, new Map())
    expect(effects.map(effect => effect.name)).toEqual(["Unstoppable", "Unstoppabong", "Fury", "Fury"])
    expect(effects[0].sources).toMatchObject([{ label: "Charging Heavy" }])
    expect(effects[1].sources).toMatchObject([{ label: "Synergy", champions: [partner] }])
    expect(effects[2].sources).toMatchObject([{ label: "Synergy", champions: [partner] }])
    expect(effects[3].sources).toMatchObject([{ label: "Synergy", champions: [] }])
    expect(links[0].source).toContain("{2}")
    expect(buildChampionKitEffects(links, new Map())).toHaveLength(4)
  })

  it("keeps distinct sources separate even when they have the same short label", () => {
    const [effect] = buildChampionKitOverviewEffects([
      { id: 1, type: "ABILITY", source: "SP1 grants {1} Fury (text:10).", effectForm: "BUFF", effectDirection: "GAIN", ability, synergyChampions: [] },
      { id: 2, type: "ABILITY", source: "SP1 grants another Fury (text:11).", effectForm: "BUFF", effectDirection: "GAIN", ability, synergyChampions: [] },
      { id: 3, type: "ABILITY", source: "SP1 inflicts a Fury on the Opponent.", effectForm: "BUFF", effectDirection: "INFLICT", ability, synergyChampions: [] },
      { id: 4, type: "ABILITY", source: "SP1 gains a Passive Fury.", effectForm: "PASSIVE", effectDirection: "GAIN", ability, synergyChampions: [] },
    ], new Map())
    expect(effect.sources).toHaveLength(4)
    expect(effect.sources[0].rawLabel).not.toBe(effect.sources[1].rawLabel)
    expect(effect.sources.every(source => source.label === "Special 1")).toBe(true)
    expect(filterChampionKitEffects([effect], { effectForm: "BUFF", effectDirection: "INFLICT" })[0].sources).toHaveLength(1)
    expect(filterChampionKitEffects([effect], { effectForm: "PASSIVE", effectDirection: "INFLICT" })).toEqual([])
  })

  it("cleans explicit metadata out of the condition without losing forms or targets", () => {
    const [effect] = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: "Passive, When the Opponent gains Buffs", ability, synergyChampions: [] },
      { id: 2, type: "ABILITY", source: "Passive", ability, synergyChampions: [] },
    ], new Map())
    expect(effect.sources).toMatchObject([
      { label: "When the Opponent gains Buffs", effectForm: "PASSIVE", effectDirection: "UNKNOWN" },
      { label: "", effectForm: "PASSIVE", effectDirection: "UNKNOWN" },
    ])
  })

  it("filters both dimensions on the same source and keeps different applications separate", () => {
    const effects = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: "SP1", effectForm: "PASSIVE", effectDirection: "GAIN", ability, synergyChampions: [] },
      { id: 2, type: "ABILITY", source: "SP1", effectForm: "DEBUFF", effectDirection: "INFLICT", ability, synergyChampions: [] },
      { id: 3, type: "ABILITY", source: "SP1", effectForm: "PASSIVE", effectDirection: "GAIN", ability, synergyChampions: [] },
    ], new Map())
    expect(effects[0].sources).toHaveLength(2)
    expect(filterChampionKitEffects(effects, { effectForm: "PASSIVE", effectDirection: "INFLICT" })).toEqual([])
    expect(filterChampionKitEffects(effects, { effectForm: "DEBUFF", effectDirection: "INFLICT" })[0].sources).toMatchObject([{ effectForm: "DEBUFF", effectDirection: "INFLICT" }])
    expect(filterChampionKitEffects(effects, { effectForm: "ALL", effectDirection: "GAIN" })[0].sources).toHaveLength(1)
  })

  it("keeps unclassified and immunity sources honest", () => {
    const effects = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: null, ability, synergyChampions: [] },
      { id: 2, type: "IMMUNITY", source: "While the Opponent has a Buff", ability, synergyChampions: [] },
    ], new Map())
    expect(filterChampionKitEffects(effects, { effectForm: "BUFF", effectDirection: "ALL" })).toEqual([])
    expect(filterChampionKitEffects(effects, { effectForm: "UNKNOWN", effectDirection: "UNKNOWN" })).toHaveLength(2)
  })

  it("keeps the base and synergy conditions of the same effect visible separately", () => {
    const effects = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: "Heavy Attacks", ability, synergyChampions: [] },
      { id: 2, type: "ABILITY", source: "While charging a Heavy Attack", ability, synergyChampions: [{ champion: partner }] },
    ], new Map())
    expect(effects).toHaveLength(1)
    expect(effects[0].sources).toMatchObject([
      { label: "Heavy Attacks", champions: [] },
      { label: "While charging a Heavy Attack", champions: [partner] },
    ])
  })

  it("preserves a required teammate even when a source label is missing", () => {
    const [effect] = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: null, ability, synergyChampions: [{ champion: partner }] },
    ], new Map())
    expect(effect.sources).toMatchObject([{ label: "Synergy", champions: [partner] }])
  })

  it("can use an imported glossary effect when the curated link lacks a glossary ID", () => {
    const [effect] = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: "Passive", ability: { ...ability, gameGlossaryTermId: null }, synergyChampions: [] },
    ], new Map([["fury", { description: "Increases Attack Rating.", iconUrl: "fury.svg", raw: { color_primary: "fc9335" } }]]))
    expect(effect).toMatchObject({ color: "#fc9335", iconUrl: "fury.svg", description: "Increases Attack Rating." })
  })

  it("uses the imported effect colors and definition without making them the source", () => {
    const [effect] = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: "SPECIAL_ATTACK_2", ability, synergyChampions: [] },
    ], new Map([["fury", { description: "Increases Attack Rating.", raw: { color_primary: "FF9F43FF", color_secondary: "653919" } }]]))
    expect(effect).toMatchObject({ color: "#FF9F43", secondaryColor: "#653919", description: "Increases Attack Rating.", sources: [{ label: "Special Attack 2", champions: [] }] })
  })

  it("does not merge separate teammate requirements that share a source label", () => {
    const other = { name: "Ghost", slug: "ghost", images: null }
    const [effect] = buildChampionKitEffects([
      { id: 1, type: "ABILITY", source: "Synergy", ability, synergyChampions: [{ champion: partner }] },
      { id: 2, type: "ABILITY", source: "Synergy", ability, synergyChampions: [{ champion: other }] },
      { id: 3, type: "ABILITY", source: "Synergy", ability, synergyChampions: [{ champion: partner }] },
    ], new Map())
    expect(effect.sources).toHaveLength(2)
    expect(effect.sources.map(source => source.champions.map(champion => champion.name))).toEqual([["Havok"], ["Ghost"]])
  })
})

describe("grouped overview sources", () => {
  const view = prepareChampionAbilityTextView({ records: [
    { id: 30, group: "base", title: "Amplify", template: { raw: "When either Champion Intercepts or Punishes a Special Attack, gain an Amplify Passive." } },
    { id: 31, group: "base", title: "Rune Prison", template: { raw: "While Agatha is inside Rune Prison, she gains an additional Amplify Passive." } },
  ] })
  const source = (id: number, text: string) => ({ id, type: "ABILITY" as const, source: text,
    effectForm: "PASSIVE" as const, effectDirection: "GAIN" as const,
    ability: { ...ability, name: "Amplify" }, synergyChampions: [],
  })

  it("uses a reviewed overview summary while preserving detailed text and ability navigation", () => {
    const raw = "While Agatha is inside Rune Prison, gain an additional {1}% Amplify per active personal Amplify."
    const summary = "Inside Rune Prison, each personal Amplify grants additional Amplify."
    const [effect] = buildChampionKitOverviewEffects([{ ...source(1, raw), overviewSummary: summary }], new Map())
    expect(effect.sources[0].rawLabel).toBe(raw)
    expect(groupChampionKitSources(effect, view)[0].nativeSources[0]).toMatchObject({ condition: summary, label: "Inside Rune Prison", target: { recordId: "31" } })
  })

  it("uses reviewed synergy summaries without losing rarity requirements or distinct summaries at one destination", () => {
    const links = ["Gain Amplify when attacking.", "Gain Amplify when blocking."].map((summary, index) => ({
      ...source(index + 1, `Synergy: MENTOR (7★) with Havok (7★); does not stack: Detailed application ${index}.`),
      overviewSummary: summary, synergyChampions: [{ champion: partner }],
    }))
    expect(buildChampionKitOverviewEffects(links, new Map(), 6)).toEqual([])
    const [effect] = buildChampionKitOverviewEffects(links, new Map(), 7)
    const cards = [{ id: "mentor_7", name: "MENTOR", description: "Team effects.", unique: true, partners: [{ ...partner, id: 2, rarities: [7] }] }]
    expect(groupChampionKitSources(effect, view, cards)[0].synergies[0].links).toMatchObject([
      { synergyId: "mentor_7", conditions: ["Gain Amplify when attacking.", "Gain Amplify when blocking."] },
    ])
  })

  it("shares metadata across distinct named links and a separate synergy partner row", () => {
    const [effect] = buildChampionKitOverviewEffects([
      source(1, "When either champion Intercepts or Punishes a Special, gain Amplify."),
      source(2, "While Agatha is inside Rune Prison, gain Amplify."),
      { ...source(3, "Synergy: MENTOR (7★) with Havok (7★); does not stack: Gain Amplify."), synergyChampions: [{ champion: partner }] },
    ], new Map(), 7)
    const groups = groupChampionKitSources(effect, view)
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ effectForm: "PASSIVE", effectDirection: "GAIN" })
    expect(groups[0].nativeSources.map(link => [link.label, link.target?.recordId])).toEqual([
      ["Either champion intercepts / punishes", "30"], ["Inside Rune Prison", "31"],
    ])
    expect(groups[0].synergies).toHaveLength(1)
    expect(groups[0].synergies[0]).toMatchObject({ champions: [partner], links: [{ label: "Mentor" }] })
    expect(effect.sources).toHaveLength(3)
  })

  it("exposes complete usable native conditions separately from the short navigation labels", () => {
    const condition = "While Agatha is inside Rune Prison, gain additional Amplify per active personal Amplify; this does not refresh its duration."
    const input = source(1, `Passive, Gains, ${condition}`)
    const [effect] = buildChampionKitOverviewEffects([input], new Map())
    const [group] = groupChampionKitSources(effect, view)
    expect(group.nativeSources).toMatchObject([{ label: "Inside Rune Prison", condition, target: { recordId: "31" } }])
    expect(input.source).toBe(`Passive, Gains, ${condition}`)
  })

  it("leaves Agatha's unavailable SP3 conditions blank without guessing links to SP2", () => {
    const inputs = [
      { ...source(26306, "Legacy SP3 hits deal Energy Burst Damage; Empowered triggers through Block. Each Mystic Dispersion rank increases personal Energy Burst potency by {1}%. SP3 base potency, per-level total, Ability Power Rate multiplier/cap, Defender scaling, target direction and Empowered activation threshold/counter rules remain unresolved."), ability: { ...ability, name: "Burst Damage" } },
      { ...source(26308, "Legacy Empowered SP3: Energy Vulnerability lasts for the Special duration plus 6 seconds per Special level. Signature increases Agatha's Energy Vulnerability potency by {1}%. SP3 form, target direction, stacking, base potency, application timing and Empowered activation threshold/counter rules remain unresolved."), ability: { ...ability, name: "Energy Vulnerability" } },
    ].map(input => ({ ...input, effectForm: "UNKNOWN" as const, effectDirection: "UNKNOWN" as const, overviewSummary: null }))
    const original = structuredClone(inputs)
    const special2 = prepareChampionAbilityTextView({ records: [
      { id: 79148, group: "special2", title: "On activation", template: { raw: "Inflict Energy Vulnerability during this Special Attack." } },
    ] })
    const effects = buildChampionKitOverviewEffects(inputs, new Map())
    expect(effects.map(effect => effect.name)).toEqual(["Burst Damage", "Energy Vulnerability"])
    expect(effects.map(effect => groupChampionKitSources(effect, special2))).toEqual([[], []])
    expect(effects.map(effect => effect.sources[0].rawLabel)).toEqual(inputs.map(input => input.source))
    expect(inputs).toEqual(original)
  })

  it.each([
    "SP1 grants {1}% Amplify.",
    "SP1 grants Amplify (text:79135).",
    "Legacy SP1 grants Amplify.",
    "SP1 grants Amplify; potency remains unresolved.",
    "SP1 grants Amplify; value not recorded.",
    `SP1 grants Amplify. ${"Further detailed source mechanics. ".repeat(12)}`,
  ])("does not use unsuitable raw prose as an overview fallback (%s)", raw => {
    const [effect] = buildChampionKitOverviewEffects([source(1, raw)], new Map())
    expect(groupChampionKitSources(effect, view)).toEqual([])
    expect(effect.sources[0].rawLabel).toBe(raw.trim())
  })

  it("keeps synergy requirements and destinations when their raw condition is unsuitable", () => {
    const raw = "Synergy: MENTOR (7★) with Havok (7★); does not stack: Gain {1}% Amplify; value unresolved."
    const [effect] = buildChampionKitOverviewEffects([{ ...source(1, raw), synergyChampions: [{ champion: partner }] }], new Map(), 7)
    const cards = [{ id: "mentor_7", name: "MENTOR", description: "Team effects.", unique: true, partners: [{ ...partner, id: 2, rarities: [7] }] }]
    expect(groupChampionKitSources(effect, view, cards)[0].synergies).toMatchObject([
      { champions: [partner], links: [{ label: "Mentor", synergyId: "mentor_7", conditions: [] }] },
    ])
    expect(buildChampionKitOverviewEffects([{ ...source(1, raw), synergyChampions: [{ champion: partner }] }], new Map(), 6)).toEqual([])
  })

  it.each([null, "", "   ", "Passive"])("leaves absent source conditions blank even when a summary exists (%s)", raw => {
    const [effect] = buildChampionKitOverviewEffects([{ ...source(1, ""), source: raw,
      overviewSummary: "Agatha gains Amplify.",
    }], new Map())
    expect(effect.name).toBe("Amplify")
    expect(groupChampionKitSources(effect, view)).toEqual([])
  })

  it("preserves known conditions and synergy partners when other sources have no condition", () => {
    const [effect] = buildChampionKitOverviewEffects([
      { ...source(1, ""), source: null, overviewSummary: "Agatha gains Amplify." },
      source(2, "While Agatha is inside Rune Prison, gain Amplify."),
      { ...source(3, "Synergy"), overviewSummary: "Gain more Amplify.", synergyChampions: [{ champion: partner }] },
    ], new Map())
    const [group] = groupChampionKitSources(effect, view)
    expect(group.nativeSources).toMatchObject([{ condition: "While Agatha is inside Rune Prison, gain Amplify.", target: { recordId: "31" } }])
    expect(group.nativeSources).toHaveLength(1)
    expect(group.synergies[0]).toMatchObject({ champions: [partner], links: [{ conditions: [] }] })
  })

  it("does not combine different form/direction combinations or different source conditions sharing a destination", () => {
    const [effect] = buildChampionKitOverviewEffects([
      source(1, "When either champion Intercepts, gain Amplify."),
      source(2, "When either champion Punishes a Special, gain Amplify."),
      { ...source(3, "When either champion Intercepts, inflict Amplify."), effectDirection: "INFLICT" },
    ], new Map())
    const groups = groupChampionKitSources(effect, view)
    expect(groups).toHaveLength(2)
    expect(groups[0].nativeSources).toHaveLength(2)
    expect(groups[1].effectDirection).toBe("INFLICT")
  })

  it("links a source that grants an effect to its grant passage rather than a nearby pause modifier", () => {
    const prison = prepareChampionAbilityTextView({ records: [
      { id: 51, group: "base", title: "Amplify", template: { raw: "While either Champion is inside the Rune Prison, Agatha's Basic Attacks pause personal Amplifies for 0.5 seconds and deal a burst of Energy Damage, multiplied by Agatha's Ability Power Rate up to 200%." } },
      { id: 53, group: "base", title: "Energy Burst", template: { raw: "While Agatha is inside, her Buff duration is increased by 45%, and for each active personal Amplify, she gains an additional 45% Amplify Passive." } },
    ] })
    const [effect] = buildChampionKitOverviewEffects([source(1, "While Agatha is inside Rune Prison, gain an additional 5% Amplify per active personal Amplify.")], new Map())
    expect(groupChampionKitSources(effect, prison)[0].nativeSources[0].target?.recordId).toBe("53")
  })

  it("preserves opposite conditions even when punctuation is their only difference", () => {
    const [effect] = buildChampionKitOverviewEffects([
      source(1, "While Health < 50%, gain Amplify."), source(2, "While Health > 50%, gain Amplify."),
    ], new Map())
    expect(groupChampionKitSources(effect, view)[0].nativeSources).toHaveLength(2)
  })

  it("groups matching partner requirements while keeping distinct synergy links and partner combinations", () => {
    const withPartner = (id: number, name: string) => ({ ...source(id, `Synergy: ${name} (7★) with Havok (7★); does not stack: Gain Amplify.`), synergyChampions: [{ champion: partner }] })
    const other = { name: "Ghost", slug: "ghost", images: null }
    const [effect] = buildChampionKitOverviewEffects([
      withPartner(1, "MENTOR"), withPartner(2, "FRIENDS"),
      { ...source(3, "Synergy: MENTOR (7★) with Ghost (7★); does not stack: Gain Amplify."), synergyChampions: [{ champion: other }] },
    ], new Map(), 7)
    const [group] = groupChampionKitSources(effect, view)
    expect(group.synergies).toHaveLength(2)
    expect(group.synergies[0].links.map(link => link.label)).toEqual(["Mentor", "Friends"])
    expect(group.synergies[1].champions).toEqual([other])
  })

  it("reuses one synergy link only when its requirements and destination match", () => {
    const [effect] = buildChampionKitOverviewEffects([
      { ...source(1, "Synergy: MENTOR (7★) with Havok (7★); does not stack: Gain Amplify when attacking."), synergyChampions: [{ champion: partner }] },
      { ...source(2, "Synergy: MENTOR (7★) with Havok (7★); does not stack: Gain Amplify when blocking."), synergyChampions: [{ champion: partner }] },
    ], new Map(), 7)
    const cards = [{ id: "mentor_7", name: "MENTOR", description: "Gain Amplify when attacking or blocking.", unique: true,
      partners: [{ ...partner, id: 2, rarities: [7] }],
    }]
    const [group] = groupChampionKitSources(effect, view, cards)
    expect(group.synergies[0].links).toMatchObject([{ synergyId: "mentor_7" }])
    expect(group.synergies[0].links).toHaveLength(1)
    expect(group.synergies[0].links[0].conditions).toEqual(["Gain Amplify when attacking.", "Gain Amplify when blocking."])
    expect(effect.sources).toHaveLength(2)
    // Without a resolved destination, visually matching labels do not erase distinct source applications.
    expect(groupChampionKitSources(effect, view)[0].synergies[0].links).toHaveLength(2)
  })
})

describe("effect sources and ability navigation", () => {
  const view = prepareChampionAbilityTextView({ records: [
    { id: 10, group: "base", title: "Fury", template: { raw: "Fury increases Attack Rating." } },
    { id: 11, group: "base", title: "Heavy Attacks", template: { raw: "Gain a Fury for 10 seconds." } },
    { id: 12, group: "special2", title: "On activation", template: { raw: "Gain a Fury for 20 seconds." } },
    { id: 13, group: "signature", title: "Awakened", template: { raw: "Gain a Fury when awakened." } },
    { id: 14, group: "bio", title: "History", template: { raw: "Power Gain and Regeneration." } },
    { id: 15, group: "base", title: "Fury", template: { raw: "Increases Attack Rating." } },
    { id: 16, group: "base", title: "Power Steal", template: { raw: "The final hit Nullifies 1 Fury Buff and inflicts a Power Steal Passive, stealing 50% of a Bar over 5 seconds. Cooldown: 25 seconds." } },
    { id: 17, group: "base", title: "Mystic Webs", template: { raw: "When the Opponent gains Buffs, Pavitr Power Steals some of their Power. Does not trigger at 3 Bars of Power." } },
  ] })

  it("labels named sources without removing conditions or repeating special tags", () => {
    expect(getChampionKitSourceTags("Passive, SP2 → 15s; SP2 pauses it (Dupe)", false)).toEqual(["SP2", "Signature"])
    expect(getChampionKitSourceTags("Cancel Heavy with Special", true)).toEqual(["Synergy", "Heavy", "Special attacks"])
    expect(getChampionKitSourceTags("When the opponent gains Buffs", false)).toEqual([])
  })

  it("prefers the source's special attack over a general effect heading", () => {
    expect(findChampionKitAbilityTarget("Fury", "Special Attack 2", view)).toMatchObject({ recordId: "12", chapter: "special2" })
  })

  it("links Special 3 effects to explicitly shared Special 2 and 3 rules", () => {
    const shared = prepareChampionAbilityTextView({ records: [
      { id: 1, group: "base", title: "Energy Vulnerability", template: { raw: "Inflict Energy Vulnerability." } },
      { id: 2, group: "special2", title: null, template: { raw: "Inflict Energy Vulnerability.", display: { kind: "ability", section: { id: "ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_SPECIAL23", title: "Special Attacks 2 and 3" } } } },
    ] })
    expect(findChampionKitAbilityTarget("Energy Vulnerability", "SP3", shared)).toMatchObject({ recordId: "2", chapter: "special2", title: "Special Attacks 2 and 3" })
  })

  it("prefers a Heavy or Signature source when the effect occurs in several chapters", () => {
    expect(findChampionKitAbilityTarget("Fury", "Heavy Attack", view)?.recordId).toBe("11")
    expect(findChampionKitAbilityTarget("Fury", "Signature ability", view)?.recordId).toBe("13")
    expect(findChampionKitAbilityTarget("Fury", "Passive", view)?.recordId).toBe("10")
  })

  it("does not invent targets from the biography or a partial effect name", () => {
    expect(findChampionKitAbilityTarget("Power Gain", "Start fight", view)).toBeNull()
    expect(findChampionKitAbilityTarget("Fur", "Passive", view)).toBeNull()
    expect(findChampionKitAbilityTarget("", "Passive", view)).toBeNull()
  })

  it("skips standalone definitions and distinguishes different triggers for the same effect", () => {
    expect(findChampionKitAbilityTarget("Fury", "Passive", view)?.recordId).not.toBe("15")
    expect(findChampionKitAbilityTarget("Power Steal", "Passive, Heavy Attack → 50% of a Bar over 5 seconds, 25s Cooldown", view)?.recordId).toBe("16")
    expect(findChampionKitAbilityTarget("Power Steal", "Passive, When opponent gains Buffs & is below 3 Bars of Power", view)?.recordId).toBe("17")
    expect(findChampionKitAbilityTarget("Nullify", "Heavy Attack", view)?.recordId).toBe("16")
  })

  it("finds effect names inside nested game colors and glossary links", () => {
    const nested = prepareChampionAbilityTextView({ records: [{ id: 20, group: "special1", title: "On hit", template: {
      raw: "Apply Spider-Seals.", blocks: [{ type: "paragraph", children: [{ type: "color", color: "#ff0000", children: [{ type: "glossary", id: "spider_seal", label: "Spider-Seals" }] }] }],
    } }] })
    expect(findChampionKitAbilityTarget("Spider-Seal", "SP1", nested)?.recordId).toBe("20")
  })
})
