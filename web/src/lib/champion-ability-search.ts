import type { ChampionAbilityTextRecord, PreparedChampionAbilityText, PreparedChampionAbilityTextNode, PreparedChampionAbilityTextPanel } from "./champion-ability-text"

export function championAbilityTextContent(prepared: PreparedChampionAbilityText): string {
  if (prepared.status !== "ready") return ""
  const text = (nodes: PreparedChampionAbilityTextNode[]): string => nodes.map(node => {
    if (node.type === "color") return text(node.children)
    if (node.type === "text") return node.value
    if (node.type === "glossary") return node.label
    return node.resolution.status === "resolved" ? node.resolution.displayValue : ""
  }).join("")
  return prepared.blocks.map(block => text(block.children)).join("\n")
}

export function filterChampionAbilityPanels<T extends ChampionAbilityTextRecord>(panels: PreparedChampionAbilityTextPanel<T>[], query: string) {
  const needle = query.trim().toLocaleLowerCase()
  const matches = (text: string | null) => Boolean(text?.toLocaleLowerCase().includes(needle))
  const filtered = !needle ? panels : panels.flatMap(panel => {
    if (matches(panel.title)) return [panel]
    const recordGroups = panel.recordGroups.flatMap(group => {
      const records = matches(group.title) ? group.records : group.records.filter(record => matches(championAbilityTextContent(record.prepared)))
      return records.length ? [{ ...group, records }] : []
    })
    const introRecord = panel.introRecord && (matches(panel.introRecord.displayTitle) || matches(championAbilityTextContent(panel.introRecord.prepared))) ? panel.introRecord : undefined
    const specialAttackIntros = panel.specialAttackIntros?.filter(({ record }) => matches(record.displayTitle) || matches(championAbilityTextContent(record.prepared)))
    if (!recordGroups.length && !introRecord && !specialAttackIntros?.length) return []
    const recordIds = new Set(recordGroups.flatMap(group => group.records.map(record => record.id)))
    return [{ ...panel, recordGroups, introRecord, specialAttackIntros, records: panel.records.filter(record => recordIds.has(record.id)) }]
  })
  return {
    panels: filtered,
    passageCount: filtered.reduce((total, panel) => total + panel.recordGroups.reduce((count, group) => count + group.records.length, 0) + (panel.introRecord ? 1 : 0) + (panel.specialAttackIntros?.length ?? 0), 0),
  }
}
