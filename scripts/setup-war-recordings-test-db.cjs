// Bootstrap only a disposable local database, preserving deployed migration checksums.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const postgres = require('postgres');

async function main() {
  const databaseUrl = process.env.WAR_RECORDINGS_TEST_DATABASE_URL;
  if (!databaseUrl) throw new Error('Set WAR_RECORDINGS_TEST_DATABASE_URL to a disposable local recordings_test database');
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', 'postgres'].includes(url.hostname) || !url.pathname.includes('recordings_test')) {
    throw new Error('Only a local recordings_test database may be initialized');
  }
  if (process.argv.includes('--create-database')) {
    const databaseName = decodeURIComponent(url.pathname.slice(1));
    const adminUrl = new URL(databaseUrl);
    adminUrl.pathname = '/postgres';
    const admin = postgres(adminUrl.toString(), { max: 1 });
    try {
      const existing = await admin`SELECT 1 FROM pg_database WHERE datname = ${databaseName}`;
      if (!existing.length) await admin.unsafe(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
    } finally {
      await admin.end();
    }
  }
  const env = { ...process.env, DATABASE_URL: databaseUrl };
  const runPrisma = (...args) => {
    const result = spawnSync(process.execPath, [require.resolve('prisma/build/index.js'), ...args], { env, stdio: 'inherit' });
    if (result.status !== 0) throw new Error(`Prisma ${args[0]} failed`);
  };
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const [table] = await sql`SELECT to_regclass('public."WarFight"') as existing`;
    if (!table.existing) {
      // 0_init is historically UTF-16. Prisma's SQL runner needs decoded text
      // when creating a brand-new database; leave the original file unchanged.
      const bytes = fs.readFileSync('prisma/migrations/0_init/migration.sql');
      const encoding = bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf16le' : 'utf8';
      await sql.begin(tx => tx.unsafe(bytes.toString(encoding).replace(/^\uFEFF/, '')));
      runPrisma('migrate', 'resolve', '--applied', '0_init');
    }
  } finally {
    await sql.end();
  }
  runPrisma('migrate', 'deploy');
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
