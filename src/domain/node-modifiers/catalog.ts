export interface ModifierApplication {
  hash: string
  text: string | null
  raw: Record<string, unknown>
  evidence: { sourceId: string; pointer: string; coordinate: { x: number; y: number } | null }
  observations: number
}
export interface ModifierVersion {
  hash: string
  sourceBcgSha256: string | null
  definitionHash: string
  raw: Record<string, unknown>
  componentIds: string[]
  missingComponentIds: string[]
  components: { id: string; hash: string; raw: Record<string, unknown> }[]
  applications: ModifierApplication[]
}
export interface ModifierDefinition { id: string; versions: ModifierVersion[] }
export interface NodeModifierCatalog {
  schemaVersion: number
  contract: string
  contentHash: string
  profileHash: string
  profile: {
    id: string; gameVersion: string; bcgSha256: string; schemaSha256: string; gameAssemblySha256: string
    coverage: string
    inputs: { id: string; path: string; sha256: string; capturedAt: string; pointers: string[] }[]
    evidence: { path: string; sha256: string; contract: string }[]
  }
  definitions: ModifierDefinition[]
}

export function plainGameText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\[(?:[\da-fA-F]{8}|[\da-fA-F]{6}|-|\/?b|\/?i|k=glossary\/[a-zA-Z0-9_/-]+|\/k)\]/g, "").replace(/\\r\\n|\\[nr]/g, "\n").trim() : ""
}
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
export function assignedEffectIds(raw: Record<string, unknown>): string[] {
  const buffs = record(raw.nodeSource).buffs
  return Array.isArray(buffs) ? buffs.flatMap(item => {
    const buff = record(item)
    return buff.Type === "buff" && typeof buff.Data === "string" ? [buff.Data] : []
  }) : []
}
export function applicationContext(raw: Record<string, unknown>) {
  const source = record(raw.nodeSource)
  const type = record(source.type)
  return {
    source: typeof type.name === "string" ? type.name : "Unknown",
    target: source.attk === true ? "attacker" : source.attk === false ? "defender" : "unknown",
    remainActive: typeof source.remainActive === "boolean" ? source.remainActive : null,
  }
}
export function modifierSummary(definition: ModifierDefinition) {
  const apps = definition.versions.flatMap(v => v.applications)
  return {
    id: definition.id,
    name: plainGameText(definition.versions[0]?.raw.localizedName) || definition.id,
    names: [...new Set(definition.versions.map(v => plainGameText(v.raw.localizedName)))],
    texts: [...new Set(apps.map(a => plainGameText(a.text)).filter(Boolean))],
    sources: [...new Set(apps.map(a => applicationContext(a.raw).source))].sort(),
    targets: [...new Set(apps.map(a => applicationContext(a.raw).target))].sort(),
    versionCount: definition.versions.length,
    applicationCount: apps.length,
    missing: definition.versions.some(v => v.missingComponentIds.length > 0),
  }
}
export interface ModifierFilters { q?: string; source?: string; target?: string; binding?: string }
export function browseModifiers(definitions: ModifierDefinition[], filters: ModifierFilters) {
  const q = (filters.q ?? "").trim().toLowerCase()
  return definitions.filter(definition => {
    const summary = modifierSummary(definition)
    const search = [definition.id, ...summary.names, ...summary.texts, ...definition.versions.flatMap(v => v.componentIds)].join(" ").toLowerCase()
    return (!q || search.includes(q)) && (!filters.binding || (filters.binding === "missing" ? summary.missing : filters.binding === "complete" && !summary.missing)) &&
      definition.versions.some(v => v.applications.some(a => {
        const context = applicationContext(a.raw)
        return (!filters.source || context.source === filters.source) && (!filters.target || context.target === filters.target)
      }))
  }).sort((a, b) => {
    const an = modifierSummary(a).name, bn = modifierSummary(b).name
    return an < bn ? -1 : an > bn ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}
