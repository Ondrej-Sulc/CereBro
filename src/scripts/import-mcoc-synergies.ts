import 'dotenv/config';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { importMcocSynergies, parseMcocSynergiesJson } from '../services/mcocSynergiesImportService';

async function main() {
  const file = process.argv.find(arg => arg.startsWith('--file='))?.slice(7);
  if (!file) throw new Error('Usage: pnpm import:mcoc-synergies -- --file=mcoc_synergies.json [--write]');
  const data = parseMcocSynergiesJson(fs.readFileSync(file, 'utf8'));
  const prisma = new PrismaClient();
  try {
    const write = process.argv.includes('--write');
    const report = await importMcocSynergies(prisma, data, { write });
    console.log(JSON.stringify({ mode: write ? 'write' : 'dry-run', ...report }, null, 2));
    if (!report.canWrite) process.exitCode = 1;
  } finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
