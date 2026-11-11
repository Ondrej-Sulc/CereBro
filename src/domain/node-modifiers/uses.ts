import type { ModifierApplication, ModifierDefinition, ModifierVersion, NodeModifierCatalog } from "./catalog"

export interface ModifierPlacement {
  x: number; y: number; nodeNumber: number | null; final: boolean
  defenders: { name: string | null; gameId: string | null; bossId: string; blueprintId: string | null }[]
}
export interface ModifierQuestLabel {
  key: string; questId: string; mapId: string; sourceId: string; sourceSha256: string
  mapPointer: string; summaryPointer: string; name: string; storyNumber: string | null
  category: string; chapter: string | null; collection: string | null; difficulty: string | null
  labelEvidence: Record<string, unknown>
}
export interface ModifierQuestUse {
  id: string; questKey: string; effectId: string; versionHash: string; applicationHash: string
  role: string; side: string; sourceCoordinate: { x: number; y: number } | null
  sourceNode: ModifierPlacement | null
  affectedNodes: (ModifierPlacement & { pointers: string[] })[]
  sourcePointers: string[]
}
export interface ModifierUseProjection {
  schemaVersion: number; contract: string; modifierCatalogHash: string; contentHash: string
  quests: ModifierQuestLabel[]; uses: ModifierQuestUse[]
}
export interface ModifierLocationContext {
  key: string
  role: string; side: string; sourceNodes: ModifierPlacement[]; affectedNodes: ModifierPlacement[]
  useIds: string[]; applicationIdentities: string[]; amounts: unknown[]
}
export interface ModifierQuestLocations { quest: ModifierQuestLabel; contexts: ModifierLocationContext[] }
export function placementLabel(node: ModifierPlacement) {
  const names = node.defenders.map(d => d.name || "Unresolved defender").join(", ")
  const number = node.nodeNumber === null ? "unnumbered node" : `Node ${node.nodeNumber}`
  return node.nodeNumber === null ? `${names || "Source placement"} · ${number}` : `${number}${names ? ` · ${names}` : ""}`
}
const nodeKey = (node: ModifierPlacement) => `${node.x}:${node.y}:${node.defenders.map(d => d.bossId).join("|")}`
const addNode = (nodes: ModifierPlacement[], node: ModifierPlacement) => {
  if (!nodes.some(n => nodeKey(n) === nodeKey(node))) nodes.push(node)
}

/** Joins exact source identities; grouping changes only the display, never applications. */
export function modifierLocations(catalog: NodeModifierCatalog, definition: ModifierDefinition,
  references: { version: ModifierVersion; application: ModifierApplication }[], projection: ModifierUseProjection) {
  const identities = new Map(references.map(ref => [`${ref.version.hash}:${ref.application.hash}`, ref]))
  if (projection.modifierCatalogHash !== catalog.contentHash) return { quests: [] as ModifierQuestLocations[], unresolvedApplications: identities.size }
  const quests = new Map<string, ModifierQuestLocations>(), matched = new Set<string>()
  for (const use of projection.uses) {
    const identity = `${use.versionHash}:${use.applicationHash}`
    const reference = identities.get(identity)
    if (use.effectId !== definition.id || !reference) continue
    const label = projection.quests.find(q => q.key === use.questKey)
    if (!label || !catalog.profile.inputs.some(input => input.id === label.sourceId && input.sha256 === label.sourceSha256)) continue
    matched.add(identity)
    let quest = quests.get(label.key)
    if (!quest) { quest = { quest: label, contexts: [] }; quests.set(label.key, quest) }
    // Local rows share one quest context. Linked/global sources retain separate
    // origins; source-only observations never masquerade as affected placements.
    const origin = use.role === "Local" ? "local" : use.sourceNode ? nodeKey(use.sourceNode) : "unknown"
    const key = `${use.role}:${use.side}:${origin}:${use.affectedNodes.length > 0}`
    let context = quest.contexts.find(c => c.key === key)
    if (!context) {
      context = { key, role: use.role, side: use.side, sourceNodes: [], affectedNodes: [], useIds: [], applicationIdentities: [], amounts: [] }
      quest.contexts.push(context)
    }
    if (use.sourceNode) addNode(context.sourceNodes, use.sourceNode)
    use.affectedNodes.forEach(node => addNode(context.affectedNodes, node))
    context.useIds.push(use.id)
    if (!context.applicationIdentities.includes(identity)) context.applicationIdentities.push(identity)
    const amount = reference.application.raw.buffAmount
    if (!context.amounts.includes(amount)) context.amounts.push(amount)
  }
  for (const quest of quests.values()) for (const context of quest.contexts) {
    const order = (a: ModifierPlacement, b: ModifierPlacement) => (a.nodeNumber ?? Infinity) - (b.nodeNumber ?? Infinity) || a.x - b.x || a.y - b.y
    context.sourceNodes.sort(order); context.affectedNodes.sort(order)
  }
  return { quests: [...quests.values()].sort((a, b) => (a.quest.storyNumber ?? a.quest.name).localeCompare(b.quest.storyNumber ?? b.quest.name)),
    unresolvedApplications: [...identities.keys()].filter(key => !matched.has(key)).length }
}
