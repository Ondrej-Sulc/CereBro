import { crystalBrowseReturnLabel } from "@/lib/crystal-browse-return"
import { CrystalBrowseBoundary } from "./crystal-browse-boundary"
import Link from "next/link"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { CRYSTAL_CATEGORIES, crystalEditionLabel } from "@cerebro/core/domain/crystal-categories"
import { getCrystalChronology } from "@cerebro/core/domain/crystal-chronology"
import type { loadCrystalDetails } from "@/lib/data/crystals"
import { crystalCatalogHref, crystalComparisonHref, crystalHref } from "@/lib/crystal-navigation"
import { CrystalPageHeader, CrystalPageSections } from "./crystal-page-header"
import { CrystalPoolBrowser } from "./crystal-pool-browser"
import { CrystalOddsDisclosure } from "./crystal-odds-disclosure"
import { CrystalOpeningRules } from "./crystal-reward-cards"
import { CrystalRewardsBrowser } from "./crystal-rewards-browser"
import { CrystalAvailabilityNotice } from "./crystal-availability-notice"
export { CrystalCatalogView } from "./crystal-catalog-browser"
import styles from "./crystal-detail-page.module.css"

type Details = NonNullable<Awaited<ReturnType<typeof loadCrystalDetails>>>
const opening = (selection: { draw: number; pick: number } | null) => selection ? `Choose ${selection.pick} of ${selection.draw}` : "Standard opening"

export function CrystalDetailView({ data, earningHref }: { data: Details; earningHref?: string }) {
  const currentId = data.opening?.id ?? data.id
  const displayName = data.opening?.name ?? data.name
  const rewards = data.opening?.rewardPresentation
  const rewardCount = rewards ? rewards.groups.reduce((count, group) => count + group.rows.length, 0) + rewards.unrated.length : 0
  const openings = [...new Map(data.variants.map(variant => [JSON.stringify(variant.selection), {
    label: variant.selection ? variant.family?.variantLabel ?? "Selection" : "Standard",
    description: variant.selection ? opening(variant.selection) : "",
    id: variant.id, sourceIds: variant.sourceIds,
  }] as const)).values()]
  const sourceIds = data.variants.flatMap(variant => variant.sourceIds)
  const edition = getCrystalChronology(sourceIds).label ?? crystalEditionLabel(sourceIds, data.category)
  const rewardsFirst = rewardCount >= 8 && data.championCount <= 8
  const hasRules = !!data.opening && !!(data.opening.pity || data.opening.boxRules || data.opening.conditionalBonuses.length)
  const championVisuals = Object.fromEntries((data.opening?.rewardPresentation.championOdds?.groups ?? []).flatMap(group => group.rows.map(row => {
    const key = `${group.sourceIndex}:${row.sourceIndex}`
    return [key, { imageUrl: null, href: null, ...data.opening?.oddsVisuals[key], kind: "champion" as const }]
  })))
  const pool = <CrystalPoolBrowser key={`pool:${currentId}`} data={{ returnTo: data.returnTo, id: currentId, champions: data.poolChampions, q: data.q, rarity: data.rarity, rarities: data.rarities, championClass: data.championClass, classes: data.classes, championCount: data.championCount, championOdds: data.opening?.rewardPresentation.championOdds }}>
    {data.opening && <CrystalOddsDisclosure key={`champion-odds:${currentId}`} odds={data.opening.rewardPresentation.championOdds} visuals={championVisuals} compact embedded />}
  </CrystalPoolBrowser>
  const rules = data.opening && hasRules ? <div id="opening-rules" className={styles.rules}><CrystalOpeningRules opening={data.opening} /></div> : null
  const sectionList: Parameters<typeof CrystalPageSections>[0]["sections"] = [
    { id: "champion-pool-title", label: "Champions", count: data.championCount, kind: "champions" },
    ...(rewardCount ? [{ id: "crystal-other-rewards", label: "Rewards", count: rewardCount, kind: "rewards" as const }] : []),
    ...(hasRules ? [{ id: "opening-rules", label: data.opening?.pity || data.opening?.boxRules ? "Rules" : "Bonuses", kind: "rules" as const }] : []),
  ]
  if (rewardsFirst) sectionList.unshift(sectionList.splice(1, 1)[0])
  return <CrystalBrowseBoundary returnTo={data.returnTo}><div className={styles.page}>
    <div className={styles.topbar}><Link href={data.returnTo ?? crystalCatalogHref({ rarity: data.rarity, category: data.category })} scroll={data.returnTo ? false : undefined}><ArrowLeft aria-hidden="true" />{crystalBrowseReturnLabel(data.returnTo)}</Link><Link href={crystalComparisonHref({ left: data.id, rarity: data.rarity })}>Compare pool <ArrowRight aria-hidden="true" /></Link></div>
    <CrystalPageHeader name={displayName} category={CRYSTAL_CATEGORIES.find(category => category.id === data.category)?.name} edition={edition}
      artwork={data.opening?.artworkUrl ?? data.artworkUrl} banner={data.opening?.bannerArtworkUrl ?? data.bannerArtworkUrl}
      championCount={data.championCount} rarities={data.rarities} rewardCount={rewardCount} observedAt={data.observedAt}
      ratesObservedAt={data.opening?.odds?.status === "captured" ? data.opening.odds.observedAt : undefined} earningHref={earningHref}
      availability={!data.availabilityReview ? data.availability : null}
      openings={openings.length > 1 || data.variants.some(variant => variant.selection) ? openings.map(option => ({
        label: option.label, description: option.description, current: option.sourceIds.includes(currentId),
        href: crystalHref(option.id, { rarity: data.rarity, q: data.q, championClass: data.championClass, returnTo: data.returnTo }),
      })) : []} />
    <CrystalPageSections sections={sectionList} />
    {data.availabilityReview && <CrystalAvailabilityNotice review={data.availabilityReview} id={currentId} />}
    <div className={styles.layout} data-crystal-content data-crystal-layout={rewardsFirst ? "rewards" : "champions"}>
      <div className={styles.main}>
        {!rewardsFirst && pool}
        {data.opening && <CrystalRewardsBrowser key={`rewards:${currentId}`} presentation={data.opening.rewardPresentation} />}
        {!rewardsFirst && rules}
      </div>
      {rewardsFirst && <aside className={styles.sidebar} aria-label="Champion rewards and opening information">{pool}{rules}</aside>}
    </div>
  </div></CrystalBrowseBoundary>
}
