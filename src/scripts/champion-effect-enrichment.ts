import { config } from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  artifactHash, assertLocalDatabase, hashChampionInput, validateEnrichment, unchangedCreatedAbilityIds, unresolvedRestoreChampionIds,
  databaseConnectionIdentity, matchesBackupDatabaseIdentity,
  type ChampionEnrichmentInput, type EnrichmentDocument, type EnrichmentSnapshot, type ExistingEffectLink,
  type CatalogAbility, type EffectCandidate, type CreatedAbilitySnapshot,
} from '../domain/champion-effect-enrichment';

config({ quiet: true });
config({ path: 'web/.env.local', quiet: true });
config({ path: 'web/.env', quiet: true });
const command = process.argv[2];
const argument = (name: string) => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const runDir = path.resolve(argument('run-dir') ?? argument('out-dir') ?? 'scratch/champion-enrichment/run-20261017');
const filePath = (...parts: string[]) => path.join(runDir, ...parts);
function writeNew(file: string, value: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
}
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;
const selectIds = (): Set<number> | undefined => {
  const value = argument('champion-ids');
  if (!value) return undefined;
  const ids = value.split(',').map(Number);
  if (ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error('Invalid --champion-ids.');
  return new Set(ids);
};
function plainText(text: string): string {
  return text.replace(/\[(?:\/?(?:b|i|u)|\/?k(?:=[^\]]*)?|[0-9a-f]{6,8}|-)\]/gi, '')
    .replace(/<[^>]+>/g, '').replace(/\r\n/g, '\n').trim();
}
function templateText(template: Prisma.JsonValue): string {
  function renderNode(node: unknown): string {
    if (!node || typeof node !== 'object') return '';
    const n = node as Record<string, unknown>;
    if (n.type === 'text') return String(n.value ?? '');
    if (n.type === 'glossary') return String(n.label ?? '');
    if (n.type === 'value') return `{${n.placeholderIndex ?? n.key ?? 'value'}}`;
    if (Array.isArray(n.children)) return n.children.map(renderNode).join('');
    return '';
  }
  if (!template || typeof template !== 'object' || Array.isArray(template)) return '';
  if (Array.isArray(template.blocks)) return plainText(template.blocks.map(renderNode).join('\n'));
  return typeof template.raw === 'string' ? plainText(template.raw) : '';
}
async function loadInputs(db: Prisma.TransactionClient, ids?: Set<number>): Promise<ChampionEnrichmentInput[]> {
  const champions = await db.champion.findMany({ where: { isPlayable: true, ...(ids ? { id: { in: [...ids] } } : {}) },
    orderBy: { id: 'asc' }, include: {
      abilityTexts: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] },
      abilities: { include: { ability: true, synergyChampions: true }, orderBy: { id: 'asc' } },
    } });
  const synergies = await db.gameSynergy.findMany({ where: { enabled: true, requiredHeroGroups: false,
    ...(ids ? { members: { some: { championId: { in: [...ids] } } } } : {}) }, orderBy: { id: 'asc' },
    include: { members: { include: { champion: { select: { id: true, name: true, isPlayable: true } } } } } });
  return champions.map(champion => {
    const documents: EnrichmentDocument[] = [];
    const inheritedTitles = new Map<string, string>();
    for (const record of champion.abilityTexts) {
      if (/bio|portrait|synerg/i.test(record.group)) continue;
      if (record.title?.trim()) inheritedTitles.set(record.group, plainText(record.title));
      const title = inheritedTitles.get(record.group) ?? null;
      const text = templateText(record.template);
      if (text) documents.push({ id: `text:${record.id}`, kind: 'abilityText', title, text,
        origin: `ChampionAbilityText:${record.sourceId} (${record.group})` });
    }
    if (!documents.length) {
      function collect(value: Prisma.JsonValue, keys: string[] = []) {
        if (typeof value === 'string') {
          if (!keys.some(key => /bio|portrait|synerg/i.test(key)) && plainText(value)) documents.push({
            id: `legacy:${keys.join('.')}`, kind: 'legacyAbility', title: keys.slice(0, -1).join(' / ') || null,
            text: plainText(value), origin: `Champion.fullAbilities.${keys.join('.')}`,
          });
        } else if (Array.isArray(value)) value.forEach((item, index) => collect(item, [...keys, String(index)]));
        else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => { if (item !== undefined) collect(item, [...keys, key]); });
      }
      collect(champion.fullAbilities);
    }
    for (const synergy of synergies) {
      const membersByRole = (role: 'OWNER' | 'REQUIRED') => {
        const grouped = new Map<number, { id: number; name: string; rarities: number[] }>();
        for (const member of synergy.members.filter(m => m.role === role && m.champion.isPlayable)) {
          const entry = grouped.get(member.championId) ?? { id: member.championId, name: member.champion.name, rarities: [] };
          if (!entry.rarities.includes(member.rarity)) entry.rarities.push(member.rarity);
          grouped.set(entry.id, entry);
        }
        return [...grouped.values()].map(p => ({ ...p, rarities: p.rarities.sort((a, b) => a - b) })).sort((a, b) => a.id - b.id);
      };
      const owners = membersByRole('OWNER'), required = membersByRole('REQUIRED');
      for (const role of ['OWNER', 'REQUIRED'] as const) {
        const self = (role === 'OWNER' ? owners : required).find(member => member.id === champion.id);
        const partners = (role === 'OWNER' ? required : owners).filter(member => member.id !== champion.id);
        if (!self || !partners.length) continue;
        const key = `${synergy.id}:${role}`;
        const context = { key, sourceHash: synergy.sourceHash, championRole: role, championRarities: self.rarities,
          partners, targetTags: [...synergy.targetTags].sort(), unique: synergy.unique };
        const text = `Synergy: ${plainText(synergy.name)}\n${plainText(synergy.description)}\n` +
          `Owners: ${owners.map(m => `${m.name} (${m.rarities.join('/')} star)`).join('; ')}\n` +
          `Required partners: ${required.map(m => `${m.name} (${m.rarities.join('/')} star)`).join('; ')}\n` +
          `Target tags: ${context.targetTags.join(', ') || '(none)'}\nUnique (does not stack): ${synergy.unique}`;
        documents.push({ id: `synergy:${key}`, kind: 'synergy', title: plainText(synergy.name), text,
          origin: `GameSynergy:${synergy.id}`, synergy: context });
      }
    }
    const content: Omit<ChampionEnrichmentInput, 'inputHash'> = { schemaVersion: 1, id: champion.id, name: champion.name,
      slug: champion.slug, gameId: champion.gameId, documents,
      existingLinks: champion.abilities.map(link => ({ id: link.id, abilityId: link.abilityId, name: link.ability.name,
        type: link.type, source: link.source, effectForm: link.effectForm, effectDirection: link.effectDirection,
        synergyChampionIds: link.synergyChampions.map(s => s.championId).sort((a, b) => a - b) })) };
    return { ...content, inputHash: hashChampionInput(content) };
  });
}
async function snapshot(db: PrismaClient) {
  const data = await db.$transaction(async tx => {
    const abilities = await tx.ability.findMany({ select: { id: true, name: true, description: true, gameGlossaryTermId: true }, orderBy: { id: 'asc' } });
    const champions = await loadInputs(tx, selectIds());
    return { schemaVersion: 1 as const, createdAt: new Date().toISOString(), catalogHash: artifactHash(abilities), abilities, champions };
  }, { isolationLevel: 'RepeatableRead', timeout: 120000 });
  if (!data.champions.length) throw new Error('No playable champions selected.');
  if (fs.existsSync(filePath('manifest.json'))) throw new Error('Run already exists; use a new output directory.');
  writeNew(filePath('snapshot.json'), data);
  writeNew(filePath('catalog.json'), data.abilities);
  for (const champion of data.champions) writeNew(filePath('inputs', `${champion.id}.json`), champion);
  writeNew(filePath('manifest.json'), { schemaVersion: 1, createdAt: data.createdAt, snapshotHash: artifactHash(data), catalogHash: data.catalogHash,
    champions: data.champions.map(({ id, name, inputHash }) => ({ id, name, inputHash })) });
  console.log(JSON.stringify({ runDir, champions: data.champions.length, abilities: data.abilities.length,
    documents: data.champions.reduce((sum, c) => sum + c.documents.length, 0) }, null, 2));
}
function loadSnapshot(): EnrichmentSnapshot {
  const data = read<EnrichmentSnapshot>(filePath('snapshot.json'));
  const manifest = read<{ snapshotHash: string; catalogHash: string }>(filePath('manifest.json'));
  if (data.schemaVersion !== 1 || artifactHash(data) !== manifest.snapshotHash || artifactHash(data.abilities) !== manifest.catalogHash ||
    artifactHash(read(filePath('catalog.json'))) !== manifest.catalogHash) throw new Error('Snapshot/catalog integrity check failed.');
  for (const input of data.champions) {
    if (hashChampionInput(input) !== input.inputHash || artifactHash(input) !== artifactHash(read(filePath('inputs', `${input.id}.json`)))) throw new Error(`Input integrity check failed: ${input.id}.`);
  }
  return data;
}
function validatedChampion(input: ChampionEnrichmentInput, catalog: CatalogAbility[], requireReview: boolean) {
  const draftFile = filePath('drafts', `${input.id}.json`), reviewFile = filePath('reviews', `${input.id}.json`);
  if (!fs.existsSync(draftFile)) throw new Error(`Missing draft: ${input.id}.`);
  if (requireReview && !fs.existsSync(reviewFile)) throw new Error(`Missing review: ${input.id}.`);
  const policyFile = filePath('removal-policy.json');
  const validated = validateEnrichment(input, catalog, read(draftFile), fs.existsSync(reviewFile) ? read(reviewFile) : undefined,
    fs.existsSync(policyFile) ? read(policyFile) : undefined);
  if (requireReview && validated.review?.decision !== 'approve') throw new Error(`Champion ${input.id} is not approved.`);
  return validated;
}

type SavedLink = Prisma.ChampionAbilityLinkGetPayload<{ include: { ability: { select: { name: true } }; synergyChampions: true } }>;
type Intent = { schemaVersion: 1; championId: number; inputHash: string; draftHash: string; reviewHash: string;
  before: SavedLink[]; beforeHash: string; desiredHash: string };
type Receipt = Intent & { appliedAt: string; after: SavedLink[]; afterHash: string; createdAbilityIds: number[];
  createdAbilitySnapshots?: CreatedAbilitySnapshot[] };
const abilitySnapshotInclude = { categories: { orderBy: { id: 'asc' } }, gameGlossaryTerm: true } satisfies Prisma.AbilityInclude;
const savedLinks = (db: Prisma.TransactionClient, championId: number) => db.championAbilityLink.findMany({ where: { championId },
  include: { ability: { select: { name: true } }, synergyChampions: { orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } });
async function lockChampionEffects(db: Prisma.TransactionClient, championId: number) {
  // Parent locking also blocks noncooperating FK inserts while the reviewed state is checked/applied/restored.
  await db.$queryRaw`SELECT "id" FROM "Champion" WHERE "id" = ${championId} FOR UPDATE`;
  await db.$queryRaw`SELECT "id" FROM "ChampionAbilityLink" WHERE "championId" = ${championId} ORDER BY "id" FOR UPDATE`;
  await db.$queryRaw`SELECT synergy."id" FROM "ChampionAbilitySynergy" synergy
    JOIN "ChampionAbilityLink" link ON link."id" = synergy."championAbilityLinkId"
    WHERE link."championId" = ${championId} ORDER BY synergy."id" FOR UPDATE OF synergy`;
}
function semanticHash(effects: Array<ExistingEffectLink | EffectCandidate | SavedLink>): string {
  const values = effects.map(effect => ({ name: 'ability' in effect ? effect.ability.name : effect.name, type: effect.type,
    source: effect.source, effectForm: effect.effectForm, effectDirection: effect.effectDirection,
    synergyChampionIds: ('synergyChampions' in effect ? effect.synergyChampions.map(s => s.championId) : effect.synergyChampionIds).slice().sort((a, b) => a - b) }));
  return artifactHash(values.sort((a, b) => canonicalSort(a).localeCompare(canonicalSort(b))));
}
const canonicalSort = (value: unknown) => artifactHash(value);
async function ensureBackup(db: PrismaClient) {
  const backupFile = filePath('backup.json'), backupManifestFile = filePath('backup-manifest.json');
  if (fs.existsSync(backupFile)) {
    const manifest = read<{ hash: string; databaseIdentity: string; identityVersion?: number }>(backupManifestFile);
    if (!matchesBackupDatabaseIdentity(process.env.DATABASE_URL!, manifest) || manifest.hash !== artifactHash(read(backupFile))) throw new Error('Backup identity/integrity check failed.');
    return;
  }
  const backup = await db.$transaction(async tx => ({ schemaVersion: 1, createdAt: new Date().toISOString(),
    abilities: await tx.ability.findMany({ orderBy: { id: 'asc' } }),
    links: await tx.championAbilityLink.findMany({ orderBy: { id: 'asc' } }),
    synergies: await tx.championAbilitySynergy.findMany({ orderBy: { id: 'asc' } }),
  }), { isolationLevel: 'RepeatableRead', timeout: 120000 });
  writeNew(backupFile, backup);
  writeNew(backupManifestFile, { hash: artifactHash(backup), databaseIdentity: databaseConnectionIdentity(process.env.DATABASE_URL!), identityVersion: 2 });
}
async function createEffect(db: Prisma.TransactionClient, championId: number, effect: EffectCandidate) {
  let ability = await db.ability.findFirst({ where: { name: { equals: effect.name, mode: 'insensitive' } } });
  if (ability && ability.name !== effect.name) throw new Error(`Catalog changed: canonical name is ${ability.name}.`);
  if (effect.abilityId && ability?.id !== effect.abilityId) throw new Error('Catalog ability identity changed.');
  let createdAbility: CreatedAbilitySnapshot | undefined;
  if (!ability) {
    const created = await db.ability.create({ data: { name: effect.name, description: '' }, include: abilitySnapshotInclude });
    ability = created;
    const snapshot: unknown = JSON.parse(JSON.stringify(created));
    createdAbility = { id: created.id, snapshot, snapshotHash: artifactHash(snapshot) };
  }
  const link = await db.championAbilityLink.create({ data: { championId, abilityId: ability.id, type: effect.type,
    source: effect.source, effectForm: effect.effectForm, effectDirection: effect.effectDirection } });
  if (effect.synergyChampionIds.length) await db.championAbilitySynergy.createMany({
    data: effect.synergyChampionIds.map(id => ({ championAbilityLinkId: link.id, championId: id })),
  });
  return createdAbility;
}
async function apply(db: PrismaClient) {
  assertLocalDatabase(process.env.DATABASE_URL);
  const data = loadSnapshot(), selected = selectIds();
  const inputs = data.champions.filter(c => !selected || selected.has(c.id));
  if (selected && inputs.length !== selected.size) throw new Error('Selected champion is outside this snapshot.');
  // Validate every selected artifact before the first write. No partial run due to a missing review.
  const approved = inputs.map(input => ({ input, validated: validatedChampion(input, data.abilities, true) }));
  await ensureBackup(db);
  let applied = 0, skipped = 0;
  for (const { input, validated } of approved) {
    const intentFile = filePath('intents', `${input.id}.json`), receiptFile = filePath('receipts', `${input.id}.json`);
    if (fs.existsSync(filePath('restored', `${input.id}.json`))) throw new Error(`Champion ${input.id} was restored. Start a new run to reapply.`);
    const draftHash = artifactHash(validated.draft), reviewHash = artifactHash(validated.review);
    if (fs.existsSync(receiptFile)) {
      const receipt = read<Receipt>(receiptFile);
      if (receipt.draftHash !== draftHash || receipt.reviewHash !== reviewHash || artifactHash(await savedLinks(db, input.id)) !== receipt.afterHash) {
        throw new Error(`Applied champion ${input.id} changed; refusing to overwrite.`);
      }
      skipped++; continue;
    }
    const result = await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(718264, ${input.id}::int)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(718263, 1)`;
      // Acquire row locks after the importer lock. ReadCommitted then sees the import that may have just finished.
      await lockChampionEffects(tx, input.id);
      const before = await savedLinks(tx, input.id), desiredHash = semanticHash(validated.effects);
      let intent: Intent;
      if (fs.existsSync(intentFile)) {
        intent = read<Intent>(intentFile);
        if (intent.draftHash !== draftHash || intent.reviewHash !== reviewHash || intent.desiredHash !== desiredHash || artifactHash(intent.before) !== intent.beforeHash) {
          throw new Error('Pending intent differs from approved artifacts.');
        }
        // Recover a committed transaction whose receipt write was interrupted.
        if (semanticHash(before) === intent.desiredHash) {
          const attemptDir = filePath('attempts', String(input.id));
          const attempt = fs.existsSync(attemptDir) ? fs.readdirSync(attemptDir).map(name => read<Receipt>(path.join(attemptDir, name)))
            .find(item => item.afterHash === artifactHash(before) && item.draftHash === draftHash && item.reviewHash === reviewHash) : undefined;
          if (attempt) return attempt;
          if (artifactHash(before) !== intent.beforeHash) throw new Error('Committed application is missing its recovery journal.');
          return { ...intent, appliedAt: new Date().toISOString(), after: before, afterHash: artifactHash(before), createdAbilityIds: [], createdAbilitySnapshots: [] };
        }
        if (artifactHash(before) !== intent.beforeHash) throw new Error(`Pending champion ${input.id} has unexpected database changes.`);
        const live = (await loadInputs(tx, new Set([input.id])))[0];
        if (!live || live.inputHash !== input.inputHash) throw new Error(`Champion ${input.id} mechanics changed since pending intent.`);
      } else {
        const live = (await loadInputs(tx, new Set([input.id])))[0];
        if (!live || live.inputHash !== input.inputHash) throw new Error(`Champion ${input.id} changed since snapshot.`);
        intent = { schemaVersion: 1, championId: input.id, inputHash: input.inputHash, draftHash, reviewHash,
          before, beforeHash: artifactHash(before), desiredHash };
        writeNew(intentFile, intent);
      }
      const createdAbilityIds: number[] = [];
      const createdAbilitySnapshots: CreatedAbilitySnapshot[] = [];
      // Remove changed identities first, so valid swaps/splits cannot hit transient unique-index collisions.
      await tx.championAbilityLink.deleteMany({ where: { id: { in: validated.draft.dispositions.filter(d => d.action !== 'preserve').map(d => d.linkId) } } });
      for (const disposition of validated.draft.dispositions) {
        if (disposition.action === 'update') {
          const original = before.find(link => link.id === disposition.linkId)!;
          const { ability: _, synergyChampions, ...originalData } = original;
          await tx.championAbilityLink.create({ data: { ...originalData, source: disposition.source,
            effectForm: disposition.effectForm, effectDirection: disposition.effectDirection } });
          if (synergyChampions.length) await tx.championAbilitySynergy.createMany({ data: synergyChampions });
        } else if (disposition.action === 'replace') for (const replacement of disposition.replacements) {
          const created = await createEffect(tx, input.id, replacement);
          if (created) { createdAbilityIds.push(created.id); createdAbilitySnapshots.push(created); }
        }
      }
      for (const addition of validated.draft.additions) {
        const created = await createEffect(tx, input.id, addition);
        if (created) { createdAbilityIds.push(created.id); createdAbilitySnapshots.push(created); }
      }
      const after = await savedLinks(tx, input.id);
      if (semanticHash(after) !== desiredHash) throw new Error('Applied state differs from approved plan.');
      const attempt: Receipt = { ...intent, appliedAt: new Date().toISOString(), after, afterHash: artifactHash(after), createdAbilityIds, createdAbilitySnapshots };
      writeNew(filePath('attempts', String(input.id), `${Date.now()}-${randomUUID()}.json`), attempt);
      return attempt;
    }, { isolationLevel: 'ReadCommitted', maxWait: 15000, timeout: 120000 });
    writeNew(receiptFile, result); applied++;
    console.log(JSON.stringify({ championId: input.id, name: input.name, status: 'applied' }));
  }
  console.log(JSON.stringify({ applied, skipped }));
}
async function restore(db: PrismaClient) {
  assertLocalDatabase(process.env.DATABASE_URL);
  loadSnapshot();
  if (!fs.existsSync(filePath('backup.json'))) throw new Error('Original backup is missing.');
  await ensureBackup(db);
  const selected = selectIds(), receiptDir = filePath('receipts');
  const receiptNames = fs.existsSync(receiptDir) ? fs.readdirSync(receiptDir).filter(name => /^\d+\.json$/.test(name)) : [];
  const allReceipts = receiptNames.map(name => read<Receipt>(path.join(receiptDir, name)));
  const numberedChildren = (directory: string, pattern: RegExp) => fs.existsSync(directory)
    ? fs.readdirSync(directory).filter(name => pattern.test(name)).map(name => Number(name.replace(/\.json$/, ''))) : [];
  const pending = unresolvedRestoreChampionIds(numberedChildren(filePath('intents'), /^\d+\.json$/),
    numberedChildren(filePath('attempts'), /^\d+$/), allReceipts.map(receipt => receipt.championId), selected);
  if (pending.length) throw new Error(`Restore refused before any changes: unresolved application journals for champions ${pending.join(', ')}. Run apply with '--champion-ids=${pending.join(',')}' to recover their receipts, then retry restore.`);
  if (!allReceipts.length) throw new Error('No application receipts found.');
  const receipts = allReceipts.filter(receipt => !selected || selected.has(receipt.championId));
  if (selected && selected.size !== receipts.length) throw new Error('A selected champion has no application receipt.');
  for (const receipt of receipts) {
    const restoredFile = filePath('restored', `${receipt.championId}.json`);
    if (fs.existsSync(restoredFile)) {
      const restored = read<{ restoredHash: string }>(restoredFile);
      if (artifactHash(await savedLinks(db, receipt.championId)) !== restored.restoredHash) throw new Error('Previously restored champion has changed.');
      continue;
    }
    await db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(718264, ${receipt.championId}::int)`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock_shared(718263, 1)`;
      await lockChampionEffects(tx, receipt.championId);
      const current = await savedLinks(tx, receipt.championId);
      if (artifactHash(receipt.before) !== receipt.beforeHash || artifactHash(receipt.after) !== receipt.afterHash) throw new Error('Receipt integrity check failed.');
      // Idempotent recovery if a previous restore committed before its receipt was written.
      if (artifactHash(current) === receipt.beforeHash) return;
      if (artifactHash(current) !== receipt.afterHash) throw new Error(`Champion ${receipt.championId} changed after application; restore refused.`);
      await tx.championAbilityLink.deleteMany({ where: { championId: receipt.championId } });
      for (const original of receipt.before) {
        const { ability: _, synergyChampions, ...data } = original;
        await tx.championAbilityLink.create({ data });
        if (synergyChampions.length) await tx.championAbilitySynergy.createMany({ data: synergyChampions });
      }
    }, { isolationLevel: 'ReadCommitted', maxWait: 15000, timeout: 120000 });
    writeNew(restoredFile, { restoredAt: new Date().toISOString(), restoredHash: receipt.beforeHash, championId: receipt.championId });
    console.log(JSON.stringify({ championId: receipt.championId, status: 'restored' }));
  }
  // Use provenance from the whole run: A may create an effect that B reuses and restores later.
  // Require an unchanged full scalar/category/glossary snapshot; old receipts conservatively retain catalog entries.
  const runAbilityIds = new Set(allReceipts.flatMap(receipt => receipt.createdAbilitySnapshots?.map(item => item.id) ?? []));
  for (const id of runAbilityIds) await db.$transaction(async tx => {
    // Block scalar edits and new FK-backed links/category assignments before reading the cleanup snapshot.
    await tx.$queryRaw`SELECT "id" FROM "Ability" WHERE "id" = ${id} FOR UPDATE`;
    const ability = await tx.ability.findUnique({ where: { id }, include: { ...abilitySnapshotInclude, _count: { select: { champions: true } } } });
    if (!ability) return;
    const { _count, ...content } = ability;
    const eligible = unchangedCreatedAbilityIds(allReceipts, [{ id, snapshot: JSON.parse(JSON.stringify(content)), inUse: _count.champions > 0 }]);
    if (eligible.length) await tx.ability.deleteMany({ where: { id, champions: { none: {} } } });
  }, { isolationLevel: 'ReadCommitted', maxWait: 15000, timeout: 30000 });
}

async function main() {
  if (command === 'validate') {
    const data = loadSnapshot(), selected = selectIds();
    const inputs = data.champions.filter(c => !selected || selected.has(c.id));
    if (selected && selected.size !== inputs.length) throw new Error('Selected champion is outside this snapshot.');
    const errors: string[] = [], missing: number[] = []; let valid = 0, present = 0, approved = 0;
    for (const input of inputs) {
      if (!fs.existsSync(filePath('drafts', `${input.id}.json`))) { missing.push(input.id); continue; }
      present++;
      try { const result = validatedChampion(input, data.abilities, process.argv.includes('--require-review')); valid++; if (result.review?.decision === 'approve') approved++; }
      catch (error) { errors.push(`${input.id} ${input.name}: ${error instanceof Error ? error.message : error}`); }
    }
    if (process.argv.includes('--require-complete') && missing.length) errors.push(`Missing ${missing.length} champion drafts.`);
    console.log(JSON.stringify({ expected: inputs.length, present, valid, approved, missing, errors }, null, 2));
    if (errors.length) process.exitCode = 1;
    return;
  }
  if (!['snapshot', 'apply', 'restore'].includes(command)) throw new Error('Usage: pnpm exec tsx src/scripts/champion-effect-enrichment.ts snapshot|validate|apply|restore --run-dir=PATH [--champion-ids=1,2] [--require-review] [--require-complete]');
  const db = new PrismaClient();
  try { if (command === 'snapshot') await snapshot(db); else if (command === 'apply') await apply(db); else await restore(db); } finally { await db.$disconnect(); }
}
export { apply, restore };
if (require.main === module) main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
