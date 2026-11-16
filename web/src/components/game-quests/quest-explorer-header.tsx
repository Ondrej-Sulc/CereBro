import Image from "next/image";
import type {QuestSummary} from "@cerebro/core/domain/game-quests";
import type {MenuArtwork} from "@cerebro/core/domain/game-quests/menu-art";
import {getGroupMenuArtwork} from "@cerebro/core/data/game-quests/menu-art";
import styles from "./quest-explorer-header.module.css";

// Editorial variety for the explorer, not a ranking or an availability assertion.
const featuredQuests=["a06_ch02_q01","me_crucible_ch01_q01","a08_ch04_q06","realm3"];
function explorerArtwork(quests:QuestSummary[],primary?:MenuArtwork|null) {
  const posters:(MenuArtwork&{section:string})[]=[];
  const add=(art:MenuArtwork|null|undefined,quest:QuestSummary)=>{
    if(art&&posters.length<4&&!posters.some(poster=>poster.url===art.url))posters.push({...art,section:quest.section??quest.category});
  };
  if(primary&&quests[0])add(primary,quests[0]);
  for(const id of featuredQuests){
    const quest=quests.find(q=>q.id===id);
    const parent=quest?.hierarchy[0];
    if(quest&&parent)add(getGroupMenuArtwork([quest],{kind:"act",id:parent.actId}),quest);
  }
  for(const kind of ["act","chapter"] as const)for(const quest of quests){
    if(posters.length===4)break;
    for(const parent of quest.hierarchy)add(getGroupMenuArtwork([quest],{kind,id:kind==="act"?parent.actId:parent.chapterId}),quest);
  }
  return posters;
}

export function QuestExplorerHeader({quests,primaryArtwork,totalCount,mappedCount}:{quests:QuestSummary[];primaryArtwork?:MenuArtwork|null;totalCount:number;mappedCount:number}) {
  const posters=explorerArtwork(quests,primaryArtwork);
  return <header className={styles.header} data-quest-explorer-header data-art-count={posters.length}>
    <div className={styles.copy}>
      <p className={styles.eyebrow}>Explore the Battlerealm</p>
      <h1>Quest explorer</h1>
      <p className={styles.lede}>Explore Story and Special quests, their maps, bosses and rewards.</p>
      <div className={styles.stats}><span><strong>{totalCount}</strong> permanent {totalCount===1?"quest":"quests"}</span><span><strong>{mappedCount}</strong> with maps</span></div>
    </div>
    {posters.length>0&&<div className={styles.collage} aria-hidden="true">
      {posters.map((art,index)=><div key={art.url} className={styles.poster} data-poster-section={art.section}>
        <Image src={art.url} alt="" width={art.width} height={art.height} sizes="(max-width:600px) 72px, 116px" priority={index===0}/>
      </div>)}
    </div>}
  </header>;
}
