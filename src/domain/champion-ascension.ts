import { z } from "zod"
import type { ChampionAscensionEligibility } from "./champion-ascension-eligibility"
import { classifyAscensionBlueprint } from "./champion-ascension-classification"
export type { ChampionAscensionEligibility } from "./champion-ascension-eligibility"
export { classifyAscensionBlueprint } from "./champion-ascension-classification"
export type { AscensionBlueprintIdentity, AscensionBlueprintClassification } from "./champion-ascension-classification"

const identity = z.string().min(1).refine(value => value === value.trim(), "Identity contains surrounding whitespace")
const fileName = identity.refine(value => !/[\\/:]/.test(value), "Expected a filename, not a machine path")
const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const costSchema = z.object({ type: z.enum(["inv", "res"]), id: identity, quantity: z.number().int().positive() }).strict()
const modifiers = { attackBonus: z.number().finite(), healthBonus: z.number().finite(), challengeRating: z.number().int(), mightGain: z.number().finite(), buffIds: z.array(identity) }
const tierSchema = z.object({ id: identity, cost: z.array(costSchema), ...modifiers }).strict()
const stepSchema = z.object({ level: z.number().int().positive(), tierId: identity, cost: z.array(costSchema).min(1), ...modifiers }).strict()
const resourceSchema = z.object({
  type: z.enum(["inv", "res"]), id: identity, metadataResolved: z.boolean(), name: identity.optional(), description: z.string().optional(),
  definitionEnabled: z.boolean().optional(), usageTags: z.string().optional(), rankRestriction: z.number().int().optional(), signatureRestriction: z.string().optional(),
  artwork: z.object({ reference: identity, onCdn: z.boolean() }).strict().optional(),
}).strict().superRefine((resource, context) => {
  if (!resource.metadataResolved && Object.keys(resource).some(key => !["type", "id", "metadataResolved"].includes(key))) {
    context.addIssue({ code: "custom", message: "Unresolved resource contains unverified display metadata" })
  }
})
const fileSourceSchema = z.object({ fileName, sha256, fileSha256: sha256, bytes: z.number().int().positive(), mtimeUtc: z.iso.datetime({ offset: true }) }).strict()
const catalogSchema = z.object({
  version: z.literal(1),
  source: z.object({
    observedAt: z.iso.datetime({ offset: true }), capturedAt: z.iso.datetime({ offset: true }), bcg: fileSourceSchema,
    gameStore: fileSourceSchema.nullable(), metadata: z.array(z.object({ assembly: fileName, sha256 }).strict()).min(1), schemaSha256: sha256,
  }).strict(),
  tiers: z.array(tierSchema),
  blueprints: z.array(z.object({
    id: identity, gameId: identity, name: identity, rarity: z.number().int().min(1).max(7), heroClass: identity.nullable(),
    userCollection: z.boolean(), isEventCharacter: z.boolean(), eligibleTierIds: z.array(identity), maxRecordedLevel: z.number().int().nonnegative(), steps: z.array(stepSchema),
  }).strict()),
  resources: z.array(resourceSchema),
  coverage: z.object({
    sourceBlueprints: z.number().int().positive(), excludedBlueprints: z.number().int().nonnegative(), blueprints: z.number().int().positive(),
    collectibleBlueprints: z.number().int().positive(), globalTiers: z.number().int().positive(), sourceGlobalTiers: z.number().int().positive(),
    excludedGlobalTierIds: z.array(identity), costResources: z.number().int().nonnegative(),
  }).strict(),
}).strict()

export type ChampionAscensionCatalogData = z.infer<typeof catalogSchema>
export type AscensionCost = z.infer<typeof costSchema>
export type AscensionStep = z.infer<typeof stepSchema>
export type AscensionResource = z.infer<typeof resourceSchema>
export type ChampionAscensionRules = {
  gameId: string; rarity: number; blueprintId: string; maxLevel: number; steps: AscensionStep[]; observedAt: string
}
/** Effective combat multipliers (identity 1), plus additive CR/Might contributions. */
export type AscensionEffects = { attackMultiplier: number; healthMultiplier: number; challengeRating: number; mightGain: number }

/** A known no-tier rule clamps to zero; missing data never grants an ascension. */
export function clampRecordedAscensionLevel(rules: Pick<ChampionAscensionRules, "maxLevel"> | null | undefined, level: number) {
  if (!rules || !Number.isFinite(level)) return 0
  return Math.max(0, Math.min(rules.maxLevel, Math.round(level)))
}

/**
 * Compose incremental Attack/Health bonuses from completed exact-rule steps.
 * CR/Might remain additive; raw step tuning is unchanged. No integer rounding or
 * prestige calculation here. See docs/champion-combat-ascension.md for evidence.
 */
export function getAscensionEffects(rules: ChampionAscensionRules | null | undefined, level: number): AscensionEffects {
  const target = clampRecordedAscensionLevel(rules, level)
  return (rules?.steps ?? []).filter(step => step.level <= target).reduce((result, step) => ({
    attackMultiplier: result.attackMultiplier * (1 + step.attackBonus), healthMultiplier: result.healthMultiplier * (1 + step.healthBonus),
    challengeRating: result.challengeRating + step.challengeRating, mightGain: result.mightGain + step.mightGain,
  }), { attackMultiplier: 1, healthMultiplier: 1, challengeRating: 0, mightGain: 0 })
}

function cloneRules(rules: ChampionAscensionRules): ChampionAscensionRules {
  return { ...rules, steps: rules.steps.map(step => ({ ...step, cost: step.cost.map(cost => ({ ...cost })), buffIds: [...step.buffIds] })) }
}

function unique<T>(rows: T[], key: (row: T) => string, label: string) {
  const result = new Map<string, T>()
  for (const row of rows) {
    const id = key(row)
    if (result.has(id)) throw new Error(`Duplicate ascension ${label}: ${id}`)
    result.set(id, row)
  }
  return result
}

/** Validates a sanitized snapshot and indexes collectible paths, including exact reviewed player events. */
export function createChampionAscensionCatalog(input: unknown) {
  const data = catalogSchema.parse(input)
  const tiers = unique(data.tiers, tier => tier.id, "tier")
  const blueprints = unique(data.blueprints, blueprint => blueprint.id, "blueprint")
  const resources = unique(data.resources, resource => `${resource.type}:${resource.id}`, "resource")
  const excludedTiers = new Set(data.coverage.excludedGlobalTierIds)
  const collectible = data.blueprints.filter(blueprint => classifyAscensionBlueprint(blueprint) !== "excluded")
  if (data.coverage.blueprints !== blueprints.size || data.coverage.collectibleBlueprints !== collectible.length
    || data.coverage.sourceBlueprints !== blueprints.size + data.coverage.excludedBlueprints
    || data.coverage.globalTiers !== tiers.size || excludedTiers.size !== data.coverage.excludedGlobalTierIds.length
    || [...excludedTiers].some(id => tiers.has(id)) || data.coverage.sourceGlobalTiers !== tiers.size + excludedTiers.size
    || data.coverage.costResources !== resources.size) throw new Error("Ascension catalog coverage mismatch")
  if (Date.parse(data.source.capturedAt) < Date.parse(data.source.observedAt)) throw new Error("Ascension capture predates observation")
  for (const blueprint of data.blueprints) {
    if (blueprint.maxRecordedLevel !== blueprint.steps.length || blueprint.eligibleTierIds.length !== blueprint.steps.length
      || new Set(blueprint.eligibleTierIds).size !== blueprint.eligibleTierIds.length) throw new Error(`Ascension step count mismatch: ${blueprint.id}`)
    blueprint.steps.forEach((step, index) => {
      if (step.level !== index + 1 || step.tierId !== blueprint.eligibleTierIds[index]) throw new Error(`Ascension step order mismatch: ${blueprint.id}`)
      const tier = tiers.get(step.tierId)
      if (!tier) throw new Error(`Unknown ascension tier: ${step.tierId}`)
      if ((["attackBonus", "healthBonus", "challengeRating", "mightGain"] as const).some(key => step[key] !== tier[key])
        || JSON.stringify(step.buffIds) !== JSON.stringify(tier.buffIds)) throw new Error(`Ascension modifier mismatch: ${blueprint.id}/${step.tierId}`)
      for (const cost of step.cost) if (!resources.has(`${cost.type}:${cost.id}`)) throw new Error(`Unknown ascension resource: ${cost.type}/${cost.id}`)
    })
  }
  const byChampion = new Map<string, ChampionAscensionRules[]>()
  const byBlueprint = new Map<string, ChampionAscensionRules>()
  const rarityBounds = new Map<number, number>()
  for (const blueprint of collectible) {
    const rows = byChampion.get(blueprint.gameId) ?? []
    if (rows.some(row => row.rarity === blueprint.rarity)) throw new Error(`Conflicting collectible ascension rules: ${blueprint.gameId}/${blueprint.rarity}`)
    const rules: ChampionAscensionRules = { gameId: blueprint.gameId, rarity: blueprint.rarity, blueprintId: blueprint.id,
      maxLevel: blueprint.maxRecordedLevel, steps: blueprint.steps, observedAt: data.source.observedAt }
    rows.push(rules); byChampion.set(blueprint.gameId, rows); byBlueprint.set(blueprint.id, rules)
    rarityBounds.set(blueprint.rarity, Math.max(rarityBounds.get(blueprint.rarity) ?? 0, rules.maxLevel))
  }
  for (const rows of byChampion.values()) rows.sort((a, b) => b.rarity - a.rarity)
  const eligibility = new Map<string, ChampionAscensionEligibility>()
  for (const [gameId, rows] of byChampion) eligibility.set(gameId, {
    ascendableRarities: rows.filter(row => row.maxLevel > 0).map(row => row.rarity),
    recordedRarities: rows.map(row => row.rarity),
  })
  const names = new Map(collectible.map(blueprint => [blueprint.gameId, blueprint.name]))
  const copyEligibility = (gameId: string): ChampionAscensionEligibility => {
    const row = eligibility.get(gameId)
    return { ascendableRarities: [...(row?.ascendableRarities ?? [])], recordedRarities: [...(row?.recordedRarities ?? [])] }
  }
  return {
    source: structuredClone(data.source),
    getChampionAscensionEligibility(gameId: string | null | undefined): ChampionAscensionEligibility {
      return copyEligibility(gameId ?? "")
    },
    listChampionAscensionEligibility() {
      return [...eligibility.keys()].map(gameId => ({ gameId, name: names.get(gameId)!, ...copyEligibility(gameId) }))
    },
    getChampionAscension(gameId: string | null | undefined, rarity: number | null | undefined): ChampionAscensionRules | null {
      if (!gameId || !Number.isInteger(rarity)) return null
      const rules = byChampion.get(gameId)?.find(row => row.rarity === rarity)
      return rules ? cloneRules(rules) : null
    },
    getChampionAscensionRules(gameId: string | null | undefined): ChampionAscensionRules[] {
      return (byChampion.get(gameId ?? "") ?? []).map(cloneRules)
    },
    getChampionAscensionByBlueprintId(blueprintId: string | null | undefined): ChampionAscensionRules | null {
      const rules = byBlueprint.get(blueprintId ?? "")
      return rules ? cloneRules(rules) : null
    },
    getAscensionResource(type: AscensionCost["type"], id: string): AscensionResource | null {
      const resource = resources.get(`${type}:${id}`)
      return resource ? structuredClone(resource) : null
    },
    maxRecordedAscensionForRarity(rarity: number | null | undefined): number { return rarityBounds.get(rarity ?? 0) ?? 0 },
  }
}
