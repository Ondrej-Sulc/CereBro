import { describe, expect, it } from "vitest"
import { nodeModifierCatalog } from "../../data/game-node-modifiers"
import { browseModifiers, modifierSummary, applicationContext, plainGameText } from "./catalog"

describe("source-backed node modifier browsing", () => {
  it("keeps same-name definitions and exact IDs separate", () => {
    const health = browseModifiers(nodeModifierCatalog.definitions, { q: "Health" })
    expect(health.some(d => d.id === "avx_hp_pct200")).toBe(true)
    expect(health.some(d => d.id === "avx_hp_pct600")).toBe(true)
    expect(browseModifiers(nodeModifierCatalog.definitions, { q: "ava_ea20" }).map(d => d.id)).toEqual(["ava_ea20"])
  })
  it("filters source and target on the same application", () => {
    const definition = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    const version = definition.versions[0]
    const app = version.applications[0]
    const mixed = { ...definition, versions: [{ ...version, applications: [
      { ...app, raw: { nodeSource: { type: { name: "Local" }, attk: true } } },
      { ...app, raw: { nodeSource: { type: { name: "Link" }, attk: false } } },
    ] }] }
    expect(browseModifiers([mixed], { source: "Local", target: "defender" })).toEqual([])
    expect(browseModifiers([mixed], { source: "Link", target: "defender" })).toHaveLength(1)
  })
  it("preserves missing bindings, raw parameter precision, and unresolved templates", () => {
    const gifted = nodeModifierCatalog.definitions.find(d => d.id === "ava_ea20")!
    expect(gifted.versions[0].raw.localizedDesc).toContain("{1}")
    expect(modifierSummary(gifted).texts).toContain("The Defender's Ability Accuracy is increased by 20%.")
    const missing = browseModifiers(nodeModifierCatalog.definitions, { binding: "missing" })
    expect(missing.map(d => d.id)).toContain("saga_boost_aspect_of_strength")
    expect(gifted.versions[0].components.find(c => c.id === "ava_ea20")?.raw.Modifier).toBe(0.20000000298023224)
  })
  it("never turns linked assignment flags into active combat state", () => {
    expect(applicationContext({ nodeSource: { type: { name: "Link" }, attk: false, remainActive: false } })).toEqual({ source: "Link", target: "defender", remainActive: false })
    expect(applicationContext({})).toEqual({ source: "Unknown", target: "unknown", remainActive: null })
  })
  it("handles empty results, invalid filters, and game markup as text", () => {
    expect(browseModifiers(nodeModifierCatalog.definitions, { q: "no-such-modifier" })).toEqual([])
    expect(browseModifiers(nodeModifierCatalog.definitions, { source: "not-a-source" })).toEqual([])
    expect(plainGameText("[16982bff]30%[-] [k=glossary/armor_up]Armor Up[/k] <script>kept as text</script>")).toBe("30% Armor Up <script>kept as text</script>")
  })
  it("renders native escaped effect line breaks as readable paragraphs", () => {
    expect(plainGameText("[16982bff]Disabled until the linked node is removed.[-]\\nPower Loop lasts 15% less.\\r\\nOther condition.")).toBe("Disabled until the linked node is removed.\nPower Loop lasts 15% less.\nOther condition.")
  })
})
