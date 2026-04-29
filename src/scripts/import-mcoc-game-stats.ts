import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  importMcocGameStats,
  McocGameStatsImportReport,
  parseMcocGameStatsJson,
} from '../services/mcocGameStatsImportService';

const prisma = new PrismaClient();

const DEFAULT_INPUT_PATH =
  'C:\\Games\\Marvel Contest of Champions\\default\\game\\Scripts\\mcoc_game_stats.json';

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

function printReport(report: McocGameStatsImportReport) {
  console.log(`Schema version: ${report.schemaVersion}`);
  console.log(`Generated at: ${report.generatedAt}`);
  console.log(`Champions: ${report.championCount}`);
  console.log(`Tiers: ${report.tierCount}`);
  console.log(`Rank rows: ${report.rankCount}`);
  console.log(`Matched champions: ${report.matched}`);
  console.log(`Match methods: ${JSON.stringify(report.methods)}`);
  printList('Unmatched champions', report.unmatched);
  printList('Ambiguous matches', report.ambiguous);
  printList('Game ID conflicts', report.conflicts);
  printList('Champion.gameId values to set', report.gameIdsToSet);
  printList('Name mismatches for review', report.nameMismatches);
  console.log(`Prestige delta distribution: ${JSON.stringify(report.prestigeDeltas)}`);
  console.log(`Can write: ${report.canWrite ? 'yes' : 'no'}`);
  if (report.written) {
    console.log(`Champion.gameId values updated: ${report.written.updatedChampions}`);
    console.log(`ChampionStats rows upserted: ${report.written.upsertedStats}`);
  }
}

async function main() {
  const { inputPath, write } = parseArgs();

  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  const data = parseMcocGameStatsJson(fs.readFileSync(inputPath, 'utf-8'));
  const report = await importMcocGameStats(prisma, data, { write });

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
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
