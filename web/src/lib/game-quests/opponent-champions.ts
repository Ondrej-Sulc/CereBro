import { prisma } from "@/lib/prisma";
import { getFromCache } from "@/lib/cache";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { validOpponentGameId } from "@cerebro/core/data/game-quests/opponent-lookup";

/** Only public navigation and portrait fields; no kits, stats or roster data. */
export async function getQuestOpponentChampions() {
  return getFromCache("quest-opponent-champions-v1",3600,async()=>{
    const rows=await prisma.champion.findMany({where:{isPlayable:true,gameId:{not:null}},select:{gameId:true,name:true,slug:true,images:true,class:true},orderBy:{name:"asc"}});
    return rows.flatMap(row=>{
      if(!row.gameId||!validOpponentGameId(row.gameId))return [];
      const image=getChampionImageUrl(row.images,"128");
      return [{id:row.gameId,name:row.name,class:row.class,className:row.class.charAt(0)+row.class.slice(1).toLowerCase(),portraitUrl:/^https?:\/\//.test(image)?image:null,color:getChampionClassColors(row.class).color,href:row.slug?`/champions/${encodeURIComponent(row.slug)}`:null}];
    });
  });
}
