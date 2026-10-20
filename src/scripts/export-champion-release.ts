import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { artifactHash } from '../domain/champion-effect-enrichment';
import { overviewSourceHash } from '../domain/champion-overview-summary';

// A local, read-only handoff for an agent-led data promotion. This is not an
// importer and cannot change either database. Keep user/alliance tables out.
async function main() {
  const outputArg = process.argv.slice(2).find(arg => arg.startsWith('--output='));
  if (!outputArg) throw new Error('Usage: pnpm exec tsx src/scripts/export-champion-release.ts --output=<new-directory>');
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
    throw new Error('The release source must be the local database.');
  }
  if ((new URL(url).searchParams.get('schema') ?? 'public') !== 'public') {
    throw new Error('The catalog release expects the project public schema.');
  }
  const output = path.resolve(outputArg.slice('--output='.length));
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.mkdir(output); // Refuse to overwrite an existing handoff.
  await fs.writeFile(path.join(output, 'INCOMPLETE'), 'Do not promote until manifest.json and all file hashes verify.\n');
  const db = new PrismaClient();
  try {
    const snapshot = await db.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      const data = {
        abilityCategories: await tx.abilityCategory.findMany({ orderBy: { id: 'asc' } }),
        glossaryTerms: await tx.gameGlossaryTerm.findMany({ orderBy: { id: 'asc' } }),
        abilities: await tx.ability.findMany({ orderBy: { id: 'asc' }, include: { categories: { select: { id: true }, orderBy: { id: 'asc' } } } }),
        tags: await tx.tag.findMany({ orderBy: { id: 'asc' } }),
        champions: await tx.champion.findMany({ orderBy: { id: 'asc' }, include: { tags: { select: { id: true }, orderBy: { id: 'asc' } } } }),
        prestige: await tx.championPrestige.findMany({ orderBy: { id: 'asc' } }),
        stats: await tx.championStats.findMany({ orderBy: { id: 'asc' } }),
        abilityTexts: await tx.championAbilityText.findMany({ orderBy: { id: 'asc' } }),
        abilityCurves: await tx.championAbilityCurve.findMany({ orderBy: { id: 'asc' } }),
        gameSynergies: await tx.gameSynergy.findMany({ orderBy: { id: 'asc' } }),
        gameSynergyMembers: await tx.gameSynergyMember.findMany({ orderBy: [{ synergyId: 'asc' }, { role: 'asc' }, { tierId: 'asc' }] }),
        effectApplications: await tx.championAbilityLink.findMany({ orderBy: { id: 'asc' } }),
        effectPartners: await tx.championAbilitySynergy.findMany({ orderBy: { id: 'asc' } }),
        overviews: await tx.championAbilityOverview.findMany({ orderBy: { championAbilityLinkId: 'asc' } }),
        attacks: await tx.attack.findMany({ orderBy: { id: 'asc' } }),
        hits: await tx.hit.findMany({ orderBy: { id: 'asc' } }),
      };
      const abilities = new Map(data.abilities.map(ability => [ability.id, ability.name]));
      const sources = new Map(data.effectApplications.map(link => [link.id, {
        ...link, name: abilities.get(link.abilityId)!,
        synergyChampionIds: data.effectPartners.filter(partner => partner.championAbilityLinkId === link.id).map(partner => partner.championId),
      }]));
      const stale = data.overviews.filter(row => {
        const source = sources.get(row.championAbilityLinkId);
        return !source || overviewSourceHash(source) !== row.sourceHash;
      });
      if (stale.length) throw new Error(`${stale.length} stale overview source bindings; release refused.`);
      const limits = await tx.$queryRaw<Array<{ id: number; maximum: number }>>`
        SELECT id, champion_overview_text_limit(id, 'public') AS maximum FROM "ChampionAbilityLink" ORDER BY id`;
      const maxima = new Map(limits.map(row => [row.id, row.maximum]));
      if (data.overviews.some(row => [...row.text].length > (maxima.get(row.championAbilityLinkId) ?? 360))) {
        throw new Error('Overview exceeds its database-authorized length.');
      }
      const constraints = await tx.$queryRaw<Array<{ name: string; definition: string }>>`
        SELECT conname AS name, pg_get_constraintdef(oid) AS definition FROM pg_constraint
        WHERE conrelid = 'public."ChampionAbilityOverview"'::regclass AND contype = 'c'`;
      const triggers = await tx.$queryRaw<Array<{ name: string; enabled: string; definition: string }>>`
        SELECT tgname AS name, tgenabled::text AS enabled, pg_get_triggerdef(oid) AS definition
        FROM pg_trigger WHERE tgrelid = 'public."ChampionAbilityOverview"'::regclass AND NOT tgisinternal`;
      if (!triggers.some(trigger => trigger.name === 'ChampionAbilityOverview_scoped_text_length'
        && ['O', 'A'].includes(trigger.enabled))) throw new Error('Scoped length trigger is not enabled.');
      return { data, checks: { staleOverviews: stale.length,
        playableChampions: data.champions.filter(champion => champion.isPlayable).length,
        overviews: data.overviews.length,
        longOverviews: data.overviews.filter(row => [...row.text].length > 360).length,
        authorizedLongSources: limits.filter(row => row.maximum === 1000).length,
        maximumOverviewLength: Math.max(0, ...data.overviews.map(row => [...row.text].length)), constraints, triggers } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120000 });

    const files = [];
    for (const [name, rows] of Object.entries(snapshot.data)) {
      const serialized = JSON.stringify(rows);
      const file = `${name}.json`;
      await fs.writeFile(path.join(output, file), serialized + '\n');
      const bytes = await fs.readFile(path.join(output, file));
      const reread: unknown[] = JSON.parse(bytes.toString('utf8'));
      if (reread.length !== rows.length || artifactHash(reread) !== artifactHash(JSON.parse(serialized))) {
        throw new Error(`Release round-trip verification failed: ${file}`);
      }
      files.push({ file, rows: rows.length, bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), contentHash: artifactHash(reread) });
    }
    const allowanceBytes = await fs.readFile('prisma/migrations/20261020010000_scope_overview_summary_lengths/allowances.json');
    await fs.writeFile(path.join(output, 'length-allowances.json'), allowanceBytes);
    files.push({ file: 'length-allowances.json', rows: 68, bytes: allowanceBytes.length,
      sha256: createHash('sha256').update(allowanceBytes).digest('hex'), contentHash: artifactHash(JSON.parse(allowanceBytes.toString('utf8'))) });
    const manifest = { schemaVersion: 1, createdAt: new Date().toISOString(), source: 'local-read-only-repeatable-read',
      purpose: 'Agent-led champion catalog promotion; map identities before writing. See docs/champion-data-release.md.',
      missingOverviewMeans: 'No stored display copy; never manufacture a summary or infer review status from absence.',
      checks: snapshot.checks, files };
    const manifestText = JSON.stringify(manifest, null, 2) + '\n';
    await fs.writeFile(path.join(output, 'manifest.json'), manifestText);
    await fs.unlink(path.join(output, 'INCOMPLETE'));
    console.log(JSON.stringify({ output, manifestSha256: createHash('sha256').update(manifestText).digest('hex'), checks: snapshot.checks, files: files.length }));
  } finally { await db.$disconnect(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
