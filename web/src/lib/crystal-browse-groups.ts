import { compareCrystalStars, getCrystalChronology } from "@cerebro/core/domain/crystal-chronology"
import type { CrystalPoolChampion } from "./crystal-pool-preview"

export type CrystalEditionGroup = {
  kind: "monthly-login"
  label: string
  rarities: number[]
  options: Array<{ id: string; rarities: number[] }>
  singleChampion: CrystalPoolChampion | null
}
type Groupable = {
  id: string; name: string; category: string; rarities: number[]; rewardKind: string
  variants: Array<{ sourceIds: string[] }>
  availabilitySourceId?: string
  singleChampion?: CrystalPoolChampion | null
}

function loginEdition(entry: Groupable) {
  if (entry.category !== "calendar") return null
  const ids = entry.variants.flatMap(variant => variant.sourceIds)
  if (!ids.length || !ids.every(id => /^login_crystal_(?:[1-7]_)?[1-7]_star_[a-z]+(?:20)?\d{2}$/.test(id))) return null
  const chronology = getCrystalChronology(ids)
  const { start, end } = chronology.period ?? {}
  if (!start?.month || !end || start.year !== end.year || start.month !== end.month || !chronology.label) return null
  return { key: `login:${start.year}:${start.month}:${entry.rewardKind}`, label: chronology.label }
}

/** Browse-only grouping after exact filters. Never merge reward contents or
 * claim that the star ranges share a pool, rates or current availability. */
export function groupCrystalEditions<T extends Groupable>(entries: readonly T[]): Array<T & { editionGroup?: CrystalEditionGroup }> {
  const groups = new Map<string, T[]>()
  const editions = new Map<T, ReturnType<typeof loginEdition>>()
  for (const entry of entries) {
    const edition = loginEdition(entry)
    editions.set(entry, edition)
    if (!edition) continue
    const members = groups.get(edition.key) ?? []
    members.push(entry); groups.set(edition.key, members)
  }
  const emitted = new Set<string>()
  return entries.flatMap(entry => {
    const edition = editions.get(entry)
    if (!edition) return [entry]
    const members = groups.get(edition.key)!
    if (members.length < 2) return [entry]
    if (emitted.has(edition.key)) return []
    emitted.add(edition.key)
    const options = [...members].sort(compareCrystalStars)
    const champion = options[0].singleChampion
    const singleChampion = champion && options.every(option => option.singleChampion?.gameId === champion.gameId) ? champion : null
    return [{ ...options[0], editionGroup: { kind: "monthly-login" as const, label: edition.label,
      rarities: [...new Set(options.flatMap(option => option.rarities))].sort((a, b) => a - b),
      options: options.map(option => ({ id: option.availabilitySourceId ?? option.id, rarities: [...option.rarities] })), singleChampion } }]
  })
}
