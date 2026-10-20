import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { artifactHash } from '../domain/champion-effect-enrichment';
import { parseAbilityDisplayFile, planAbilityDisplayUpdates, parseAbilityDisplayBindings,
  applyAbilityDisplayBindings } from '../services/championAbilityDisplayService';

const arg = (name: string, fallback: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
async function main() {
  const metadataPath = path.resolve(arg('metadata', 'scratch/ability-display-metadata.json'));
  const runDir = path.resolve(arg('run-dir', 'scratch/champion-ability-display/pilot-20261019'));
  const slugs = arg('champions', 'agatha-harkness,beta-ray-bill,silver-sable').split(',').map(slug => slug.trim()).filter(Boolean);
  if (!slugs.length) throw new Error('Select at least one champion for the bounded display repair.');
  const write = process.argv.includes('--write');
  const metadata = parseAbilityDisplayFile(fs.readFileSync(metadataPath, 'utf8'));
  const bindingsPath = arg('champion-bindings', '');
  const championBindings = bindingsPath ? parseAbilityDisplayBindings(fs.readFileSync(path.resolve(bindingsPath), 'utf8')) : [];
  const bindingProof = championBindings.length ? { championBindings, championBindingsHash: artifactHash(championBindings) } : {};
  const db = new PrismaClient({ log: [] });
  const selection = { id: true, championId: true, sourceId: true, group: true, title: true, sortOrder: true, template: true,
    champion: { select: { gameId: true } } } as const;
  try {
    const rows = await db.championAbilityText.findMany({ where: { champion: { slug: { in: slugs } }, group: { notIn: ['bio', 'special'] } }, select: selection, orderBy: { id: 'asc' } });
    const boundRows = applyAbilityDisplayBindings(rows.map(row => ({ ...row, gameId: row.champion.gameId })), championBindings);
    const plan = planAbilityDisplayUpdates(boundRows, metadata.entries);
    const summary = { slugs, selected: rows.length, changes: plan.updates.length, champions: new Set(plan.updates.map(row => row.championId)).size,
      unchanged: plan.unchanged, unmatched: plan.unmatched, drifted: plan.drifted,
      glossary: plan.updates.filter(row => (row.after.display as {kind:string}).kind === 'glossary').length,
      sectionHeadings: plan.updates.filter(row => !!(row.after.display as {section?:unknown}).section).length };
    fs.mkdirSync(runDir, { recursive: true });
    if (!write) {
      fs.writeFileSync(path.join(runDir, 'preflight.json'), JSON.stringify({ ...summary, provenance: metadata.provenance, metadataHash: artifactHash(metadata), ...bindingProof }, null, 2));
      console.log(JSON.stringify({ mode: 'dry-run', ...summary, unmatched: plan.unmatched.length, drifted: plan.drifted.length }));
      return;
    }
    const host = new URL(process.env.DATABASE_URL ?? '').hostname;
    if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(host)) throw new Error('Display repair is restricted to the local database.');
    if (plan.drifted.length) throw new Error('Original text differs from display bindings; no changes applied.');
    if (!plan.updates.length) { console.log(JSON.stringify({ mode: 'unchanged', ...summary })); return; }
    if (plan.updates.some(update => update.before.display !== undefined)) throw new Error('Existing display metadata differs; explicit follow-up repair required.');
    const ids = plan.updates.map(row => row.id);
    const idSet = new Set(ids);
    const before = rows.filter(row => idSet.has(row.id));
    const beforeHash = artifactHash(before);
    const backup = { schemaVersion: 1, beforeHash, metadataHash: artifactHash(metadata), provenance: metadata.provenance, ...bindingProof, rows: before };
    const backupPath = path.join(runDir, 'backup.json');
    fs.writeFileSync(backupPath, JSON.stringify(backup), { flag: 'wx' });
    const updates = new Map(plan.updates.map(update => [update.id, update]));
    const expected = before.map(row => ({ ...row, template: updates.get(row.id)!.after }));
    const expectedHash = artifactHash(expected);
    await db.$transaction(async tx => {
      await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "ChampionAbilityText" WHERE "id" IN (${Prisma.join(ids)}) ORDER BY "id" FOR UPDATE`);
      const current = await tx.championAbilityText.findMany({ where: { id: { in: ids } }, select: selection, orderBy: { id: 'asc' } });
      if (artifactHash(current) !== beforeHash) throw new Error('Display repair snapshot drifted; transaction aborted.');
      const payload = JSON.stringify(plan.updates.map(update => ({ id: update.id, display: update.after.display })));
      const count = await tx.$executeRaw(Prisma.sql`UPDATE "ChampionAbilityText" AS target
        SET "template" = target."template" || jsonb_build_object('display', incoming.display)
        FROM jsonb_to_recordset(${payload}::jsonb) AS incoming(id int, display jsonb)
        WHERE target."id" = incoming.id`);
      if (count !== ids.length) throw new Error('Display repair row count mismatch.');
      const after = await tx.championAbilityText.findMany({ where: { id: { in: ids } }, select: selection, orderBy: { id: 'asc' } });
      if (artifactHash(after) !== expectedHash) throw new Error('Display repair poststate mismatch.');
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 120_000 });
    const final = await db.championAbilityText.findMany({ where: { id: { in: ids } }, select: selection, orderBy: { id: 'asc' } });
    if (artifactHash(final) !== expectedHash) throw new Error('Committed display poststate mismatch.');
    fs.writeFileSync(path.join(runDir, 'receipt.json'), JSON.stringify({ ...summary, beforeHash, afterHash: expectedHash,
      backupHash: artifactHash(backup), metadataHash: artifactHash(metadata), ...bindingProof, ids, verified: true }, null, 2), { flag: 'wx' });
    console.log(JSON.stringify({ mode: 'applied-verified', ...summary, unmatched: plan.unmatched.length, drifted: plan.drifted.length, beforeHash, afterHash: expectedHash }));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
