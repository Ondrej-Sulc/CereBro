import { z } from "zod"
import type { CrystalAvailabilityStatus } from "./crystal-availability-labels"
export { CRYSTAL_AVAILABILITY_FILTERS, crystalAvailabilityFilter, crystalAvailabilityLabel, type CrystalAvailabilityFilter, type CrystalAvailabilityStatus } from "./crystal-availability-labels"
const identity = z.string().min(1).max(250)
const sourceSchema = z.object({ id: identity, title: identity, kind: z.enum(["official_announcement", "catalog_review"]), author: identity.optional(), url: z.url().refine(value => new URL(value).protocol === "https:" && ["playcontestofchampions.com", "forums.playcontestofchampions.com"].includes(new URL(value).hostname)).optional(), publishedAt: z.string().optional(), contentSha256: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict().refine(source => source.kind !== "official_announcement" || Boolean(source.url && source.author && /^(Kabam(?:\s|$)|MCOC Team$|Marvel Contest of Champions$)/.test(source.author)), "Official availability evidence requires a reviewed Kabam author or publisher")
const recordSchema = z.object({ sourceIds: z.array(identity).min(1), kind: z.enum(["recurring", "event", "past_event"]), sourceId: identity, description: z.string().min(1).max(650), startsOn: z.iso.date().optional(), endsOn: z.iso.date().optional() }).strict().superRefine((record, context) => {
  if (record.kind === "event" ? !record.startsOn || !record.endsOn || record.startsOn > record.endsOn : record.startsOn || record.endsOn) context.addIssue({ code: "custom", message: "Expected an ordered event window, or no dates for an undated review" })
})
const schema = z.object({ version: z.literal(1), reviewedAt: z.iso.date(), sources: z.array(sourceSchema), records: z.array(recordSchema) }).strict()
export type CrystalAvailability = {
  status: CrystalAvailabilityStatus
  description: string
  reviewedAt: string | null
  startsOn?: string
  endsOn?: string
  source: Omit<z.infer<typeof sourceSchema>, "id" | "contentSha256"> | null
}

/** Availability evidence is independent of recorded contents, rates and named editions. */
export function createCrystalAvailability(input: unknown) {
  const catalog = schema.parse(input)
  const sources = new Map(catalog.sources.map(source => [source.id, source]))
  if (sources.size !== catalog.sources.length) throw new Error("Duplicate availability source")
  const records = new Map<string, z.infer<typeof recordSchema>>()
  for (const record of catalog.records) {
    const source = sources.get(record.sourceId)
    if (!source) throw new Error("Unknown availability evidence source")
    if (record.kind !== "recurring" && (source.kind !== "official_announcement" || !source.url)) throw new Error("Event reviews require an official announcement")
    for (const id of record.sourceIds) {
      if (records.has(id)) throw new Error("Duplicate crystal availability identity")
      records.set(id, record)
    }
  }
  const unknown: CrystalAvailability = Object.freeze({ status: "unverified", reviewedAt: null, source: null, description: "This crystal is recorded in the catalog. A current acquisition source has not been verified." })
  const projected = new Map<string, CrystalAvailability>()
  let projectedDay: string | null = null
  return {
    reviewedSourceIds: Object.freeze([...records.keys()]),
    forSource(id: string, asOf = new Date().toISOString().slice(0, 10)): CrystalAvailability {
      if (asOf !== projectedDay) {
        z.iso.date().parse(asOf)
        projectedDay = asOf
        projected.clear()
      }
      const cached = projected.get(id)
      if (cached) return cached
      const record = records.get(id)
      if (!record) return unknown
      const source = sources.get(record.sourceId)!
      const status = record.kind === "event" ? asOf < record.startsOn! ? "upcoming" : asOf > record.endsOn! ? "past_event" : "current_event" : record.kind
      const result: CrystalAvailability = Object.freeze({ status, reviewedAt: catalog.reviewedAt, description: record.description, ...(record.startsOn ? { startsOn: record.startsOn, endsOn: record.endsOn } : {}), source: Object.freeze({ title: source.title, kind: source.kind, ...(source.author ? { author: source.author } : {}), ...(source.url ? { url: source.url } : {}), ...(source.publishedAt ? { publishedAt: source.publishedAt } : {}) }) })
      projected.set(id, result)
      return result
    },
  }
}
