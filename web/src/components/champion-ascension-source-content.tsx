"use client"

import Image from "next/image"
import Link from "next/link"
import { useId, useState, type ReactNode } from "react"
import { ArrowUpRight, ChevronDown, Gem } from "lucide-react"
import { rewardDisplayName } from "@cerebro/core/domain/reward-display"
import type { ChampionCrystalAscensionSource } from "@/lib/data/champion-crystal-ascension-types"
import type { ChampionAscensionSourcePayload } from "@/lib/champion-ascension-source-payload"
import { ChampionAscensionAcquisition } from "@/components/champion-ascension-acquisition"
import type { ChampionAcquisition } from "@cerebro/core/domain/champion-acquisition"
import { ChampionAcquisitionDataNotes } from "./champion-acquisition-data-notes"
import { crystalCatalogHref, crystalHref } from "@/lib/crystal-navigation"
import styles from "./champion-ascension-source-content.module.css"
import { CrystalIntentLink } from "@/app/crystals/crystal-intent-link"

/** Complete selected-seven-star presentation. Hosts own fetching and URL/pagination state. */
export function ChampionAscensionSourceContent({ data, championName, returnTo, error = false, onRetry, crystalCount = data?.crystals.length ?? 0, previewSize = 6, children, id, eligibilityObservedAt, showDataNotes = true, championAcquisition, crystalPoolObservedAt, headingActions, headingLevel = 3 }: {
  data: ChampionAscensionSourcePayload | null
  championName: string
  returnTo: string
  error?: boolean
  onRetry?: () => void
  crystalCount?: number
  previewSize?: number
  children?: ReactNode
  id?: string
  eligibilityObservedAt?: string
  showDataNotes?: boolean
  championAcquisition?: ChampionAcquisition
  crystalPoolObservedAt?: string
  headingActions?: ReactNode
  headingLevel?: 2 | 3
}) {
  const [expanded, setExpanded] = useState(false)
  const titleId = useId()
  const listId = useId()
  const sources = data?.crystals.filter(source => source.rarities.includes(7)) ?? []
  const sourceCount = crystalCount + (data?.acquisition.routes.filter(route => route.rarity === 7).length ?? 0)
  const visible = expanded ? sources : sources.slice(0, previewSize)
  const Heading = headingLevel === 2 ? "h2" : "h3"
  return <section id={id} tabIndex={id ? -1 : undefined} data-ascension-section className={styles.section} aria-labelledby={titleId}>
    <header className={styles.heading}>
      <div><Heading id={titleId}>7★ Ascension sources {data && sourceCount > 0 && <span>{sourceCount} {sourceCount === 1 ? "source" : "sources"}</span>}</Heading></div>
      <Link prefetch={false} href={crystalCatalogHref({ reward: "ascension" })}>Find ascension materials <ArrowUpRight aria-hidden="true" /></Link>
      {headingActions}
    </header>
    {error ? <div className={styles.empty} role="alert"><p>Could not load ascension sources.</p><button type="button" onClick={onRetry}>Try again</button></div>
      : !data ? <p className={styles.empty} role="status">Loading ascension sources…</p>
      : <>
        <ChampionAscensionAcquisition data={data.acquisition} selectedRarity="7" hasCrystalSources={crystalCount > 0}>
        {sources.length > 0 && <div>
        <h4 className={styles.groupTitle}>Crystal bonuses & token rewards</h4>
        <ul id={listId} className={styles.sources}>{visible.map(source => <SourceRow key={source.key} source={source} championName={championName} returnTo={returnTo} />)}</ul>
        {sources.length > previewSize && <button type="button" className={styles.more} aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded(value => !value)}>{expanded ? "Show fewer sources" : `Show ${sources.length - previewSize} more sources`} <ChevronDown aria-hidden="true" /></button>}
        </div>}
        {children}
        </ChampionAscensionAcquisition>
      </>}
    {showDataNotes && <ChampionAcquisitionDataNotes acquisition={championAcquisition} crystalPoolObservedAt={crystalPoolObservedAt} ascension={data?.acquisition} ascensionObservedAt={data?.observedAt} eligibilityObservedAt={eligibilityObservedAt} />}
  </section>
}

type Reward = ChampionCrystalAscensionSource["rewards"][number]
function amount(reward: Reward) {
  if (reward.quantityRangeStatus) return "Range unavailable"
  const { minQuantity, maxQuantity, quantity } = reward
  if (minQuantity !== undefined && maxQuantity !== undefined) return minQuantity === maxQuantity ? `×${minQuantity.toLocaleString("en")}` : `${minQuantity.toLocaleString("en")}–${maxQuantity.toLocaleString("en")}`
  if (minQuantity !== undefined) return `At least ${minQuantity.toLocaleString("en")}`
  if (maxQuantity !== undefined) return `Up to ${maxQuantity.toLocaleString("en")}`
  return quantity !== undefined ? `×${quantity.toLocaleString("en")}` : "Quantity not recorded"
}

function SourceRow({ source, championName, returnTo }: { source: ChampionCrystalAscensionSource; championName: string; returnTo: string }) {
  const conditions = source.rewards.flatMap(reward => {
    const fields = [...Object.entries({ action: reward.action, balance: reward.balance, header: reward.header, footer: reward.footer }),
      ...Object.entries(reward.context ?? {}).map(([key, value]) => [`context.${key}`, value])].filter(([, value]) => value !== undefined)
    return fields.length ? [{ reward, fields }] : []
  })
  return <li className={styles.row} data-ascension-source={source.key}>
    <CrystalIntentLink className={styles.destination} href={crystalHref(source.id, { rarity: "7" })} returnTo={returnTo}>
      <span className={styles.artwork} aria-hidden="true">{source.artworkUrl ? <Image src={source.artworkUrl} alt="" width={56} height={56} sizes="56px" /> : <Gem />}</span>
      <div className={styles.title}><span className={styles.kind}>{source.kind === "champion-bonus" ? "Champion outcome bonus" : "Champion token reward"}</span><h4>{source.name}</h4></div><ArrowUpRight className={styles.arrow} aria-hidden="true" />
    </CrystalIntentLink>
    <div className={styles.contents}>
      <p className={styles.condition}>{source.kind === "champion-bonus" ? `If the 7★ ${championName} outcome is awarded.` : "Possible token outcome, separate from the champion; does not establish a champion drop."}{source.autoAscend && " Automatic ascension when applicable."}</p>
      <ul className={styles.rewards} aria-label="Recorded ascension materials">{source.rewards.map(reward => <li key={reward.sourceIndex}>
        {reward.imageUrl && <Image src={reward.imageUrl} alt="" width={28} height={28} sizes="28px" />}<span>{rewardDisplayName(reward)} <strong>{amount(reward)}</strong></span>
      </li>)}</ul>
      {conditions.length > 0 && <details className={styles.conditions}><summary>Recorded reward conditions</summary>{conditions.map(({ reward, fields }) => <p key={reward.sourceIndex}>{rewardDisplayName(reward)}: {fields.map(([key, value]) => `${key}: ${value}`).join(" · ")}</p>)}</details>}
    </div>
  </li>
}
