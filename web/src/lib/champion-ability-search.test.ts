import { describe, expect, it } from "vitest"
import { prepareChampionAbilityTextView, type PreparedChampionAbilityText } from "./champion-ability-text"
import { championAbilityTextContent, filterChampionAbilityPanels } from "./champion-ability-search"

const view = prepareChampionAbilityTextView({ records: [
  { id: 1, group: "base", title: "Heavy Attacks", template: { raw: "Gain Fury for 15 seconds." } },
  { id: 2, group: "base", title: "Heavy Attacks", template: { raw: "Inflict Weakness." } },
  { id: 3, group: "base", title: "Blocking", template: { raw: "Gain Armor." } },
  { id: 4, group: "special", title: "Web Sling", template: { raw: "A web-filled strike." } },
  { id: 5, group: "special1", title: "On activation", template: { raw: "Inflict Fury and Power Sting." } },
] })
const panels = view.descriptionPanels

describe("ability reader search", () => {
  it("searches case-insensitively across text and excludes unrelated records without mutating panels", () => {
    const result = filterChampionAbilityPanels(panels, "  FURY ")
    expect(result.passageCount).toBe(2)
    expect(result.panels.flatMap(panel => panel.recordGroups.flatMap(group => group.records.map(record => record.id)))).toEqual([1, 5])
    expect(filterChampionAbilityPanels(panels, "").passageCount).toBe(5)
  })

  it("keeps a heading's full context when the heading matches", () => {
    const result = filterChampionAbilityPanels(panels, "heavy")
    expect(result.passageCount).toBe(2)
    expect(result.panels[0].recordGroups.flatMap(group => group.records.map(record => record.id))).toEqual([1, 2])
  })

  it("finds the named special attack introduction", () => {
    const result = filterChampionAbilityPanels(panels, "web-filled")
    expect(result.passageCount).toBe(1)
    expect(result.panels[0].introRecord?.id).toBe(4)
    expect(result.panels[0].recordGroups).toHaveLength(0)
  })

  it("treats punctuation as literal search text and reports no matches", () => {
    expect(filterChampionAbilityPanels(panels, ".*").passageCount).toBe(0)
    expect(filterChampionAbilityPanels(panels, "nothing recorded here").panels).toEqual([])
  })

  it("searches and counts both introductions in a shared special section without repeating its rules", () => {
    const section = { id: "ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_SPECIAL23", title: "Special Attacks 2 and 3" }
    const shared = prepareChampionAbilityTextView({ records: [
      ...["First", "Dark Magic", "Soul Corruption"].map((title, index) => ({ id: index + 1, group: "special", title, template: { raw: `${title} flavor.` } })),
      { id: 4, group: "special2", title: null, template: { raw: "Empowered attacks inflict Vulnerability.", display: { kind: "ability", section } } },
    ] }).descriptionPanels
    expect(filterChampionAbilityPanels(shared, "").passageCount).toBe(3)
    const result = filterChampionAbilityPanels(shared, "Soul Corruption")
    expect(result.passageCount).toBe(1)
    expect(result.panels[0].specialAttackIntros?.map(intro => intro.number)).toEqual([3])
    expect(result.panels[0].recordGroups).toHaveLength(0)
    expect(filterChampionAbilityPanels(shared, "empowered").passageCount).toBe(1)
    expect(filterChampionAbilityPanels(shared, "").passageCount).toBe(3)
  })

  it("extracts nested colors, glossary labels, and resolved values without splitting phrases", () => {
    const prepared: PreparedChampionAbilityText = { status: "ready", blocks: [{ type: "paragraph", children: [
      { type: "text", value: "Gain " },
      { type: "color", color: "ff0000", children: [{ type: "glossary", id: "fury", label: "Fury" }] },
      { type: "text", value: " for " },
      { type: "value", key: "duration", placeholderIndex: 0, resolution: { status: "resolved", value: 15, displayValue: "15", curve: null, detail: "" } },
      { type: "text", value: " seconds." },
    ] }] }
    expect(championAbilityTextContent(prepared)).toBe("Gain Fury for 15 seconds.")
  })
})
