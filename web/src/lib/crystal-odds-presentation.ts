import type { CrystalOddsOpening, CrystalOddsRow } from "@cerebro/core/domain/crystal-odds"

export type CrystalOddsIconKind = "champion" | "crystal" | "material" | "resource" | "selector" | "item"
export type CrystalOddsRowVisual = { imageUrl: string | null; href: string | null; kind: CrystalOddsIconKind }
export type CrystalOddsVisuals = Record<string, CrystalOddsRowVisual>
export function crystalRatePercentage(value: string) {
  const number = Number(value)
  return number > 0 && number < .00000001 ? number.toExponential(2) : number.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 8 })
}
export type CrystalStarRate = Pick<CrystalOddsRow, "label" | "percentValue" | "prefix"> & { key: string }

/** Only the exact, complete set of named star categories can become filter
 * annotations. Multiple groups, named champions and missing stars stay separate. */
export function crystalStarCategoryRates(odds: CrystalOddsOpening | null | undefined, rarities: readonly number[]): Record<string, CrystalStarRate> | null {
  if (odds?.status !== "captured" || odds.groups?.length !== 1 || rarities.length < 2) return null
  const group = odds.groups[0]
  if (group.name?.trim() || group.isFeatured || new Set(rarities).size !== rarities.length) return null
  const result: Record<string, CrystalStarRate> = {}
  for (const row of group.rows) {
    const match = row.label?.match(/^([1-7])-Star (?:Hero|Champion)$/i)
    if (!match || result[match[1]] || row.rewardData !== undefined || row.rewardType && !["hero", "hcos"].includes(row.rewardType)) return null
    result[match[1]] = { label: row.label, percentValue: row.percentValue, prefix: row.prefix, key: crystalOddsRowKey(group.sourceIndex, row.sourceIndex) }
  }
  return Object.keys(result).length === rarities.length && rarities.every(rarity => result[rarity]) ? result : null
}
type RewardCandidate = { type: string; data: string; displayName?: string; imageUrl: string | null; href: string | null }

const normalize = (value: string) => value.normalize("NFKD").toLocaleLowerCase("en").replace(/\bshards\b/g, "shard").replace(/[^a-z0-9]/g, "")
export const crystalOddsRowKey = (groupIndex: number, rowIndex: number) => `${groupIndex}:${rowIndex}`
export function crystalOddsIconKind(label: string): CrystalOddsIconKind {
  if (/selector/i.test(label)) return "selector"
  if (/crystal/i.test(label)) return "crystal"
  if (/catalyst|alloy|iso.?8|dust/i.test(label)) return "material"
  if (/gold|units|battle.?chips|loyalty|glory|radiance|essentia/i.test(label)) return "resource"
  if (/hero|champion|punisher/i.test(label)) return "champion"
  return "item"
}

/** Decorative art only: category labels never acquire quantities or new odds.
 * Match within this exact opening, and fail closed on ambiguous identities.
 */
export function buildCrystalOddsVisuals(odds: CrystalOddsOpening | null, candidates: readonly RewardCandidate[]): CrystalOddsVisuals {
  const visuals: CrystalOddsVisuals = {}
  for (const group of odds?.groups ?? []) for (const row of group.rows) {
    const label = row.label || row.rewardData || ""
    const matching = candidates.filter(candidate => matches(row, candidate))
    const identities = new Set(matching.map(candidate => JSON.stringify([candidate.type, candidate.data])))
    const images = new Set(matching.map(candidate => candidate.imageUrl))
    const destinations = new Set(matching.map(candidate => candidate.href))
    visuals[crystalOddsRowKey(group.sourceIndex, row.sourceIndex)] = {
      imageUrl: identities.size === 1 && images.size === 1 ? matching[0].imageUrl : null,
      href: identities.size === 1 && matching[0].type === "gs" && destinations.size === 1 ? matching[0].href : null,
      kind: crystalOddsIconKind(label),
    }
  }
  return visuals
}

function matches(row: CrystalOddsRow, candidate: RewardCandidate) {
  if (row.rewardType && row.rewardData !== undefined) return row.rewardType === candidate.type && row.rewardData === candidate.data
  const label = row.label ?? ""
  const fragment = /\bfragments?\b/i.test(label)
  const shard = /\bshards?\b/i.test(label)
  if (fragment ? candidate.type !== "ebpf" : shard ? candidate.type !== "gf" : ["ebpf", "gf"].includes(candidate.type)) return false
  const text = fragment ? label.replace(/\bfragments?\b/gi, "") : label
  return Boolean(text && candidate.displayName && normalize(text) === normalize(fragment ? candidate.displayName.replace(/\bfragments?\b/gi, "") : candidate.displayName))
}
