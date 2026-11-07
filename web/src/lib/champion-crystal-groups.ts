import type { ChampionCrystal } from "@cerebro/core/domain/champion-crystals"
import { buildCrystalFamilies, type ChampionCrystalFamily } from "@cerebro/core/domain/crystal-families"
import { CRYSTAL_CATEGORIES, crystalEditionLabel, type CrystalCategoryId } from "@cerebro/core/domain/crystal-categories"

// Editorial acquisition priority, never a claim about current sale or odds.
const order: CrystalCategoryId[] = ["main", "featured", "classes", "spotlight", "modes", "events", "collections", "calendar", "other"]
export const CHAMPION_CRYSTAL_PREVIEW = 3
export const CHAMPION_CRYSTAL_PAGE_SIZE = 12
export const CHAMPION_CRYSTAL_PREVIEW_GROUPS = 4

/** Only the supplied champion projection is scanned; exact stars precede grouping/search. */
export function getChampionCrystalGroups(crystals: ChampionCrystal[], rarity: number, query = "") {
  const search = query.trim().toLocaleLowerCase("en")
  const buckets = new Map<CrystalCategoryId, ChampionCrystalFamily[]>()
  for (const family of buildCrystalFamilies(crystals, rarity)) {
    const category = family.variants.some(variant => variant.isMainPool) ? "main"
      : family.variants.find(variant => variant.category && variant.category !== "main")?.category ?? "other"
    if (search && ![family.name, ...family.variants.flatMap(variant => [variant.name, ...variant.sourceIds,
      variant.family?.variantLabel ?? "", crystalEditionLabel(variant.sourceIds, category) ?? ""])]
      .some(value => value.toLocaleLowerCase("en").includes(search))) continue
    const rows = buckets.get(category) ?? []
    rows.push(family)
    buckets.set(category, rows)
  }
  return order.flatMap(id => {
    const families = buckets.get(id)
    const category = CRYSTAL_CATEGORIES.find(group => group.id === id)!
    return families?.length ? [{ ...category, count: families.length, families }] : []
  })
}
