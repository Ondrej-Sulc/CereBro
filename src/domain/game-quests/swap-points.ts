import {z} from 'zod';
import {coordinateKey,type Coordinate,type QuestMap} from './index';
import type {QuestFeatureSource} from './map-features';

export type QuestSwapOption={choiceId:'teamswap'|'swapteamselect'|'swapteamselect_alt1';swapCount:number;minSwaps:number;nativeDefaultsApplied:{field:'swapCount'|'minSwaps';value:number;basis:'native-constructor'}[]};
export type QuestSwapPoint={id:string;coordinate:Coordinate;pathIndices:number[];options:QuestSwapOption[];source:QuestFeatureSource};
export type QuestSwapLayer={questId:string;mapId:string;sourceHash:string;publicMapSha256:string;coverage:'captured'|'partial'|'uncaptured';points:QuestSwapPoint[];unresolvedChoiceCoordinates:Coordinate[];definitionSources:Record<string,string>};
const hash=z.string().regex(/^[a-f0-9]{64}$/),coordinate=z.tuple([z.number().int(),z.number().int()]);
const source=z.object({file:z.string().min(1).refine(value=>!/^(?:[a-z]:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/i.test(value)),sha256:hash,pointer:z.string().startsWith('/'),capturedAt:z.string().datetime({offset:true})}).strict();
const option=z.object({choiceId:z.enum(['teamswap','swapteamselect','swapteamselect_alt1']),swapCount:z.number().int().min(0).max(100),minSwaps:z.number().int().min(0).max(100),nativeDefaultsApplied:z.array(z.object({field:z.enum(['swapCount','minSwaps']),value:z.number().int(),basis:z.literal('native-constructor')}).strict())}).strict();
export const questSwapLayerSchema=z.object({questId:z.string().min(1),mapId:z.string().min(1),sourceHash:hash,publicMapSha256:hash,coverage:z.enum(['captured','partial','uncaptured']),points:z.array(z.object({id:z.string().min(1),coordinate,pathIndices:z.array(z.number().int().nonnegative()),options:z.array(option).min(1),source}).strict()),unresolvedChoiceCoordinates:z.array(coordinate),definitionSources:z.record(z.string(),hash)}).strict();

/** Public preview locations only. Never infer team eligibility, use or progress. */
export function applyQuestSwapPoints(map:QuestMap,layer:QuestSwapLayer):QuestMap{
 questSwapLayerSchema.parse(layer);
 if(layer.questId!==map.questId||layer.mapId!==map.mapId||layer.sourceHash!==map.sourceHash)throw new Error('Swap source identity mismatch');
 const tiles=new Set(map.tiles.map(tile=>coordinateKey(tile.coordinate))),positions=new Set<string>(),ids=new Set<string>();
 for(const point of layer.points){
  const key=coordinateKey(point.coordinate);
  if(!tiles.has(key)||positions.has(key)||ids.has(point.id)||layer.definitionSources[point.source.file]!==point.source.sha256)throw new Error('Invalid swap placement/source');
  positions.add(key);ids.add(point.id);
  const paths=map.paths.filter(path=>path.coordinates.some(c=>coordinateKey(c)===key)).map(path=>path.index);
  if(JSON.stringify(paths)!==JSON.stringify(point.pathIndices))throw new Error('Swap route mismatch');
  for(const choice of point.options){
   if(choice.swapCount>0&&choice.minSwaps>choice.swapCount)throw new Error('Invalid swap limits');
   const defaults=new Set<string>();
   for(const applied of choice.nativeDefaultsApplied){
    const expected=applied.field==='swapCount'?1:0;
    if(defaults.has(applied.field)||applied.value!==expected||choice[applied.field]!==expected)throw new Error('Invalid native swap default provenance');
    defaults.add(applied.field);
   }
  }
 }
 const unresolved=new Set<string>();
 for(const c of layer.unresolvedChoiceCoordinates){const key=coordinateKey(c);if(!tiles.has(key)||positions.has(key)||unresolved.has(key))throw new Error('Invalid unresolved choice location');unresolved.add(key);}
 if(layer.coverage==='captured'&&unresolved.size||layer.coverage==='uncaptured'&&layer.points.length||layer.coverage==='partial'&&(!unresolved.size||!layer.points.length))throw new Error('Invalid swap coverage');
 return {...map,swapPoints:layer};
}
