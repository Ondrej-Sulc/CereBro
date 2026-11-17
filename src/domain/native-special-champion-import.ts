import type {ChampionClass} from '@prisma/client';

export type NativeSpecialImportRow={id:number;name:string;slug:string|null;gameId:string|null;isPlayable:boolean;class:ChampionClass};
export type NativeSpecialIdentityEvidence={rows:number;orderedRecordsSha256:string};
export type NativeSpecialImportCandidate={
 gameId:string;nativeName:string;name:string;slug:string;class:ChampionClass;releaseDate:null;
 existingChampion:{id:number;name:string;slug:string|null;gameId:string|null;isPlayable:boolean}|null;
 identityEvidence:NativeSpecialIdentityEvidence|null;portrait:{url:string;sha256:string}|null;
};
export type NativeSpecialChampionInsert={name:string;slug:string;shortName:string;gameId:string;class:ChampionClass;releaseDate:null;obtainable:string[];images:Record<string,string>;fullAbilities:Record<string,never>;isPlayable:false};

/** Plan exact reviewed identities only; source metadata never overwrites existing kits or dates. */
export function planNativeSpecialChampions<Row extends NativeSpecialImportRow>(snapshot:readonly Row[],candidates:readonly NativeSpecialImportCandidate[]){
 const byId=new Map(snapshot.map(row=>[row.id,row])),byGameId=new Map(snapshot.flatMap(row=>row.gameId?[[row.gameId,row] as const]:[]));
 const normalize=(value:string)=>value.trim().toLocaleLowerCase('en');
 const names=new Map(snapshot.map(row=>[normalize(row.name),row.id])),slugs=new Map(snapshot.flatMap(row=>row.slug?[[normalize(row.slug),row.id] as const]:[]));
 const seenIds=new Set<string>(),seenNames=new Set<string>(),seenSlugs=new Set<string>();
 const repairs:{id:number;before:Row;after:{gameId:string;isPlayable:false};identityEvidence:NativeSpecialIdentityEvidence}[]=[];
 const inserts:NativeSpecialChampionInsert[]=[],verifiedExisting:number[]=[];
 for(const source of candidates){
  if(!source.gameId||!source.name.trim()||!source.nativeName.trim()||!source.slug||source.releaseDate!==null)throw new Error('Invalid native special identity');
  const nameKey=normalize(source.name),slugKey=normalize(source.slug);
  if(seenIds.has(source.gameId)||seenNames.has(nameKey)||seenSlugs.has(slugKey))throw new Error('Duplicate native special identity');
  seenIds.add(source.gameId);seenNames.add(nameKey);seenSlugs.add(slugKey);
  const reviewed=source.existingChampion;
  const current=reviewed?byId.get(reviewed.id):byGameId.get(source.gameId);
  if(reviewed&&!current)throw new Error('Reviewed champion identity missing');
  if(current){
   if(current.gameId!==null&&current.gameId!==source.gameId)throw new Error('Existing game identity conflict');
   if(byGameId.has(source.gameId)&&byGameId.get(source.gameId)!.id!==current.id)throw new Error('Native game identity already claimed');
   if(current.name!==source.name||current.slug!==source.slug||current.class!==source.class)throw new Error('Reviewed champion metadata changed');
   if(reviewed&&(current.name!==reviewed.name||current.slug!==reviewed.slug))throw new Error('Reviewed champion identity changed');
   if(!reviewed&&current.isPlayable)throw new Error('Cannot reclassify an unreviewed playable champion');
   if(current.gameId!==source.gameId||current.isPlayable){
    const proof=source.identityEvidence;
    if(!reviewed||!proof||!Number.isInteger(proof.rows)||proof.rows<1||!/^[a-f0-9]{64}$/.test(proof.orderedRecordsSha256))throw new Error('Verified identity evidence required for repair');
    repairs.push({id:current.id,before:current,after:{gameId:source.gameId,isPlayable:false},identityEvidence:proof});
   }else verifiedExisting.push(current.id);
   continue;
  }
  if(names.has(nameKey)||slugs.has(slugKey))throw new Error('Native special name or slug already claimed');
  const portrait=source.portrait;
  if(portrait&&(!/^\/(?:game-champions\/native-art|game-quests\/(?:permanent-art|progressed-art))\/[a-f0-9]{64}\.webp$/.test(portrait.url)||!portrait.url.endsWith(`${portrait.sha256}.webp`)))throw new Error('Unverified native portrait reference');
  inserts.push({name:source.name,slug:source.slug,shortName:source.nativeName,gameId:source.gameId,class:source.class,releaseDate:null,obtainable:[],images:portrait?{p_128:portrait.url}: {},fullAbilities:{},isPlayable:false});
 }
 return {repairs,inserts,verifiedExisting};
}
