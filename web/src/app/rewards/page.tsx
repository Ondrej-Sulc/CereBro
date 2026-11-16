import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowRight, ArrowLeft, Gem, SearchX } from "lucide-react";
import { getRewardDiscovery, listDiscoverableRewards } from "@cerebro/core/data/game-discovery";
import { rewardIdentity, rewardSourcesHref } from "@cerebro/core/domain/game-discovery";
import { projectRewardRow } from "@/lib/game-quests/presentation";
import { DiscoveryLocations } from "@/components/discovery/discovery-locations";
import { RewardItemOverlay } from "@/components/reward-item-overlay";
import { RewardSearch, type RewardSearchOption } from "@/components/discovery/reward-search";
import { rankRewardSearchOptions, rewardSearchLabel } from "@/components/discovery/reward-search-ranking";
import styles from "@/components/discovery/discovery.module.css";
import finder from "@/components/discovery/reward-finder.module.css";

export const metadata = { title: "Where to earn rewards | CereBro" };
type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, key: string) => typeof p[key] === "string" ? p[key] : "";
const preservedRewardWords = new Set(["ISO", "ISO-8", "XP", "DNA", "AQ", "AW", "II", "III", "IV", "VI", "VII", "VIII", "IX"]);
function readableRewardName(name: string) {
  return name.replace(/\b[A-Z0-9]+(?:['’-][A-Z0-9]+)*\b/g, word => preservedRewardWords.has(word) || /^T\d+$/.test(word)
    ? word
    : word.split(/([-’'])/).map(part => part.charAt(0) + part.slice(1).toLocaleLowerCase("en")).join(""));
}
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
  const allEntries = listDiscoverableRewards().map(reward => {
    const view = projectRewardRow(reward.sample, "", "lookup");
    const option: RewardSearchOption = { key: rewardIdentity(reward.type, reward.token), name: readableRewardName(view.name), href: rewardSourcesHref(reward.type, reward.token),
      imageUrl: view.imageUrl, sources: reward.locations, rarity: view.rarity ?? null };
    return { ...reward, view, option };
  }).sort((a, b) => a.option.name.localeCompare(b.option.name, "en") || a.option.key.localeCompare(b.option.key, "en"));
  const options = allEntries.map(entry => entry.option);
  const hasQuery = filters.q.trim().length > 0;
  const entriesByKey = new Map(allEntries.map(entry => [entry.option.key, entry]));
  const entries = hasQuery ? rankRewardSearchOptions(options, filters.q, options.length).map(option => entriesByKey.get(option.key)!) : allEntries;
  const shortcuts = [{ label: "Catalysts", query: "catalyst" }, { label: "Crystals", query: "crystal" }, { label: "Rank-up gems", query: "rank up gem" }, { label: "ISO-8", query: "iso 8" }]
    .filter(shortcut => rankRewardSearchOptions(options, shortcut.query, 1).length > 0);
  const pages = Math.max(1, Math.ceil(entries.length / 24)), requested = Number(filters.page), page = Math.min(pages, Number.isSafeInteger(requested) && requested > 0 ? requested : 1);
  return <div className={finder.page}>
    <Link href="/quests" className={finder.back}><ArrowLeft size={15} aria-hidden="true"/>Quest explorer</Link>
    <header className={finder.hero}><h1>Find a reward</h1><p>Find the item you need, then see which quests and Towers list it.</p></header>
    <section className={finder.searchPanel} aria-label="Search rewards">
      <RewardSearch key={filters.q} initialQuery={filters.q} options={options}/>
      <nav className={finder.shortcuts} aria-label="Quick reward searches"><span>Try</span>{shortcuts.map(shortcut => <Link prefetch={false} key={shortcut.query} href={`/rewards?${new URLSearchParams({ q: shortcut.query })}`} aria-current={filters.q.trim().toLocaleLowerCase("en") === shortcut.query ? "page" : undefined}>{shortcut.label}</Link>)}</nav>
    </section>
    <section className={finder.results} aria-labelledby="reward-results-heading">
      <div className={finder.resultsHeading}><div><h2 id="reward-results-heading">{hasQuery ? "Search results" : "Browse all rewards"}</h2><p role="status">{entries.length.toLocaleString("en")} {entries.length === 1 ? "reward" : "rewards"}{hasQuery && <> matching <strong>“{filters.q}”</strong></>}</p></div>{hasQuery && <Link href="/rewards" className={finder.clear}>Clear search</Link>}</div>
      {entries.length > 0 ? <ul className={finder.catalog} aria-label="Rewards">{entries.slice((page - 1) * 24, page * 24).map(entry => <li key={entry.option.key}><Link prefetch={false} href={entry.option.href} className={finder.rewardCard}>
        <span className={finder.itemArt}>{art(entry.view)}</span><div className={finder.cardCopy}><h3>{rewardSearchLabel(entry.option)}</h3><p><strong>{entry.locations.toLocaleString("en")}</strong> {entry.locations === 1 ? "source" : "sources"}</p></div><ArrowRight className={finder.cardArrow} size={16} aria-hidden="true"/>
      </Link></li>)}</ul> : <div className={finder.empty}><SearchX size={28} aria-hidden="true"/><h3>No rewards found</h3><p>Try a broader name, a star rating, or one of the searches above.</p><Link href="/rewards">Browse all rewards <ArrowRight size={15} aria-hidden="true"/></Link></div>}
      {pages > 1 && <nav className={finder.pagination} aria-label="Reward pages">{page > 1 ? <Link href={`/rewards?${new URLSearchParams({ q: filters.q, page: String(page - 1) })}`}><ArrowLeft size={15} aria-hidden="true"/>Previous</Link> : <span/>}<span>Page {page} of {pages}</span>{page < pages ? <Link href={`/rewards?${new URLSearchParams({ q: filters.q, page: String(page + 1) })}`}>Next<ArrowRight size={15} aria-hidden="true"/></Link> : <span/>}</nav>}
    </section>
  </div>;
}
