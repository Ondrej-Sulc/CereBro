import { beforeEach,expect,it,vi } from "vitest";
import { clearCache } from "../../../web/src/lib/cache";
import { getQuestOpponentChampions } from "../../../web/src/lib/game-quests/opponent-champions";
const {query}=vi.hoisted(()=>({query:vi.fn()}));
vi.mock("@/lib/prisma",()=>({prisma:{champion:{findMany:query}}}));
beforeEach(()=>{clearCache("quest-opponent-champions-v1");query.mockReset();});

it("loads a cached public name/portrait navigation index without kits, stats or roster fields",async()=>{
  query.mockResolvedValue([{gameId:"absorbingman",name:"Absorbing Man",slug:"absorbing-man",images:{p_128:"https://example.test/abs.png"},class:"MYSTIC"},{gameId:"",name:"Empty",slug:null,images:{},class:"MYSTIC"}]);
  const options=await getQuestOpponentChampions();
  expect(query).toHaveBeenCalledWith({where:{isPlayable:true,gameId:{not:null}},select:{gameId:true,name:true,slug:true,images:true,class:true},orderBy:{name:"asc"}});
  expect(options).toHaveLength(1);expect(options[0]).toMatchObject({id:"absorbingman",name:"Absorbing Man",portraitUrl:"https://example.test/abs.png",href:"/champions/absorbing-man"});
  await getQuestOpponentChampions();expect(query).toHaveBeenCalledTimes(1);
  expect(Object.keys(options[0]).sort()).toEqual(["class","className","color","href","id","name","portraitUrl"]);
});
