import { describe, expect, it } from "vitest"
import { nodeModifierCatalog } from "../../data/game-node-modifiers"
import { modifierUseProjection } from "../../data/game-node-modifiers/uses"
import { modifierLocations, placementLabel } from "./uses"

const locations = (id: string) => {
  const definition = nodeModifierCatalog.definitions.find(d => d.id === id)!
  return modifierLocations(nodeModifierCatalog, definition, definition.versions.flatMap(version => version.applications.map(application => ({ version, application }))), modifierUseProjection)
}
describe("modifier quest uses", () => {
  it("groups six Disarray identities into one verified Story quest and six real placements", () => {
    const data = locations("pve_disarray")
    expect(data.quests).toHaveLength(1)
    expect(data.quests[0].quest.storyNumber).toBe("4.4.6")
    expect(data.quests[0].quest.name).toBe("Culmination")
    expect(data.quests[0].contexts).toHaveLength(1)
    expect(data.quests[0].contexts[0].useIds).toHaveLength(6)
    expect(data.quests[0].contexts[0].affectedNodes.map(placementLabel)).toEqual([
      "Node 4 · HULK", "Node 9 · CAPTAIN AMERICA", "Node 14 · MAGIK", "Node 19 · RONAN", "Node 24 · GAMORA", "Node 29 · IRON MAN",
    ])
    expect(data.unresolvedApplications).toBe(0)
  })
  it("preserves multiple quests and separates linked sources from assigned defenders", () => {
    const data = locations("pve_ai_sp3")
    expect(data.quests.map(q => q.quest.storyNumber).sort()).toEqual(["4.4.6", "5.1.1"])
    const linked = data.quests.flatMap(q => q.contexts).find(c => c.role === "Link")!
    expect(linked.sourceNodes.map(placementLabel)).toEqual(["Node 31 · MAESTRO"])
    expect(linked.affectedNodes).toHaveLength(30)
    expect(linked.affectedNodes.some(n => n.nodeNumber === 31)).toBe(false)
    expect(linked).not.toHaveProperty("active")
  })
  it("uses bound difficulty and explicit source locations for event effects", () => {
    const data = locations("saga_boost_aspect_of_strength")
    expect(data.quests[0].quest.name).toBe("Crossed Wires")
    expect(data.quests[0].quest.storyNumber).toBeNull()
    expect(data.quests[0].quest.difficulty).toBe("Progression rank 4")
    expect(data.quests[0].contexts).toHaveLength(3)
  })
  it("never guesses a quest on stale catalog/application or missing labels", () => {
    const definition = nodeModifierCatalog.definitions[0]
    const references = definition.versions.flatMap(version => version.applications.map(application => ({ version, application })))
    expect(modifierLocations(nodeModifierCatalog, definition, references, { ...modifierUseProjection, modifierCatalogHash: 'stale' }).quests).toEqual([])
    expect(modifierLocations(nodeModifierCatalog, definition, references, { ...modifierUseProjection, quests: [] }).unresolvedApplications).toBe(references.length)
    expect(placementLabel({ x: 1, y: 2, nodeNumber: null, final: false, defenders: [{ name: null, gameId: null, bossId: 'unknown', blueprintId: null }] })).toBe("Unresolved defender · unnumbered node")
  })
})
