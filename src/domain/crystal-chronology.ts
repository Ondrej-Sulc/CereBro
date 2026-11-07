/** Editorial source-identity chronology, never a release date or game version. */
export type CrystalNamedPeriod = { year: number; month: number | null }
export type CrystalChronology = {
  kind: "period" | "revision" | "unknown"
  label: string | null
  period: { start: CrystalNamedPeriod; end: CrystalNamedPeriod } | null
  revision: { seriesId: string; first: number; last: number } | null
  evidenceSourceIds: string[]
}

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const monthPattern = "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
const monthAndYear = new RegExp(`(?:^|_)(${monthPattern})((?:20)?\\d{2})(?=_|$)`, "g")
const monthMetaYear = new RegExp(`^(${monthPattern})_meta_(20\\d{2})(?:_|$)`)
const contentYears = /(?:^|_)(?:20\d{2}(?:_20\d{2})?_(?:champions?|annual|reflective|unforgettable|nostalgia)|nexus_20\d{2}_20\d{2}|featured_20\d{2}|rankup_gem)(?:_|$)/
const datedEvents = /(?:^|_)(?:banquet|gifting|holiday|valentines?|couples|legends_celebration|redenvelope|rebirth)(?:_|$)/

function namedPeriod(id: string): CrystalNamedPeriod | null {
  const dates = [...id.matchAll(monthAndYear)].map(match => ({ year: Number(match[2].length === 2 ? `20${match[2]}` : match[2]), month: monthNames.findIndex(name => name.toLowerCase() === match[1].slice(0, 3)) + 1 }))
  const separated = id.match(monthMetaYear)
  if (separated) dates.push({ year: Number(separated[2]), month: monthNames.findIndex(name => name.toLowerCase() === separated[1].slice(0, 3)) + 1 })
  const unique = new Map(dates.filter(date => date.year >= 2014 && date.year <= 2099 && date.month > 0).map(date => [`${date.year}:${date.month}`, date]))
  if (unique.size === 1) return [...unique.values()][0]
  if (unique.size > 1 || contentYears.test(id)) return null
  const years = [...id.matchAll(/(?:^|_)(20\d{2})(?=_|$)/g)].map(match => Number(match[1])).filter(year => year >= 2014 && year <= 2099)
  if (new Set(years).size !== 1) return null
  // Whitelisted event labels and year-suffixed Incursions identify editions;
  // other year tokens may describe champion cohorts instead of the crystal.
  if (datedEvents.test(id) || /^[3-7]star_incursions?_crystal_[a-z_]+_20\d{2}$/.test(id)) return { year: years[0], month: null }
  return null
}

function revision(id: string) {
  if ([...id.matchAll(/(?:^|_)v\d+(?=_|$)/g)].length !== 1) return null
  const match = id.match(/^(.+?)_v(\d+)(_.+)?$/)
  if (!match || !Number.isSafeInteger(Number(match[2]))) return null
  return { seriesId: `${match[1]}${match[3] ?? ""}`, value: Number(match[2]) }
}

const periodLabel = (period: CrystalNamedPeriod) => period.month ? `${monthNames[period.month - 1]} ${period.year}` : String(period.year)
const periodLower = (period: CrystalNamedPeriod) => period.year * 12 + (period.month ?? 1)
const periodUpper = (period: CrystalNamedPeriod) => period.year * 12 + (period.month ?? 12)

export function getCrystalChronology(sourceIds: readonly string[]): CrystalChronology {
  const dated: Array<{ id: string; value: CrystalNamedPeriod }> = []
  const revisions: Array<{ id: string; seriesId: string; value: number }> = []
  for (const id of [...new Set(sourceIds)].sort()) {
    const normalized = id.toLowerCase()
    const period = namedPeriod(normalized), version = revision(normalized)
    if (period) dated.push({ id, value: period })
    if (version) revisions.push({ id, ...version })
  }
  const first = [...dated].sort((a, b) => periodLower(a.value) - periodLower(b.value))[0]?.value
  const last = [...dated].sort((a, b) => periodUpper(b.value) - periodUpper(a.value))[0]?.value
  const period = first && last ? { start: { ...first }, end: { ...last } } : null
  const sameSeries = revisions.length > 0 && new Set(revisions.map(value => value.seriesId)).size === 1
  const relative = sameSeries ? { seriesId: revisions[0].seriesId, first: Math.min(...revisions.map(value => value.value)), last: Math.max(...revisions.map(value => value.value)) } : null
  let label: string | null = null
  if (period) {
    if (period.start.year === period.end.year && (period.start.month === null || period.end.month === null)) label = String(period.start.year)
    else if (period.start.year === period.end.year && period.start.month === period.end.month) label = periodLabel(period.start)
    else if (period.start.year === period.end.year) label = `${monthNames[period.start.month! - 1]}–${monthNames[period.end.month! - 1]} ${period.start.year}`
    else label = `${periodLabel(period.start)}–${periodLabel(period.end)}`
  } else if (relative) label = `Pool v${relative.first}${relative.first === relative.last ? "" : `–${relative.last}`}`
  return { kind: period ? "period" : relative ? "revision" : "unknown", label, period, revision: relative,
    evidenceSourceIds: [...new Set([...(period ? dated.map(value => value.id) : []), ...(relative ? revisions.map(value => value.id) : [])])].sort() }
}

export type CrystalChronologySortable = { id: string; name: string; sourceIds: readonly string[]; rarities?: readonly number[] }

/** Rank recorded champion stars; this says nothing about release or sale dates. */
export function compareCrystalStars(a: { rarities?: readonly number[] }, b: { rarities?: readonly number[] }): number {
  const left = a.rarities ?? [], right = b.rarities ?? []
  return Math.max(0, ...right) - Math.max(0, ...left)
    || (right.length ? Math.min(...right) : 0) - (left.length ? Math.min(...left) : 0)
}

/**
 * Named editions first; year-only entries follow exact-month entries in that year.
 * Revisions are ordered only within their own series (series groups are alphabetical).
 * Equal editions and undated definitions prefer higher stars, then stable names. None of these keys is a
 * releasedAt value, first-seen timestamp, semantic game version, or sale date.
 */
export function compareCrystalsNewestFirst(a: CrystalChronologySortable, b: CrystalChronologySortable): number {
  const left = getCrystalChronology(a.sourceIds), right = getCrystalChronology(b.sourceIds)
  return compareRecordedChronology(a, b, left, right)
}

/** Decorate once: sorting a catalog must not parse every ID for each comparison. */
export function sortCrystalsNewestFirst<T extends CrystalChronologySortable>(crystals: readonly T[]): T[] {
  return crystals.map(crystal => ({ crystal, chronology: getCrystalChronology(crystal.sourceIds) }))
    .sort((a, b) => compareRecordedChronology(a.crystal, b.crystal, a.chronology, b.chronology)).map(item => item.crystal)
}

function compareRecordedChronology(a: CrystalChronologySortable, b: CrystalChronologySortable, left: CrystalChronology, right: CrystalChronology): number {
  if (left.period && right.period) {
    const byYear = right.period.end.year - left.period.end.year
    if (byYear) return byYear
    const byMonth = (right.period.end.month ?? 0) - (left.period.end.month ?? 0)
    if (byMonth) return byMonth
  } else if (!!left.period !== !!right.period) return left.period ? -1 : 1
  if (!left.period && !right.period) {
    if (left.revision && right.revision) {
      const bySeries = left.revision.seriesId.localeCompare(right.revision.seriesId, "en")
      if (bySeries) return bySeries
      const byRevision = right.revision.last - left.revision.last
      if (byRevision) return byRevision
    } else if (!!left.revision !== !!right.revision) return left.revision ? -1 : 1
  }
  return compareCrystalStars(a, b) || a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en")
}
