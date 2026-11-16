import raw from './act10-modifiers.json';
import type {Coordinate,QuestApplication,QuestMap} from '../../domain/game-quests';

type Binding = Pick<QuestApplication,'effectId'|'amount'|'target'|'sourceCoordinate'|'sourceType'|'remainActive'|'linkedTargets'> & {tileCoordinate:Coordinate};
type Definition = {name:string;description:string;rawDescription:string;amount:number;definitionHash:string;iconKey:string|null};
type Projection = {capturedAt:string;componentBcgSha256:string;definitions:Record<string,Definition>;maps:Record<string,{mapId:string;sourceHash:string;applications:Record<string,Binding>}>};
const data=raw as unknown as Projection;
const equal=(left:unknown,right:unknown)=>JSON.stringify(left)===JSON.stringify(right);

/** Add the later native definition observation without rewriting the saved map. */
export function withAct10Modifiers(map:QuestMap):QuestMap {
  if(!Object.hasOwn(data.maps,map.questId))return map;
  const source=data.maps[map.questId];
  if(source.mapId!==map.mapId||source.sourceHash!==map.sourceHash)return map;
  let applied=0;
  const tiles=map.tiles.map(tile=>({...tile,applications:tile.applications.map(application=>{
    if(!Object.hasOwn(source.applications,application.id)||!Object.hasOwn(data.definitions,application.effectId))return application;
    const binding=source.applications[application.id],definition=data.definitions[application.effectId];
    if(application.parameters.definitionCoverage!=='unresolved-native-definition-version'
      ||application.description!==null||application.name!=='Modifier details unavailable'
      ||definition.amount!==application.amount||!equal(tile.coordinate,binding.tileCoordinate))return application;
    for(const key of ['effectId','amount','target','sourceCoordinate','sourceType','remainActive','linkedTargets'] as const){
      if(!equal(application[key],binding[key]))return application;
    }
    const redeemer=application.parameters.nativeRedeemer;
    if(!redeemer||typeof redeemer!=='object'||Array.isArray(redeemer))return application;
    const native=redeemer as Record<string,unknown>;
    if(Object.keys(native).length!==3||native.t!=='buff'||native.n!==application.effectId||native.q!==application.amount)return application;
    applied++;
    return {...application,name:definition.name,description:definition.description,rawDescription:definition.rawDescription,
      iconKey:definition.iconKey,parameters:{...application.parameters,definitionCoverage:'resolved-native-public-definition',
        definitionHash:definition.definitionHash,definitionCapturedAt:data.capturedAt,definitionBcgSha256:data.componentBcgSha256}};
  })}));
  if(!applied)return map;
  const applications=tiles.flatMap(tile=>tile.applications);
  return {...map,tiles,modifierCoverage:{...map.modifierCoverage,applications:applications.length,
    resolvedDefinitions:applications.filter(a=>a.description!==null&&a.name!=='Modifier details unavailable').length,
    verifiedIcons:applications.filter(a=>Boolean(a.iconKey)).length,definitionCapturedAt:data.capturedAt}};
}
