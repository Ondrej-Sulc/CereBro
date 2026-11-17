import type {Coordinate,QuestBossFlags,QuestEncounter,QuestMap} from './index';

const flagKeys=['tileIsFinalBoss','tileShouldDisplayFinalBossIcon','bossIsFinalBoss','bossMetadataFinalBoss'] as const;

/** The native boss-icon flags are distinct from the map's completion/finish flag. */
export function questEncounterIsBoss(map:Pick<QuestMap,'nativeBossFlags'>,encounter:Pick<QuestEncounter,'id'|'final'>):boolean {
  const flags=map.nativeBossFlags?.[encounter.id];
  return flags?flagKeys.some(key=>flags[key]===true):encounter.final;
}

export type QuestBossDisplayObservation={
  questId:string;mapId:string;sourceHash:string;
  encounters:readonly (QuestBossFlags&{id:string;coordinate:Coordinate;bossKey:string})[];
};

/** Join only existing placements from the exact frozen map; never add a defender. */
export function applyQuestBossDisplay(map:QuestMap,observations:readonly QuestBossDisplayObservation[]):QuestMap {
  const matches=observations.filter(row=>row.questId===map.questId&&row.mapId===map.mapId&&row.sourceHash===map.sourceHash);
  if(!matches.length)return map;
  if(matches.length!==1)throw new Error('Ambiguous quest boss display source');
  const observed=matches[0].encounters;
  if(observed.length!==map.encounters.length)throw new Error('Quest boss display placement count mismatch');
  const placements=new Map(map.encounters.map(encounter=>[encounter.id,encounter]));
  const flags:Record<string,QuestBossFlags>={};
  for(const row of observed){
    const encounter=placements.get(row.id);
    if(!encounter||Object.hasOwn(flags,row.id)||row.bossKey!==encounter.bossKey||row.coordinate.length!==2||row.coordinate.some((value,index)=>value!==encounter.coordinate[index]))throw new Error('Quest boss display placement mismatch');
    if(flagKeys.some(key=>typeof row[key]!=='boolean'))throw new Error('Invalid native quest boss flags');
    const existing=map.nativeBossFlags?.[row.id];
    if(existing&&flagKeys.some(key=>existing[key]!==row[key]))throw new Error('Conflicting native quest boss flags');
    flags[row.id]={tileIsFinalBoss:row.tileIsFinalBoss,tileShouldDisplayFinalBossIcon:row.tileShouldDisplayFinalBossIcon,bossIsFinalBoss:row.bossIsFinalBoss,bossMetadataFinalBoss:row.bossMetadataFinalBoss};
  }
  return {...map,nativeBossFlags:flags};
}
