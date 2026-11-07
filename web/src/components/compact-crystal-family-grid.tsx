"use client"

import Image from "next/image"
import { ArrowUpRight, Check, Gem } from "lucide-react"
import type { ChampionCrystalFamily } from "@cerebro/core/domain/crystal-families"
import type { CrystalCatalogFamily } from "@cerebro/core/domain/champion-crystals"
import { crystalEditionLabel } from "@cerebro/core/domain/crystal-categories"
import { getCrystalChronology } from "@cerebro/core/domain/crystal-chronology"
import { crystalHref } from "@/lib/crystal-navigation"
import { CrystalIntentLink } from "@/app/crystals/crystal-intent-link"
import styles from "./compact-crystal-family-grid.module.css"

// Both hosts already have verified family membership. Counts are optional: the
// lean champion projection deliberately does not download complete reward pools.
export type CompactCrystalFamily = ChampionCrystalFamily & Partial<Pick<CrystalCatalogFamily, "category" | "championCount" | "championCountsByRarity">>
type Props = {
  families: CompactCrystalFamily[]
  rarity: string
  target: { name: string; rarities?: Record<string, number[]> }
  returnTo?: string | null
  heading?: "h3" | "h4" | "h5"
}
type Opening = CompactCrystalFamily["variants"][number]
const isStandardOpening = (opening: Opening) => opening.family?.variantLabel === "Standard" && !opening.selection
const openingLabel = (opening: Opening) => `${opening.family?.variantLabel ?? (opening.selection ? "Selection" : "Standard")} · ${opening.selection ? `Choose ${opening.selection.pick} of ${opening.selection.draw}` : "One reward"}`

/** Bounded columns keep singleton, pair and larger normal pools the same size. */
export function CompactCrystalFamilyGrid({ families, ...props }: Props) {
  return <ul className={styles.grid} data-compact-crystal-grid>{families.map(family => <CompactCrystalFamilyCard key={family.id} family={family} {...props} />)}</ul>
}

export function CompactCrystalFamilyCard({ family, rarity, target, returnTo, heading: Heading = "h3" }: Omit<Props, "families"> & { family: CompactCrystalFamily }) {
  const variants = family.variants.filter(variant => !rarity || variant.rarities.includes(Number(rarity)))
  // Membership and labels are verified by the host projection. Prefer its exact
  // Standard opening, then retain the existing representative/first-source fallback.
  const source = variants.find(isStandardOpening) ?? variants.find(variant => variant.sourceIds.includes(family.id)) ?? variants[0]
  if (!source) return null
  const sourceId = source.sourceIds.includes(family.id) ? family.id : source.sourceIds[0]
  const alternatives = variants.filter(variant => variant !== source && !isStandardOpening(variant) && !variant.sourceIds.includes(sourceId))
  const primaryOpening = source.selection || source.family && !isStandardOpening(source) ? openingLabel(source) : null
  const sourceIds = variants.flatMap(variant => variant.sourceIds)
  const edition = getCrystalChronology(sourceIds).label ?? crystalEditionLabel(sourceIds, family.category ?? source.category ?? "other")
  const matchedStars = target.rarities?.[family.id] ?? (rarity ? [Number(rarity)] : [])
  const count = rarity ? family.championCountsByRarity?.[rarity] : family.championCount
  return <li className={styles.card} data-compact-crystal-card data-crystal-family={family.id}>
    <CrystalIntentLink className={styles.destination} href={crystalHref(sourceId, { rarity })} returnTo={returnTo} aria-label={`View ${family.name} contents${primaryOpening ? ` · ${primaryOpening}` : ""}`}>
      <span className={styles.artwork} aria-hidden="true">{family.artworkUrl ? <Image data-game-crystal-artwork src={family.artworkUrl} alt="" width={58} height={66} sizes="58px" /> : <Gem />}</span>
      <div className={styles.identity}>
        <div className={styles.edition}><span className={styles.stars}><Check aria-hidden="true" /><span className={styles.srOnly}>{target.name} recorded at </span>{matchedStars.map(value => `${value}★`).join(" · ")}</span>{edition && <span>{edition}</span>}</div>
        <Heading>{family.name}</Heading>
        {primaryOpening && <p className={styles.primaryOpening}>{primaryOpening}</p>}
      </div><ArrowUpRight className={styles.arrow} aria-hidden="true" />
    </CrystalIntentLink>
    {count !== undefined && <p className={styles.count} data-crystal-champion-count><strong>{count}</strong> {count === 1 ? "champion" : "champions"}{!rarity ? " · all stars" : ""}</p>}
    {alternatives.length > 0 && <nav className={styles.openings} aria-label={`${family.name} openings`}>
      {alternatives.map(variant => <CrystalIntentLink key={variant.sourceIds[0]} data-crystal-opening={variant.sourceIds[0]} href={crystalHref(variant.sourceIds[0], { rarity })} returnTo={returnTo} aria-label={`View ${family.name} contents · ${openingLabel(variant)}`}>
        {openingLabel(variant)}
      </CrystalIntentLink>)}
    </nav>}
  </li>
}
