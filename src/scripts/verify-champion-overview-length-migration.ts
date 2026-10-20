import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import postgres from 'postgres';

// Explicit, local-only integration check. Never writes application tables.
// Run: pnpm exec tsx src/scripts/verify-champion-overview-length-migration.ts
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
    throw new Error('Migration verification requires a local PostgreSQL database.');
  }
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  const schema = `champion_length_test_${randomUUID().replaceAll('-', '')}`;
  const migrationDir = path.resolve('prisma/migrations/20261020010000_scope_overview_summary_lengths');
  const manifest = JSON.parse(await fs.readFile(path.join(migrationDir, 'allowances.json'), 'utf8')) as {
    allowances: Array<{ originalLocalLinkId: number; partnerSlugs: string[] }>;
  };
  const ids = manifest.allowances.map(entry => entry.originalLocalLinkId);
  let checks = 0;
  try {
    await sql.unsafe(`CREATE SCHEMA "${schema}"`);
    await sql.unsafe(`SET search_path TO "${schema}", public`);
    await sql.unsafe(`
      CREATE TABLE "Champion" (id integer PRIMARY KEY, slug text);
      CREATE TABLE "Ability" (id integer PRIMARY KEY, name text);
      CREATE TABLE "ChampionAbilityLink" (id integer PRIMARY KEY, "championId" integer,
        "abilityId" integer, type text, source text, "effectForm" text, "effectDirection" text);
      CREATE TABLE "ChampionAbilitySynergy" ("championAbilityLinkId" integer, "championId" integer);
      CREATE TABLE "ChampionAbilityOverview" ("championAbilityLinkId" integer PRIMARY KEY, text text NOT NULL,
        CONSTRAINT "ChampionAbilityOverview_text_length" CHECK (char_length(text) BETWEEN 1 AND 360));
    `);
    // The migration must also work before an agent imports the champion data.
    await sql.unsafe(await fs.readFile(path.join(migrationDir, 'migration.sql'), 'utf8')).simple();
    checks++;
    await sql.unsafe(`INSERT INTO "${schema}"."Champion" SELECT id + 1000000, slug FROM public."Champion"`);
    await sql.unsafe(`INSERT INTO "${schema}"."Ability" SELECT id + 2000000, name FROM public."Ability"`);
    await sql.unsafe(`INSERT INTO "${schema}"."ChampionAbilityLink"
      SELECT id + 3000000, "championId" + 1000000, "abilityId" + 2000000,
        type::text, source, "effectForm"::text, "effectDirection"::text
      FROM public."ChampionAbilityLink" WHERE id = ANY($1::integer[])`, [ids]);
    await sql.unsafe(`INSERT INTO "${schema}"."ChampionAbilitySynergy"
      SELECT "championAbilityLinkId" + 3000000, "championId" + 1000000
      FROM public."ChampionAbilitySynergy" WHERE "championAbilityLinkId" = ANY($1::integer[])`, [ids]);
    const limits = await sql<{ maximum: number }[]>`
      SELECT champion_overview_text_limit(id, ${schema}) AS maximum FROM "ChampionAbilityLink"`;
    assert.equal(limits.length, 68);
    assert.ok(limits.every(row => row.maximum === 1000));
    checks += 68;

    const insert = (id: number, text: string) => sql`
      INSERT INTO "ChampionAbilityOverview" VALUES (${id}, ${text})
      ON CONFLICT ("championAbilityLinkId") DO UPDATE SET text = EXCLUDED.text`;
    const refused = async (id: number, text: string) => {
      await assert.rejects(insert(id, text), (error: unknown) =>
        error instanceof postgres.PostgresError && error.code === '23514');
      checks++;
    };
    const id = ids[0] + 3000000;
    for (const length of [1, 360, 361, 1000]) { await insert(id, 'x'.repeat(length)); checks++; }
    await refused(id, '');
    await refused(id, 'x'.repeat(1001));
    // Copying an approved local numeric ID alone grants no allowance.
    await sql`INSERT INTO "ChampionAbilityLink" (id, source) VALUES (${ids[0]}, 'unapproved')`;
    await insert(ids[0], 'x'.repeat(360)); checks++;
    await refused(ids[0], 'x'.repeat(361));

    // Changing any part of the approved source identity must refuse a long write.
    for (const assignment of [
      'source = source || \' changed\'', '"championId" = -1', '"abilityId" = -1',
      'type = \'NOT_AUTHORIZED\'', '"effectForm" = \'NOT_AUTHORIZED\'', '"effectDirection" = \'NOT_AUTHORIZED\'',
    ]) {
      await sql.begin(async tx => {
        await tx.unsafe(`UPDATE "${schema}"."ChampionAbilityLink" SET ${assignment} WHERE id = $1`, [id]);
        const [row] = await tx`SELECT champion_overview_text_limit(${id}, ${schema}) AS maximum`;
        assert.equal(row.maximum, 360);
        // Roll the isolated mutation back so the next check starts at the same identity.
        throw new Error('verified-rollback');
      }).catch(error => { if (error.message !== 'verified-rollback') throw error; });
      checks++;
    }
    const withPartner = manifest.allowances.find(entry => entry.partnerSlugs.length);
    assert.ok(withPartner, 'Include an authorized synergy to exercise partner binding.');
    const partnerId = withPartner.originalLocalLinkId + 3000000;
    await sql`DELETE FROM "ChampionAbilitySynergy" WHERE "championAbilityLinkId" = ${partnerId}`;
    await refused(partnerId, 'x'.repeat(361));
    const withoutPartner = manifest.allowances.find(entry => !entry.partnerSlugs.length)!;
    const noPartnerId = withoutPartner.originalLocalLinkId + 3000000;
    await sql`INSERT INTO "ChampionAbilitySynergy" VALUES (${noPartnerId}, -1)`;
    await refused(noPartnerId, 'x'.repeat(361));
    // Missing partner rows must not disappear from the identity query.
    console.log(JSON.stringify({ checks, authorizedIdentities: limits.length, remappedIds: true, applicationWrites: 0 }));
  } finally {
    await sql.unsafe('RESET search_path');
    // Generated, validated identifier; never a user path or application schema.
    assert.match(schema, /^champion_length_test_[a-f0-9]{32}$/);
    await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await sql.end();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
