import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { artifactHash, assertLocalDatabase, databaseConnectionIdentity } from '../domain/champion-effect-enrichment';
import { overviewSourceHash, validateOverviewSummaries, type OverviewSummaryInput } from '../domain/champion-overview-summary';
import { loadOverviewLengthAuthorization } from '../domain/champion-overview-length-authorization';
import { loadStormExtensionLength } from '../domain/champion-overview-storm-extension';
import { loadRemainingLength } from '../domain/champion-overview-remaining-length-extension';

config({ quiet: true });
const command = process.argv[2];
const argument = process.argv.find(value => value.startsWith('--run-dir='))?.slice('--run-dir='.length);
if (!argument) throw new Error('--run-dir is required.');
const runDir = path.resolve(argument);
const read = (name: string): unknown => JSON.parse(fs.readFileSync(path.join(runDir, name), 'utf8'));
function writeNew(name: string, data: unknown) {
  fs.writeFileSync(path.join(runDir, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
}
const jsonHash = (data: unknown) => artifactHash(JSON.parse(JSON.stringify(data)));
async function main() {
  const input = read('input.json') as OverviewSummaryInput;
  const stormLength = process.argv.includes('--storm-length-extension-20261020-r1');
  const remainingLength = process.argv.includes('--remaining-length-extension-20261020-r1');
  if (stormLength && remainingLength) throw new Error('Conflicting scoped length selectors.');
  const lengthOptions = remainingLength ? loadRemainingLength(runDir, input) : stormLength
    ? loadStormExtensionLength(runDir, input) : loadOverviewLengthAuthorization(runDir, input);
  const draft = validateOverviewSummaries(input, read('draft.json'), command === 'apply' ? read('review.json') : undefined, lengthOptions);
  if (command === 'validate') {
    if (fs.existsSync(path.join(runDir, 'review.json'))) validateOverviewSummaries(input, draft, read('review.json'), lengthOptions);
    console.log(JSON.stringify({ valid: draft.entries.length, summaries: draft.entries.filter(entry => entry.summary !== null).length,
      unavailable: draft.entries.filter(entry => entry.summary === null).map(entry => entry.linkId) }));
    return;
  }
  if (command !== 'apply') throw new Error('Expected validate or apply.');
  assertLocalDatabase(process.env.DATABASE_URL);
  const db = new PrismaClient();
  try {
    if (fs.existsSync(path.join(runDir, 'receipt.json'))) throw new Error('This summary run already has a receipt.');
    const ids = input.sources.map(source => source.id);
    const review = read('review.json');
    const reviewHash = artifactHash(review);
    const result = await db.$transaction(async tx => {
      // Lock existing source rows as well as the display-copy table before checking drift.
      for (const championId of [...new Set(input.sources.map(source => source.championId))].sort((a,b) => a-b)) {
        await tx.$queryRaw`SELECT "id" FROM "Champion" WHERE "id" = ${championId} FOR UPDATE`;
        await tx.$queryRaw`SELECT "id" FROM "ChampionAbilityLink" WHERE "championId" = ${championId} ORDER BY "id" FOR UPDATE`;
      }
      const current = await tx.championAbilityLink.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' },
        include: { ability: { select: { name: true } }, synergyChampions: { orderBy: { id: 'asc' } } } });
      const currentSources = current.map(link => ({ id: link.id, championId: link.championId, abilityId: link.abilityId,
        name: link.ability.name, type: link.type, source: link.source, effectForm: link.effectForm, effectDirection: link.effectDirection,
        synergyChampionIds: link.synergyChampions.map(partner => partner.championId) }));
      if (current.length !== ids.length || currentSources.some(source => overviewSourceHash(source) !== overviewSourceHash(input.sources.find(item => item.id === source.id)!))) {
        throw new Error('Current source data drifted; refusing summary application.');
      }
      const existing = await tx.championAbilityOverview.findMany({ where: { championAbilityLinkId: { in: ids } }, orderBy: { championAbilityLinkId: 'asc' } });
      const backup = { schemaVersion: 1, databaseIdentity: databaseConnectionIdentity(process.env.DATABASE_URL!),
        inputHash: artifactHash(input), draftHash: artifactHash(draft), reviewHash, before: [], sourceRows: current };
      if (fs.existsSync(path.join(runDir, 'backup.json'))) {
        if (artifactHash(read('backup.json')) !== artifactHash(backup)) throw new Error('Existing backup does not match this transaction.');
      } else {
        if (existing.length) throw new Error('Pilot summary rows already exist; use an explicitly bound follow-up run.');
        writeNew('backup.json', backup);
      }
      // A committed transaction can be reconciled after an interrupted receipt write, without rewriting any row.
      const matchesDraft = (saved: typeof existing) => saved.length === draft.entries.filter(entry => entry.summary !== null).length && saved.every(row => {
        const entry = draft.entries.find(entry => entry.linkId === row.championAbilityLinkId);
        return entry?.summary === row.text && entry.sourceHash === row.sourceHash && row.reviewHash === reviewHash;
      });
      if (existing.length && !matchesDraft(existing)) throw new Error('Existing summaries do not match the backed-up approved transaction.');
      for (const entry of draft.entries) if (!existing.length && entry.summary !== null) {
        await tx.championAbilityOverview.create({ data: { championAbilityLinkId: entry.linkId, text: entry.summary,
          sourceHash: entry.sourceHash, reviewHash } });
      }
      const after = await tx.championAbilityOverview.findMany({ where: { championAbilityLinkId: { in: ids } }, orderBy: { championAbilityLinkId: 'asc' } });
      const afterSources = await tx.championAbilityLink.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' },
        include: { ability: { select: { name: true } }, synergyChampions: { orderBy: { id: 'asc' } } } });
      if (artifactHash(afterSources) !== artifactHash(current)) throw new Error('Original source records changed.');
      if (!matchesDraft(after)) throw new Error('Summary poststate mismatch.');
      return { ...backup, sourceRows: undefined, sourceRowsHash: artifactHash(current), backupHash: artifactHash(backup),
        appliedAt: new Date().toISOString(), recoveredReceipt: existing.length > 0, after, afterHash: jsonHash(after), summaries: after.length,
        unavailable: draft.entries.filter(entry => entry.summary === null).map(entry => ({ linkId: entry.linkId, note: entry.note })) };
    }, { isolationLevel: 'Serializable', timeout: 30000 });
    writeNew('receipt.json', result);
    console.log(JSON.stringify({ summaries: result.summaries, unavailable: result.unavailable, originalSourcesUnchanged: true, receiptHash: jsonHash(result) }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
