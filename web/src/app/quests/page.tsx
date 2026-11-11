import Image from "next/image";
import { TowerDiscovery } from "@/components/game-towers/tower-discovery";
import Link from "next/link";
import type { Metadata } from "next";
import { questCatalog, searchQuests } from "@cerebro/core/data/game-quests";
import { permanentData } from "@cerebro/core/data/game-quests/permanent";
import { getGroupMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import { storyActs, storyChapters } from "@cerebro/core/domain/game-quests/browse";
import { loadBossPortraits } from "@/lib/game-quests/champions";
import { QuestArtworkCard } from "@/components/game-quests/quest-artwork-card";
import { QuestChapterPanorama } from "@/components/game-quests/quest-chapter-panorama";
import { QuestBossCard } from "@/components/game-quests/quest-boss-card";
import { QuestProvenance } from "@/components/game-quests/quest-provenance";
import { getParentRewardRecord,hasRecordedRewards } from "@cerebro/core/data/game-quests/rewards";
import { QuestParentRewards } from "@/components/game-quests/quest-parent-rewards";
import styles from "@/components/game-quests/quest-catalog.module.css";

export const metadata: Metadata = { title:"Quest explorer | CereBro", description:"Explore permanent Story and Special quests, bosses and recorded maps." };
type Params=Record<string,string|string[]|undefined>;
const one=(p:Params,k:string)=>typeof p[k]==="string" ? p[k] as string : "";
export default async function QuestExplorerPage({searchParams}:{searchParams:Promise<Params>}) {
  const p=await searchParams;
  const query=one(p,"q"),coverage=one(p,"coverage"),act=one(p,"act"),chapter=one(p,"chapter"),collection=one(p,"collection");
  const category=collection ? "Special" : act ? "Story" : one(p,"category");
  const selectedAct=storyActs(questCatalog).find(a=>a.id===act);
  const collectionQuests=questCatalog.filter(q=>q.containerSetName===collection);
  const results=searchQuests({query,category,coverage,act,chapter}).filter(q=>!collection||q.containerSetName===collection);
  const url=(changes:Record<string,string>)=>`/quests?${new URLSearchParams({q:query,category,coverage,act,chapter,collection,...changes})}`;
  const parentQuests=collection ? collectionQuests : selectedAct?.quests ?? questCatalog;
  const parentAct=act||collectionQuests[0]?.hierarchy[0]?.actId||"";
  const chapters=storyChapters(parentQuests,parentAct);
  const selectedChapter=chapters.find(c=>c.id===chapter);
  const overview=!query&&!coverage&&!chapter;
  const singleSpecial=Boolean(collection)&&chapters.length===1;
  const totalPages=Math.max(1,Math.ceil(results.length/18));
  const page=Math.min(totalPages,Math.max(1,Number.parseInt(one(p,"page"),10)||1));
  const pageQuests=results.slice((page-1)*18,page*18);
  const portraits=(query||coverage||chapter||singleSpecial||(collection&&!chapters.length)) ? await loadBossPortraits(pageQuests) : {};
  const art=getGroupMenuArtwork(selectedChapter?.quests ?? parentQuests,collection&&parentAct?{kind:"act",id:parentAct}:chapter?{kind:"chapter",id:chapter}:parentAct?{kind:"act",id:parentAct}:undefined);
  const special=Object.entries(permanentData.specialCollections).map(([id,label])=>({id,label,quests:questCatalog.filter(q=>q.containerSetName===id)}));
  const parentHasRewards=hasRecordedRewards(getParentRewardRecord(parentQuests,"act",parentAct));
  const showChapters=overview&&Boolean(parentAct)&&chapters.length>0&&!singleSpecial;
  return <div className={styles.catalog}>
    <header className={styles.hero} data-menu-art={Boolean(art)}>{art&&<><Image src={art.url} alt="" fill sizes="100vw" priority className={styles.heroImage}/><div className={styles.heroPoster}><Image src={art.url} alt="" fill sizes="(max-width:600px) 150px, 240px" priority/></div></>}<div className={styles.heroShade}/><div className={styles.heroCopy}><p className={styles.eyebrow}>Explore the Battlerealm</p><h1>Quest explorer</h1><p>Discover the Story. Face the legends.<br/>Read every recorded route and defender.</p></div><div className={styles.heroStat}><strong>{questCatalog.filter(q=>q.coverage==="full-map").length}</strong>mapped quests<span>/</span><strong>{questCatalog.length}</strong>permanent variants</div></header>
    <nav aria-label="Quest categories" className={styles.categories}>{["","Story","Special"].map(c=><Link key={c} href={url({category:c,act:"",chapter:"",collection:"",page:""})} aria-current={category===c?"page":undefined}>{c||"All quests"}</Link>)}<Link href="/quests/towers">Towers</Link></nav>
    <form action="/quests" className={styles.search}><input type="hidden" name="category" value={category}/><input type="hidden" name="act" value={act}/><input type="hidden" name="chapter" value={chapter}/><input type="hidden" name="collection" value={collection}/><label>Find a quest<input type="search" name="q" aria-label="Search quests" defaultValue={query} placeholder="Search by quest or chapter"/></label><label>Map coverage<select name="coverage" defaultValue={coverage}><option value="">All quests</option><option value="full-map">Layout captured</option><option value="summary-only">Summary only</option></select></label><button>Search</button></form>
    {(act||collection||chapter)&&<nav aria-label="Quest location" className={styles.breadcrumb}><Link href={url({act:"",chapter:"",collection:""})}>{collection?"Special quests":"Story"}</Link><span>/</span><Link href={url({chapter:""})}>{selectedAct?.label ?? permanentData.specialCollections[collection]}</Link>{selectedChapter&&!singleSpecial&&<><span>/</span><span>{selectedChapter.label}</span></>}</nav>}
    {showChapters ? <><div className={styles.sectionHeader}><h2>{selectedAct?.label ?? permanentData.specialCollections[collection]}</h2><span>{chapters.length} {chapters.length === 1 ? "chapter" : "chapters"}</span></div><QuestChapterPanorama chapters={chapters} href={id=>url({chapter:id,page:""})}/></> : overview&&!collection&&(!category||category==="Story"||category==="Special") ? <>
      {category!=="Special"&&<><div className={styles.sectionHeader}><h2>The Story</h2><span>Choose an act</span></div><div className={styles.artGrid}>{storyActs(questCatalog).map(a=><QuestArtworkCard key={a.id} scope={{kind:"act",id:a.id}} quests={a.quests} label={a.label} eyebrow={`Story act ${a.index}`} href={url({category:"Story",act:a.id,chapter:"",collection:"",page:""})}/>)}</div></>}
      {category!=="Story"&&<section className={styles.other}><div className={styles.sectionHeader}><h2>Special quests</h2><span>{special.length} recorded collections</span></div><div className={styles.artGrid}>{special.map(c=><QuestArtworkCard key={c.id} quests={c.quests} label={c.label} eyebrow="Permanent Special quest" href={url({category:"Special",collection:c.id,act:"",chapter:"",page:""})}/>)}</div><p className={styles.scopeNote}>Explore the permanent collections recorded from normal quest selection. Availability and requirements in the game may differ.</p></section>}
      {!category&&<TowerDiscovery/>}
    </> : <><div className={styles.sectionHeader}><h2>{(!singleSpecial?selectedChapter?.label:undefined) ?? permanentData.specialCollections[collection] ?? (category==="Special"?"Special quests":"Quest selection")}</h2><span>{results.length} quest {results.length===1?"variant":"variants"}</span></div><div className={styles.bossGrid}>{pageQuests.map(q=><QuestBossCard key={q.id} quest={q} portraits={portraits}/>)}</div>{!results.length&&<p className={styles.empty}>No permanent quests match this view. Monthly events and Daily quests are outside this explorer.</p>}<nav aria-label="Quest result pages" className={styles.pagination}>{page>1?<Link href={url({page:String(page-1)})}>Previous</Link>:<span/>}<span>Page {page} of {totalPages}</span>{page<totalPages?<Link href={url({page:String(page+1)})}>Next</Link>:<span/>}</nav></>}
    {(query||coverage||act||chapter||collection)&&<Link href="/quests" className={styles.reset}>Clear filters</Link>}
    {(selectedAct||collection)&&parentAct&&!query&&!coverage&&<>{selectedChapter?(parentHasRewards&&<Link className="mt-6 inline-block text-sm text-sky-300" href={`${url({chapter:""})}#act-rewards`}>View Act rewards →</Link>):<QuestParentRewards quests={parentQuests} kind="act" id={parentAct}/>} {(selectedChapter||singleSpecial)&&<QuestParentRewards quests={selectedChapter?.quests??chapters[0].quests} kind="chapter" id={selectedChapter?.id??chapters[0].id}/>}</>}
    <QuestProvenance/>
  </div>;
}
