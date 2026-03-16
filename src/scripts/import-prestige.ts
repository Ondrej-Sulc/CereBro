import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseCSVLine(text: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      result.push(cur);
      cur = '';
    } else {
      cur += char;
    }
  }
  result.push(cur);
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

async function main() {
  // Use the provided CSV file name
  const csvFilename = process.argv[2] || '@mcoc_prestige_master.csv';
  const csvPath = path.resolve(process.cwd(), csvFilename);
  
  console.log(`Reading CSV from ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    console.error('Usage: pnpm tsx src/scripts/import-prestige.ts [path/to/csv]');
    return;
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  console.log(`Found ${lines.length - 1} rows to process.`);
  
  // Cache champions to minimize DB lookups
  const champions = await prisma.champion.findMany({
    select: { id: true, name: true }
  });
  
  // Normalize names for lookup (lowercase)
  const championMap = new Map(champions.map(c => [c.name.toLowerCase(), c.id]));
  
  // Add mapped entries for curly quotes -> straight quotes to handle mismatches
  champions.forEach(c => {
    if (c.name.includes('’')) {
      championMap.set(c.name.toLowerCase().replace(/’/g, "'"), c.id);
    }
  });

  let updatedCount = 0;
  let notFoundCount = 0;
  const notFoundSet = new Set<string>();

  // Process in chunks to avoid overwhelming the DB connection pool
  const CHUNK_SIZE = 1000;
  
  // id,name,tier,rank,sig,prestige
  // Skip header line
  const dataLines = lines.slice(1);
  
  for (let i = 0; i < dataLines.length; i += CHUNK_SIZE) {
    const chunk = dataLines.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (line) => {
      const cols = parseCSVLine(line);
      // We expect: id,name,tier,rank,sig,prestige
      if (cols.length < 6) return;

      const csvId = cols[0];
      const csvName = cols[1];
      const tier = parseInt(cols[2]);
      const rank = parseInt(cols[3]);
      const sig = parseInt(cols[4]);
      const prestige = parseInt(cols[5]);
      
      let champId = championMap.get(csvName.toLowerCase());
      
      // Fallback strategies for name matching
      if (!champId) {
          // try removing special characters and parenthesis
          const cleanName = csvName.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9\s]/g, '').trim();
          for (const [name, id] of championMap.entries()) {
              const cleanDbName = name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9\s]/g, '').trim();
              if (cleanDbName === cleanName) {
                  champId = id;
                  break;
              }
          }
      }
      
      if (!champId) {
        if (!notFoundSet.has(csvName)) {
          console.warn(`Champion not found in DB: ${csvName}`);
          notFoundSet.add(csvName);
          notFoundCount++;
        }
        return;
      }

      if (isNaN(prestige) || isNaN(tier) || isNaN(rank) || isNaN(sig)) return;

      try {
        await prisma.championPrestige.upsert({
          where: {
            championId_rarity_rank_sig: {
              championId: champId,
              rarity: tier,
              rank: rank,
              sig: sig
            }
          },
          update: {
            prestige: prestige
          },
          create: {
            championId: champId,
            rarity: tier,
            rank: rank,
            sig: sig,
            prestige: prestige
          }
        });
        updatedCount++;
      } catch (err) {
        console.error(`Failed to upsert prestige for ${csvName} (Tier ${tier} Rank ${rank} Sig ${sig}):`, err);
      }
    }));

    console.log(`Processed ${Math.min(i + CHUNK_SIZE, dataLines.length)} rows...`);
  }
  
  console.log('Done!');
  console.log(`Total prestige entries updated/created: ${updatedCount}`);
  console.log(`Unique champions not found: ${notFoundCount}`);
  if (notFoundCount > 0) {
      console.log('Unmatched champions:', Array.from(notFoundSet).join(', '));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
