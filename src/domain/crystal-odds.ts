import { z } from "zod"

const count = z.number().int().safe().nonnegative()
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const observationTime = z.iso.datetime({ offset: true })
const statusSchema = z.enum(["unattempted", "captured", "empty_disclosure", "http_not_found", "server_error",
  "schema_unreviewed", "http_error", "authentication_failed", "transient_error", "rate_limited"])
const percent = z.string().regex(/^\d+(?:\.\d+)?(?:[Ee][+-]?\d+)?$/)
  .refine(value => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 100,
    "Invalid disclosed percentage")
const rowSchema = z.object({
  sourceIndex: count, percentValue: percent, rateBasis: z.literal("server-disclosed-category"),
  label: z.string().optional(), prefix: z.string().max(16).optional(), kindInfoIndex: z.number().int().safe().optional(),
  rewardType: z.string().optional(), rewardData: z.string().optional(), bonusRewardId: z.string().optional(),
  displayRarityIndex: z.number().int().safe().optional(),
}).strict()
const groupSchema = z.object({
  sourceIndex: count, name: z.string().nullable(), isFeatured: z.boolean().nullable(), rows: z.array(rowSchema),
  sumValidation: z.literal("not-inferred-across-source-groups"),
}).strict().refine(group => group.rows.every((row, index) => row.sourceIndex === index), "Rate row order changed")
const attemptSchema = z.object({
  observedAt: observationTime, status: statusSchema, httpStatus: z.number().int().min(100).max(599).nullable(),
  responseBytes: count, responseSha256: hash,
}).strict()
const openingSchema = z.object({
  status: statusSchema, attempts: z.array(attemptSchema), observedAt: observationTime.optional(),
  serverTimestamp: count.nullable().optional(), reportedName: z.string().nullable().optional(),
  groups: z.array(groupSchema).optional(), responseSha256: hash.optional(),
  individualChampionOddsInferred: z.literal(false).optional(), exactUnderlyingSamplingAlgorithmKnown: z.literal(false).optional(),
}).strict().superRefine((opening, ctx) => {
  const disclosed = opening.status === "captured" || opening.status === "empty_disclosure"
  if ((opening.status === "unattempted") !== (opening.attempts.length === 0)) {
    ctx.addIssue({ code: "custom", message: "Attempt coverage contradicts status" })
  }
  if (opening.attempts.length && opening.attempts.at(-1)?.status !== opening.status) {
    ctx.addIssue({ code: "custom", message: "Latest attempt contradicts status" })
  }
  if (disclosed && (!opening.groups || !opening.observedAt || !opening.responseSha256 ||
    opening.individualChampionOddsInferred !== false || opening.exactUnderlyingSamplingAlgorithmKnown !== false)) {
    ctx.addIssue({ code: "custom", message: "Disclosure is missing source evidence" })
  }
  if (opening.groups && !opening.groups.every((group, index) => group.sourceIndex === index)) {
    ctx.addIssue({ code: "custom", message: "Source group order changed" })
  }
  const rows = opening.groups?.reduce((total, group) => total + group.rows.length, 0) ?? 0
  if ((opening.status === "captured" && rows === 0) || (opening.status === "empty_disclosure" && rows !== 0)) {
    ctx.addIssue({ code: "custom", message: "Disclosure rows contradict status" })
  }
  if (!disclosed && opening.groups !== undefined) ctx.addIssue({ code: "custom", message: "Undisclosed odds must remain absent" })
})
const sourceSchema = z.object({
  gachaSha256: hash, endpointHost: z.string().min(1), endpointPath: z.literal("/gacha/getOdds"),
  updatedAt: observationTime, sourceCrystalCount: count, attemptedSourceCount: count,
  captureMethod: z.literal("authenticated-read-only-game-api"),
}).strict()
const catalogSchema = z.object({
  version: z.literal(1), source: sourceSchema, counts: z.record(z.string(), count),
  openings: z.record(z.string().min(1), openingSchema),
}).strict()

export type CrystalOddsStatus = z.infer<typeof statusSchema>
export type CrystalOddsRow = z.infer<typeof rowSchema>
export type CrystalOddsGroup = z.infer<typeof groupSchema>
export type CrystalOddsOpening = z.infer<typeof openingSchema>
export type CrystalOddsSource = z.infer<typeof sourceSchema>

function freezeRecordedValue(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return
  for (const child of Object.values(value)) freezeRecordedValue(child)
  Object.freeze(value)
}

/** Source IDs refer to exact openings. Shared contents never imply shared odds. */
export function createCrystalOddsCatalog(input: unknown) {
  const catalog = catalogSchema.parse(input)
  const entries = Object.entries(catalog.openings)
  if (catalog.source.sourceCrystalCount !== entries.length ||
    catalog.source.attemptedSourceCount !== entries.filter(([, opening]) => opening.attempts.length).length) {
    throw new Error("Inconsistent odds capture coverage")
  }
  const actualCounts: Partial<Record<CrystalOddsStatus, number>> = {}
  for (const [, opening] of entries) actualCounts[opening.status] = (actualCounts[opening.status] ?? 0) + 1
  if (Object.keys(catalog.counts).length !== Object.keys(actualCounts).length ||
    Object.entries(actualCounts).some(([status, amount]) => catalog.counts[status] !== amount)) {
    throw new Error("Inconsistent odds status counts")
  }
  freezeRecordedValue(catalog)
  const openings = new Map(entries)
  return {
    source: catalog.source,
    counts: catalog.counts,
    getCrystalOdds(sourceId: string, expectedGachaSha?: string): CrystalOddsOpening | null {
      if (expectedGachaSha !== undefined && expectedGachaSha !== catalog.source.gachaSha256) return null
      return openings.get(sourceId) ?? null
    },
  }
}
