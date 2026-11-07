import { z } from "zod"

const identity = z.string().min(1).max(200)
const sourceCategory = z.enum(["official_announcement", "official_reply", "official_stream_summary", "community_discussion", "community_guide", "community_summary", "community_screenshot"])
export type AcquisitionEvidenceKind = z.infer<typeof sourceCategory> | "game_data"
const sourceSchema = z.object({ id: identity, title: identity, url: z.url().refine(value => {
  const url = new URL(value)
  return url.protocol === "https:" && ["playcontestofchampions.com", "forums.playcontestofchampions.com", "steamcommunity.com", "www.youtube.com"].includes(url.hostname)
}, "Expected a reviewed source URL").optional(), reviewedAt: z.iso.date(), category: sourceCategory.optional(), author: identity.optional(),
  gameData: z.object({ fileName: identity, sha256: z.string().regex(/^[a-f0-9]{64}$/), items: z.array(z.object({ id: identity, description: z.string().min(1) }).strict()).min(1) }).strict().optional(),
}).strict().refine(value => Boolean(value.url) !== Boolean(value.gameData), "Expected a source URL or game-item evidence")
  .refine(value => !value.url || Boolean(value.category), "URL evidence requires an explicit source classification")
  .refine(value => !value.category?.startsWith("official_") || Boolean(value.author && /^(Kabam(?:\s|$)|MCOC Team$|Marvel Contest of Champions$)/.test(value.author)), "Official evidence requires a reviewed Kabam author or publisher")
  .refine(value => !value.url || new URL(value.url).hostname !== "www.youtube.com" || value.category === "community_guide", "Gameplay guides must be labeled as community evidence")
const pieceSchema = z.object({ itemId: identity, name: identity,
  origin: z.object({ label: identity, description: z.string().min(1).max(350), kind: z.enum(["past_event", "quest", "store", "past_mail"]), sourceId: identity }).strict().nullable(),
}).strict()
const methodSchema = z.object({
  id: identity, gameId: identity, rarities: z.array(z.number().int().min(1).max(7)).min(1).refine(values => new Set(values).size === values.length, "Duplicate stars"),
  kind: z.enum(["quest", "event", "pieces", "store", "giveaway"]), title: identity, description: z.string().min(1).max(700),
  requirements: z.array(identity), availability: z.enum(["progression", "source_dependent", "store_access", "event_window"]),
  startsAt: z.iso.datetime({ offset: true }).optional(), endsAt: z.iso.datetime({ offset: true }).optional(), sourceIds: z.array(identity).min(1),
  pieces: z.array(pieceSchema).min(1).max(20).optional(),
}).strict().superRefine((method, context) => {
  const valid = method.availability === "event_window"
    ? method.startsAt && method.endsAt && Date.parse(method.startsAt) < Date.parse(method.endsAt)
    : !method.startsAt && !method.endsAt
  if (!valid) context.addIssue({ code: "custom", message: "Expected a complete ordered event window, or no event dates" })
  if (method.pieces && (method.kind !== "pieces" || method.rarities.length !== 1 || new Set(method.pieces.map(piece => piece.itemId)).size !== method.pieces.length)) {
    context.addIssue({ code: "custom", message: "Expected unique collection pieces at one exact star level" })
  }
})
const catalogSchema = z.object({ version: z.literal(1), reviewedAt: z.iso.date(), sources: z.array(sourceSchema), methods: z.array(methodSchema) }).strict()
type RecordedMethod = z.infer<typeof methodSchema>
export type ChampionAcquisitionPiece = Omit<z.infer<typeof pieceSchema>, "origin"> & {
  origin: (Omit<NonNullable<z.infer<typeof pieceSchema>["origin"]>, "sourceId"> & { source: { title: string; url?: string; kind: AcquisitionEvidenceKind; author?: string } }) | null
  artworkUrl?: string | null
}
export type ChampionAcquisitionMethod = Omit<RecordedMethod, "sourceIds" | "pieces"> & {
  pieces?: ChampionAcquisitionPiece[]
  sources: Array<Pick<z.infer<typeof sourceSchema>, "id" | "title" | "url" | "reviewedAt" | "author"> & { kind: AcquisitionEvidenceKind }>
  periodStatus: "past" | "upcoming" | "within_window" | "not_dated"
}
export type ChampionAcquisition = { reviewedAt: string; methods: ChampionAcquisitionMethod[] }
function freeze(value: unknown): void {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return
  Object.values(value).forEach(freeze); Object.freeze(value)
}

/** Editorial acquisition evidence is separate from crystal membership and obtainable flags. */
export function createChampionAcquisitionCatalog(input: unknown) {
  const catalog = catalogSchema.parse(input)
  const sources = new Map<string, z.infer<typeof sourceSchema>>()
  for (const source of catalog.sources) {
    if (sources.has(source.id)) throw new Error("Duplicate acquisition source")
    if (source.reviewedAt > catalog.reviewedAt) throw new Error("Acquisition source review is newer than the catalog")
    sources.set(source.id, source)
  }
  const byChampion = new Map<string, RecordedMethod[]>(), identities = new Set<string>()
  for (const method of catalog.methods) {
    if (identities.has(method.id)) throw new Error("Duplicate acquisition method")
    identities.add(method.id)
    if (method.sourceIds.some(id => !sources.has(id))) throw new Error("Unknown acquisition source")
    if (method.pieces?.some(piece => piece.origin && !sources.has(piece.origin.sourceId))) throw new Error("Unknown piece acquisition source")
    const rows = byChampion.get(method.gameId) ?? []
    rows.push(method); byChampion.set(method.gameId, rows)
  }
  freeze(catalog)
  const evidenceKind = (source: z.infer<typeof sourceSchema>): AcquisitionEvidenceKind => source.gameData ? "game_data" : source.category!
  return { forChampion(gameId: string | null | undefined, asOf = new Date().toISOString()): ChampionAcquisition {
    const time = Date.parse(asOf)
    if (!Number.isFinite(time)) throw new Error("Invalid acquisition reference time")
    return { reviewedAt: catalog.reviewedAt, methods: (byChampion.get(gameId ?? "") ?? []).map(({ sourceIds, pieces, ...method }) => {
      const periodStatus = method.endsAt && time >= Date.parse(method.endsAt) ? "past" : method.startsAt && time < Date.parse(method.startsAt) ? "upcoming" : method.startsAt ? "within_window" : "not_dated"
      const result: ChampionAcquisitionMethod = { ...method, periodStatus, ...(pieces ? { pieces: pieces.map(({ origin, ...piece }) => {
        if (!origin) return { ...piece, origin: null }
        const { sourceId, ...display } = origin, source = sources.get(sourceId)!
        return { ...piece, origin: { ...display, source: { title: source.title, kind: evidenceKind(source), ...(source.url ? { url: source.url } : {}), ...(source.author ? { author: source.author } : {}) } } }
      }) } : {}), sources: sourceIds.map(id => {
        const source = sources.get(id)!
        return { id: source.id, title: source.title, ...(source.url ? { url: source.url } : {}), ...(source.author ? { author: source.author } : {}), reviewedAt: source.reviewedAt, kind: evidenceKind(source) }
      }) }
      freeze(result); return result
    }) }
  } }
}
