import { config } from 'dotenv';
import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { assertLocalDatabase } from '../domain/champion-effect-enrichment';
import { getCurrentOverviewSummary, overviewSourceHash } from '../domain/champion-overview-summary';
import { classifyResistanceSource, fixedResistancePercent, resistanceEvidenceHash } from '../domain/champion-resistance-classification';
import { validateResistancePlanRow } from '../domain/champion-resistance-plan';

config({ quiet: true });
const db = new PrismaClient();
const command = process.argv[2];
const runDir = path.resolve(process.argv.find(a => a.startsWith('--run-dir='))?.slice(10) ?? 'scratch/champion-resistances');
const write = (name: string, value: unknown) => {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
};
const read = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(runDir, name), 'utf8')) as T;
const include = { ability: true, overviewSummary: true, synergyChampions: { orderBy: { id: 'asc' as const } } } satisfies Prisma.ChampionAbilityLinkInclude;
type Link = Prisma.ChampionAbilityLinkGetPayload<{ include: typeof include }>;
const source = (link: Link) => ({ ...link, name: link.ability.name, synergyChampionIds: link.synergyChampions.map(p => p.championId) });
function documentText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  if (Array.isArray(value)) return value.map(documentText).join('');
  const node = value as Record<string, unknown>;
  if (node.type === 'text') return String(node.value ?? '');
  if (node.type === 'glossary') return String(node.label ?? '');
  if (node.type === 'value') return `{${node.placeholderIndex ?? 'value'}}`;
  return node.blocks ? documentText(node.blocks) : node.children ? documentText(node.children) : typeof node.raw === 'string' ? node.raw : '';
}
async function protectedState(tx: Prisma.TransactionClient) {
  return {
    links: await tx.championAbilityLink.findMany({ orderBy: { id: 'asc' } }),
    summaries: await tx.championAbilityOverview.findMany({ orderBy: { championAbilityLinkId: 'asc' } }),
    partners: await tx.championAbilitySynergy.findMany({ orderBy: { id: 'asc' } }),
    texts: await tx.championAbilityText.findMany({ orderBy: { id: 'asc' } }),
  };
}
async function snapshot() {
  const champions = await db.champion.findMany({ where: { isPlayable: true }, orderBy: { id: 'asc' }, select: {
    id: true, name: true, abilities: { include, orderBy: { id: 'asc' } }, abilityTexts: { orderBy: { id: 'asc' } },
  } });
  const catalog = await db.ability.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } });
  const before = await protectedState(db);
  write('snapshot.json', { champions, catalog, protectedHash: resistanceEvidenceHash(before) });
  write('before.json', before);
  console.log(JSON.stringify({ champions: champions.length, protectedHash: resistanceEvidenceHash(before) }));
}
type Snapshot = { champions: Array<{ id: number; name: string; abilities: Link[]; abilityTexts: Array<{ id: number; group: string; title: string | null; template: Prisma.JsonValue }> }>; catalog: Array<{ id: number; name: string }>; protectedHash: string };
type PlanRow = { championId: number; championName: string; championAbilityLinkId: number; effectId: number; effect: string;
  mechanism: Prisma.ChampionAbilityResistanceCreateManyInput['mechanism']; percent: number | null; sourceHash: string; evidence: Prisma.InputJsonValue };
function plan() {
  const data = read<Snapshot>('snapshot.json');
  const rows: PlanRow[] = [];
  const excluded: Array<{ linkId: number; champion: string; reason: string }> = [];
  for (const champion of data.champions) for (const link of champion.abilities) {
    const proposals = classifyResistanceSource({ ...link, name: link.ability.name });
    if (!proposals.length) continue;
    if (!getCurrentOverviewSummary(source(link), link.overviewSummary)) {
      excluded.push({ linkId: link.id, champion: champion.name, reason: 'No current reviewed condition; retain existing classification.' }); continue;
    }
    for (const proposal of proposals) {
      const effect = data.catalog.find(a => a.name === proposal.target);
      if (!effect) { excluded.push({ linkId: link.id, champion: champion.name, reason: `Target ${proposal.target} absent from catalog.` }); continue; }
      const records = /^Synergy:/i.test(link.source!) ? [] : champion.abilityTexts.filter(record => !/synerg|bio/i.test(record.group)
        && new RegExp(`\\b${proposal.target}\\b`, 'i').test(`${record.title ?? ''} ${documentText(record.template)}`)
        && /resistan|potenc|duration|reduc|less|expire|shrug/i.test(documentText(record.template)));
      rows.push({ championId: champion.id, championName: champion.name, championAbilityLinkId: link.id, effectId: effect.id, effect: effect.name,
        mechanism: proposal.mechanism, percent: fixedResistancePercent(link.source!, records.map(r => r.template)), sourceHash: overviewSourceHash(source(link)),
        evidence: { version: 1, source: link.source!, overviewReviewHash: link.overviewSummary!.reviewHash,
          records: records.map(record => ({ recordId: record.id, templateHash: resistanceEvidenceHash(record.template) })) },
      });
    }
  }
  const result = { version: 1, snapshotHash: resistanceEvidenceHash(data), protectedHash: data.protectedHash, rows, excluded };
  write('plan.json', result);
  console.log(JSON.stringify({ rows: rows.length, champions: new Set(rows.map(r => r.championId)).size, fixedPercentages: rows.filter(r => r.percent !== null).length, excluded, planHash: resistanceEvidenceHash(result) }, null, 2));
}
async function apply() {
  const plan = read<{ snapshotHash: string; protectedHash: string; rows: PlanRow[] }>('plan.json');
  const data = read<Snapshot>('snapshot.json');
  if (plan.snapshotHash !== resistanceEvidenceHash(data) || plan.protectedHash !== data.protectedHash) throw new Error('Snapshot binding mismatch');
  if (fs.existsSync(path.join(runDir, 'receipt.json'))) throw new Error('Already applied; use verify');
  const before = await db.championAbilityResistance.findMany({ orderBy: [{ championAbilityLinkId: 'asc' }, { effectId: 'asc' }] });
  write('resistances-before.json', before);
  const unique = new Set(plan.rows.map(r => `${r.championAbilityLinkId}:${r.effectId}`));
  if (unique.size !== plan.rows.length) throw new Error('Duplicate target application');
  const receipt = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "ChampionAbilityLink" ORDER BY "id" FOR SHARE`;
    if (resistanceEvidenceHash(await protectedState(tx)) !== plan.protectedHash) throw new Error('Protected source or summary drift');
    const current = await tx.championAbilityLink.findMany({ where: { id: { in: plan.rows.map(r => r.championAbilityLinkId) } }, include });
    const texts = await tx.championAbilityText.findMany({ where: { championId: { in: [...new Set(plan.rows.map(r => r.championId))] } } });
    const effects = await tx.ability.findMany({ where: { id: { in: [...new Set(plan.rows.map(r => r.effectId))] } }, select: { id: true, name: true } });
    for (const row of plan.rows) {
      const link = current.find(l => l.id === row.championAbilityLinkId);
      validateResistancePlanRow(row, link ? { ...link, name: link.ability.name, sourceHash: overviewSourceHash(source(link)),
        reviewHash: getCurrentOverviewSummary(source(link), link.overviewSummary) ? link.overviewSummary!.reviewHash : null } : undefined,
        effects.find(effect => effect.id === row.effectId), texts);
    }
    await tx.championAbilityResistance.createMany({ data: plan.rows.map(({ championId: _championId, championName: _championName, effect: _effect, ...row }) => row) });
    const after = await tx.championAbilityResistance.findMany({ orderBy: [{ championAbilityLinkId: 'asc' }, { effectId: 'asc' }] });
    const protectedHash = resistanceEvidenceHash(await protectedState(tx));
    if (protectedHash !== plan.protectedHash) throw new Error('Original data changed');
    return { appliedAt: new Date().toISOString(), planHash: resistanceEvidenceHash(plan), rows: plan.rows.length, champions: new Set(plan.rows.map(r => r.championId)).size, protectedHash, afterHash: resistanceEvidenceHash(after) };
  }, { isolationLevel: 'Serializable', timeout: 120000 });
  write('receipt.json', receipt);
  console.log(JSON.stringify(receipt, null, 2));
}
async function verify() {
  const receipt = read<{ protectedHash: string; afterHash: string }>('receipt.json');
  const rows = await db.championAbilityResistance.findMany({ orderBy: [{ championAbilityLinkId: 'asc' }, { effectId: 'asc' }] });
  if (resistanceEvidenceHash(await protectedState(db)) !== receipt.protectedHash || resistanceEvidenceHash(rows) !== receipt.afterHash) throw new Error('Poststate mismatch');
  console.log(JSON.stringify({ verified: true, rows: rows.length, protectedHash: receipt.protectedHash }));
}
async function main() {
  assertLocalDatabase(process.env.DATABASE_URL ?? '');
  if (command === 'snapshot') await snapshot();
  else if (command === 'plan') plan();
  else if (command === 'apply') await apply();
  else if (command === 'verify') await verify();
  else throw new Error('Use snapshot, plan, apply or verify with --run-dir');
}
if (require.main === module) void main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(() => db.$disconnect());
