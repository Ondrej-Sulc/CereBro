import { z } from "zod"
import { crystalArtworkKey, crystalArtworkReferenceSchema, publishedCrystalArtworkSchema } from "./crystal-artwork"
import { describeCrystalFamily, type CrystalFamilyMembership } from "./crystal-families"
import { CRYSTAL_CATEGORIES, classifyCrystalCategory, type CrystalCategoryId } from "./crystal-categories"
import type { CrystalAvailability } from "./crystal-availability"

const identity = z.string().min(1)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/)
const selection = z.object({ draw: z.number().int().positive(), pick: z.number().int().positive() })
  .refine(value => value.pick <= value.draw, "Selection exceeds draw count")

const catalogSchema = z.object({
  version: z.literal(1),
  source: z.object({
    observedAt: z.iso.datetime({ offset: true }),
    gachaSha256: sha256,
    bcgSha256: sha256,
    metadata: z.array(z.object({ assembly: identity, sha256 })),
  }),
  tiers: z.array(z.object({ id: identity, championId: identity, rarity: z.number().int().min(1).max(7) })),
  champions: z.array(z.object({ id: identity, name: identity })).optional(),
  pools: z.array(z.object({ id: identity, heroTierIds: z.array(identity),
    heroCosmeticRewards: z.array(z.object({ tierId: identity, cosmeticId: z.literal("first_edition"), sourceData: identity })).optional(),
  })),
  crystals: z.array(z.object({
    id: identity, name: identity, group: z.string(), set: z.string(),
    categoryIds: z.array(identity), selection: selection.nullable(),
    artwork: crystalArtworkReferenceSchema.nullish(),
    bannerArtwork: crystalArtworkReferenceSchema.nullish(),
    promotedChampionIds: z.array(identity).optional(),
  })),
  coverage: z.object({
    definitions: z.number().int().positive(),
    definitionsWithDirectHeroes: z.number().int().positive(),
    rewardItemTypes: z.record(z.string(), z.number().int().nonnegative()),
    directRewardsOnly: z.literal(true),
  }),
})

export type CrystalCatalogData = z.infer<typeof catalogSchema>
export type ChampionCrystal = {
  name: string
  sourceIds: string[]
  rarities: number[]
  isMainPool: boolean
  category?: CrystalCategoryId
  selection: { draw: number; pick: number } | null
  artworkUrl?: string | null
  bannerArtworkUrl?: string | null
  family?: CrystalFamilyMembership
  availability?: CrystalAvailability
  availabilitySourceId?: string
}
export type ChampionCrystalAvailability = {
  observedAt: string
  crystals: ChampionCrystal[]
  /** Present on the compact initial projection; other pools load on demand. */
  otherCounts?: Record<string, number>
}
export type CrystalReward = { championId: string; rarities: number[]; tierIds: string[]; sourceName?: string; cosmeticRewards?: { cosmeticId: string; tierId: string; rarity: number }[] }
export type CrystalCatalogVariant = ChampionCrystal & { id: string }
export type CrystalCatalogFamily = {
  id: string; name: string; artworkUrl: string | null; isMainPool: boolean; rarities: number[]; category: CrystalCategoryId
  championCount: number; championCountsByRarity: Record<string, number>; variants: CrystalCatalogVariant[]
}
export type CrystalCatalogDetails = CrystalCatalogFamily & { contents: CrystalReward[] }

// Editorial priority only. These exact source IDs do not assert store availability.
// Antiquated versions, dated events and similarly named special pools stay in the archive.
const MAIN_CRYSTALS = [
  "7_star_hero_shard_crystal", "7_star_titan_hero_shard_crystal",
  "6_star_hero_shard_crystal", "5_star_hero_shard_crystal", "4_star_hero_shard_crystal", "4_star_hero_crystal",
  "3_star_hero_shard_crystal", "3_star_hero_crystal",
  "7star_nexus_crystal", "7star_nexus_crystal_1_of_5",
  "7_star_nexus_titan_hero_shard_crystal", "7_star_nexus_colossal_titan_hero_crystal",
  "sg_6star_nexus_crystal", "sg_5star_nexus_crystal",
  "valiant_crystal", "valiant_nexus_crystal", "paragon_crystal_v2", "paragon_shards_v2", "paragon_nexus_crystal",
  "cavalier_crystal_v2", "cavalier_shards_v2", "grandmaster_crystals_v2", "grandmaster_shard_v2",
  "premium_hero_shard", "premium_hero_improvedspin",
] as const
const priorityById = new Map<string, number>(MAIN_CRYSTALS.map((id, index) => [id, index]))
const preferredCategory = (a: CrystalCategoryId | undefined, b: CrystalCategoryId | undefined): CrystalCategoryId =>
  CRYSTAL_CATEGORIES.find(category => category.id === a || category.id === b)?.id ?? "other"

function indexUnique<T extends { id: string }>(rows: T[], label: string) {
  const index = new Map<string, T>()
  for (const row of rows) {
    if (index.has(row.id)) throw new Error(`Duplicate ${label}: ${row.id}`)
    index.set(row.id, row)
  }
  return index
}

/** Immutable snapshot reader shared by web, bot and future catalog consumers. */
export function createCrystalCatalog(input: unknown, artworkInput?: unknown) {
  const data = catalogSchema.parse(input)
  const tiers = indexUnique(data.tiers, "tier")
  const championNames = indexUnique(data.champions ?? [], "champion")
  const pools = indexUnique(data.pools, "pool")
  const crystals = indexUnique(data.crystals, "crystal")
  const artworkByReference = new Map<string, string>()
  if (artworkInput !== undefined) {
    const manifest = publishedCrystalArtworkSchema.parse(artworkInput)
    if (manifest.source.gachaSha256 !== data.source.gachaSha256) throw new Error("Artwork snapshot does not match crystal catalog")
    const expected = new Set(data.crystals.flatMap(crystal => [
      ...(crystal.artwork ? [crystalArtworkKey({ ...crystal.artwork, role: "primary" })] : []),
      ...(crystal.bannerArtwork ? [crystalArtworkKey({ ...crystal.bannerArtwork, role: "banner" })] : []),
    ]))
    const recorded = new Set<string>()
    for (const reference of [...manifest.assets, ...manifest.missing]) {
      const key = crystalArtworkKey(reference)
      if (!expected.has(key) || recorded.has(key)) throw new Error("Unknown or duplicate artwork reference")
      recorded.add(key)
    }
    if (recorded.size !== expected.size) throw new Error("Incomplete artwork manifest")
    for (const asset of manifest.assets) {
      if (!asset.url.endsWith(`/${asset.sha256}.webp`)) throw new Error("Artwork content hash mismatch")
      artworkByReference.set(crystalArtworkKey(asset), asset.url)
    }
  }
  const poolsByTier = new Map<string, Set<string>>()
  const crystalsByPool = new Map<string, Set<string>>()
  const tiersByChampion = new Map<string, typeof data.tiers>()
  for (const tier of tiers.values()) {
    const rows = tiersByChampion.get(tier.championId) ?? []
    rows.push(tier)
    tiersByChampion.set(tier.championId, rows)
  }
  for (const pool of pools.values()) {
    for (const cosmetic of pool.heroCosmeticRewards ?? []) {
      if (!pool.heroTierIds.includes(cosmetic.tierId) || cosmetic.sourceData !== `${cosmetic.tierId}|${cosmetic.cosmeticId}`) {
        throw new Error(`Invalid cosmetic champion reward: ${pool.id}`)
      }
    }
    for (const tierId of pool.heroTierIds) {
      if (!tiers.has(tierId)) throw new Error(`Unknown hero tier: ${tierId}`)
      const ids = poolsByTier.get(tierId) ?? new Set<string>()
      ids.add(pool.id)
      poolsByTier.set(tierId, ids)
    }
  }
  let directDefinitions = 0
  for (const crystal of crystals.values()) {
    let hasHeroes = false
    for (const poolId of crystal.categoryIds) {
      const pool = pools.get(poolId)
      if (!pool) throw new Error(`Unknown reward category: ${poolId}`)
      hasHeroes ||= pool.heroTierIds.length > 0
      const ids = crystalsByPool.get(poolId) ?? new Set<string>()
      ids.add(crystal.id)
      crystalsByPool.set(poolId, ids)
    }
    if (hasHeroes) directDefinitions++
  }
  if (data.coverage.definitions !== crystals.size || data.coverage.definitionsWithDirectHeroes !== directDefinitions) {
    throw new Error("Crystal catalog coverage mismatch")
  }

  function presentation(crystal: CrystalCatalogData["crystals"][number]): ChampionCrystal {
    return { name: crystal.name, sourceIds: [crystal.id], rarities: [], isMainPool: priorityById.has(crystal.id), selection: crystal.selection,
      category: classifyCrystalCategory({ ...crystal, isMainPool: priorityById.has(crystal.id) }),
      artworkUrl: crystal.artwork ? artworkByReference.get(crystalArtworkKey({ ...crystal.artwork, role: "primary" })) ?? null : null,
      bannerArtworkUrl: crystal.bannerArtwork ? artworkByReference.get(crystalArtworkKey({ ...crystal.bannerArtwork, role: "banner" })) ?? null : null,
      family: describeCrystalFamily(crystal, crystals) }
  }
  function equivalenceKey(crystal: CrystalCatalogData["crystals"][number]) {
    const family = describeCrystalFamily(crystal, crystals)
    return JSON.stringify([crystal.name, [...crystal.categoryIds].sort(), crystal.selection, priorityById.has(crystal.id), crystal.artwork ?? null, crystal.bannerArtwork ?? null, family?.id ?? null, family?.variantLabel ?? null])
  }
  function rewards(crystal: CrystalCatalogData["crystals"][number]): CrystalReward[] {
    const rows = new Map<string, { rarities: Set<number>; tierIds: Set<string>; cosmeticRewards: Map<string, { cosmeticId: string; tierId: string; rarity: number }> }>()
    for (const poolId of crystal.categoryIds) for (const tierId of pools.get(poolId)!.heroTierIds) {
      const tier = tiers.get(tierId)!
      const row = rows.get(tier.championId) ?? { rarities: new Set<number>(), tierIds: new Set<string>(), cosmeticRewards: new Map() }
      for (const cosmetic of pools.get(poolId)!.heroCosmeticRewards ?? []) if (cosmetic.tierId === tierId) {
        row.cosmeticRewards.set(cosmetic.sourceData, { cosmeticId: cosmetic.cosmeticId, tierId, rarity: tier.rarity })
      }
      row.rarities.add(tier.rarity); row.tierIds.add(tierId); rows.set(tier.championId, row)
    }
    return [...rows].sort(([a], [b]) => a.localeCompare(b, "en")).map(([championId, row]) => ({ championId, rarities: [...row.rarities].sort((a, b) => b - a), tierIds: [...row.tierIds].sort(), ...(championNames.has(championId) ? { sourceName: championNames.get(championId)!.name } : {}), ...(row.cosmeticRewards.size ? { cosmeticRewards: [...row.cosmeticRewards.values()].sort((a, b) => a.tierId.localeCompare(b.tierId) || a.cosmeticId.localeCompare(b.cosmeticId)) } : {}) }))
  }
  let browsing: { families: CrystalCatalogFamily[]; familyBySourceId: Map<string, CrystalCatalogFamily> } | undefined
  function browse() {
    if (browsing) return browsing
    const aliases = new Map<string, CrystalCatalogVariant & { priority: number }>()
    for (const crystal of crystals.values()) {
      if (!crystal.categoryIds.some(id => pools.get(id)!.heroTierIds.length)) continue
      const key = equivalenceKey(crystal)
      const existing = aliases.get(key)
      if (existing) {
        existing.sourceIds.push(crystal.id)
        existing.category = preferredCategory(existing.category, classifyCrystalCategory({ ...crystal, isMainPool: priorityById.has(crystal.id) }))
        existing.priority = Math.min(existing.priority, priorityById.get(crystal.id) ?? Infinity)
      } else aliases.set(key, { ...presentation(crystal), id: crystal.id, priority: priorityById.get(crystal.id) ?? Infinity })
    }
    const families = new Map<string, CrystalCatalogFamily>()
    const familyBySourceId = new Map<string, CrystalCatalogFamily>()
    for (const { priority: _priority, ...variant } of [...aliases.values()].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"))) {
      variant.sourceIds.sort()
      variant.id = variant.sourceIds[0]
      const familyId = variant.family?.id ?? variant.id
      let family = families.get(familyId)
      if (!family) {
        const contents = rewards(crystals.get(variant.id)!)
        const counts: Record<string, number> = {}
        for (const reward of contents) for (const rarity of reward.rarities) counts[rarity] = (counts[rarity] ?? 0) + 1
        family = { id: familyId, name: variant.family?.name ?? variant.name, artworkUrl: variant.artworkUrl ?? null, isMainPool: variant.isMainPool,
          category: variant.category ?? "other",
          rarities: Object.keys(counts).map(Number).sort((a, b) => b - a), championCount: contents.length, championCountsByRarity: counts, variants: [] }
        families.set(familyId, family)
      }
      variant.rarities = family.rarities
      family.variants.push(variant)
      for (const id of variant.sourceIds) familyBySourceId.set(id, family)
    }
    for (const family of families.values()) family.variants.sort((a, b) => (a.family?.variantOrder ?? 0) - (b.family?.variantOrder ?? 0))
    browsing = { families: [...families.values()], familyBySourceId }
    return browsing
  }

  return {
    source: data.source,
    getCrystalPresentation(id: string): ChampionCrystal | null {
      const crystal = crystals.get(id)
      return crystal ? presentation(crystal) : null
    },
    listCrystalChampions: () => [...tiersByChampion].flatMap(([gameId, championTiers]) => {
      const rarities = [...new Set(championTiers.filter(tier => [...(poolsByTier.get(tier.id) ?? [])].some(poolId => crystalsByPool.has(poolId))).map(tier => tier.rarity))].sort((a, b) => b - a)
      return rarities.length ? [{ gameId, name: championNames.get(gameId)?.name ?? gameId, rarities }] : []
    }).sort((a, b) => a.name.localeCompare(b.name, "en") || a.gameId.localeCompare(b.gameId, "en")),
    listCrystalFamilies: () => browse().families,
    getCrystalDetails(id: string): CrystalCatalogDetails | null {
      const family = browse().familyBySourceId.get(id)
      return family ? { ...family, contents: rewards(crystals.get(family.variants[0].id)!) } : null
    },
    forChampion(championId: string | null): ChampionCrystalAvailability {
      const matches = new Map<string, Set<number>>()
      for (const tier of tiersByChampion.get(championId ?? "") ?? []) {
        for (const poolId of poolsByTier.get(tier.id) ?? []) {
          for (const crystalId of crystalsByPool.get(poolId) ?? []) {
            const rarities = matches.get(crystalId) ?? new Set<number>()
            rarities.add(tier.rarity)
            matches.set(crystalId, rarities)
          }
        }
      }
      const groups = new Map<string, ChampionCrystal & { priority: number }>()
      for (const [id, rarities] of matches) {
        const crystal = crystals.get(id)!
        // Equal labels alone do not identify a pool. Keep selectors and all category
        // identities correlated; main/other is a presentation boundary, too.
        const key = equivalenceKey(crystal)
        const group = groups.get(key)
        if (group) {
          group.sourceIds.push(id)
          group.category = preferredCategory(group.category, classifyCrystalCategory({ ...crystal, isMainPool: priorityById.has(id) }))
          group.priority = Math.min(group.priority, priorityById.get(id) ?? Infinity)
        } else {
          groups.set(key, { ...presentation(crystal), rarities: [...rarities].sort((a, b) => b - a), priority: priorityById.get(id) ?? Infinity })
        }
      }
      return {
        observedAt: data.source.observedAt,
        crystals: [...groups.values()]
          .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name, "en") || a.sourceIds[0].localeCompare(b.sourceIds[0], "en"))
          .map(({ priority: _priority, ...crystal }) => ({ ...crystal, sourceIds: crystal.sourceIds.sort() })),
      }
    },
  }
}
