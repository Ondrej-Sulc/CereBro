import { crystalBrowseReturnLabel } from "@/lib/crystal-browse-return"
import { CrystalBrowseBoundary } from "./crystal-browse-boundary"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getCrystalChronology } from "@cerebro/core/domain/crystal-chronology"
import { classifyCrystalCategory, CRYSTAL_CATEGORIES } from "@cerebro/core/domain/crystal-categories"
import type { loadCrystalOpening } from "@/lib/data/crystal-openings"
import { crystalCatalogHref, crystalHref } from "@/lib/crystal-navigation"
import { loadCrystalPageRewards } from "@/lib/data/crystal-page-rewards"
import { CrystalPageHeader, CrystalPageSections } from "./crystal-page-header"
import { CrystalOpeningRules } from "./crystal-reward-cards"
import { CrystalRewardsBrowser } from "./crystal-rewards-browser"
import styles from "./crystal-detail-page.module.css"

type Opening = NonNullable<ReturnType<typeof loadCrystalOpening>>

export function CrystalOpeningDetail({ data, returnTo, earningHref }: { data: Opening; returnTo?: string | null; earningHref?: string }) {
  const edition = getCrystalChronology([data.id]).label
  const category = classifyCrystalCategory({ id: data.id, name: data.name, isMainPool: false })
  const opening = loadCrystalPageRewards(data.id)!
  const rewards = opening.rewardPresentation
  const rewardCount = rewards.groups.reduce((count, group) => count + group.rows.length, 0) + rewards.unrated.length
  const hasRules = !!(opening.pity || opening.boxRules || opening.conditionalBonuses.length)
  return <CrystalBrowseBoundary returnTo={returnTo}><div className={styles.page}>
    <div className={styles.topbar}><Link href={returnTo ?? crystalCatalogHref()} scroll={returnTo ? false : undefined}><ArrowLeft aria-hidden="true" />{crystalBrowseReturnLabel(returnTo)}</Link></div>
    <CrystalPageHeader as="header" name={data.name} category={category !== "other" ? CRYSTAL_CATEGORIES.find(item => item.id === category)?.name : undefined} edition={edition} artwork={data.artworkUrl} banner={data.bannerArtworkUrl}
      rewardCount={rewardCount} observedAt={data.source.observedAt} firstRecordedAt={data.history?.firstRecordedAt} earningHref={earningHref}
      ratesObservedAt={data.odds?.status === "captured" ? data.odds.observedAt : undefined} availability={data.availability}
      openings={opening.selection ? [{ label: "Selection", description: `Choose ${opening.selection.pick} of ${opening.selection.draw}`, href: crystalHref(data.id, { returnTo }), current: true }] : []} />
    <CrystalPageSections sections={[{ id: "crystal-other-rewards", label: "Rewards", count: rewardCount, kind: "rewards" }, ...(hasRules ? [{ id: "opening-rules", label: opening.pity || opening.boxRules ? "Rules" : "Bonuses", kind: "rules" as const }] : [])]} />
    <div className={styles.layout} data-crystal-content data-crystal-layout={hasRules ? "rewards" : "full"}>
      <div className={styles.main}><CrystalRewardsBrowser key={`rewards:${data.id}`} presentation={rewards} primary /></div>
      {hasRules && <aside id="opening-rules" className={`${styles.sidebar} ${styles.rules}`} aria-label="Opening information"><CrystalOpeningRules opening={opening} /></aside>}
    </div>
  </div></CrystalBrowseBoundary>
}
