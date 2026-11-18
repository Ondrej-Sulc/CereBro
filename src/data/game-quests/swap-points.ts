import {z} from 'zod';
import raw from './swap-points.json';
import manifest from './manifest.json';
import {permanentData} from './permanent';
import {applyQuestSwapPoints,questSwapLayerSchema} from '../../domain/game-quests/swap-points';
import type {QuestMap} from '../../domain/game-quests';
const hash=z.string().regex(/^[a-f0-9]{64}$/);
const data=z.object({version:z.literal(1),maps:z.record(z.string(),questSwapLayerSchema),sourceIndexSha256:hash,projectionSha256:hash,exporterSha256:hash,nativeSemanticsSources:z.record(z.string(),hash),counts:z.object({maps:z.number().int().nonnegative(),swapMaps:z.number().int().nonnegative(),swapPoints:z.number().int().nonnegative(),unverifiedMaps:z.number().int().nonnegative(),unresolvedChoiceNodes:z.number().int().nonnegative()}).strict()}).strict().parse(raw);
const layers=Object.values(data.maps);
if(data.counts.maps!==layers.length||data.counts.swapMaps!==layers.filter(layer=>layer.points.length).length||data.counts.swapPoints!==layers.reduce((sum,layer)=>sum+layer.points.length,0)||data.counts.unverifiedMaps!==layers.filter(layer=>layer.coverage!=='captured').length||data.counts.unresolvedChoiceNodes!==layers.reduce((sum,layer)=>sum+layer.unresolvedChoiceCoordinates.length,0))throw new Error('Swap data counts mismatch');

export function withQuestSwapPoints(map:QuestMap):QuestMap{
 const layer=data.maps[map.questId];
 if(!layer)return map;
 const publishedHash=permanentData.maps[map.questId]?.publicMapSha256??(manifest.outputs as Record<string,string>)[`maps/${map.questId}.json`];
 if(!publishedHash||layer.publicMapSha256!==publishedHash)throw new Error('Swap public map hash mismatch');
 return applyQuestSwapPoints(map,layer);
}
