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
  const csvPath = path.join(process.cwd(), 'prestige_new.csv');
  console.log(`Reading CSV from ${csvPath}`);
  
  if (!fs.existsSync(csvPath)) {
    console.error('File not found');
    return;
  }

  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = fileContent.split(/\r?\n/).filter(l => l.trim().length > 0);
  
  // Headers: fullname,Stars,Rank,sig_0,sig_20,sig_40,sig_60,sig_80,sig_100,sig_120,sig_140,sig_160,sig_180,sig_200
  const header = parseCSVLine(lines[0]);
  const sigColumns = header.slice(3).map(h => parseInt(h.replace('sig_', '')));
  
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

  // Process in chunks to avoid overwhelming the DB connection pool
  const CHUNK_SIZE = 10;
  for (let i = 1; i < lines.length; i += CHUNK_SIZE) {
    const chunk = lines.slice(i, i + CHUNK_SIZE);
    
    await Promise.all(chunk.map(async (line) => {
      const cols = parseCSVLine(line);
      if (cols.length < 3) return;

      const fullname = cols[0];
      const stars = parseInt(cols[1]);
      const rankStr = cols[2]; // "Rank 1"
      const rank = parseInt(rankStr.replace(/Rank\s*/i, ''));
      
      const champId = championMap.get(fullname.toLowerCase());
      
      if (!champId) {
        console.warn(`Champion not found: ${fullname}`);
        notFoundCount++;
        return;
      }

      const upserts = [];
      for (let j = 0; j < sigColumns.length; j++) {
        let sig = sigColumns[j];
        const prestigeStr = cols[3 + j];
        
        if (!prestigeStr) continue;

        // Special handling for 4-star champions:
        // - Max sig is 99.
        // - The CSV stores sig 99 in the 'sig_100' column.
        // - Ignore columns > 100 for 4* champs.
        if (stars === 4) {
          if (sig === 100) {
            sig = 99;
          } else if (sig > 100) {
            continue; 
          }
        }
        
        // Remove commas from "13,064" -> 13064
        const prestige = parseInt(prestigeStr.replace(/,/g, ''));
        
        if (isNaN(prestige)) continue;

        upserts.push(
          prisma.championPrestige.upsert({
            where: {
              championId_rarity_rank_sig: {
                championId: champId,
                rarity: stars,
                rank: rank,
                sig: sig
              }
            },
            update: {
              prestige: prestige
            },
            create: {
              championId: champId,
              rarity: stars,
              rank: rank,
              sig: sig,
              prestige: prestige
            }
          })
        );
      }
      
      await Promise.all(upserts);
      updatedCount += upserts.length;
    }));

    if (i % 100 === 1) {
      console.log(`Processed ${i - 1 + chunk.length} rows...`);
    }
  }
  
  console.log('Done!');
  console.log(`Total operations: ${updatedCount}`);
  console.log(`Champions not found: ${notFoundCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });