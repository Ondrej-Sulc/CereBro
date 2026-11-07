"use client"

import Image from "next/image"
import { ArrowUpRight, CalendarDays, Gift, Map, Puzzle, ShoppingBag, Trophy } from "lucide-react"
import type { AcquisitionEvidenceKind, ChampionAcquisition, ChampionAcquisitionMethod, ChampionAcquisitionPiece } from "@cerebro/core/domain/champion-acquisition"
import styles from "@/app/champions/[slug]/champion-acquisition-panel.module.css"

const kinds = {
  quest: { label: "Quest reward", icon: Map }, event: { label: "Event reward", icon: Trophy },
  pieces: { label: "Collect pieces", icon: Puzzle }, store: { label: "Store purchase", icon: ShoppingBag }, giveaway: { label: "Event giveaway", icon: Gift },
}
const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const evidenceLabels: Record<AcquisitionEvidenceKind, string> = {
  official_announcement: "Kabam announcement", official_reply: "Kabam reply", official_stream_summary: "Kabam stream summary",
  community_discussion: "Community discussion", community_guide: "Community guide", community_summary: "Community recap", community_screenshot: "Community archive", game_data: "In-game item data",
}
function CollectionPiece({ piece }: { piece: ChampionAcquisitionPiece }) {
  const status = piece.origin?.kind === "past_event" ? "Past event" : piece.origin?.kind === "past_mail" ? "Past gift" : piece.origin?.kind === "quest" ? "Quest reward" : piece.origin?.kind === "store" ? "Store record" : "Source unverified"
  // Generic store boilerplate adds no acquisition condition beyond the source label.
  const description = piece.origin?.description.replace(/^A matching \d-star piece is recorded in the game store\. Current stock and costs may differ\.$/, "")
  return <li className={styles.piece}>
    <div className={styles.pieceArt}>{piece.artworkUrl ? <Image src={piece.artworkUrl} alt="" width={112} height={112} sizes="(max-width: 479px) 72px, 112px" loading="lazy" /> : <Puzzle aria-hidden="true" />}</div>
    <div className={styles.pieceCopy}><h5>{piece.name}</h5><span className={styles.pieceStatus} data-unverified={!piece.origin || undefined}>{status}</span>
      {piece.origin && <>{piece.origin.source.url ? <a className={styles.pieceSource} href={piece.origin.source.url} title={`${piece.origin.source.title}${piece.origin.source.author ? ` - ${piece.origin.source.author}` : ""}`} target="_blank" rel="noopener noreferrer">{piece.origin.label}<ArrowUpRight aria-hidden="true" /></a> : <p className={styles.pieceSource}>{piece.origin.label}</p>}{piece.origin.source.kind !== "game_data" && <span className={styles.evidenceKind} data-community={piece.origin.source.kind.startsWith("community_") || undefined}>{evidenceLabels[piece.origin.source.kind]}</span>}{description && <p className={styles.pieceDescription}>{description}</p>}</>}
    </div>
  </li>
}
function SourceCard({ method, rarity }: { method: ChampionAcquisitionMethod; rarity: string }) {
  const { icon: Icon, label } = kinds[method.kind]
  const status = method.periodStatus === "past" ? "Past event" : method.periodStatus === "upcoming" ? "Upcoming event" : method.periodStatus === "within_window" ? "Event window" : method.availability === "store_access" ? "Store access required" : null
  const requirements = method.requirements.filter(requirement => !method.pieces || requirement !== "Matching-star pieces required")
  const links = method.sources.filter(source => source.url)
  return <li className={styles.card}>
    <header><span className={styles.icon}><Icon aria-hidden="true" /></span><div><p className={styles.kind}>{label}<span>{rarity}★</span></p><h3>{method.title}</h3></div>{status && <span className={styles.status} data-past={method.periodStatus === "past" || undefined}>{status}</span>}</header>
    <p className={styles.description}>{method.description}</p>
    {requirements.length > 0 && <ul className={styles.requirements} aria-label="Requirements">{requirements.map(requirement => <li key={requirement}>{requirement}</li>)}</ul>}
    {method.pieces && <section className={styles.collection} aria-label="Collection pieces"><div className={styles.collectionHeading}><h4>Required pieces <span>{method.pieces.length}</span></h4></div><ul className={styles.pieceGrid}>{method.pieces.map(piece => <CollectionPiece key={piece.itemId} piece={piece} />)}</ul></section>}
    {method.startsAt && method.endsAt && <p className={styles.dates}><CalendarDays aria-hidden="true" /><span><time dateTime={method.startsAt}>{date.format(new Date(method.startsAt))}</time><span aria-hidden="true"> – </span><time dateTime={method.endsAt}>{date.format(new Date(method.endsAt))}</time></span></p>}
    {links.length > 0 && <footer>{links.map(source => <a href={source.url} key={source.id} target="_blank" rel="noopener noreferrer" title={source.author}><span className={styles.evidenceKind} data-community={source.kind.startsWith("community_") || undefined}>{evidenceLabels[source.kind]}</span><span>{source.title}</span><ArrowUpRight aria-hidden="true" /></a>)}</footer>}
  </li>
}

export function ChampionAcquisitionSources({ acquisition, selectedRarity = "" }: { acquisition: ChampionAcquisition; selectedRarity?: string }) {
  const methods = acquisition.methods.filter(method => !selectedRarity || method.rarities.includes(Number(selectedRarity)))
  if (!methods.length) return null
  return <ul className={styles.sources} aria-label="Other acquisition methods">{methods.map(method => <SourceCard method={method} rarity={selectedRarity || [...method.rarities].sort((a, b) => b - a).join("\u2605 \u00b7 ")} key={method.id} />)}</ul>
}
