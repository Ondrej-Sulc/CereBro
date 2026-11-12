import Link from "next/link";
import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { opponentResults, type OpponentFilters, type QuestOpponentMatch } from "@cerebro/core/domain/game-quests/opponent-lookup";
import styles from "./quest-opponent-lookup.module.css";

export function QuestOpponentResults({gameId,matches,filters}:{gameId:string;matches:QuestOpponentMatch[];filters:OpponentFilters}){
  const view=opponentResults(matches,filters);
  const filtered=Boolean(filters.query||filters.rarity||filters.bossOnly);
  const base=`/quests/encounters?${new URLSearchParams({gameId})}`;
  const url=(changes:Record<string,string>)=>`/quests/encounters?${new URLSearchParams({gameId,q:filters.query??"",category:filters.section??"",rarity:filters.rarity??"",role:filters.bossOnly?"boss":"",...changes})}`;
  const matchInfo=(match:QuestOpponentMatch)=><span className={styles.matchInfo}><span>{match.rarity}★</span>{match.boss&&<span className={styles.boss}>Boss</span>}{match.kind==="region"&&<span className={styles.region}>Encounter region</span>}</span>;
  const questLabel=(q:QuestOpponentMatch["quest"])=>q.section==="Story"?`${q.number} ${q.name}`:`${q.collection}: ${q.name}`;
  const heading=(q:QuestOpponentMatch["quest"])=> <div className={styles.questHeading}>{q.section==="Story"&&<span className={styles.number}>{q.number}</span>}<div><h2>{q.name}</h2><p>{q.section==="Special"?q.collection:"Story"}{q.difficulty&&` · ${q.difficulty}`}</p></div></div>;
  return <section className={styles.results} aria-label="Champion quest results">
    <div className={styles.resultTools}><nav aria-label="Quest result categories" className={styles.tabs}>{([['','All quests'],['Story','Story'],['Special','Special']] as const).map(([section,label])=><Link key={section} href={url({category:section})} aria-current={(filters.section??"")===section?"page":undefined}>{label}<span>{section?view.counts[section]:view.counts.all}</span></Link>)}</nav>
      <details className={styles.filters} open={filtered}><summary aria-label="Filters"><SlidersHorizontal size={15} aria-hidden="true"/><span className={styles.filterLabel}>Filters</span>{filtered&&<span className={styles.activeDot} aria-label="Filters active"/>}</summary><form key={JSON.stringify([gameId,filters])} action="/quests/encounters">
        <input type="hidden" name="gameId" value={gameId}/><input type="hidden" name="category" value={filters.section??""}/>
        <label className={styles.query}>Quest or collection<input name="q" aria-label="Search matching quests" type="search" defaultValue={filters.query??""} placeholder="Quest name, number or collection" maxLength={180}/></label>
        <label>Rarity<select name="rarity" defaultValue={filters.rarity??""}><option value="">All rarities</option>{[...new Set([...matches.map(m=>m.rarity),...(filters.rarity?[Number(filters.rarity)]:[])])].sort((a,b)=>a-b).map(r=><option key={r} value={r}>{r}★</option>)}</select></label>
        <label className={styles.checkbox}><input type="checkbox" name="role" value="boss" defaultChecked={filters.bossOnly}/>Bosses only</label><button type="submit">Apply</button>
      </form></details>
    </div>
    <p className={styles.resultCount} role="status">{view.totalQuests} {view.totalQuests===1?"quest":"quests"}{view.totalMatches>view.totalQuests&&` · ${view.totalMatches} matches`}{filtered&&<> · <Link href={url({q:"",rarity:"",role:""})}>Clear filters</Link></>}</p>
    <div className={styles.grid}>{view.groups.map(group=><article className={styles.resultCard} key={group.quest.id} data-quest-opponent-result>
      {group.matches.length===1?<Link prefetch={false} className={styles.resultLink} href={group.matches[0].href} aria-label={`View ${questLabel(group.quest)} ${group.matches[0].kind==="region"?"encounter region":"encounter"}`}>
        {heading(group.quest)}<div className={styles.cardFooter}>{matchInfo(group.matches[0])}<span className={styles.action}>View {group.matches[0].kind==="region"?"region":"encounter"}<ArrowRight size={16} aria-hidden="true"/></span></div>
      </Link>:<><div className={styles.multiHeading}>{heading(group.quest)}</div><ul className={styles.matchList}>{group.matches.map((match,i)=><li key={match.key}><Link prefetch={false} href={match.href} aria-label={`View match ${i+1} in ${questLabel(group.quest)}`}><span className={styles.matchNumber}>Match {i+1}</span>{matchInfo(match)}<ArrowRight size={16} aria-hidden="true"/></Link></li>)}</ul></>}
    </article>)}</div>
    {!view.totalQuests&&<div className={styles.empty}><h2>{matches.length?"No quests match these filters":"No mapped quest encounters found"}</h2><p>{matches.length?"Try another rarity, include non-boss encounters or choose a different category.":"Choose another champion, or browse the quest explorer."}</p>{matches.length?<Link href={base} data-clear-opponent-filters>Show all matches →</Link>:<Link href="/quests">Browse quests →</Link>}</div>}
    {view.totalPages>1&&<nav className={styles.pagination} aria-label="Quest result pages">{view.page>1?<Link href={url({page:String(view.page-1)})}>← Previous</Link>:<span/>}<span>Page {view.page} of {view.totalPages}</span>{view.page<view.totalPages?<Link href={url({page:String(view.page+1)})}>Next →</Link>:<span/>}</nav>}
    {view.hasRegions&&<p className={styles.note}>Encounter regions highlight possible locations; the exact trigger tile can vary.</p>}
    <details className={styles.coverage}><summary>About these results</summary><p>This lookup covers recorded Story and Special quest maps. Boss means a final-boss placement. Encounter regions remain approximate and use the map’s separate region layer. Unplaced previews, rewards and Tower floors are excluded. Availability in the game can differ.</p></details>
  </section>;
}
