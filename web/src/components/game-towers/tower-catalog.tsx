import Link from "next/link";
import type { CSSProperties } from "react";
import { ArrowRight, Search } from "lucide-react";
import type { TowerCatalogEntry } from "@/lib/game-towers";
import { TowerImage } from "./tower-image";
import styles from "./towers.module.css";

export const towerTitle = (name: string) => name === name.toUpperCase() ? name.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : name;
export const towerKind = (tower: TowerCatalogEntry) => tower.section === "event" ? "Event Tower" : tower.section === "class" ? "Class Tower" : tower.archiveStatus === "archived" ? "Challenge Tower archive" : "Challenge Tower";
export function eventEndText(endsAt: string | null | undefined, now = Date.now()) {
  const end = endsAt ? new Date(endsAt) : null;
  if (!end || !Number.isFinite(end.getTime())) return null;
  return `${end.getTime() <= now ? "Ended" : "Ends"} ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(end)}`;
}
export const towerColor = (id?: string) => ({ skill: "#f68f72", mutant: "#edcb59", tech: "#71b9f9", cosmic: "#6cdeeb", mystic: "#bf9cf5", science: "#a1d787" }[id ?? ""] ?? "#94cde9");

export function TowerCard({ tower, index = 0, returnTo }: { tower: TowerCatalogEntry; index?: number; returnTo?: string }) {
  const href = `/quests/towers/${encodeURIComponent(tower.id)}${returnTo ? `?from=${encodeURIComponent(returnTo)}` : ""}`;
  return <Link href={href} prefetch={false} className={styles.poster} style={{ "--tower-accent": towerColor(tower.classId) } as CSSProperties}>
    <TowerImage src={tower.artwork?.url} className={styles.posterImage} eager={index < 6} />
    <div className={styles.posterShade} />
    <div className={styles.posterTop}><span>{towerKind(tower)}</span><ArrowRight size={17} aria-hidden="true"/></div>
    <div className={styles.posterCopy}><h3>{towerTitle(tower.name)}</h3><p>{tower.blockNumbers.length ? `${tower.blockNumbers.length} blocks` : "Block details unavailable"}{tower.floorCount !== null && <span> · {tower.floorCount.toLocaleString("en")} floors</span>}</p>{tower.section === "event" && <p className={styles.eventDate}><time dateTime={tower.endsAt ?? undefined}>{eventEndText(tower.endsAt) ?? "Schedule unavailable"}</time></p>}{tower.section === "event" && tower.capturedBlockNumbers?.length === 0 && <p className={styles.eventGap}>Defender details unavailable</p>}<span className={styles.posterAction}>Explore Tower <ArrowRight size={15} aria-hidden="true"/></span></div>
  </Link>;
}

export function TowerCatalog({ towers, query, section, status }: { towers: TowerCatalogEntry[]; query: string; section: string; status: string }) {
  const match = (t: TowerCatalogEntry) => (!query || t.name.toLowerCase().includes(query.toLowerCase())) && (!status || t.archiveStatus === status);
  const classes = towers.filter(t => t.section === "class" && match(t));
  const events = towers.filter(t => t.section === "event" && match(t));
  const challenges = towers.filter(t => t.section === "challenge" && match(t));
  const filters = new URLSearchParams();
  if (query) filters.set("q", query); if (section) filters.set("section", section); if (status) filters.set("status", status);
  const returnTo = `/quests/towers${filters.size ? `?${filters}` : ""}`;
  return <div className={styles.page}>
    <nav className={styles.breadcrumb} aria-label="Quest location"><Link href="/quests">Quest explorer</Link><span aria-hidden="true">/</span><span>Towers</span></nav>
    <header className={styles.catalogHeader}><h1>Towers</h1><p className={styles.intro}>Browse Class, Challenge and Event Towers, floor defenders, nodes and rewards.</p></header>
    <nav className={styles.categories} aria-label="Quest categories"><Link href="/quests">All quests</Link><Link href="/quests?category=Story">Story</Link><Link href="/quests?category=Special">Special</Link><Link href="/quests/towers" aria-current="page">Towers</Link></nav>
    <form key={returnTo} action="/quests/towers" className={styles.filters}><label className={styles.search}><span className={styles.srOnly}>Search Towers</span><Search size={18} aria-hidden="true"/><input type="search" name="q" defaultValue={query} placeholder="Find a Tower"/></label><label><span className={styles.srOnly}>Tower collection</span><select name="section" defaultValue={section}><option value="">All collections</option><option value="class">Class Towers</option><option value="challenge">Challenge Towers</option><option value="event">Event Towers</option></select></label>{towers.some(t => t.archiveStatus !== "unknown") && <label><span className={styles.srOnly}>Archive status</span><select name="status" defaultValue={status}><option value="">All statuses</option><option value="active">Current collection</option><option value="archived">Archives</option><option value="unknown">Status unconfirmed</option></select></label>}<button type="submit" className={styles.primaryButton}>Find</button>{filters.size > 0 && <Link className={styles.reset} href="/quests/towers">Reset</Link>}</form>
    {(!section || section === "class") && <section className={styles.catalogSection} aria-labelledby="class-heading"><div className={styles.sectionHeading}><div><h2 id="class-heading">Class Towers</h2></div><span>{classes.length} {classes.length === 1 ? "Tower" : "Towers"}</span></div><div className={styles.posterGrid}>{classes.map((tower, index) => <TowerCard key={tower.id} tower={tower} index={index} returnTo={returnTo}/>)}</div>{!classes.length && <p className={styles.empty}>No Class Towers match these filters.</p>}</section>}
    {(!section || section === "challenge") && <section className={styles.catalogSection} aria-labelledby="challenge-heading"><div className={styles.sectionHeading}><div><h2 id="challenge-heading">Challenge Towers</h2></div><span>{challenges.length} {challenges.length === 1 ? "Tower" : "Towers"}</span></div>{challenges.length ? <div className={`${styles.posterGrid} ${styles.challengeGrid}`} data-single={challenges.length === 1}>{challenges.map((tower, index) => <TowerCard key={tower.id} tower={tower} index={index} returnTo={returnTo}/>)}</div> : <p className={styles.empty}>{towers.some(t => t.section === "challenge") ? "No Challenge Towers match these filters." : "Challenge Tower definitions are not yet available in this explorer."}</p>}</section>}
    {(!section || section === "event") && <section className={styles.catalogSection} aria-labelledby="event-heading"><div className={styles.sectionHeading}><h2 id="event-heading">Event Towers</h2><span>{events.length} {events.length === 1 ? "Tower" : "Towers"}</span></div>{events.length ? <div className={`${styles.posterGrid} ${styles.eventGrid}`}>{events.map((tower, index) => <TowerCard key={tower.id} tower={tower} index={index} returnTo={returnTo}/>)}</div> : <p className={styles.empty}>No Event Towers match these filters.</p>}</section>}
    <details className={styles.source}><summary>About this Tower collection</summary><p>Block and floor details come from saved native definitions. A listed Tower or block does not establish current access or account eligibility. Unknown artwork, modifiers and rewards remain unresolved. The game&apos;s Challenge Tower Archives groups Towers according to account state. This explorer does not infer archive membership or historical availability from that grouping.</p></details>
  </div>;
}
