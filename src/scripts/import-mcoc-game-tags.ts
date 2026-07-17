import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  importMcocGameTags,
  parseMcocChampionTagsJson,
  parseMcocGameTagsJson,
  parseMcocHeroTiersJson,
} from '../services/mcocGameTagsImportService';

const DEFAULT_SCRIPTS_DIR = 'C:\\Games\\Marvel Contest of Champions\\default\\game\\Scripts';

function readArg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const arg = process.argv.find(value => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : fallback;
}

async function main() {
  const championsPath = readArg('champions', path.join(DEFAULT_SCRIPTS_DIR, 'champion_display.json'));
  const tagsPath = readArg('tags', path.join(DEFAULT_SCRIPTS_DIR, 'tags.json'));
  const heroTiersPath = readArg('hero-tiers', path.join(DEFAULT_SCRIPTS_DIR, 'hero_tiers.json'));
  const write = process.argv.includes('--write');
  const pruneUnusedTags = process.argv.includes('--prune-unused-tags');

  const prisma = new PrismaClient();
  try {
    const report = await importMcocGameTags(
      prisma,
      {
        champions: parseMcocChampionTagsJson(fs.readFileSync(championsPath, 'utf8')),
        tags: parseMcocGameTagsJson(fs.readFileSync(tagsPath, 'utf8')),
        heroTiers: parseMcocHeroTiersJson(fs.readFileSync(heroTiersPath, 'utf8')),
      },
      { write, pruneUnusedTags }
    );

    console.log(`Mode: ${write ? 'write' : 'dry-run'}`);
    console.log(`Champions in file: ${report.sourceChampions}`);
    console.log(`Champions deduplicated: ${report.dedupedChampions}`);
    console.log(`Tags in file: ${report.sourceTags}`);
    console.log(`Hero tiers in file: ${report.sourceGenderTiers}`);
    console.log(`Champions matched: ${report.updated}`);
    console.log(`Gender tagged: ${report.genderTagged}`);
    console.log(`Gender missing: ${report.genderMissing}`);
    console.log(`Skipped: ${report.skipped.length}`);
    console.log(`Blocked: ${report.blocked.length}`);
    if (write) console.log(`Unused tags deleted: ${report.deletedTags}`);

    if (report.skipped.length) {
      console.log('\nSkipped champions:');
      for (const item of report.skipped) console.log(`- ${item}`);
    }
    if (report.blocked.length) {
      console.log('\nBlocked matches:');
      for (const item of report.blocked) console.log(`- ${item}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
