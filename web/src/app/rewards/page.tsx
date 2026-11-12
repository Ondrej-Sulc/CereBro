import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Gem } from "lucide-react";
import { getRewardDiscovery, listDiscoverableRewards } from "@cerebro/core/data/game-discovery";
import { rewardSourcesHref, matchesDiscoveryQuery } from "@cerebro/core/domain/game-discovery";
import { projectRewardRow } from "@/lib/game-quests/presentation";
import { DiscoveryLocations } from "@/components/discovery/discovery-locations";
import { RewardItemOverlay } from "@/components/reward-item-overlay";
import styles from "@/components/discovery/discovery.module.css";

export const metadata = { title: "Where to earn rewards | CereBro" };
type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, key: string) => typeof p[key] === "string" ? p[key] : "";
export default async function RewardSourcesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const p = await searchParams, type = one(p, "type"), token = one(p, "item");
  const reward = type && token ? getRewardDiscovery(type, token) : undefined;
  if ((type || token) && !reward) notFound();
  const filters = { q: one(p, "q").slice(0, 180), section: one(p, "section"), scope: one(p, "scope"), page: one(p, "page") };
  const art = (view: ReturnType<typeof projectRewardRow>) => <span className={styles.art}>{view.imageUrl ? <Image src={view.imageUrl} width={76} height={76} sizes="76px" alt=""/> : <Gem size={30} aria-hidden="true"/>}<RewardItemOverlay rank={view.rankChange} signaturePoints={view.signaturePoints} rarity={view.itemRarity}/></span>;
  if (reward) {
    const view = projectRewardRow(reward.sample, "", "lookup");
    return <div className={styles.page}><Link href="/rewards" className={styles.back}>← Find a reward</Link>
      <header className={styles.hero}>{art(view)}<div><p>Reward sources</p><h1>{view.rarity ? `${view.rarity}★ ` : ""}{view.name}</h1>{view.href && <Link href={view.href} className={styles.back}>View {view.type === "crystal" ? "crystal" : view.type === "champion" ? "champion" : "details"} ↗</Link>}</div></header>
      <DiscoveryLocations rows={reward.sources} base="/rewards" fixed={{ type, item: token }} filters={filters} rewards/>
    </div>;
  }
  const entries = listDiscoverableRewards().map(r => ({ ...r, view: projectRewardRow(r.sample, "", "lookup") }))
    .filter(r => matchesDiscoveryQuery(r.view.name, filters.q)).sort((a, b) => a.view.name.localeCompare(b.view.name));
  const pages = Math.max(1, Math.ceil(entries.length / 24)), requested = Number(filters.page), page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  return <div className={styles.page}><Link href="/quests" className={styles.back}>← Quest explorer</Link><header className={styles.hero}><div><h1>Find a reward</h1><p>Find quests and Towers that list the item you need.</p></div></header>
    <form action="/rewards" className={styles.filters}><label className={styles.search}>Reward name<input type="search" name="q" defaultValue={filters.q} placeholder="Catalyst, crystal, rank-up gem…" maxLength={180}/></label><button>Search</button></form>
    <p className={styles.count}>{entries.length} rewards</p><ul className={styles.catalog}>{entries.slice((page - 1) * 24, page * 24).map(r => <li key={`${r.type}:${r.token}`}><Link prefetch={false} href={rewardSourcesHref(r.type, r.token)} className={styles.rewardCard}>{art(r.view)}<div><h2>{r.view.rarity ? `${r.view.rarity}★ ` : ""}{r.view.name}</h2><p>{r.locations.toLocaleString("en")} reward sources →</p></div></Link></li>)}</ul>
    {!entries.length && <p className={styles.empty}>No rewards match that name. Try another search.</p>}
    {pages > 1 && <nav className={styles.pagination} aria-label="Reward pages">{page > 1 ? <Link href={`/rewards?${new URLSearchParams({ q: filters.q, page: String(page - 1) })}`}>← Previous</Link> : <span/>}<span>{page} / {pages}</span>{page < pages ? <Link href={`/rewards?${new URLSearchParams({ q: filters.q, page: String(page + 1) })}`}>Next →</Link> : <span/>}</nav>}
  </div>;
}
