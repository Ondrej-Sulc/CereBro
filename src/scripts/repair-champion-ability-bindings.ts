import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { artifactHash } from '../domain/champion-effect-enrichment';
import { parseAbilityBindingFile, planAbilityBindingUpdates } from '../services/championAbilityBindingService';
import { applyAbilityDisplayBindings, parseAbilityDisplayBindings } from '../services/championAbilityDisplayService';

const arg = (name: string) => process.argv.find(v => v.startsWith(`--${name}=`))?.slice(name.length + 3);
async function main() {
  const metadataPath = arg('bindings'), directory = arg('run-dir');
  if (!metadataPath || !directory) throw Error('--bindings and --run-dir are required.');
  const runDir = path.resolve(directory);
  const metadata = parseAbilityBindingFile(fs.readFileSync(path.resolve(metadataPath), 'utf8'));
  const aliases = arg('champion-bindings');
  const bindings = aliases ? parseAbilityDisplayBindings(fs.readFileSync(aliases, 'utf8')) : [];
  const write = process.argv.includes('--write');
  const db = new PrismaClient({ log: [] });
  const save = (name: string, value: unknown) => fs.writeFileSync(path.join(runDir, name), JSON.stringify(value), { flag: 'wx' });
  const select = { id: true, championId: true, sourceId: true, group: true, title: true, sortOrder: true, template: true,
    champion: { select: { gameId: true, slug: true } } } as const;
  try {
    const rows = await db.championAbilityText.findMany({ select, orderBy: { id: 'asc' } });
    const overviews = await db.championAbilityOverview.findMany({ orderBy: { championAbilityLinkId: 'asc' } });
    const protectedHash = artifactHash(overviews);
    const boundRows = applyAbilityDisplayBindings(rows.map(r => ({ ...r, gameId: r.champion.gameId })), bindings);
    const plan = planAbilityBindingUpdates(boundRows, metadata.entries);
    const summary = { selectedRows: rows.length, updates: plan.updates.length,
      champions: new Set(rows.filter(r => plan.updates.some(u => u.id === r.id)).map(r => r.championId)).size,
      held: plan.held, unchanged: plan.unchanged, metadataHash: artifactHash(metadata), bindingsHash: artifactHash(bindings),
      beforeHash: artifactHash(rows), protectedOverviewHash: protectedHash };
    fs.mkdirSync(runDir, { recursive: true });
    if (!write) {
      save('before.json', { rows, overviews });
      save('plan.json', { ...summary, updates: plan.updates });
      console.log(JSON.stringify({ ...summary, held: plan.held.length }));
      return;
    }
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(new URL(process.env.DATABASE_URL ?? '').hostname)) throw Error('Binding repair is local DB only.');
    const prior = JSON.parse(fs.readFileSync(path.join(runDir, 'plan.json'), 'utf8'));
    if (artifactHash(prior) !== artifactHash({ ...summary, updates: plan.updates })) throw Error('Binding preflight drifted.');
    if (!plan.updates.length) throw Error('No binding changes selected.');
    const updates = new Map(plan.updates.map(u => [u.id, u.after]));
    const expected = rows.map(r => updates.has(r.id) ? { ...r, template: updates.get(r.id)! } : r);
    const expectedHash = artifactHash(expected);
    save('journal.json', { beforeHash: summary.beforeHash, expectedHash, ids: [...updates.keys()], protectedHash });
    await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ChampionAbilityText" ORDER BY "id" FOR UPDATE`);
      const current = await tx.championAbilityText.findMany({ select, orderBy: { id: 'asc' } });
      if (artifactHash(current) !== summary.beforeHash) throw Error('Binding transaction snapshot drifted.');
      for (let i = 0; i < plan.updates.length; i += 250) {
        const chunk = plan.updates.slice(i, i + 250);
        const payload = JSON.stringify(chunk.map(u => ({ id: u.id, template: u.after })));
        const count = await tx.$executeRaw(Prisma.sql`UPDATE "ChampionAbilityText" AS target SET "template" = incoming.template
          FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(id int, template jsonb) WHERE target."id" = incoming.id`);
        if (count !== chunk.length) throw Error('Binding update count differs.');
      }
      const after = await tx.championAbilityText.findMany({ select, orderBy: { id: 'asc' } });
      if (artifactHash(after) !== expectedHash) throw Error('Binding transaction poststate differs.');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 180_000, maxWait: 10_000 });
    const finalRows = await db.championAbilityText.findMany({ select, orderBy: { id: 'asc' } });
    const finalOverviews = await db.championAbilityOverview.findMany({ orderBy: { championAbilityLinkId: 'asc' } });
    if (artifactHash(finalRows) !== expectedHash || artifactHash(finalOverviews) !== protectedHash) throw Error('Final binding/protected overview reconciliation failed.');
    save('receipt.json', { ...summary, afterHash: expectedHash, verified: true });
    console.log(JSON.stringify({ mode: 'applied-verified', ...summary, held: plan.held.length, afterHash: expectedHash }));
  } finally { await db.$disconnect(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
