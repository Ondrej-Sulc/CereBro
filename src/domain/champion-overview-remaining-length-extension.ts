import fs from 'node:fs';
import path from 'node:path';
import {artifactHash} from './champion-effect-enrichment';
import type {OverviewSummaryInput,OverviewSummaryValidationOptions} from './champion-overview-summary';
export const REMAINING_ROOT='D:/CereBro-artifacts/champion-overview-summaries/remaining-length-extension-20261020-r1';
export const REMAINING_AUTHORITY_HASH='dfac3a60c9a353b0f015c174f1a7840b8d6902d1428edd8fe51857e3306ce8c2';
export const REMAINING_IDS=[483,502,539,679,697,723,752] as const;
export const REMAINING_LINK_IDS=[15732,21626,21629,21631,21636,21637,21638,20732,22066,22069,22073,22076,22079,16542,16543,16544,16545,16546,22645,22646,22653,22671,22672,22673,22674,22675,22676,22677,22678,22679,24464,24709,24710,25142,25144,25145,25581] as const;
const hash=(x:any)=>artifactHash(JSON.parse(JSON.stringify(x)));
export function checkRemainingMemberLength(member:any,input:OverviewSummaryInput,authority:any,authorityHash:string):OverviewSummaryValidationOptions{
 if(hash(authority)!==authorityHash||authority.maximumCharacters!==1000||authority.userAnswer!=='ok allow more than the 360 limit for these'||!REMAINING_IDS.includes(member.championId)||hash(authority.members.find((m:any)=>m.championId===member.championId))!==hash(member)||hash(input)!==member.inputHash)throw new Error('Remaining length authority/member/input drift');
 if(!member.changedLinkIds.length||new Set(member.changedLinkIds).size!==member.changedLinkIds.length||member.changedLinkIds.some((id:number)=>!REMAINING_LINK_IDS.includes(id as any))||input.sources.length!==member.selectedCount||new Set(input.sources.map(s=>s.id)).size!==input.sources.length||input.sources.some(s=>s.championId!==member.championId)||member.changedLinkIds.some((id:number)=>!input.sources.some(s=>s.id===id)))throw new Error('Remaining length selected source/ID drift');
 return {summaryLengthOverrides:Object.fromEntries(member.changedLinkIds.map((id:number)=>[id,1000]))};
}
export function loadRemainingLength(runDir:string,input:OverviewSummaryInput):OverviewSummaryValidationOptions{
 const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8')),authority=read(path.join(REMAINING_ROOT,'parent-authorization.json'));
 if(hash(authority)!==REMAINING_AUTHORITY_HASH)throw new Error('Exact remaining phase authority drift');
 const member=authority.members.find((m:any)=>input.sources[0]?.championId===m.championId);
 const normalize=(p:string)=>path.resolve(p).replace(/\\/g,'/').toLowerCase();
 if(!member||normalize(runDir)!==normalize(path.join(REMAINING_ROOT,'champions',String(member.championId))))throw new Error('Remaining length outside exact new member run');
 const authorization=read(path.join(runDir,'summary-length-authorization.json'));
 if(authorization.authorityHash!==REMAINING_AUTHORITY_HASH||hash(authorization.member)!==hash(member)||authorization.maxSummaryLength!==1000)throw new Error('Remaining length certificate drift');
 return checkRemainingMemberLength(member,input,authority,REMAINING_AUTHORITY_HASH);
}
