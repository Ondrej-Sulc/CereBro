import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { prisma } from "@/lib/prisma"
import { getFromCache } from "@/lib/cache"
import { getChampionImageUrlOrPlaceholder, isChampionImages } from "@/lib/championHelper"
import logger from "@/lib/logger"
import { crystalCatalogRewardKey, loadCrystalPageRewards, type CrystalCatalogReward } from "./crystal-page-rewards"

/** Reuse current public catalog identities; no ownership, source imports or writes. */
export async function getCrystalPageRewards(id: string) {
  const opening = getCrystalOpening(id)
  if (!opening) return null
  const rewards = [...opening.categories.flatMap(category => category.rewards),
    ...opening.conditionalBonuses.flatMap(bonus => bonus.bonusReward.rewards)]
  const relicIds = [...new Set(rewards.filter(reward => reward.type === "relic2").map(reward => reward.data))].sort()
  const championIds = [...new Set(rewards.flatMap(reward => reward.type === "bp" && reward.gameId ? [reward.gameId] : []))].sort()
  if (!relicIds.length && !championIds.length) return loadCrystalPageRewards(id)
  const catalog = new Map<string, CrystalCatalogReward>()
  try {
    const [relics, champions] = await Promise.all([
      relicIds.length ? getFromCache(`crystal-relic-rewards-v1:${JSON.stringify(relicIds)}`, 300, () => prisma.gameRelic.findMany({
        where: { id: { in: relicIds }, isCurrent: true },
        select: { id: true, name: true, slug: true, portraitPath: true, class: true,
          rarities: { where: { isCurrent: true, selectable: true }, select: { sourceRarityId: true, stars: true } } },
      })) : [],
      championIds.length ? getFromCache(`crystal-blueprint-rewards-v1:${JSON.stringify(championIds)}`, 300, () => prisma.champion.findMany({
        where: { gameId: { in: championIds } },
        select: { gameId: true, name: true, slug: true, class: true, images: true },
      })) : [],
    ])
    const relicById = new Map(relics.map(relic => [relic.id, relic]))
    const championById = new Map(champions.map(champion => [champion.gameId, champion]))
    for (const reward of rewards) {
      const relic = reward.type === "relic2" ? relicById.get(reward.data) : null
      const champion = reward.type === "bp" && reward.gameId ? championById.get(reward.gameId) : null
      if (relic) {
        const rarity = relic.rarities.find(rarity => rarity.sourceRarityId === reward.context?.rarity)
        catalog.set(crystalCatalogRewardKey(reward), {
          name: `${rarity ? `${rarity.stars}-Star ` : ""}${relic.name}`,
          href: `/relics/${relic.slug}${rarity ? `?rarity=${rarity.stars}` : ""}`,
          imageUrl: relic.portraitPath || null,
          className: relic.class.charAt(0) + relic.class.slice(1).toLowerCase(), rarity: rarity?.stars,
        })
      } else if (champion) {
        catalog.set(crystalCatalogRewardKey(reward), {
          name: reward.displayName || champion.name, href: champion.slug ? `/champions/${champion.slug}` : null,
          imageUrl: isChampionImages(champion.images) ? getChampionImageUrlOrPlaceholder(champion.images, "64") : null,
        })
      }
    }
  } catch {
    logger.warn("Crystal reward catalog metadata unavailable; retaining neutral reward labels")
  }
  return loadCrystalPageRewards(id, catalog)
}
