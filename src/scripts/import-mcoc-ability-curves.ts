import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  importMcocAbilityCurves,
  parseMcocAbilityCurvesJson,
} from '../services/mcocAbilityCurvesImportService';

const DEFAULT_SCRIPTS_DIR = 'C:\\Games\\Marvel Contest of Champions\\default\\game\\Scripts';

function readArg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

async function main() {
  const curvesPath = readArg('curves', path.join(DEFAULT_SCRIPTS_DIR, 'mcoc_ability_curves.json'));
  const write = process.argv.includes('--write');
  const curves = parseMcocAbilityCurvesJson(fs.readFileSync(curvesPath, 'utf8'));

  const prisma = new PrismaClient();
  try {
    const report = await importMcocAbilityCurves(prisma, curves, { write });

    console.log(`Mode: ${write ? 'write' : 'dry-run'}`);
    console.log(`Generated at: ${report.generatedAt}`);
    console.log(`Champions in file: ${report.championCount}`);
    console.log(`Champions matched: ${report.matched}`);
    console.log(`Curve records: ${report.curveCount}`);
    console.log(`Skipped: ${report.unmatched.length}`);
    console.log(`Ambiguous: ${report.ambiguous.length}`);
    console.log(`Conflicts: ${report.conflicts.length}`);

    if (report.written) {
      console.log(`Old signature curves deleted: ${report.written.deletedCurves}`);
      console.log(`Signature curves upserted: ${report.written.upsertedCurves}`);
    }

    if (report.unmatched.length) {
      console.log('\nSkipped champions:');
      for (const item of report.unmatched.slice(0, 80)) console.log(`- ${item}`);
      if (report.unmatched.length > 80) console.log(`... ${report.unmatched.length - 80} more`);
    }
    if (report.ambiguous.length || report.conflicts.length) {
      console.log('\nBlocked matches:');
      for (const item of [...report.ambiguous, ...report.conflicts]) console.log(`- ${item}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
