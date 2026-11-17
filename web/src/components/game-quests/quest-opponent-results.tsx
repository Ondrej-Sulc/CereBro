import Link from "next/link";
import Image from "next/image";
import { ArrowRight, BookOpen, ChevronDown, Compass, MapPin, Search, Skull, SlidersHorizontal } from "lucide-react";
import { opponentResults, type OpponentFilters, type QuestOpponentMatch } from "@cerebro/core/domain/game-quests/opponent-lookup";
import type { QuestSummary } from "@cerebro/core/domain/game-quests";
import { findQuest } from "@cerebro/core/data/game-quests";
import { getGroupMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import styles from "./quest-opponent-lookup.module.css";

type QuestGroup = ReturnType<typeof opponentResults>["groups"][number];
type ResultCollection = { key: string; title: string; section: "Story" | "Special"; groups: QuestGroup[] };

/** Group the current page only; ordering and pagination stay with the lookup model. */
function resultCollections(groups: QuestGroup[]) {
  const collections: ResultCollection[] = [];
  for (const group of groups) {
    const { quest } = group;
    const key = quest.section === "Story" ? `Story:${quest.actIndex}` : `Special:${quest.collection}`;
    const previous = collections.at(-1);
    if (previous?.key === key) previous.groups.push(group);
    else collections.push({ key, title: quest.section === "Story" ? quest.actIndex > 0 ? `Act ${quest.actIndex}` : "Story quests" : quest.collection || "Special quests", section: quest.section, groups: [group] });
  }
  return collections;
}

function collectionArtwork(collection: ResultCollection) {
  const quests = collection.groups.map(group => findQuest(group.quest.id))
    .filter((quest): quest is QuestSummary => quest !== undefined);
  if (quests.length !== collection.groups.length || quests.some(quest => quest.section !== collection.section)) return null;
  if (collection.section === "Story") {
    if (quests.some((quest, index) => quest.actIndex !== collection.groups[index].quest.actIndex)) return null;
    const parents = [...new Set(quests.flatMap(quest => quest.hierarchy.map(parent => parent.actId)))];
    return parents.length === 1 ? getGroupMenuArtwork(quests, { kind: "act", id: parents[0] }) : null;
  }
  const art = getGroupMenuArtwork(quests);
  return art?.role === "act" ? art : null;
}

function CollectionHeading({ collection }: { collection: ResultCollection }) {
  const art = collectionArtwork(collection);
  return <div className={styles.collectionHeading} data-has-art={art ? true : undefined}>
    {art && <span className={styles.collectionArtwork} data-quest-opponent-group-art data-art-owner={art.ownerId} data-art-role={art.role} aria-hidden="true">
      <Image src={art.url} alt="" width={art.width} height={art.height} sizes="140px" />
    </span>}
    {collection.section === "Story" ? <BookOpen size={15} aria-hidden="true" /> : <Compass size={15} aria-hidden="true" />}
    <h2>{collection.title}</h2><span>{collection.section}</span><i aria-hidden="true" />
  </div>;
}

function MatchInfo({ match }: { match: QuestOpponentMatch }) {
  return <span className={styles.matchInfo}>
    <span className={styles.rarity}>{match.rarity}★</span>
    {match.boss && <span className={styles.boss}><Skull size={11} aria-hidden="true" />Boss</span>}
    {match.kind === "region" && <span className={styles.region}>Encounter region</span>}
  </span>;
}

function QuestHeading({ quest }: { quest: QuestOpponentMatch["quest"] }) {
  const context = [quest.section === "Story" && quest.chapterIndex > 0 ? `Chapter ${quest.chapterIndex}` : "", quest.difficulty].filter(Boolean).join(" · ");
  return <div className={styles.questHeading}>
    {quest.section === "Story" ? <span className={styles.number}>{quest.number}</span> : <span className={styles.specialMarker}><Compass size={20} aria-hidden="true" /></span>}
    <div><h3>{quest.name}</h3>{context && <p>{context}</p>}</div>
  </div>;
}

export function QuestOpponentResults({ gameId, matches, filters }: { gameId: string; matches: QuestOpponentMatch[]; filters: OpponentFilters }) {
  const view = opponentResults(matches, filters);
  const filtered = Boolean(filters.query || filters.rarity || filters.bossOnly);
  const base = `/quests/encounters?${new URLSearchParams({ gameId })}`;
  const url = (changes: Record<string, string>) => `/quests/encounters?${new URLSearchParams({ gameId, q: filters.query ?? "", category: filters.section ?? "", rarity: filters.rarity ?? "", role: filters.bossOnly ? "boss" : "", ...changes })}`;
  const questLabel = (quest: QuestOpponentMatch["quest"]) => quest.section === "Story" ? `${quest.number} ${quest.name}` : `${quest.collection}: ${quest.name}`;
  const collections = resultCollections(view.groups);
  const first = (view.page - 1) * 12 + 1;

  return <section className={styles.results} aria-label="Champion quest results">
    <div className={styles.searchWorkspace}>
      <form key={JSON.stringify([gameId, filters])} action="/quests/encounters" className={styles.searchForm}>
        <input type="hidden" name="gameId" value={gameId} />
        <input type="hidden" name="category" value={filters.section ?? ""} />
        <div className={styles.searchRow}>
          <label className={styles.query}><span>Search these encounters</span><span className={styles.queryField}><Search size={17} aria-hidden="true" /><input name="q" aria-label="Search matching quests" type="search" defaultValue={filters.query ?? ""} placeholder="Quest name, number or collection…" maxLength={180} /></span></label>
          <button type="submit" className={styles.searchButton}><Search size={16} aria-hidden="true" /><span>Search</span></button>
          <details className={styles.filters} open={filtered}>
            <summary aria-label="Filters"><SlidersHorizontal size={15} aria-hidden="true" /><span>Filters</span>{filtered && <span className={styles.activeDot} aria-label="Filters active" />}<ChevronDown size={13} aria-hidden="true" /></summary>
            <div className={styles.filterPanel}>
              <label>Champion rarity<select name="rarity" defaultValue={filters.rarity ?? ""}><option value="">All rarities</option>{[...new Set([...matches.map(match => match.rarity), ...(filters.rarity ? [Number(filters.rarity)] : [])])].sort((a, b) => a - b).map(rarity => <option key={rarity} value={rarity}>{rarity}★</option>)}</select></label>
              <label className={styles.checkbox}><input type="checkbox" name="role" value="boss" defaultChecked={filters.bossOnly} /><span>Bosses only<small>Final-boss encounters</small></span></label>
              <button type="submit" className={styles.applyButton}>Apply filters<ArrowRight size={14} aria-hidden="true" /></button>
            </div>
          </details>
        </div>
      </form>
      <nav aria-label="Quest result categories" className={styles.tabs}>{([["", "All quests"], ["Story", "Story"], ["Special", "Special"]] as const).map(([section, label]) => <Link key={section} href={url({ category: section })} aria-current={(filters.section ?? "") === section ? "page" : undefined}>{label}<span>{section ? view.counts[section] : view.counts.all}</span></Link>)}</nav>
    </div>

    <div className={styles.resultSummary}>
      <p className={styles.resultCount} role="status"><strong>{view.totalQuests}</strong> {view.totalQuests === 1 ? "quest" : "quests"}{view.totalMatches > view.totalQuests && ` · ${view.totalMatches} matches`}{filtered && <> · <Link href={url({ q: "", rarity: "", role: "" })}>Clear filters</Link></>}</p>
      {view.totalPages > 1 && <p className={styles.pageRange}>Showing {first}–{first + view.groups.length - 1} of {view.totalQuests}</p>}
    </div>

    <div className={styles.collections}>{collections.map(collection => <section key={collection.key} className={styles.collection} aria-label={collection.title}>
      <CollectionHeading collection={collection} />
      <div className={styles.grid}>{collection.groups.map(group => <article className={styles.resultCard} key={group.quest.id} data-quest-opponent-result>
        {group.matches.length === 1 ? <Link prefetch={false} className={styles.resultLink} href={group.matches[0].href} aria-label={`View ${questLabel(group.quest)} ${group.matches[0].kind === "region" ? "encounter region" : "encounter"}`}>
          <QuestHeading quest={group.quest} />
          <div className={styles.cardFooter}><MatchInfo match={group.matches[0]} /><span className={styles.mapAction}><MapPin size={13} aria-hidden="true" />Open map<ArrowRight size={14} aria-hidden="true" /></span></div>
        </Link> : <><div className={styles.multiHeading}><QuestHeading quest={group.quest} /></div><ul className={styles.matchList}>{group.matches.map((match, index) => <li key={match.key}><Link prefetch={false} href={match.href} aria-label={`View match ${index + 1} in ${questLabel(group.quest)}`}><span className={styles.matchNumber}>Match {index + 1}</span><MatchInfo match={match} /><span className={styles.matchAction}>Open map<ArrowRight size={14} aria-hidden="true" /></span></Link></li>)}</ul></>}
      </article>)}</div>
    </section>)}</div>

    {!view.totalQuests && <div className={styles.empty}><span className={styles.emptyIcon}><Search size={24} aria-hidden="true" /></span><h2>{matches.length ? "No quests match these filters" : "No mapped quest encounters found"}</h2><p>{matches.length ? "Try another rarity, include non-boss encounters or choose a different category." : "Choose another champion, or browse the quest explorer."}</p>{matches.length ? <Link href={base} data-clear-opponent-filters>Show all matches<ArrowRight size={15} aria-hidden="true" /></Link> : <Link href="/quests">Browse quests<ArrowRight size={15} aria-hidden="true" /></Link>}</div>}
    {view.totalPages > 1 && <nav className={styles.pagination} aria-label="Quest result pages">{view.page > 1 ? <Link href={url({ page: String(view.page - 1) })}>← Previous</Link> : <span />}<span>Page <strong>{view.page}</strong> of {view.totalPages}</span>{view.page < view.totalPages ? <Link href={url({ page: String(view.page + 1) })}>Next<ArrowRight size={14} aria-hidden="true" /></Link> : <span />}</nav>}
    {view.hasRegions && <p className={styles.note}>Encounter regions highlight possible locations; the exact trigger tile can vary.</p>}
    <details className={styles.coverage}><summary>About these results<ChevronDown size={14} aria-hidden="true" /></summary><p>This lookup covers recorded Story and Special quest maps. Boss means a final-boss placement. Encounter regions remain approximate and use the map’s separate region layer. Unplaced previews, rewards and Tower floors are excluded. Availability in the game can differ.</p></details>
  </section>;
}
