// Decorative catalog curation, independent of filters, editions and store availability.
// Resolve exact crystal artwork through the published manifest; never substitute rewards.
const catalogCrystals = [
  { slot: "hero", id: "7_star_hero_shard_crystal" },
  { slot: "empowered", id: "greater_empowered_crystal" },
  { slot: "ascension", id: "t7_class_ascension_token_crystal" },
  { slot: "event", id: "superior_banquet_crystal_dec25" },
  { slot: "catalyst", id: "t6_class_cat_crystal" },
] as const

export type CrystalCatalogArtworkItem = {
  slot: typeof catalogCrystals[number]["slot"]
  id: string
  url: string
}

export function projectCrystalCatalogArtwork(presentation: (id: string) => { artworkUrl?: string | null } | null): CrystalCatalogArtworkItem[] {
  return catalogCrystals.flatMap(crystal => {
    const url = presentation(crystal.id)?.artworkUrl
    return url ? [{ ...crystal, url }] : []
  })
}
