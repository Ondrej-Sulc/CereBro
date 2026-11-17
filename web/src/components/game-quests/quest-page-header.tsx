import Image from "next/image";
import Link from "next/link";
import { Fragment } from "react";
import { ArrowLeft, ChevronRight, Flame, Skull, UserRound } from "lucide-react";
import { getQuestMenuArtwork,getGroupMenuArtwork } from "@cerebro/core/data/game-quests/menu-art";
import { getQuestArtwork } from "@cerebro/core/data/game-quests/artwork";
import type {MenuArtwork} from "@cerebro/core/domain/game-quests/menu-art";
import type {QuestPortrait} from "@/lib/game-quests/presentation";
import { hierarchyLabel, type QuestMap, type QuestSummary } from "@cerebro/core/domain/game-quests";
import { questDifficulty } from "@cerebro/core/domain/game-quests/browse";
import { questCatalog } from "@cerebro/core/data/game-quests";
import { permanentData,getBossPreview } from "@cerebro/core/data/game-quests/permanent";
import styles from "./quest-page-header.module.css";
import { questEncounterPortrait } from "./quest-portrait";

export function QuestPageHeader({ quest: q,portraits={},map }: { quest: QuestSummary;portraits?:Record<string,QuestPortrait>;map?:QuestMap }) {
  const special = q.section === "Special";
  const showChapter = !special || new Set(questCatalog.filter(other => other.containerSetId === q.containerSetId).flatMap(other => other.hierarchy.map(h => h.chapterId))).size > 1;
  const collection = permanentData.specialCollections[q.containerSetName] ?? "Special quests";
  const difficulty = questDifficulty(q);
  const location = showChapter ? [...new Set(q.hierarchy.map(h => h.chapterName).filter(name => name && name !== "-" && !/^\d+ Stars$/i.test(name)))].join(" · ") : "";
  const collectionParams = { category: "Special", collection: q.containerSetName };
  const artworks:MenuArtwork[]=[];
  const addArt=(art:MenuArtwork|null)=>{if(art&&!artworks.some(existing=>existing.url===art.url))artworks.push(art);};
  for(const parent of q.hierarchy){
    addArt(getGroupMenuArtwork([q],{kind:"act",id:parent.actId}));
    if(showChapter)addArt(getGroupMenuArtwork([q],{kind:"chapter",id:parent.chapterId}));
  }
  if(!artworks.length)addArt(getQuestMenuArtwork(q));
  const background=getQuestArtwork(q.id);
  const terrain=background?.sourceHash===q.sourceHash?background:null;
  const preview=getBossPreview(q);
  // A source-matched map can establish a final boss missing from the menu preview.
  const mapMatches=preview&&map?.questId===q.id&&map.mapId===q.mapId&&map.sourceHash===q.mapSourceHash;
  const bosses=preview?.bosses.length?preview.bosses:mapMatches?map!.encounters.filter(encounter=>encounter.final):[];
  const bossLabel=bosses.length===1?"Boss":"Bosses";
  return <div className={styles.wrapper}>
    <nav className={styles.breadcrumb} aria-label="Quest location">
      <Link href="/quests"><ArrowLeft size={14} aria-hidden="true"/>Quest explorer</Link>
      {special && <><ChevronRight size={12} aria-hidden="true"/><Link href={`/quests?${new URLSearchParams(collectionParams)}`}>{collection}</Link></>}
      {q.hierarchy.map(h => <Fragment key={`${h.actId}:${h.chapterId}`}>
        {!special && <><ChevronRight size={12} aria-hidden="true"/><Link href={`/quests?${new URLSearchParams({ category: "Story", act: h.actId })}`}>Act {q.actIndex}</Link></>}
        {showChapter && <><ChevronRight size={12} aria-hidden="true"/><Link href={`/quests?${new URLSearchParams(special ? { ...collectionParams, chapter: h.chapterId } : { category: "Story", act: h.actId, chapter: h.chapterId })}`}>Chapter {q.chapterIndex}</Link></>}
      </Fragment>)}
    </nav>
    <header className={styles.header} data-has-art={artworks.length>0} data-menu-art-role={artworks.map(art=>art.role).join(' ')||"none"}>
      <div className={styles.scene} aria-hidden="true">{terrain&&<Image src={terrain.url} alt="" width={terrain.width} height={terrain.height} sizes="(max-width:600px) 400px, 760px"/>}</div>
      <div className={styles.copy}>
        <div className={styles.meta}><span>{special ? "Special quest" : q.section ?? q.category}</span>{difficulty && difficulty.toLocaleLowerCase() !== q.name.toLocaleLowerCase() && <span className={styles.difficulty}>{difficulty}</span>}</div>
        <div className={styles.heading}><span className={styles.number} data-quest-number>{hierarchyLabel(q)}</span><div><h1>{q.name}</h1>{location && <p className={styles.location}>{location}</p>}</div></div>
        {bosses.length>0?<div className={styles.bosses}><p>{bossLabel}</p><ul aria-label={bossLabel} role="list">{bosses.map((boss,index)=>{
          const portrait=questEncounterPortrait(boss,portraits);
          const native=permanentData.nativePortraits[boss.gameId];
          const src=portrait?.imageUrl??(!boss.champion&&native?.character===boss.gameId&&native.sourceBcgSha256===permanentData.bcgSha256?native.url:null);
          const name=portrait?.name??boss.champion?.name??boss.name;
          const identity=<><span className={styles.bossFrame}><span className={styles.bossPortrait} style={{borderColor:portrait?.color??"#829cb0"}}>{src?<Image src={src} alt="" width={44} height={44} sizes="44px"/>:<UserRound size={22} aria-hidden="true"/>}</span><span className={styles.bossMarker} aria-hidden="true"><Flame className={styles.flame}/><Skull className={styles.skull}/></span></span><span className={styles.bossName}><strong>{name}</strong><small>{boss.rarity}★</small></span></>;
          const href=portrait?.href??(boss.champion?`/champions/${encodeURIComponent(boss.champion.slug)}`:null);
          return <li key={`${boss.tierId}:${index}`} data-quest-header-boss={boss.gameId}>{href?<Link prefetch={false} href={href} className={styles.bossIdentity}>{identity}</Link>:<div className={styles.bossIdentity}>{identity}</div>}</li>;
        })}</ul></div>:<p className={styles.noBoss}>Boss information unavailable</p>}
      </div>
      {artworks.length>0&&<div className={styles.artStage} aria-hidden="true" data-category-art-count={artworks.length}>{artworks.map((art,index)=><div key={art.url} className={styles.art} data-quest-category-art={art.role}><Image src={art.url} alt="" width={art.width} height={art.height} sizes="(max-width:600px) 80px, 112px" priority={index===0}/></div>)}</div>}
    </header>
  </div>;
}
