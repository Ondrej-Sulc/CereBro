import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  importMcocSigPrestige,
  McocSigPrestigeImportReport,
  parseMcocSigPrestigeJson,
} from '../services/mcocSigPrestigeImportService';

const prisma = new PrismaClient();

const DEFAULT_INPUT_PATH =
  'C:\\Games\\Marvel Contest of Champions\\default\\game\\Scripts\\mcoc_sig_prestige.json';

function parseArgs() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const inputArg = args.find(arg => !arg.startsWith('--'));
  return {
    inputPath: path.resolve(inputArg ?? DEFAULT_INPUT_PATH),
    write,
  };
}

function printList(title: string, values: string[], limit = 25) {
  console.log(`${title}: ${values.length}`);
  for (const value of values.slice(0, limit)) {
    console.log(`  - ${value}`);
  }
  if (values.length > limit) console.log(`  ... ${values.length - limit} more`);
}

function printReport(report: McocSigPrestigeImportReport) {
  console.log(`Schema version: ${report.schemaVersion}`);
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Champions: ${report.championCount}`);
  console.log(`Tiers: ${report.tierCount}`);
  console.log(`Input sig rows: ${report.inputSigRows}`);
  console.log(`Matched champions: ${report.matched}`);
  printList('Unmatched champions', report.unmatched);
  printList('Ambiguous matches', report.ambiguous);
  printList('Game ID conflicts', report.conflicts);
  console.log(`Sig 0 baseline rows from ChampionStats: ${report.baselineRows}`);
  console.log(`Max-sig endpoint rows: ${report.maxSigRows}`);
  console.log(`Skipped rows: ${report.skippedRows}`);
  console.log(`Can write: ${report.canWrite ? 'yes' : 'no'}`);
  if (report.written) {
    console.log(`ChampionPrestige sig 0 rows upserted: ${report.written.upsertedBaselineRows}`);
    console.log(`ChampionPrestige max-sig rows upserted: ${report.written.upsertedMaxSigRows}`);
  }
}

async function main() {
  const { inputPath, write } = parseArgs();

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const data = parseMcocSigPrestigeJson(fs.readFileSync(inputPath, 'utf-8'));
  const report = await importMcocSigPrestige(prisma, data, { write });

  console.log(`Input: ${inputPath}`);
  console.log(`Mode: ${write ? 'write' : 'dry-run'}`);
  printReport(report);

  if (!write) {
    console.log('Dry-run only. Re-run with --write after reviewing the report. Unmatched champions are skipped on write.');
  }
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
