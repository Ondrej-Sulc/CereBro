import { z } from "zod"

const identity = z.string().min(1)
const count = z.number().int().safe().nonnegative()
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const changedField = z.enum(["name", "sourceGroup", "sourceSet", "categoryIds", "directChampionRewards"])
const observationSchema = z.object({ observedAt: z.iso.datetime({ offset: true }), gachaSha256: hash,
  inputSha256: hash, projectionSha256: hash, definitionCount: count,
  inputFormat: z.enum(["champion-catalog-v1", "all-rewards-v1"]) }).strict()
const historySchema = z.object({ version: z.literal(1), projection: z.literal("champion-catalog-common-v1"),
  observations: z.array(observationSchema).min(1), baselineSourceIds: z.array(identity),
  transitions: z.array(z.object({ from: count, to: count, addedSourceIds: z.array(identity), removedSourceIds: z.array(identity),
    changed: z.array(z.object({ sourceId: identity, fields: z.array(changedField).min(1),
      previousProjectionSha256: hash, projectionSha256: hash }).strict()) }).strict()),
}).strict()

export type CrystalHistoryObservation = z.infer<typeof observationSchema>
export type CrystalHistoryField = z.infer<typeof changedField>
export type CrystalHistoryRecord = { sourceId: string; firstRecordedAt: string; lastRecordedAt: string;
  lastChangedRecordedAt: string | null; presentInLatest: boolean; changedFields: CrystalHistoryField[] }
export type CrystalHistory = { firstRecordedAt: string; lastRecordedAt: string; lastChangedRecordedAt: string | null;
  presentInLatest: boolean; records: CrystalHistoryRecord[] }

function unique(values: readonly string[], label: string): Set<string> {
  const result = new Set(values)
  if (values.length !== result.size) throw new Error(`Duplicate ${label}`)
  return result
}

/**
 * Replays observations of exact source definitions. "Recorded" means found in a
 * hash-pinned local cache, never released, purchasable, expired, or client version.
 * Changes cover only fields retained by both original normalized input formats.
 */
export function createCrystalHistory(input: unknown) {
  const history = historySchema.parse(input)
  const observations = history.observations
  if (history.transitions.length !== observations.length - 1) throw new Error("History must have sequential transitions")
  for (let i = 1; i < observations.length; i++) {
    if (Date.parse(observations[i].observedAt) <= Date.parse(observations[i - 1].observedAt)) throw new Error("Observation must be later than its predecessor")
  }
  const records = new Map<string, CrystalHistoryRecord>()
  for (const sourceId of unique(history.baselineSourceIds, "baseline source identity")) records.set(sourceId, {
    sourceId, firstRecordedAt: observations[0].observedAt, lastRecordedAt: observations[0].observedAt,
    lastChangedRecordedAt: null, presentInLatest: true, changedFields: [],
  })
  if (records.size !== observations[0].definitionCount) throw new Error("Inconsistent baseline coverage")
  const lastProjectionHashes = new Map<string, string>()
  history.transitions.forEach((transition, index) => {
    if (transition.from !== index || transition.to !== index + 1) throw new Error("History must have sequential transitions")
    const added = unique(transition.addedSourceIds, "added source identity")
    const removed = unique(transition.removedSourceIds, "removed source identity")
    unique(transition.changed.map(row => row.sourceId), "changed source identity")
    if ([...added].some(id => removed.has(id))) throw new Error("Added and removed identities overlap")
    const observedAt = observations[index + 1].observedAt
    for (const id of removed) {
      const record = records.get(id)
      if (!record?.presentInLatest) throw new Error(`Unknown removed source: ${id}`)
      record.presentInLatest = false
      lastProjectionHashes.delete(id)
    }
    for (const id of added) {
      const record = records.get(id)
      if (record?.presentInLatest) throw new Error(`Already present added source: ${id}`)
      if (record) record.presentInLatest = true
      else records.set(id, { sourceId: id, firstRecordedAt: observedAt, lastRecordedAt: observedAt,
        lastChangedRecordedAt: null, presentInLatest: true, changedFields: [] })
    }
    for (const change of transition.changed) {
      const record = records.get(change.sourceId)
      if (!record?.presentInLatest || added.has(change.sourceId) || removed.has(change.sourceId)) throw new Error(`Unknown changed source: ${change.sourceId}`)
      unique(change.fields, "changed field")
      if (change.previousProjectionSha256 === change.projectionSha256) throw new Error("Changed projections must differ")
      const previousHash = lastProjectionHashes.get(change.sourceId)
      if (previousHash && previousHash !== change.previousProjectionSha256) throw new Error(`Broken projection chain: ${change.sourceId}`)
      lastProjectionHashes.set(change.sourceId, change.projectionSha256)
      record.lastChangedRecordedAt = observedAt
      record.changedFields = [...change.fields]
    }
    let present = 0
    for (const record of records.values()) if (record.presentInLatest) { record.lastRecordedAt = observedAt; present++ }
    if (present !== observations[index + 1].definitionCount) throw new Error("Inconsistent observation coverage")
  })
  return {
    observations: observations.map(value => ({ ...value })) as readonly CrystalHistoryObservation[],
    changeScope: history.projection,
    getCrystalHistory(sourceIds: readonly string[]): CrystalHistory | null {
      const found = [...new Set(sourceIds)].sort().flatMap(id => {
        const row = records.get(id)
        return row ? [{ ...row, changedFields: [...row.changedFields] }] : []
      })
      if (!found.length) return null
      const earliest = (values: string[]) => values.sort((a, b) => Date.parse(a) - Date.parse(b))[0]
      const latest = (values: string[]) => values.sort((a, b) => Date.parse(b) - Date.parse(a))[0]
      const changed = found.flatMap(value => value.lastChangedRecordedAt ? [value.lastChangedRecordedAt] : [])
      return { firstRecordedAt: earliest(found.map(value => value.firstRecordedAt)),
        lastRecordedAt: latest(found.map(value => value.lastRecordedAt)), lastChangedRecordedAt: changed.length ? latest(changed) : null,
        presentInLatest: found.some(value => value.presentInLatest), records: found }
    },
  }
}
