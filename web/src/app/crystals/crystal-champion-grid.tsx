"use client"

import Image from "next/image"
import Link from "next/link"
import { memo, useCallback, useId, useRef, useState, type CSSProperties, type FocusEvent, type MouseEvent, type ReactNode } from "react"
import { ArrowUpRight, X } from "lucide-react"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { getChampionClassColors } from "@/lib/championClassHelper"
import type { CrystalChampion } from "@/lib/data/crystals"
import { CrystalGridNamesToggle, useCrystalGridNames } from "./crystal-grid-preferences"
import styles from "./crystals.module.css"

const className = (value: string) => value.charAt(0) + value.slice(1).toLowerCase()
const stars = (values: number[]) => values.map(value => `${value}★`).join(" · ")
const accent = (champion: CrystalChampion) => ({ "--class-accent": getChampionClassColors(champion.championClass ?? undefined).color }) as CSSProperties

// Hundreds of portraits share one detail popover. Idle portraits stay inexpensive.
const ChampionPortrait = memo(function ChampionPortrait({ champion, rarity, showNames, cards, tabIndex, open, dialogId, onFocus, onClick }: {
  champion: CrystalChampion; rarity: string; showNames: boolean; tabIndex: number; open: boolean; dialogId: string
  cards: boolean
  onFocus: (event: FocusEvent<HTMLButtonElement>) => void; onClick: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const starLabel = rarity ? `${rarity}★` : stars(champion.rarities)
  const compactStars = champion.rarities.length === 1 ? starLabel : `${Math.min(...champion.rarities)}–${Math.max(...champion.rarities)}★`
  const championClass = champion.championClass ? className(champion.championClass) : null
  const firstEdition = champion.firstEditionRarities?.length ? stars(champion.firstEditionRarities) : null
  return <li style={accent(champion)}>
    <button type="button" data-champion-portrait={champion.gameId} className={styles.champion} tabIndex={tabIndex} onFocus={onFocus} onClick={onClick}
      aria-label={`${champion.name}, ${starLabel}${championClass ? `, ${championClass}` : ""}. Show details`} title={champion.name}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined} data-state={open ? "open" : "closed"}>
      <span className={styles.portrait}>
        {champion.portraitUrl ? <Image src={champion.portraitUrl} alt="" width={64} height={64} sizes="64px" loading="lazy" /> : <span className={styles.portraitFallback}>{champion.name.split(/\s+/).slice(0, 2).map(word => word.charAt(0)).join("")}</span>}
        {championClass && <span className={styles.classBadge}><Image src={`/assets/icons/${championClass}.png`} alt="" width={14} height={14} sizes="14px" /></span>}
        {firstEdition && <span className={styles.editionMarker} aria-label={`First Edition available at ${firstEdition}`}>✦</span>}
      </span>
      {showNames && <span className={styles.portraitName}>{champion.name}</span>}
      {(!rarity || cards) && <span className={styles.portraitStars}>{cards ? starLabel : compactStars}{cards && championClass ? ` · ${championClass}` : ""}</span>}
    </button>
  </li>
})

export const CrystalChampionGrid = memo(function CrystalChampionGrid({ champions, rarity, controls = true, label = "Champions in this crystal", layout = "portraits", toolbarActions }: { champions: CrystalChampion[]; rarity: string; controls?: boolean; label?: string; layout?: "portraits" | "cards"; toolbarActions?: ReactNode }) {
  const namePreference = useCrystalGridNames()
  const showNames = layout === "cards" || namePreference
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const anchor = useRef<HTMLButtonElement | null>(null)
  const position = useRef({
    getBoundingClientRect: () => anchor.current?.getBoundingClientRect() ?? new DOMRect(),
    get contextElement() { return anchor.current ?? undefined },
  })
  const restoreFocus = useRef(true)
  const titleId = useId(), dialogId = useId()
  const active = champions.some(champion => champion.gameId === activeId) ? activeId : champions[0]?.gameId
  const selected = champions.find(champion => champion.gameId === selectedId)
  if (selectedId && !selected) setSelectedId(null)
  const selectedStar = rarity || String(selected?.rarities[0])
  const href = selected?.slug ? `/champions/${encodeURIComponent(selected.slug)}${selected.obtainable.includes(selectedStar) ? `?rarity=${selectedStar}` : ""}` : null
  const firstEdition = selected?.firstEditionRarities?.length ? stars(selected.firstEditionRarities) : null
  const onFocus = useCallback((event: FocusEvent<HTMLButtonElement>) => setActiveId(event.currentTarget.dataset.championPortrait ?? null), [])
  const onClick = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    anchor.current = event.currentTarget
    restoreFocus.current = true
    const id = event.currentTarget.dataset.championPortrait ?? null
    setActiveId(id); setSelectedId(id)
  }, [])
  return <Popover open={!!selected} onOpenChange={open => { if (!open) setSelectedId(null) }}>
    <PopoverAnchor virtualRef={position} />
    {controls && <div className={styles.gridToolbar} data-champion-toolbar><p className={styles.gridHint}>Select a portrait<span> for details · Use arrow keys to explore</span></p><div className={styles.gridViewControls}><CrystalGridNamesToggle />{toolbarActions}</div></div>}
    <ul className={`${styles.championGrid}${showNames ? ` ${styles.namedGrid}` : ""}${layout === "cards" ? ` ${styles.championCards}` : ""}`} aria-label={label} onKeyDown={event => {
      const trigger = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-champion-portrait]")
      if (!trigger || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return
      const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[data-champion-portrait]")]
      const index = buttons.indexOf(trigger)
      const firstRowTop = buttons[0].offsetTop
      const rowEnd = buttons.findIndex((button, i) => i > 0 && button.offsetTop > firstRowTop)
      const columns = rowEnd > 0 ? rowEnd : buttons.length
      const step = event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : event.key === "ArrowUp" ? -columns : columns
      const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : Math.max(0, Math.min(buttons.length - 1, index + step))
      event.preventDefault(); buttons[next]?.focus()
    }}>{champions.map(champion => <ChampionPortrait key={champion.gameId} champion={champion} rarity={rarity} showNames={showNames} cards={layout === "cards"} tabIndex={champion.gameId === active ? 0 : -1} open={champion.gameId === selected?.gameId} dialogId={dialogId} onFocus={onFocus} onClick={onClick} />)}</ul>
    {selected && <PopoverContent id={dialogId} className={styles.championDetails} style={accent(selected)} sideOffset={8} collisionPadding={12} aria-labelledby={titleId}
      onInteractOutside={() => { restoreFocus.current = false }}
      onCloseAutoFocus={event => { event.preventDefault(); if (restoreFocus.current && anchor.current?.isConnected) anchor.current.focus() }}>
      <button type="button" className={styles.closeDetails} onClick={() => setSelectedId(null)} aria-label="Close champion details"><X aria-hidden="true" /></button>
      <h3 id={titleId}>{selected.name}</h3>
      <p className={styles.detailStars}>{rarity ? `${rarity}★` : stars(selected.rarities)}{selected.championClass && <span> · {className(selected.championClass)}</span>}</p>
      {firstEdition && <p className={styles.cosmeticReward}>✦ First Edition available at {firstEdition}</p>}
      {firstEdition && selected.firstEditionSources?.length ? <p className={styles.cosmeticReward}>In {selected.firstEditionSources.join(" and ")}</p> : null}
      {href ? <Link className={styles.championProfile} href={href}>View champion <ArrowUpRight aria-hidden="true" /></Link> : <p className={styles.sourceOnly}>No champion page yet</p>}
    </PopoverContent>}
  </Popover>
})
