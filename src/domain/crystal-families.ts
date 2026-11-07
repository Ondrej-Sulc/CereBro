import type { ChampionCrystal, CrystalCatalogData } from "./champion-crystals"

export type CrystalFamilyMembership = { id: string; name: string; variantLabel: string; variantOrder: number }
type Opening = { draw: number; pick: number } | null
type FamilyDefinition = { anchor: string; variants: Array<{ id: string; label: string; opening: Opening }> }
const standard = (id: string) => ({ id, label: "Standard", opening: null })
const shards = (id: string) => ({ ...standard(id), label: "Shard version" })
const nexus = (id: string, label = "Nexus", draw = 3) => ({ id, label, opening: { draw, pick: 1 } })
const definitions: FamilyDefinition[] = [
  { anchor: "7_star_hero_shard_crystal", variants: [standard("7_star_hero_shard_crystal"), nexus("7star_nexus_crystal"), nexus("7star_nexus_crystal_1_of_5", "Epoch Nexus", 5)] },
  { anchor: "7_star_titan_hero_shard_crystal", variants: [standard("7_star_titan_hero_shard_crystal"), nexus("7_star_nexus_titan_hero_shard_crystal"), nexus("7_star_nexus_colossal_titan_hero_crystal", "Colossal Nexus", 5)] },
  { anchor: "6_star_hero_shard_crystal", variants: [standard("6_star_hero_shard_crystal"), nexus("sg_6star_nexus_crystal")] },
  { anchor: "5_star_hero_shard_crystal", variants: [standard("5_star_hero_shard_crystal"), nexus("sg_5star_nexus_crystal")] },
  { anchor: "4_star_hero_shard_crystal", variants: [shards("4_star_hero_shard_crystal"), standard("4_star_hero_crystal")] },
  { anchor: "3_star_hero_shard_crystal", variants: [shards("3_star_hero_shard_crystal"), standard("3_star_hero_crystal")] },
  { anchor: "valiant_crystal", variants: [standard("valiant_crystal"), nexus("valiant_nexus_crystal")] },
  { anchor: "paragon_crystal_v2", variants: [standard("paragon_crystal_v2"), standard("paragon_shards_v2"), nexus("paragon_nexus_crystal")] },
  { anchor: "cavalier_crystal_v2", variants: [standard("cavalier_crystal_v2"), shards("cavalier_shards_v2")] },
  { anchor: "premium_hero_shard", variants: [shards("premium_hero_shard"), standard("premium_hero_improvedspin")] },
]

/** Explicit identities establish the family; equal source categories and verified
 * opening rules must still agree before a variant can join it. */
export function describeCrystalFamily(crystal: CrystalCatalogData["crystals"][number], catalog: ReadonlyMap<string, CrystalCatalogData["crystals"][number]>): CrystalFamilyMembership | undefined {
  for (const family of definitions) {
    const variantOrder = family.variants.findIndex(variant => variant.id === crystal.id)
    if (variantOrder < 0) continue
    const anchor = catalog.get(family.anchor)
    if (!anchor || JSON.stringify([...anchor.categoryIds].sort()) !== JSON.stringify([...crystal.categoryIds].sort())) return undefined
    const variant = family.variants[variantOrder]
    if (JSON.stringify(variant.opening) !== JSON.stringify(crystal.selection)) return undefined
    return { id: family.anchor, name: anchor.name, variantLabel: variant.label, variantOrder }
  }
  return undefined
}

export type ChampionCrystalFamily = {
  id: string
  name: string
  artworkUrl: string | null
  variants: ChampionCrystal[]
}

export function buildCrystalFamilies(crystals: ChampionCrystal[], rarity: number): ChampionCrystalFamily[] {
  const families = new Map<string, ChampionCrystalFamily>()
  for (const crystal of crystals.filter(item => item.rarities.includes(rarity))) {
    const id = crystal.family?.id ?? crystal.sourceIds[0]
    const family = families.get(id)
    if (family) family.variants.push(crystal)
    else families.set(id, { id, name: crystal.family?.name ?? crystal.name, artworkUrl: crystal.artworkUrl ?? null, variants: [crystal] })
  }
  for (const family of families.values()) {
    family.variants.sort((a, b) => (a.family?.variantOrder ?? 0) - (b.family?.variantOrder ?? 0))
    family.artworkUrl = family.variants[0]?.artworkUrl ?? null
  }
  return [...families.values()]
}
