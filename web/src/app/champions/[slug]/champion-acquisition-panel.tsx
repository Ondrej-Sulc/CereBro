"use client"

import Link from "next/link"
import { useId } from "react"
import { ArrowUpRight } from "lucide-react"
import type { ChampionAcquisition } from "@cerebro/core/domain/champion-acquisition"
import type { ChampionCrystalAvailability } from "@cerebro/core/domain/champion-crystals"
import type { ChampionAscensionRules } from "@cerebro/core/domain/champion-ascension"
import { crystalCatalogHref } from "@/lib/crystal-navigation"
import { ChampionAcquisitionSources } from "@/components/champion-acquisition-sources"
import { ChampionAcquisitionDataNotes } from "@/components/champion-acquisition-data-notes"
import { ChampionCrystalsPanel } from "./champion-crystals-panel"
import { ChampionAscensionSources } from "./champion-ascension-sources"
import styles from "./champion-acquisition-panel.module.css"

export function ChampionAcquisitionPanel({ acquisition, availability, selectedRarity, championName, championSlug, ascensionRules }: {
  acquisition?: ChampionAcquisition; availability?: ChampionCrystalAvailability; selectedRarity: string; championName: string; championSlug?: string | null; ascensionRules?: ChampionAscensionRules | null
}) {
  const titleId = useId()
  const methods = acquisition?.methods.filter(method => method.rarities.includes(Number(selectedRarity))) ?? []
  const hasCrystals = availability?.crystals.some(crystal => crystal.rarities.includes(Number(selectedRarity))) || (availability?.otherCounts?.[selectedRarity] ?? 0) > 0
  const hasAscension = selectedRarity === "7" && championSlug && ascensionRules?.rarity === 7 && ascensionRules.maxLevel > 0
  return <section className={styles.panel} aria-labelledby={titleId}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>{selectedRarity}★ acquisition</p><h2 id={titleId}>How to obtain</h2></div><Link prefetch={false} href={crystalCatalogHref({ rarity: selectedRarity })}>Browse crystals <ArrowUpRight aria-hidden="true" /></Link></header>
    {methods.length > 0 ? <ChampionAcquisitionSources acquisition={acquisition!} selectedRarity={selectedRarity} /> : !hasCrystals && <p className={styles.unknown}>No acquisition source recorded for this star level. Other ways to obtain this champion may exist.</p>}
    <ChampionCrystalsPanel key={`${championSlug}:${selectedRarity}`} embedded availability={availability} selectedRarity={selectedRarity} championName={championName} championSlug={championSlug} />
    <ChampionAscensionSources championSlug={championSlug} championName={championName} selectedRarity={selectedRarity} ascensionRules={ascensionRules} championAcquisition={acquisition} crystalPoolObservedAt={availability?.observedAt} />
    {!hasAscension && <ChampionAcquisitionDataNotes acquisition={acquisition} crystalPoolObservedAt={availability?.observedAt} />}
  </section>
}
