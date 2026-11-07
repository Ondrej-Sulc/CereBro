import { z } from "zod"
import type { AscensionResource, ChampionAscensionRules } from "./champion-ascension"
import type { ChampionAscensionAcquisitionSources, ChampionAscensionAcquisitionRoute, ChampionAscensionMaterialPath } from "./champion-ascension-acquisition-types"

const text = z.string().min(1).max(1200).refine(value => value === value.trim(), "Surrounding whitespace")
const id = z.string().regex(/^[a-z0-9_-]+$/).max(200)
const instant = z.iso.datetime({ offset: true })
const date = z.iso.date()
const boundary = z.union([date, instant])
const sourceSchema = z.object({
  id, title: text, kind: z.enum(["official_announcement", "official_stream_summary", "static_store", "quest_capture"]),
  publisher: text, creditedTo: text.optional(),
  url: z.url().refine(value => {
    const url = new URL(value)
    return url.protocol === "https:" && ["playcontestofchampions.com", "forums.playcontestofchampions.com"].includes(url.hostname)
  }, "Expected official source URL").optional(),
  publishedAt: boundary.nullable(), reviewedAt: date, capturedAt: instant.optional(), fileModifiedAt: instant.optional(),
  fileName: text.refine(value => !/[\\/:]/.test(value), "Expected filename").optional(), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
}).strict().superRefine((source, context) => {
  const official = source.kind.startsWith("official_")
  if (official ? !source.url || source.fileName || source.sha256 || !["The MCoC Team", "Kabam (Osaurus) Rex"].includes(source.publisher)
    : Boolean(source.url) || !source.fileName || !source.sha256 || source.publishedAt !== null) {
    context.addIssue({ code: "custom", message: "Invalid official citation or captured game-data provenance" })
  }
  if ((source.publishedAt && source.publishedAt.slice(0, 10) > source.reviewedAt) || (source.capturedAt && source.capturedAt.slice(0, 10) > source.reviewedAt)) {
    context.addIssue({ code: "custom", message: "Evidence postdates review" })
  }
  if (source.kind === "official_stream_summary" && !source.creditedTo) context.addIssue({ code: "custom", message: "Published summaries require their credited author" })
})
const windowSchema = z.object({ start: boundary.nullable(), end: boundary.nullable(), timeZone: text.nullable(), label: text }).strict().superRefine((window, context) => {
  if (window.start && window.end && (window.start.length !== window.end.length && (window.start.length === 10 || window.end.length === 10)
    || Date.parse(window.start) >= Date.parse(window.end))) context.addIssue({ code: "custom", message: "Invalid or unordered acquisition window" })
  if ((window.start?.length === 10 || window.end?.length === 10) && window.timeZone !== null) context.addIssue({ code: "custom", message: "Date-only source must retain unspecified timezone" })
})
const rewardSchema = z.object({ type: z.enum(["inv", "hero", "res"]), id, quantity: z.number().int().positive(), role: z.enum(["ascension_material", "champion", "other"]) }).strict().superRefine((reward, context) => {
  const material = reward.type === "inv" && /^(ascension_token_(champion|class)_[a-z0-9_]+|primordial_dust_t[1-3])$/.test(reward.id)
  if ((reward.role === "champion") !== (reward.type === "hero") || (reward.role === "ascension_material") !== material) context.addIssue({ code: "custom", message: "Reward role disagrees with exact reward identity" })
})
const offerSchema = z.object({
  id, label: text, sourceId: id, binding: text.nullable(), rewards: z.array(rewardSchema),
  price: z.object({ currency: text, quantity: z.number().int().positive() }).strict().nullable(),
  purchaseLimit: z.number().int().positive().nullable(), conditions: z.array(text),
}).strict()
const routeSchema = z.object({
  id, gameId: id, rarity: z.literal(7), kind: z.enum(["exchange", "challenge", "event", "sale", "quest", "definition"]), title: text, description: text,
  confidence: z.enum(["high", "partial", "definition_only"]), starScope: z.enum(["explicit", "recorded_path_match"]),
  requiredTokenIds: z.array(id).min(1), availability: z.enum(["historical", "activity_dependent", "current_stock_unverified", "definition_only"]),
  window: windowSchema.nullable(), conditions: z.array(text), missingEvidence: z.array(text).min(1), offers: z.array(offerSchema), sourceIds: z.array(id).min(1),
  canonicalGuard: z.literal("exact_a1_quest_reward").optional(),
}).strict()
const schema = z.object({ version: z.literal(1), reviewedAt: date, sources: z.array(sourceSchema), routes: z.array(routeSchema) }).strict()
type RecordedRoute = z.infer<typeof routeSchema>
type Dependencies = {
  getRules(gameId: string): ChampionAscensionRules[]
  getResource(type: "inv" | "res", id: string): AscensionResource | null
}

function assertUnique(values: string[], label: string) {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate acquisition ${label}`)
}

function periodStatus(route: RecordedRoute, asOf: string): ChampionAscensionAcquisitionRoute["periodStatus"] {
  const { start, end } = route.window ?? { start: null, end: null }
  // Date-only announcements have no timezone. Compare calendar dates against
  // the supplied reference date (UTC calendar date for instant references),
  // retaining date-only values in the DTO. Never invent a source timestamp.
  const comparison = (value: string) => value.length === 10 ? asOf.slice(0, 10).localeCompare(value) : Math.sign(Date.parse(asOf) - Date.parse(value))
  if (start && comparison(start) < 0) return "upcoming"
  if (end && (end.length === 10 ? comparison(end) > 0 : comparison(end) >= 0)) return "past"
  if (start && end) return "within_announced_period"
  if (start) return "start_passed_end_unknown"
  return route.availability === "historical" ? "past" : "not_dated"
}

function canonicalMatch(route: RecordedRoute, rule: ChampionAscensionRules | undefined): boolean {
  if (!rule || rule.gameId !== route.gameId || rule.rarity !== route.rarity || rule.maxLevel <= 0 || !route.requiredTokenIds.every(token => rule.steps.some(step => step.cost.some(cost => cost.type === "inv" && cost.id === token)))) return false
  if (route.canonicalGuard) {
    // Exact quest reward and canonical recipe must agree. This guard cannot
    // create eligibility or widen the separately reviewed event exception.
    if (route.gameId !== "carina_white" || rule.blueprintId !== "carina_white_t7" || rule.maxLevel !== 1 || rule.steps.length !== 1) return false
    const costs = rule.steps[0].cost
    const rewards = route.offers[0]?.rewards
    return costs.length === 2 && rewards?.length === 2 && rewards.every(reward => costs.some(cost => cost.type === reward.type && cost.id === reward.id && cost.quantity === reward.quantity))
  }
  return true
}

/** Reviewed source evidence, independent of crystals, account gates and stock. */
export function createChampionAscensionAcquisitionCatalog(input: unknown, dependencies: Dependencies) {
  const data = schema.parse(input)
  assertUnique(data.sources.map(source => source.id), "source")
  assertUnique(data.routes.map(route => route.id), "route")
  const sources = new Map(data.sources.map(source => [source.id, source]))
  const byChampion = new Map<string, RecordedRoute[]>()
  for (const source of data.sources) if (source.reviewedAt > data.reviewedAt) throw new Error("Source review postdates acquisition catalog")
  for (const route of data.routes) {
    assertUnique(route.sourceIds, "source reference")
    assertUnique(route.requiredTokenIds, "required token")
    assertUnique(route.offers.map(offer => offer.id), "offer")
    if (route.sourceIds.some(id => !sources.has(id))) throw new Error("Unknown acquisition source")
    if (route.requiredTokenIds.some(token => token !== `ascension_token_champion_${route.gameId}`)) throw new Error("Acquisition token identity mismatch")
    const definition = route.kind === "definition"
    if (definition !== (route.confidence === "definition_only") || definition !== (route.availability === "definition_only")) throw new Error("Definition-only evidence cannot be an obtainable route")
    if (!definition && !route.sourceIds.some(id => sources.get(id)!.kind.startsWith("official_") || sources.get(id)!.kind === "quest_capture")) throw new Error("Acquisition mechanism requires primary evidence")
    for (const offer of route.offers) {
      if (!route.sourceIds.includes(offer.sourceId)) throw new Error("Offer source missing from route citations")
      const source = sources.get(offer.sourceId)!
      if (["static_store", "quest_capture"].includes(source.kind) && !offer.binding) throw new Error("Exact game-data binding required")
      if (source.kind === "static_store" && offer.price) throw new Error("Static catalog does not establish a verified price")
      if (source.kind === "static_store" && !offer.binding!.includes(`[Name=${offer.id}].Redeemers`)) throw new Error("Static offer binding identity mismatch")
      assertUnique(offer.rewards.map(reward => `${reward.type}:${reward.id}`), "reward")
      for (const reward of offer.rewards) {
        if (reward.id.startsWith("ascension_token_champion_") && !route.requiredTokenIds.includes(reward.id)) throw new Error("Unrelated champion-token payout")
        if (reward.type === "hero" && reward.id !== `${route.gameId}_t${route.rarity}`) throw new Error("Unrelated champion reward")
      }
    }
    if ((route.gameId === "carina_white") !== Boolean(route.canonicalGuard)
      || (route.canonicalGuard && (route.kind !== "quest" || route.offers.length !== 1 || route.offers[0].binding !== "epilogue_ch04_q04.masteryCompletionRewards"))) throw new Error("Invalid canonical quest guard")
    const rows = byChampion.get(route.gameId) ?? []
    rows.push(route); byChampion.set(route.gameId, rows)
  }

  return {
    forChampion(gameId: string, rarity?: number, asOf = new Date().toISOString()): ChampionAscensionAcquisitionSources {
      if (rarity !== undefined && (!Number.isInteger(rarity) || rarity < 1 || rarity > 7)) throw new Error("Invalid acquisition rarity")
      const reference = boundary.parse(asOf)
      const evaluatedAsOf = reference.length === 10 ? reference : new Date(reference).toISOString()
      const rules = dependencies.getRules(gameId)
      const stars = rarity === undefined ? [7, 6, 5, 4, 3, 2, 1] : [rarity]
      const paths: ChampionAscensionMaterialPath[] = stars.map(star => {
        const rule = rules.find(rule => rule.rarity === star)
        const positive = Boolean(rule && rule.maxLevel > 0)
        const personal = Boolean(rule?.steps.some(step => step.cost.some(cost => cost.type === "inv" && cost.id.startsWith("ascension_token_champion_"))))
        return {
          rarity: star, state: !rule ? "unknown" : positive ? "recorded_path" : "recorded_empty",
          blueprintId: rule?.blueprintId ?? null, observedAt: rule?.observedAt ?? null, maxLevel: rule?.maxLevel ?? null,
          materialKind: positive ? personal ? "champion_specific" : "shared" : null,
          steps: (rule?.steps ?? []).map(step => ({ level: step.level, costs: step.cost.map(cost => ({ ...cost, name: dependencies.getResource(cost.type, cost.id)?.name ?? null })) })),
          guidance: !rule ? "No ascension path metadata is recorded at this star level."
            : !positive ? "The recorded blueprint has no ascension tiers at this star level."
              : personal ? "This recorded path requires the exact champion token and other listed materials. Source evidence does not verify current availability or account access."
                : "Ascend with shared Primordial Dust and the recorded upgrade cost. Champion-specific rewards are not required. Account gates and affordability remain unverified.",
          materialFinderHref: positive ? "/crystals?reward=ascension" : null,
        }
      })
      const projected = (byChampion.get(gameId) ?? []).filter(route => stars.includes(route.rarity) && canonicalMatch(route, rules.find(rule => rule.rarity === route.rarity))).map(route => {
        const { sourceIds, canonicalGuard: _guard, ...record } = route
        const period = periodStatus(route, evaluatedAsOf)
        const availability = route.availability === "definition_only" ? "definition_only" : period === "upcoming" ? "upcoming"
          : period === "past" ? "historical" : period === "within_announced_period" ? "activity_dependent" : route.availability
        return { ...record, periodStatus: period, availability, sources: sourceIds.map(id => sources.get(id)!) } satisfies ChampionAscensionAcquisitionRoute
      })
      return structuredClone({ gameId, reviewedAt: data.reviewedAt, evaluatedAsOf, accountStatus: "unverified", paths,
        routes: projected.filter(route => route.kind !== "definition"), definitions: projected.filter(route => route.kind === "definition") })
    },
  }
}
