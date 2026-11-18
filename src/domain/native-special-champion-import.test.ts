import {describe,expect,it} from 'vitest';
import {planNativeSpecialChampions,type NativeSpecialImportCandidate,type NativeSpecialImportRow} from './native-special-champion-import';

const existing:NativeSpecialImportRow={id:10,name:'Ares',slug:'ares',gameId:null,isPlayable:false,class:'SUPERIOR'};
const candidate:NativeSpecialImportCandidate={gameId:'ares',nativeName:'ARES',name:'Ares',slug:'ares',class:'SUPERIOR',releaseDate:null,existingChampion:{id:10,name:'Ares',slug:'ares',gameId:null,isPlayable:false},identityEvidence:{rows:2,orderedRecordsSha256:'a'.repeat(64)},portrait:null};
const fresh:NativeSpecialImportCandidate={...candidate,gameId:'thor_legacy',nativeName:'THOR (LEGACY)',name:'THOR (LEGACY)',slug:'npc-thor-legacy',class:'COSMIC',existingChampion:null,identityEvidence:null,portrait:{url:`/game-champions/native-art/${'b'.repeat(64)}.webp`,sha256:'b'.repeat(64)}};

describe('native special champion import plan',()=>{
 it('repairs exact reviewed null identities without replacing existing metadata or IDs',()=>{
  const plan=planNativeSpecialChampions([existing],[candidate]);
  expect(plan.repairs).toEqual([{id:10,before:existing,after:{gameId:'ares',isPlayable:false},identityEvidence:candidate.identityEvidence}]);
  expect(plan.inserts).toEqual([]);expect(existing.gameId).toBeNull();
 });
 it('creates noncollectible catalog records without invented release dates, obtainable stars or kits',()=>{
  const [insert]=planNativeSpecialChampions([],[fresh]).inserts;
  expect(insert).toMatchObject({name:fresh.name,gameId:'thor_legacy',class:'COSMIC',slug:'npc-thor-legacy',isPlayable:false,releaseDate:null,obtainable:[],fullAbilities:{},images:{p_128:fresh.portrait!.url}});
  expect(insert).not.toHaveProperty('id');
 });
 it('uses the reviewed display name on import and recognizes an already renamed NPC by exact identity',()=>{
  const vision:NativeSpecialImportCandidate={...fresh,gameId:'vision_blackorder',nativeName:'NAMELESS',name:'NAMELESS [vision_blackorder]',slug:'npc-vision-blackorder',class:'SUPERIOR'};
  expect(planNativeSpecialChampions([],[vision]).inserts[0]).toMatchObject({
   name:'Nameless Vision',shortName:'NAMELESS',gameId:vision.gameId,slug:vision.slug,
  });
  const renamed:NativeSpecialImportRow={id:50,gameId:vision.gameId,name:'Nameless Vision',slug:vision.slug,class:vision.class,isPlayable:false};
  expect(planNativeSpecialChampions([renamed],[vision])).toEqual({repairs:[],inserts:[],verifiedExisting:[50]});
  expect(()=>planNativeSpecialChampions([{...renamed,name:'Custom Vision'}],[vision])).toThrow(/metadata/);
 });
 it('corrects a source-proven NPC playable flag and makes repeated planning idempotent',()=>{
  const wrong={...existing,gameId:'ares',isPlayable:true},reviewed={...candidate,existingChampion:{...candidate.existingChampion!,gameId:'ares',isPlayable:true}};
  expect(planNativeSpecialChampions([wrong],[reviewed]).repairs[0].after).toEqual({gameId:'ares',isPlayable:false});
  const correct={...existing,gameId:'ares'};
  expect(planNativeSpecialChampions([correct],[candidate]).repairs).toEqual([]);
  expect(planNativeSpecialChampions([correct],[candidate]).verifiedExisting).toEqual([10]);
 });
 it('refuses conflicting ownership of a game ID, reviewed champion ID, name, slug or class',()=>{
  for(const row of [{...existing,id:11,gameId:'ares'},{...existing,gameId:'other'},{...existing,name:'Changed'},{...existing,slug:'changed'},{...existing,class:'COSMIC' as const}])expect(()=>planNativeSpecialChampions([row],[candidate])).toThrow();
  for(const row of [{...existing,name:fresh.name},{...existing,slug:fresh.slug}])expect(()=>planNativeSpecialChampions([row],[fresh])).toThrow();
 });
 it('requires an exact paragraph identity proof for a reviewed repair and rejects duplicate candidates',()=>{
  expect(()=>planNativeSpecialChampions([existing],[{...candidate,identityEvidence:null}])).toThrow(/identity evidence/);
  expect(()=>planNativeSpecialChampions([],[fresh,fresh])).toThrow(/Duplicate/);
  expect(()=>planNativeSpecialChampions([],[{...fresh,portrait:{url:'https://unverified.example/portrait.webp',sha256:'b'.repeat(64)}}])).toThrow(/portrait/);
 });
});
