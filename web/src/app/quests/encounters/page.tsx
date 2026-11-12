import Link from "next/link";
import { loadQuestOpponentMatches, validOpponentGameId } from "@cerebro/core/data/game-quests/opponent-lookup";
import { permanentData } from "@cerebro/core/data/game-quests/permanent";
import { getQuestOpponentChampions } from "@/lib/game-quests/opponent-champions";
import { QuestOpponentResults } from "@/components/game-quests/quest-opponent-results";
import { QuestOpponentSearch } from "@/components/game-quests/quest-opponent-search";
import { QuestPortrait } from "@/components/game-quests/quest-portrait";
import styles from "@/components/game-quests/quest-opponent-lookup.module.css";

export const metadata = { title: "Find champion quest encounters | CereBro" };
type Params=Record<string,string|string[]|undefined>;
const one=(params:Params,key:string)=>typeof params[key]==="string"?params[key]:"";

export default async function ChampionEncountersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params=await searchParams;
  const requested=one(params,"gameId"),gameId=validOpponentGameId(requested)?requested:"";
  const [champions,matches]=await Promise.all([getQuestOpponentChampions(),loadQuestOpponentMatches(gameId)]);
  const champion=champions.find(c=>c.id===gameId);
  const art=permanentData.nativePortraits[gameId];
  const nativeArt=art?.character===gameId&&art.sourceBcgSha256===permanentData.bcgSha256?art.url:null;
  const name=champion?.name??matches[0]?.opponentName;
  const portrait=name?{name,href:champion?.href??null,imageUrl:champion?.portraitUrl??matches.find(m=>m.portraitUrl)?.portraitUrl??nativeArt,className:champion?.className??"NPC / legacy defender",color:champion?.color??"#7891aa"}:undefined;
  const category=one(params,"category"),rarity=one(params,"rarity");
  const filters={query:one(params,"q").slice(0,180),section:category==="Story"||category==="Special"?category:"",rarity:/^(?:[1-9]|1[0-2])$/.test(rarity)?rarity:"",bossOnly:one(params,"role")==="boss",page:one(params,"page")};
  return <div className={styles.page}>
    <Link href="/quests" className={styles.back}>← Quest explorer</Link>
    <header className={styles.hero}>{portrait&&<QuestPortrait portrait={portrait} large/>}<div><p className={styles.eyebrow}>Quest encounters</p><h1>{champion?.href?<Link href={champion.href}>{name}<span aria-hidden="true"> ↗</span></Link>:name??"Find a quest opponent"}</h1>{champion&&<p className={styles.heroMeta}>{champion.className}</p>}</div></header>
    <QuestOpponentSearch gameId={gameId} champions={champions.map(c=>({id:c.id,name:c.name,class:c.class,portraitUrl:c.portraitUrl}))}/>
    {gameId?<QuestOpponentResults gameId={gameId} matches={matches} filters={filters}/>:<p className={styles.note}>Choose a champion to find their quest encounters and open them on the map.</p>}
  </div>;
}
