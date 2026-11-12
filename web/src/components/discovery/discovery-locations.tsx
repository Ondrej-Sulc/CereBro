import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { discoveryResults, discoverySections, type DiscoveryLocation, type RewardSource } from "@cerebro/core/domain/game-discovery";
import { questRewardScope } from "@/lib/game-quests/presentation";
import styles from "./discovery.module.css";

export const sourceScopeLabel = (scope: string) => scope.endsWith("rewards") || scope.endsWith("rules") ? scope : questRewardScope(scope);
export function DiscoveryLocations({ rows, base, fixed = {}, filters, rewards = false }: {
  rows: DiscoveryLocation[] | RewardSource[]; base: string; fixed?: Record<string, string>;
  filters: { q?: string; section?: string; scope?: string; page?: string }; rewards?: boolean;
}) {
  const view = discoveryResults(rows, filters);
  const url = (changes: Record<string, string>) => `${base}?${new URLSearchParams({ ...fixed, q: filters.q ?? "", section: filters.section ?? "", scope: filters.scope ?? "", ...changes })}#locations`;
  const sections = discoverySections.filter(section => rows.some(r => r.section === section));
  const scopes = [...new Set(rows.flatMap(r => "scope" in r ? [r.scope] : []))];
  return <section id="locations" className={styles.locations} aria-labelledby="locations-heading">
    <div className={styles.sectionHeading}><h2 id="locations-heading">{rewards ? "Where to earn it" : "Where it appears"}</h2><span>{rows.length.toLocaleString("en")} locations</span></div>
    <form action={base} className={styles.filters}>
      {Object.entries(fixed).map(([name, value]) => <input key={name} type="hidden" name={name} value={value}/>)}
      <label className={styles.search}>Find a quest or Tower<input name="q" type="search" defaultValue={filters.q} placeholder="Quest, Tower or defender" maxLength={180}/></label>
      <label>Collection<select name="section" defaultValue={filters.section ?? ""}><option value="">All collections</option>{sections.map(section => <option key={section}>{section}</option>)}</select></label>
      {rewards && <label>Reward type<select name="scope" defaultValue={filters.scope ?? ""}><option value="">All reward types</option>{scopes.map(scope => <option key={scope} value={scope}>{sourceScopeLabel(scope)}</option>)}</select></label>}
      <button type="submit"><Search size={16} aria-hidden="true"/><span>Search</span></button>
    </form>
    <p className={styles.count} role="status">{view.total.toLocaleString("en")} matching locations{(filters.q || filters.section || filters.scope) && <> · <Link href={`${base}?${new URLSearchParams(fixed)}#locations`}>Clear filters</Link></>}</p>
    <ul className={styles.rows}>{view.rows.map((row, i) => {
      const reward = rewards && "scope" in row ? row as RewardSource : undefined;
      const ranged = reward?.minQuantity !== undefined && reward.maxQuantity !== undefined && reward.minQuantity !== reward.maxQuantity;
      return <li key={reward?.key ?? `${row.href}:${i}`}><a href={row.href} className={styles.row} data-discovery-location>
        <div className={styles.copy}><span className={styles.collection}>{row.section}</span><h3>{row.title}</h3>{row.context && <p>{row.context}</p>}{reward && <p className={styles.scope}>{sourceScopeLabel(reward.scope)}{reward.scope === "potentialCompletionRewards" && " · Possible outcome"}</p>}</div>
        {reward && <strong className={styles.quantity}>{ranged ? `${reward.minQuantity!.toLocaleString("en")}–${reward.maxQuantity!.toLocaleString("en")}` : `×${reward.quantity.toLocaleString("en")}`}</strong>}
        <ArrowRight size={17} aria-hidden="true"/>
      </a></li>;
    })}</ul>
    {!view.total && <p className={styles.empty}>No locations match these filters. Try another collection or search.</p>}
    {view.pages > 1 && <nav className={styles.pagination} aria-label="Location pages">{view.page > 1 ? <Link href={url({ page: String(view.page - 1) })}>← Previous</Link> : <span/>}<span>{view.page} / {view.pages}</span>{view.page < view.pages ? <Link href={url({ page: String(view.page + 1) })}>Next →</Link> : <span/>}</nav>}
    {rewards && <p className={styles.note}>These are listed reward sources. Potential outcomes are not guaranteed, and Event Tower availability can change.</p>}
  </section>;
}
