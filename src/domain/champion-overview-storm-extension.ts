import fs from 'node:fs';
import path from 'node:path';
import { artifactHash } from './champion-effect-enrichment';
import { STORM_LENGTH_AUTHORIZATION, checkScopedLengthAuthorization } from './champion-overview-length-authorization';
import type { OverviewSummaryInput, OverviewSummaryValidationOptions } from './champion-overview-summary';

export const STORM_EXTENSION_ROOT = 'D:/CereBro-artifacts/champion-overview-summaries/storm-length-extension-20261020-r1';
export const STORM_EXTENSION_IDS = [21107,21108,21110,21114,21115,21118,21120,21121,25281,25282,25283] as const;
export const STORM_EXTENSION_AUTHORIZATION = {
  schemaVersion:1,kind:'storm730-eleven-length-extension-20261020-r1',championId:730,
  inputHash:'e70b13b5498cc457fcb1cf0f626671c2106a357f52eba4414f72c2f50ae74bab',
  authorityHash:'748e48c95ddc79e5cfe5d480ec63f9e01615139224af4f47101f2d6419d0ecf2',
  previousAuthorization:STORM_LENGTH_AUTHORIZATION,
  newLinkIds:STORM_EXTENSION_IDS,maxSummaryLength:1000,
} as const;
const hash=(x:unknown)=>artifactHash(JSON.parse(JSON.stringify(x)));
export function checkStormExtensionScope(expected:any,authorization:any,input:OverviewSummaryInput,authority:any,priorAuthority:any,priorOutput:any):OverviewSummaryValidationOptions {
  if(hash(authorization)!==hash(expected)||hash(input)!==expected.inputHash||hash(authority)!==expected.authorityHash||
     expected.championId!==730||expected.maxSummaryLength!==1000||hash(expected.newLinkIds)!==hash(STORM_EXTENSION_IDS)||
     authority.userAnswer!=='Extend the allowance to these 11 (Recommended)'||hash(authority.selectedLinkIds)!==hash(STORM_EXTENSION_IDS)||authority.maximumCharacters!==1000)
    throw new Error('Exact Storm extension authority/input/selection mismatch');
  const previous=checkScopedLengthAuthorization(expected.previousAuthorization,authorization.previousAuthorization,input,priorAuthority,priorOutput);
  if(input.sources.length!==65||input.sources.some(s=>s.championId!==730)||new Set(input.sources.map(s=>s.id)).size!==65||expected.newLinkIds.some((id:number)=>!input.sources.some(s=>s.id===id))||expected.newLinkIds.some((id:number)=>expected.previousAuthorization.linkIds.includes(id)))throw new Error('Storm extension selected sources mismatch');
  return {summaryLengthOverrides:{...previous.summaryLengthOverrides,...Object.fromEntries(STORM_EXTENSION_IDS.map(id=>[id,1000]))}};
}
export function loadStormExtensionLength(runDir:string,input:OverviewSummaryInput):OverviewSummaryValidationOptions {
  const normalize=(p:string)=>path.resolve(p).replace(/\\/g,'/').toLowerCase();
  if(normalize(runDir)!==normalize(path.join(STORM_EXTENSION_ROOT,'run')))throw new Error('Storm extension is outside its exact new run');
  const read=(p:string)=>JSON.parse(fs.readFileSync(p,'utf8'));
  return checkStormExtensionScope(STORM_EXTENSION_AUTHORIZATION,read(path.join(runDir,'summary-length-authorization.json')),input,
    read(path.join(STORM_EXTENSION_ROOT,'parent-authorization.json')),read(path.join(STORM_EXTENSION_ROOT,'prior-length-authority.json')),read(path.join(STORM_EXTENSION_ROOT,'prior-author-output.json')));
}
