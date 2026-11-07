import Image from "next/image"
import { CrystalIntentLink } from "./crystal-intent-link"
import { ArrowUpRight, ChevronDown, Package } from "lucide-react"
import type { CrystalPageRewards, CrystalRewardCard } from "@/lib/data/crystal-page-rewards"
import { rewardDisplayName } from "@cerebro/core/domain/reward-display"
import { rewardTypeLabel } from "./crystal-reward-labels"
import { groupCrystalRewardCards, type CrystalRewardGroup } from "@/lib/crystal-reward-groups"
import { groupCrystalAscensionBonuses } from "@/lib/crystal-ascension-bonuses"
import { CrystalAscensionBonuses } from "./crystal-ascension-bonuses"
import styles from "./crystal-reward-cards.module.css"

const label = rewardDisplayName
function amount(reward: CrystalRewardCard) {
  if (reward.quantityRangeStatus === "reversed_in_source") return "Range unavailable"
  if (reward.minQuantity !== undefined && reward.maxQuantity !== undefined) return reward.minQuantity === reward.maxQuantity
    ? `×${reward.minQuantity.toLocaleString("en")}` : `${reward.minQuantity.toLocaleString("en")}–${reward.maxQuantity.toLocaleString("en")}`
  return reward.quantity !== undefined ? `×${reward.quantity.toLocaleString("en")}` : ""
}

function RewardCard({ reward }: { reward: CrystalRewardCard }) {
  const content = <>
    <span className={styles.artwork}>{reward.imageUrl ? <Image data-reward-artwork src={reward.imageUrl} alt="" width={80} height={80} sizes="(max-width: 639px) 64px, 80px" /> : <Package aria-hidden="true" />}</span>
    <span className={styles.cardCopy}><strong>{label(reward)}</strong><span>{reward.selection ? `Choose ${reward.selection.pick} of ${reward.selection.draw}` : `${reward.rarity ? `${reward.rarity}★ · ` : ""}${rewardTypeLabel(reward.type)}`}</span><span className={styles.quantity}>{amount(reward)}</span></span>
    {reward.href && <ArrowUpRight className={styles.arrow} aria-hidden="true" />}
  </>
  return reward.href ? <CrystalIntentLink className={styles.card} href={reward.href} data-reward-category={reward.categoryId}>{content}</CrystalIntentLink> : <article className={styles.card} data-reward-category={reward.categoryId}>{content}</article>
}

function AmountOptionsCard({ group }: { group: CrystalRewardGroup }) {
  const { reward, options } = group
  return <details className={styles.amountGroup} data-reward-amounts data-reward-category={reward.categoryId}>
    <summary className={styles.card}>
      <span className={styles.artwork}>{reward.imageUrl ? <Image data-reward-artwork src={reward.imageUrl} alt="" width={80} height={80} sizes="(max-width: 639px) 64px, 80px" /> : <Package aria-hidden="true" />}</span>
      <span className={styles.cardCopy}><strong>{label(reward)}</strong><span>{rewardTypeLabel(reward.type)}</span><span className={styles.quantity}>{options.length} amount options</span></span>
      <ChevronDown className={styles.amountChevron} aria-hidden="true" />
    </summary>
    <ul className={styles.amountOptions} aria-label={`Recorded amounts for ${label(reward)}`}>{options.map(option => <li key={option.key} data-reward-option={option.key}>{amount(option)}</li>)}</ul>
  </details>
}

function Cards({ rewards }: { rewards: CrystalRewardCard[] }) {
  return <div className={styles.grid}>{groupCrystalRewardCards(rewards).map(group => group.options.length > 1 ? <AmountOptionsCard key={group.reward.key} group={group} /> : <RewardCard key={group.reward.key} reward={group.reward} />)}</div>
}

export function CrystalOpeningRules({ opening }: { opening: CrystalPageRewards }) {
  const grouped = groupCrystalAscensionBonuses(opening.conditionalBonuses)
  const compact = grouped.groups.reduce((count, group) => count + group.members.length, 0) >= 8
  const otherBonuses = compact ? grouped.otherBonuses : opening.conditionalBonuses
  const otherTitle = compact ? "crystal-additional-bonuses-title" : "crystal-bonus-rewards-title"
  return <>
    {compact && <CrystalAscensionBonuses groups={grouped.groups} />}
    {otherBonuses.length > 0 && <section className={styles.section} aria-labelledby={otherTitle}><header><div><p className={styles.eyebrow}>With specific outcomes</p><h2 id={otherTitle}>{compact ? "Other bonus rewards" : "Bonus rewards"}</h2></div></header><div className={styles.bonuses}>{otherBonuses.map(bonus => <div className={styles.bonus} key={bonus.key} data-bonus-outcome={bonus.key}><h3>{bonus.trigger.displayName || bonus.trigger.data}{bonus.trigger.rarity ? ` · ${bonus.trigger.rarity}★` : ""}</h3><Cards rewards={bonus.rewards} />{bonus.autoAscend && <p>These materials are used for automatic ascension when applicable.</p>}</div>)}</div></section>}
    {(opening.pity || opening.boxRules) && <section className={styles.section} aria-label="Opening rules"><header><h2>Opening rules</h2></header><div className={styles.ruleGrid}>
      {opening.pity?.groups.map(group => <div className={styles.rule} key={group.id}><span className={styles.eyebrow}>Grace guarantee</span><h3>{(group.descriptionTemplate || group.shortDescriptionTemplate || "Recorded threshold: {0} openings").replaceAll("{0}", group.payoutLimit.toLocaleString("en"))}</h3><p>Recorded limit · {group.payoutLimit} openings. Your personal progress is not included.</p></div>)}
      {opening.boxRules && <div className={styles.rule}><span className={styles.eyebrow}>Box crystal</span><h3>{opening.boxRules.openLimit} recorded openings per cycle</h3>{opening.boxRules.allowManualReset && <p>Manual reset is supported by this definition.</p>}</div>}
    </div></section>}
  </>
}
