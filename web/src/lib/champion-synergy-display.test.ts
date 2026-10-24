import { describe, expect, it } from "vitest"
import { groupChampionSynergyCards, groupChampionSynergyFamilies } from "./champion-synergy-display"
import type { ChampionSynergyCard } from "./champion-synergies"

const partner = { id: 2, name: "Black Widow (Deadly Origin)", slug: "black-widow-deadly-origin", images: null }
const card = (id: string, stars: number[], championStars = [6]): ChampionSynergyCard => ({
  id, name: "IT'S COMPLICATED Lv. 3", description: "All Champions gain +60 Armor Rating & +3% [k=glossary/combat_power_rate]Combat Power Rate[/k].",
  unique: false, rarities: championStars, partners: [{ ...partner, rarities: stars }], champions: [partner],
})

describe("leveled synergy families", () => {
  it("keeps exact bonuses and star rules under a shared family, ordered numerically", () => {
    const first = { ...card("level-one", [2, 3]), name: "FRIENDS Lv. 1", description: "All Champions gain +70 Armor Rating." }
    const second = { ...card("level-two", [4]), name: "FRIENDS Lv. 2", description: "All Champions gain +95 Armor Rating." }
    const third = { ...card("level-three", [5, 6, 7]), name: "FRIENDS Lv. 3", description: "All Champions gain +130 Armor Rating." }
    const tenth = { ...card("level-ten", [7]), name: "FRIENDS Lv. 10", description: "All Champions gain +500 Armor Rating." }
    const cards = [tenth, third, first, second]
    const original = structuredClone(cards)
    const families = groupChampionSynergyFamilies(cards)
    expect(families).toHaveLength(1)
    expect(families[0]).toMatchObject({ name: "FRIENDS", id: "level-one" })
    expect(families[0].variants.map(variant => [variant.level, variant.description, variant.availability[0].partners[0].rarities])).toEqual([
      [1, first.description, [2, 3]], [2, second.description, [4]], [3, third.description, [5, 6, 7]], [10, tenth.description, [7]],
    ])
    expect(cards).toEqual(original)
  })

  it("still combines identical rarity imports inside a level and preserves all source targets", () => {
    const cards = [card("four", [4]), card("five", [5]), { ...card("two", [3]), name: "IT'S COMPLICATED - Lv. 2", description: "A different bonus." }]
    const families = groupChampionSynergyFamilies(cards)
    expect(families).toHaveLength(1)
    expect(families[0].variants.map(variant => variant.level)).toEqual([2, 3])
    expect(families[0].variants[1]).toMatchObject({ ids: ["four", "five"], availability: [{ partners: [{ rarities: [4, 5] }] }] })
  })

  it.each(["name", "partner", "stacking", "members"])("does not group families with different %s", difference => {
    const first = card("first", [4])
    const second = { ...card("second", [5]), name: "IT'S COMPLICATED Lv. 2" }
    if (difference === "name") second.name = "FRIENDS Lv. 2"
    if (difference === "partner") second.partners[0].id = 3
    if (difference === "stacking") second.unique = true
    if (difference === "members") second.champions = [{ ...partner, id: 3 }]
    expect(groupChampionSynergyFamilies([first, second])).toHaveLength(2)
  })

  it("keeps non-leveled names and unknown availability separate", () => {
    const first = { ...card("first", [4]), name: "IT'S COMPLICATED" }
    const second = { ...card("second", [5]), name: "IT'S COMPLICATED Lv. 2" }
    expect(groupChampionSynergyFamilies([first, second]).map(family => family.name)).toEqual([first.name, second.name])
    first.name = "IT'S COMPLICATED Lv. 1"
    first.rarities = undefined
    expect(groupChampionSynergyFamilies([first, second])).toHaveLength(2)
  })
})

describe("equivalent full synergy cards", () => {
  it("combines identical full cards and their single-partner star ranges without modifying catalog records", () => {
    const cards = [card("comp_008", [4]), card("comp_009", [5]), card("comp_010", [6, 7])]
    const original = structuredClone(cards)
    const grouped = groupChampionSynergyCards(cards)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].ids).toEqual(["comp_008", "comp_009", "comp_010"])
    expect(grouped[0].availability).toHaveLength(1)
    expect(grouped[0].availability[0]).toMatchObject({ championRarities: [6], partners: [{ id: 2, rarities: [4, 5, 6, 7] }] })
    expect(cards).toEqual(original)
  })

  it.each(["bonus", "level", "partner", "stacking", "glossary", "recipients"])("keeps different %s definitions separate", difference => {
    const first = card("first", [4])
    const second = card("second", [5])
    if (difference === "bonus") second.description = second.description.replace("+60", "+65")
    if (difference === "level") second.name = "IT'S COMPLICATED Lv. 2"
    if (difference === "partner") second.partners[0].id = 3
    if (difference === "stacking") second.unique = true
    if (difference === "glossary") second.description = second.description.replace("glossary/combat_power_rate", "glossary/power_rate")
    if (difference === "recipients") second.champions = [{ ...partner, id: 3, name: "Another recipient" }]
    expect(groupChampionSynergyCards([first, second])).toHaveLength(2)
  })

  it("keeps owner and partner rarity pairs correlated when viewing all champion rarities", () => {
    const grouped = groupChampionSynergyCards([card("six", [4], [6]), card("seven", [5], [7])])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].availability.map(rule => [rule.championRarities, rule.partners[0].rarities])).toEqual([[[6], [4]], [[7], [5]]])
  })

  it("keeps distinct multi-partner combinations rather than independently unioning their stars", () => {
    const first = card("first", [4])
    first.partners.push({ ...partner, id: 3, name: "Another partner", rarities: [5] })
    const second = structuredClone(first)
    second.id = "second"
    second.partners[0].rarities = [5]
    second.partners[1].rarities = [4]
    const grouped = groupChampionSynergyCards([first, second])
    expect(grouped).toHaveLength(1)
    expect(grouped[0].availability.map(rule => rule.partners.map(partner => partner.rarities))).toEqual([[[4], [5]], [[5], [4]]])
  })

  it("leaves unavailable rarity metadata uncombined", () => {
    const first = card("first", [4])
    const second = card("second", [5])
    first.rarities = undefined
    second.rarities = undefined
    expect(groupChampionSynergyCards([first, second])).toHaveLength(2)
  })
})
