"use client"

import Image from "next/image"
import { useState, type ReactNode } from "react"
import { ArrowUpRight, Check, ChevronDown, Coins, Gem, Gift, Info, Layers, Package, UserRound } from "lucide-react"
import type { CrystalRewardPresentation, CrystalRewardPrize, CrystalRewardRate, CrystalRewardVariant } from "@/lib/crystal-reward-presentation"
import { crystalRewardAmount, sortCrystalRewardRows } from "@/lib/crystal-reward-presentation"
import { crystalOddsIconKind, crystalRatePercentage as percent } from "@/lib/crystal-odds-presentation"
import { CrystalIntentLink } from "./crystal-intent-link"
import styles from "./crystal-rewards-browser.module.css"

const icons = { champion: UserRound, crystal: Gem, material: Layers, resource: Coins, selector: Gift, item: Package }
const groupName = (group: CrystalRewardPrize) => group.name?.trim().replace(/^PRIZE\s*(\d+)$/i, "Prize $1") || `Reward group ${group.sourceIndex + 1}`
const amounts = (variant: CrystalRewardVariant) => [...new Set(variant.options.map(crystalRewardAmount).filter(Boolean))]
const displayLabel = (value: string) => value === value.toLocaleUpperCase("en") && /[A-Z]/.test(value)
  ? value.toLocaleLowerCase("en").replace(/\b[a-z]/g, letter => letter.toUpperCase()).replace(/Iso-8/g, "ISO-8") : value

function description(variants: CrystalRewardVariant[]) {
  if (!variants.length) return ""
  const values = [...new Set(variants.flatMap(amounts))]
  const classes = new Set(variants.map(variant => variant.className).filter(Boolean))
  const parts = variants.length > 1 ? [classes.size === variants.length ? `${classes.size} classes` : `${variants.length} variants`] : []
  if (values.length === 1) parts.unshift(values[0])
  else if (values.length > 1) parts.push(`${values.length} ${variants.length > 1 ? "amounts" : "amount options"}`)
  if (variants.length === 1 && variants[0].reward.selection) parts.push(`Choose ${variants[0].reward.selection.pick} of ${variants[0].reward.selection.draw}`)
  return parts.join(" · ")
}

function Artwork({ row, variants, label }: { row?: CrystalRewardRate; variants: CrystalRewardVariant[]; label: string }) {
  const images = [...new Set(variants.map(variant => variant.reward.imageUrl).filter((url): url is string => !!url))]
  const single = row?.visual.imageUrl ?? (images.length === 1 ? images[0] : null)
  const Icon = icons[row?.visual.kind ?? crystalOddsIconKind(label)]
  return <span className={styles.artwork}>{single ? <Image data-reward-artwork src={single} alt="" width={48} height={48} sizes="48px" loading="lazy" />
    : images.length > 1 ? <span className={styles.artStack}>{images.slice(0, 3).map(src => <Image data-reward-artwork key={src} src={src} alt="" width={36} height={36} sizes="36px" loading="lazy" />)}</span>
    : <Icon aria-hidden="true" />}</span>
}

function VariantDetails({ variants }: { variants: CrystalRewardVariant[] }) {
  if (variants.length === 1) return <ul className={styles.amounts} aria-label={`Recorded amounts for ${variants[0].label}`}>{amounts(variants[0]).map(amount => <li key={amount}>{amount}</li>)}</ul>
  const classOptions = variants.every(variant => !!variant.className) && new Set(variants.map(variant => variant.className)).size === variants.length
  return <ul className={styles.variantGrid} data-class-options={classOptions || undefined} aria-label="Reward variants">{variants.map(variant => <li key={variant.reward.key} data-reward-category={variant.reward.categoryId}>
    {variant.reward.imageUrl ? <Image data-reward-artwork src={variant.reward.imageUrl} alt="" width={40} height={40} sizes="40px" loading="lazy" /> : <Package aria-hidden="true" />}
    <div>{variant.reward.href ? <CrystalIntentLink href={variant.reward.href}>{displayLabel(variant.label)}<ArrowUpRight aria-hidden="true" /></CrystalIntentLink> : <strong title={variant.label}>{classOptions ? variant.className : displayLabel(variant.label)}</strong>}
      <ul className={styles.amounts}>{amounts(variant).map(amount => <li key={amount}>{amount}</li>)}</ul></div>
  </li>)}</ul>
}

function RewardEntry({ row, variant, open, onOpenChange }: { row?: CrystalRewardRate; variant?: CrystalRewardVariant; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const variants = row?.variants ?? (variant ? [variant] : [])
  const label = displayLabel(row?.rate.label || variant?.label || "Reward category")
  const destinations = new Set(variants.map(item => item.reward.href))
  const href = row?.visual.href ?? (destinations.size === 1 ? variants[0]?.reward.href : null)
  const expandable = variants.length > 1 || variants.some(item => amounts(item).length > 1)
  const certain = !!row && Number(row.rate.percentValue) === 100 && !row.rate.prefix
  const subtitle = description(variants)
  const content = <>
    <Artwork row={row} variants={variants} label={label} />
    <span className={styles.copy}>{href ? <CrystalIntentLink href={href}>{label}<ArrowUpRight aria-hidden="true" /></CrystalIntentLink> : <strong>{label}</strong>}{subtitle && <span>{subtitle}</span>}</span>
    {row && <span className={styles.rate} data-certain={certain || undefined} title={`Server-disclosed value: ${row.rate.prefix ?? ""}${row.rate.percentValue}%`}>{row.rate.prefix}{percent(row.rate.percentValue)}%</span>}
    {expandable && <ChevronDown className={styles.chevron} aria-hidden="true" />}
  </>
  return expandable ? <details className={styles.entry} open={open} onToggle={event => onOpenChange?.(event.currentTarget.open)} data-unrated={!row || undefined} data-reward-amounts={variants.length === 1 || undefined} data-odds-row={row?.key} data-reward-category={variants.length === 1 ? variants[0].reward.categoryId : undefined}>
    <summary className={styles.row}>{content}</summary>
    <div className={styles.options}><p className={styles.optionsLabel}>{variants.length > 1 ? "Reward options" : "Amount options"}</p><VariantDetails variants={variants} />{row && <p className={styles.optionsNote}>Individual option rates are not disclosed.</p>}</div>
  </details> : <article className={`${styles.entry} ${styles.row}`} data-unrated={!row || undefined} data-odds-row={row?.key} data-reward-category={variants[0]?.reward.categoryId}>{content}</article>
}

/** Keep each column stable when a native details row expands. CSS multicolumn
 * balancing otherwise moves rewards to the other column during interaction. */
function RewardColumns({ entries }: { entries: ReactNode[] }) {
  const split = Math.ceil(entries.length / 2)
  return <div className={styles.rows} data-columns={entries.length > 1 ? "two" : "one"}>
    <div data-reward-column>{entries.slice(0, split)}</div>
    {entries.length > 1 && <div data-reward-column>{entries.slice(split)}</div>}
  </div>
}

type RewardExpansion = { expandedRows: ReadonlySet<string>; onExpand: (key: string, open: boolean) => void }

function Prize({ group, showHeading, expandedRows, onExpand }: { group: CrystalRewardPrize; showHeading: boolean } & RewardExpansion) {
  return <article className={styles.prize} data-guaranteed={group.guaranteed || undefined} aria-label={groupName(group)}>
    {showHeading && <header><h3>{groupName(group)}{group.isFeatured && <span>Featured</span>}</h3>{group.guaranteed ? <span className={styles.guaranteed}><Check aria-hidden="true" />Guaranteed category</span> : <span>{group.rows.length} reward {group.rows.length === 1 ? "category" : "categories"}</span>}</header>}
    <RewardColumns entries={group.rows.map(row => <RewardEntry key={row.key} row={row} open={expandedRows.has(row.key)} onOpenChange={open => onExpand(row.key, open)} />)} />
  </article>
}

export function CrystalRewardsBrowser({ presentation, primary = false }: { presentation: CrystalRewardPresentation; primary?: boolean }) {
  const [selected, setSelected] = useState("all")
  // Prize selection can unmount rows; retain their native disclosure state.
  const [expandedRows, setExpandedRows] = useState<ReadonlySet<string>>(() => new Set())
  const onExpand = (key: string, open: boolean) => setExpandedRows(previous => {
    if (previous.has(key) === open) return previous
    const next = new Set(previous)
    if (open) next.add(key)
    else next.delete(key)
    return next
  })
  const total = presentation.groups.reduce((count, group) => count + group.rows.length, 0) + presentation.unrated.length
  if (!total) return null
  const groups = presentation.groups.filter(group => selected === "all" || selected === String(group.sourceIndex)).map(group => ({ ...group,
    rows: sortCrystalRewardRows(group.rows) })).filter(group => group.rows.length)
  const unrated = selected === "all" || selected === "unrated" ? presentation.unrated : []
  const regular = groups.filter(group => !group.guaranteed)
  const guaranteed = groups.filter(group => group.guaranteed)
  return <section id="crystal-other-rewards" className={styles.section} aria-labelledby="crystal-other-rewards-title" data-crystal-odds={presentation.groups.length > 0 || undefined}>
    <header className={styles.heading}><h2 id="crystal-other-rewards-title">{presentation.groups.length ? "Rewards & drop rates" : primary ? "Possible rewards" : "Other rewards"}<span aria-label={`${total} reward categories`}>{total}</span></h2>{presentation.groups.length > 1 && <span>{presentation.groups.length} prize groups</span>}</header>
    {presentation.groups.length > 1 && <nav className={styles.groupTabs} aria-label="Reward prize groups"><button type="button" aria-label="Show all prize groups" aria-pressed={selected === "all"} onClick={() => setSelected("all")}>All prizes</button>{presentation.groups.map(group => <button type="button" key={group.sourceIndex} aria-label={`Show ${groupName(group)}`} aria-pressed={selected === String(group.sourceIndex)} onClick={() => setSelected(String(group.sourceIndex))}>{groupName(group)}</button>)}{presentation.unrated.length >= 3 && <button type="button" aria-pressed={selected === "unrated"} onClick={() => setSelected("unrated")}>Other recorded</button>}</nav>}
    <div className={styles.prizes}>{regular.map(group => <Prize key={group.sourceIndex} group={group} expandedRows={expandedRows} onExpand={onExpand} showHeading={presentation.groups.length > 1 || !!group.name?.trim()} />)}</div>
    {guaranteed.length > 0 && <div className={styles.included}><h3>{regular.length ? "Guaranteed extras" : "Guaranteed categories"}</h3><div className={styles.guaranteedPrizes}>{guaranteed.map(group => <Prize key={group.sourceIndex} group={group} expandedRows={expandedRows} onExpand={onExpand} showHeading={presentation.groups.length > 1 || !!group.name?.trim()} />)}</div></div>}
    {unrated.length > 0 && <div className={styles.unrated}>{presentation.groups.length > 0 && <header><h3>Other recorded rewards</h3><p>Individual percentages are not available for these rewards.</p></header>}<RewardColumns entries={unrated.map(variant => <RewardEntry key={variant.reward.key} variant={variant} open={expandedRows.has(variant.reward.key)} onOpenChange={open => onExpand(variant.reward.key, open)} />)} /></div>}
    {presentation.groups.length > 0 && <p className={styles.note}><Info aria-hidden="true" /><span>Rates apply to the listed reward categories. Individual champion, class and amount chances are not inferred.</span></p>}
  </section>
}
