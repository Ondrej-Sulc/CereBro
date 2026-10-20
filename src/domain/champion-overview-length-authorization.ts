import fs from 'node:fs';
import path from 'node:path';
import { artifactHash } from './champion-effect-enrichment';
import type { OverviewSummaryInput, OverviewSummaryValidationOptions } from './champion-overview-summary';

// One independently recorded user choice, scoped to twenty Storm entries in the
// separate held-correction phase. No historical run or other entry gains a waiver.
export const STORM_LENGTH_ROOT = 'D:/CereBro-artifacts/champion-overview-summaries/held-corrections-20261019-r1';
export const STORM_LENGTH_AUTHORIZATION = {
  schemaVersion: 1, kind: 'storm730-twenty-user-authorized-summary-length', championId: 730,
  inputHash: 'e70b13b5498cc457fcb1cf0f626671c2106a357f52eba4414f72c2f50ae74bab',
  authorityHash: '15dfe33cdbd948a0067c6715c65ecffc9416d4781725aba5022b17db9e02e8ef',
  originalAuthorOutputHash: '19ee0e0cd51375cdc8c7ec49acf5b42fa5841696254690cc830d6e64915c77be',
  maxSummaryLength: 1000,
  linkIds: [25289,25290,25291,25292,25293,25294,25295,25296,25297,25298,25307,25308,25309,25310,25311,25312,25313,25314,25325,25326],
} as const;
const hash = (x: unknown) => artifactHash(JSON.parse(JSON.stringify(x)));
export function checkScopedLengthAuthorization(expected: any, authorization: any, input: OverviewSummaryInput, authority: any, originalOutput: any): OverviewSummaryValidationOptions {
  if (hash(authorization) !== hash(expected) || hash(input) !== expected.inputHash || hash(authority) !== expected.authorityHash || hash(originalOutput) !== expected.originalAuthorOutputHash) throw new Error('Scoped length authority/input/output binding mismatch.');
  const ids = expected.linkIds as number[];
  if (!ids.length || new Set(ids).size !== ids.length || input.sources.some(source => source.championId !== expected.championId) || ids.some(id => !input.sources.some(source => source.id === id))) throw new Error('Scoped length source selection mismatch.');
  if (!Number.isSafeInteger(expected.maxSummaryLength) || expected.maxSummaryLength <= 360 || expected.maxSummaryLength > 1000) throw new Error('Scoped length bound invalid.');
  return { summaryLengthOverrides: Object.fromEntries(ids.map(id => [id, expected.maxSummaryLength])) };
}
export function loadOverviewLengthAuthorization(runDir: string, input: OverviewSummaryInput): OverviewSummaryValidationOptions | undefined {
  const file = path.join(runDir, 'summary-length-authorization.json');
  if (!fs.existsSync(file)) return undefined;
  const normalize = (p: string) => path.resolve(p).replace(/\\/g, '/').toLowerCase();
  const dir = normalize(runDir), root = normalize(path.join(STORM_LENGTH_ROOT, 'champions/730'));
  if (![root, `${root}/repair-1`].includes(dir)) throw new Error('Length authorization is outside its exact selected correction run.');
  const read = (p: string) => JSON.parse(fs.readFileSync(p, 'utf8'));
  return checkScopedLengthAuthorization(STORM_LENGTH_AUTHORIZATION, read(file), input,
    read(path.join(STORM_LENGTH_ROOT, 'storm-length-user-authorization-r1.json')),
    read(path.join(STORM_LENGTH_ROOT, 'champions/730/author-output.json')));
}
