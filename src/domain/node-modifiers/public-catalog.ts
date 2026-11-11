import { createHash } from "node:crypto"

export interface PublicCuratedModifier { id: string; name: string; description: string }
export const publicCuratedModifierSelect = { id: true, name: true, description: true } as const
export interface GameModifierRecord {
  id: string; name: string; text: string; names: string[]; texts: string[]; versionHashes: string[]
  sources: string[]; targets: string[]; assignmentContexts: { source: string; target: string }[]
  missing: boolean; questCount: number; iconKey?: string | null
}
export interface PublicModifierFilters { q?: string; catalog?: string; source?: string; target?: string; binding?: string; page?: string }
export interface PublicModifierCard { id: string; name: string; text: string; origin: "curated" | "game"; href: string; iconKey?: string | null; questCount?: number }
export interface CuratedAssociation { curatedId: string; effectId: string; versionHash: string; curatedHash: string }
export function curatedModifierHash(record: PublicCuratedModifier) {
  // Same sorted, UTF-8 JSON projection as the existing offline reconciliation.
  return createHash("sha256").update(JSON.stringify({ description: record.description, id: record.id, name: record.name })).digest("hex")
}
export function verifyCuratedAssociations(curated: PublicCuratedModifier[], game: GameModifierRecord[], bindings: CuratedAssociation[]) {
  const seen = new Set<string>()
  return bindings.map(binding => {
    const key = `${binding.curatedId}:${binding.effectId}:${binding.versionHash}`
    if (seen.has(key)) throw new Error("Duplicate reviewed modifier association")
    seen.add(key)
    const record = curated.find(row => row.id === binding.curatedId), definition = game.find(row => row.id === binding.effectId)
    const status = !record ? "missing-curated-record" : !definition ? "missing-definition" :
      !definition.versionHashes.includes(binding.versionHash) ? "definition-drift" : curatedModifierHash(record) !== binding.curatedHash ? "curated-drift" : "verified"
    return { ...binding, status }
  })
}
export function browsePublicModifiers(curated: PublicCuratedModifier[], game: GameModifierRecord[], filters: PublicModifierFilters, pageSize = 24) {
  const q = (filters.q ?? "").trim().toLowerCase(), catalog = filters.catalog === "curated" || filters.catalog === "game" ? filters.catalog : "all"
  const gameOnly = !!(filters.source || filters.target || filters.binding)
  const curatedRows: PublicModifierCard[] = catalog === "game" || gameOnly ? [] : curated.filter(row => !q || `${row.name} ${row.description}`.toLowerCase().includes(q)).map(row =>
    ({ id: row.id, name: row.name, text: row.description, origin: "curated", href: `/nodes/curated/${encodeURIComponent(row.id)}` }))
  const gameRows: PublicModifierCard[] = catalog === "curated" ? [] : game.filter(row => {
    const search = [row.id, ...row.names, ...row.texts].join(" ").toLowerCase()
    return (!q || search.includes(q)) && (!(filters.source || filters.target) || row.assignmentContexts.some(context =>
      (!filters.source || context.source === filters.source) && (!filters.target || context.target === filters.target))) &&
      (!filters.binding || (filters.binding === "missing" ? row.missing : filters.binding === "complete" && !row.missing))
  }).map(row => ({ id: row.id, name: row.name, text: row.text, origin: "game", href: `/nodes/${encodeURIComponent(row.id)}`, iconKey: row.iconKey, questCount: row.questCount }))
  const rows = [...curatedRows, ...gameRows].sort((a, b) => a.name.localeCompare(b.name, "en", { numeric: true, sensitivity: "base" }) ||
    (a.origin === b.origin ? 0 : a.origin === "curated" ? -1 : 1) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
  const pages = Math.max(1, Math.ceil(rows.length / pageSize)), requested = Number(filters.page)
  const page = Math.min(pages, Math.max(1, Number.isSafeInteger(requested) ? requested : 1))
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, pages, page, pageSize,
    counts: { curated: curated.length, game: game.length, matchingCurated: curatedRows.length, matchingGame: gameRows.length }, catalog }
}
export function publicModifierHref(filters: PublicModifierFilters, page?: number) {
  const query = new URLSearchParams()
  for (const key of ["q", "catalog", "source", "target", "binding"] as const) if (filters[key]) query.set(key, filters[key]!)
  if (page && page > 1) query.set("page", String(page))
  return `/nodes${query.size ? `?${query}` : ""}`
}
