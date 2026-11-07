import { z } from "zod"

const identity = z.string().min(1)
const integer = z.number().int().safe()
const count = integer.nonnegative()
const hash = z.string().regex(/^[a-f0-9]{64}$/)
const rewardSchema = z.object({
  sourceIndex: count,
  type: z.enum(["hero", "hcos", "res", "ebpf", "gf", "ebp", "bp", "inv", "relic2", "gs", "sra", "evta", "oact", "nothing", "utitle", "profilebadge"]),
  data: z.string(), quantity: count.optional(), minQuantity: count.optional(), maxQuantity: count.optional(),
  balance: integer.optional(), action: z.string().optional(), header: z.string().optional(), footer: z.string().optional(),
  context: z.record(z.string(), z.string()).optional(), quantityRangeStatus: z.literal("reversed_in_source").optional(),
  displayName: z.string().optional(),
  gameId: identity.optional(), rarity: integer.min(1).max(7).optional(),
  nestedCrystalId: identity.optional(),
}).strict()
const rewardsSchema = z.array(rewardSchema).superRefine((items, ctx) => {
  items.forEach((item, index) => {
    if (item.sourceIndex !== index) ctx.addIssue({ code: "custom", message: "Reward source indices must preserve entry order" })
    const reversed = item.minQuantity !== undefined && item.maxQuantity !== undefined && item.minQuantity > item.maxQuantity
    if (reversed !== (item.quantityRangeStatus === "reversed_in_source")) {
      ctx.addIssue({ code: "custom", message: "Source quantity range anomaly must be preserved explicitly" })
    }
  })
})
const categorySchema = z.object({ id: identity, displayRarityIndex: count.optional(), rewards: rewardsSchema }).strict()
const bonusSchema = z.object({ id: identity, displayName: z.string(), autoAscend: z.boolean(), rewards: rewardsSchema }).strict()
const pityGroupSchema = z.object({ id: identity, payoutLimit: count.positive(), descriptionTemplate: z.string(),
  shortDescriptionTemplate: z.string(), pityTags: z.array(identity) }).strict()
const pityTemplateSchema = z.object({ id: identity, groupIds: z.array(identity) }).strict()
const crystalSchema = z.object({
  id: identity, name: identity, sourceGroup: z.string(), sourceSet: z.string(), categoryIds: z.array(identity), hideOddsInfo: z.boolean(),
  sourceMetadata: z.object({ setVersion: z.string().optional(), setIndex: integer.optional(), setGroup: z.string().optional(),
    boxVersion: z.string().optional(), endTime: integer.optional(), freeTime: integer.optional(), minItems: count.optional(),
    maxItems: count.optional(), multiplier: count.optional(), pickSet: z.string().optional(), token: z.string().optional(),
    boxGroup: z.string().optional(), tab: z.string().optional() }).strict(),
  selection: z.object({ draw: count.positive(), pick: count.positive() }).strict().refine(value => value.pick <= value.draw).optional(),
  boxRules: z.object({ openLimit: count.positive(), allowManualReset: z.boolean(), manualResetItem: z.string() }).strict().optional(),
  recordedSpend: z.record(z.string(), z.record(z.string(), count)).optional(),
  pityTemplateId: identity.optional(),
  presentation: z.object({ featuredRewards: rewardsSchema.optional(), carouselRewards: rewardsSchema.optional(),
    carouselCategoryIds: z.array(identity).optional(), setPossibleRewards: rewardsSchema.optional() }).strict().optional(),
}).strict()
const sourceSchema = z.object({
  observedAt: z.iso.datetime({ offset: true }), capturedAt: z.iso.datetime({ offset: true }), gachaSha256: hash,
  gacha: z.object({ fileName: identity.refine(value => !/[\\/]/.test(value), "Only a filename may be published"), sha256: hash, bytes: count }).strict(),
  schemaSha256: hash,
  metadata: z.array(z.object({ assembly: identity.refine(value => !/[\\/]/.test(value)), sha256: hash }).strict()),
  displayMetadata: z.array(z.object({ kind: z.enum(["bcg", "gameStore", "localization"]),
    fileName: identity.refine(value => !/[\\/]/.test(value)), sha256: hash, bytes: count }).strict()).optional(),
}).strict().refine(source => source.gachaSha256 === source.gacha.sha256, "Inconsistent source identity")
  .refine(source => Date.parse(source.capturedAt) >= Date.parse(source.observedAt), "Capture precedes observation")
const catalogSchema = z.object({
  version: z.literal(1), source: sourceSchema, numericOddsStatus: z.literal("not_in_static_catalog"),
  crystals: z.array(crystalSchema), categories: z.array(categorySchema), bonusRewards: z.array(bonusSchema),
  pityTemplates: z.array(pityTemplateSchema), pityGroups: z.array(pityGroupSchema),
  coverage: z.record(z.string(), z.union([count, z.record(z.string(), count)])),
}).strict()

export type CrystalOpeningReward = z.infer<typeof rewardSchema>
export type CrystalOpeningCategory = z.infer<typeof categorySchema>
export type CrystalOpeningDefinition = z.infer<typeof crystalSchema>
export type CrystalOpeningSource = z.infer<typeof sourceSchema>
export type CrystalConditionalBonus = { categoryId: string; rewardIndex: number; bonusReward: z.infer<typeof bonusSchema> }
export type CrystalOpening = CrystalOpeningDefinition & {
  source: CrystalOpeningSource
  categories: CrystalOpeningCategory[]
  conditionalBonuses: CrystalConditionalBonus[]
  pity: { template: z.infer<typeof pityTemplateSchema>; groups: z.infer<typeof pityGroupSchema>[] } | null
}

function indexById<T extends { id: string }>(rows: T[], label: string): Map<string, T> {
  const map = new Map<string, T>()
  for (const row of rows) {
    if (map.has(row.id)) throw new Error(`Duplicate ${label}: ${row.id}`)
    map.set(row.id, row)
  }
  return map
}

function required<T>(map: Map<string, T>, id: string, label: string): T {
  const row = map.get(id)
  if (!row) throw new Error(`Unknown ${label}: ${id}`)
  return row
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return
  for (const child of Object.values(value)) deepFreeze(child)
  Object.freeze(value)
}

/** Exact source IDs are opening contracts. Equal membership does not establish equal odds or bonuses. */
export function createCrystalOpeningCatalog(input: unknown) {
  const catalog = catalogSchema.parse(input)
  for (const [key, actual] of [["definitions", catalog.crystals.length], ["categories", catalog.categories.length],
    ["rewardEntries", catalog.categories.reduce((sum, category) => sum + category.rewards.length, 0)]] as const) {
    if (catalog.coverage[key] !== actual) throw new Error(`Inconsistent all-reward coverage: ${key}`)
  }
  const crystals = indexById(catalog.crystals, "crystal")
  const categories = indexById(catalog.categories, "category")
  const bonuses = indexById(catalog.bonusRewards, "bonus reward")
  const templates = indexById(catalog.pityTemplates, "pity template")
  const groups = indexById(catalog.pityGroups, "pity group")
  for (const category of categories.values()) {
    for (const reward of category.rewards) {
      if (reward.context?.bonusReward) required(bonuses, reward.context.bonusReward, "bonus reward")
    }
  }
  const allRewards = [...catalog.categories.flatMap(category => category.rewards), ...catalog.bonusRewards.flatMap(bonus => bonus.rewards),
    ...catalog.crystals.flatMap(crystal => [
      ...(crystal.presentation?.featuredRewards ?? []), ...(crystal.presentation?.carouselRewards ?? []), ...(crystal.presentation?.setPossibleRewards ?? []),
    ])]
  for (const reward of allRewards) {
    if (reward.nestedCrystalId) {
      if (reward.type !== "gs" && reward.type !== "gf") throw new Error("Only verified crystal token reward types can reference a nested crystal")
      required(crystals, reward.nestedCrystalId, "nested crystal")
    }
  }
  for (const template of templates.values()) for (const id of template.groupIds) required(groups, id, "pity group")
  for (const crystal of crystals.values()) {
    for (const id of crystal.categoryIds) required(categories, id, "category")
    for (const id of crystal.presentation?.carouselCategoryIds ?? []) required(categories, id, "carousel category")
    if (crystal.pityTemplateId) required(templates, crystal.pityTemplateId, "pity template")
  }
  // Parsed snapshot is private, immutable data. Selected views can reuse rows
  // without allowing one caller to poison later reads or cloning 40k entries.
  deepFreeze(catalog)
  return {
    source: catalog.source,
    coverage: catalog.coverage,
    listCrystalOpenings: (): readonly CrystalOpeningDefinition[] => catalog.crystals,
    getCrystalOpeningCategory: (id: string): CrystalOpeningCategory | null => categories.get(id) ?? null,
    assertSourceHash(expected: string) {
      if (catalog.source.gachaSha256 !== expected) throw new Error("Crystal opening snapshot differs from the requested membership snapshot")
    },
    getCrystalOpening(id: string): CrystalOpening | null {
      const crystal = crystals.get(id)
      if (!crystal) return null
      const directCategories = crystal.categoryIds.map(cid => required(categories, cid, "category"))
      const conditionalBonuses: CrystalConditionalBonus[] = []
      for (const category of directCategories) {
        for (const reward of category.rewards) {
          const bonusId = reward.context?.bonusReward
          if (bonusId) conditionalBonuses.push({ categoryId: category.id, rewardIndex: reward.sourceIndex,
            bonusReward: required(bonuses, bonusId, "bonus reward") })
        }
      }
      const template = crystal.pityTemplateId ? required(templates, crystal.pityTemplateId, "pity template") : null
      return { ...crystal, source: catalog.source, categories: directCategories, conditionalBonuses,
        pity: template ? { template, groups: template.groupIds.map(gid => required(groups, gid, "pity group")) } : null }
    },
  }
}
