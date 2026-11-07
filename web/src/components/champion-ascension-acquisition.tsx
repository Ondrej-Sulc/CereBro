"use client"

import Image from "next/image"
import type { ReactNode } from "react"
import { ArrowUpRight, CalendarDays, Coins, Map, Package, ShoppingBag, Sparkles, Trophy } from "lucide-react"
import type { ChampionAscensionAcquisitionRoute, ChampionAscensionAcquisitionSources, ChampionAscensionMaterialPath } from "@/lib/data/champion-ascension-acquisition-types"
import styles from "./champion-ascension-acquisition.module.css"

const date = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const formatDate = (value: string) => date.format(new Date(value.length === 10 ? `${value}T00:00:00Z` : value))
const kinds = {
  exchange: { label: "Currency exchange", icon: Coins }, challenge: { label: "Challenge reward", icon: Trophy },
  event: { label: "Event reward", icon: Trophy }, sale: { label: "Store offer", icon: ShoppingBag },
  quest: { label: "Quest reward", icon: Map }, definition: { label: "Static definition", icon: Package },
}
const statuses = {
  historical: "Past event", upcoming: "Upcoming", activity_dependent: "Activity-dependent",
  current_stock_unverified: "Current stock unverified", definition_only: "Definition only",
}

function MaterialPath({ path }: { path: ChampionAscensionMaterialPath }) {
  return <div className={styles.path} data-material-path={path.rarity}>
    <div className={styles.pathIntro}><div className={styles.pathHeading}><Sparkles aria-hidden="true" /><strong>{path.rarity}★ · Recorded path to A{path.maxLevel}</strong></div><p className={styles.costLabel}>Incremental upgrade costs</p><details className={styles.details}><summary>Path notes & eligibility</summary><p>{path.guidance}</p></details></div>
    {path.steps.map(step => <div className={styles.costs} key={step.level} aria-label={`${path.rarity}-star upgrade cost to A${step.level}`}><strong className={styles.step}>A{step.level - 1} → A{step.level}</strong>{step.costs.map(cost => <span key={`${cost.type}:${cost.id}`}>{cost.imageUrl && <Image src={cost.imageUrl} alt="" width={24} height={24} sizes="24px" />}<span><strong>{cost.quantity.toLocaleString("en")}</strong> {cost.name ?? cost.id}</span></span>)}</div>)}
  </div>
}

function MethodRow({ route }: { route: ChampionAscensionAcquisitionRoute }) {
  const { icon: Icon, label } = kinds[route.kind]
  const official = route.sources.find(source => source.url && source.kind.startsWith("official_"))
  return <li className={styles.method} data-ascension-method={route.id}>
    <header><span className={styles.icon}><Icon aria-hidden="true" /></span><div className={styles.identity}><p className={styles.kind}>{label} · {route.rarity}★</p><h4>{route.title}</h4></div><span className={styles.status} data-status={route.availability}>{statuses[route.availability]}</span></header>
    <p className={styles.description}>{route.description}</p>
    {route.conditions.length > 0 && route.kind === "exchange" && <p className={styles.conditions}>{route.conditions[0]}</p>}
    {route.window && <div className={styles.window}><CalendarDays aria-hidden="true" /><div>{route.window.label}{(route.window.start || route.window.end) && <p>{route.window.start && <time dateTime={route.window.start}>{formatDate(route.window.start)}</time>}{route.window.start && route.window.end && " – "}{route.window.end && <time dateTime={route.window.end}>{formatDate(route.window.end)}</time>}</p>}</div></div>}
    {route.offers.some(offer => offer.rewards.some(reward => reward.role === "ascension_material")) && <div className={styles.payouts} aria-label="Recorded material rewards">{route.offers.filter(offer => offer.rewards.some(reward => reward.role === "ascension_material")).map(offer => <div key={offer.id}>
      <h5>{offer.label}</h5><p>{route.sources.find(source => source.id === offer.sourceId)?.kind === "static_store" ? "Static contents · stock unverified" : "Recorded reward"}{offer.purchaseLimit !== null && ` · Limit ${offer.purchaseLimit}`}</p>
      <ul>{offer.rewards.filter(reward => reward.role === "ascension_material").map((reward, index) => <li key={index}>{reward.imageUrl && <Image src={reward.imageUrl} alt="" width={24} height={24} sizes="24px" />}<span><strong>{reward.quantity.toLocaleString("en")}</strong> {reward.name ?? reward.id}</span></li>)}</ul>
    </div>)}</div>}
    {official && <footer><a href={official.url} target="_blank" rel="noopener noreferrer" title={`${official.publisher} · ${official.title}`}>Official source <ArrowUpRight aria-hidden="true" /></a></footer>}
    <details className={styles.details}><summary>Source details{route.offers.length > 0 ? " & bundle contents" : " & evidence"}</summary>
      {route.conditions.map(condition => <p key={condition}>{condition}</p>)}
      {route.starScope === "recorded_path_match" && <p>The published mechanism does not independently establish every star restriction. {route.rarity}★ applicability is matched to the recorded material path.</p>}
      {route.offers.map(offer => {
        const evidence = route.sources.find(source => source.id === offer.sourceId)
        return <div className={styles.offer} key={offer.id}><h5>{offer.label}</h5>
        {evidence && <p className={styles.offerEvidence}>{evidence.kind === "static_store" ? "Static bundle contents · stock unverified" : evidence.kind === "quest_capture" ? "Recorded quest reward" : "Published announcement"}{evidence.publishedAt && <> · <time dateTime={evidence.publishedAt}>{formatDate(evidence.publishedAt)}</time></>}</p>}
        {offer.price && <p>{offer.price.quantity.toLocaleString("en")} {offer.price.currency}</p>}
        {offer.purchaseLimit !== null && <p>Purchase limit: {offer.purchaseLimit}</p>}
        {offer.rewards.length > 0 && <ul aria-label="Recorded bundle contents">{offer.rewards.map((reward, index) => <li key={`${reward.type}:${reward.id}:${index}`}>{reward.imageUrl ? <Image src={reward.imageUrl} alt="" width={28} height={28} sizes="28px" /> : <Package aria-hidden="true" />}<span>{reward.quantity.toLocaleString("en")} {reward.name ?? reward.id}{reward.role === "champion" ? " · Champion reward" : reward.role === "other" ? " · Other reward" : ""}</span></li>)}</ul>}
        {offer.conditions.map(condition => <p key={condition}>{condition}</p>)}
        {offer.binding && <p className={styles.binding}>Exact binding: <code>{offer.binding}</code></p>}
      </div>})}
      {route.confidence === "partial" && <p>Reward quantities and current access are not fully verified.</p>}
      {route.sources.map(source => <p className={styles.citation} key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} <ArrowUpRight aria-hidden="true" /></a> : source.title}<span>{source.publisher}{source.creditedTo ? ` · Credits ${source.creditedTo}` : ""}{source.publishedAt ? <> · Published <time dateTime={source.publishedAt}>{formatDate(source.publishedAt)}</time></> : ""}{source.capturedAt ? <> · Captured <time dateTime={source.capturedAt}>{formatDate(source.capturedAt)}</time></> : ""}</span></p>)}
    </details>
  </li>
}

/** One selected-champion projection, shared by finder and lazy How to obtain. */
export function ChampionAscensionAcquisition({ data, selectedRarity = "7", hasCrystalSources = false, children }: {
  data: ChampionAscensionAcquisitionSources; selectedRarity?: string; hasCrystalSources?: boolean; children?: ReactNode
}) {
  if (selectedRarity && selectedRarity !== "7") return null
  const matchesStar = (row: { rarity: number }) => row.rarity === 7
  const paths = data.paths.filter(path => matchesStar(path) && path.state === "recorded_path")
  const routes = data.routes.filter(matchesStar)
  const definitions = data.definitions.filter(matchesStar)
  if (!paths.length && !routes.length && !definitions.length) return null
  const missingPersonal = paths.some(path => path.materialKind === "champion_specific" && !routes.some(route => route.rarity === path.rarity)) && !hasCrystalSources
  return <div className={styles.section}>
    <div className={styles.sourceContent}>
    {routes.length > 0 && <ul className={styles.methods} aria-label="Reviewed ascension methods">{routes.map(route => <MethodRow key={route.id} route={route} />)}</ul>}
    {children}
    {missingPersonal && <p className={styles.unknown}>A {paths.filter(path => path.materialKind === "champion_specific").map(path => `${path.rarity}★`).join(" / ")} ascension path is recorded. We have not verified an obtainable source for this champion’s ascension materials.</p>}
    {definitions.length > 0 && <details className={styles.definitions}><summary>Static material definitions · {definitions.length}</summary><p>These records do not establish an obtainable method.</p><ul className={styles.methods}>{definitions.map(route => <MethodRow key={route.id} route={route} />)}</ul></details>}
    </div>
    {paths.length > 0 && <aside className={styles.paths} aria-label="Canonical upgrade costs">{paths.map(path => <MaterialPath key={path.rarity} path={path} />)}</aside>}
  </div>
}
