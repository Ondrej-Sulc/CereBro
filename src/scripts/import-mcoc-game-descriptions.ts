import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  importMcocGameDescriptions,
  parseMcocGameDescriptionsJson,
  parseMcocGameGlossaryJson,
} from '../services/mcocGameDescriptionsImportService';

const DEFAULT_SCRIPTS_DIR = 'C:\\Games\\Marvel Contest of Champions\\default\\game\\Scripts';

function readArg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

async function main() {
  const championsPath = readArg('champions', path.join(DEFAULT_SCRIPTS_DIR, 'champions.json'));
  const glossaryPath = readArg('glossary', path.join(DEFAULT_SCRIPTS_DIR, 'glossary.json'));
  const write = process.argv.includes('--write');

  const descriptions = parseMcocGameDescriptionsJson(fs.readFileSync(championsPath, 'utf8'));
  const glossary = parseMcocGameGlossaryJson(fs.readFileSync(glossaryPath, 'utf8'));

  const prisma = new PrismaClient();
  try {
    const report = await importMcocGameDescriptions(prisma, descriptions, glossary, { write });

    console.log(`Mode: ${write ? 'write' : 'dry-run'}`);
    console.log(`Champions in file: ${report.championCount}`);
    console.log(`Champions matched: ${report.matched}`);
    console.log(`Text records: ${report.textRecords}`);
    console.log(`Glossary terms: ${report.glossaryTerms}`);
    console.log(`Skipped: ${report.unmatched.length}`);
    console.log(`Ambiguous: ${report.ambiguous.length}`);
    console.log(`Conflicts: ${report.conflicts.length}`);

    if (report.written) {
      console.log(`Text records deleted: ${report.written.textRecordsDeleted}`);
      console.log(`Text records created: ${report.written.textRecordsCreated}`);
      console.log(`Glossary terms upserted: ${report.written.glossaryTermsUpserted}`);
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

    if (write && !report.canWrite) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
