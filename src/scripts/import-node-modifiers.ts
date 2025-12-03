import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';

const prisma = new PrismaClient();

async function importNodeModifiers() {
  const filePath = path.resolve(__dirname, 'node_modifiers.csv'); // Assuming CSV is in the same directory as the script
  const records: { name: string; description: string }[] = [];

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    console.error(`Error: CSV file not found at ${filePath}`);
    process.exit(1);
  }

  const parser = fs
    .createReadStream(filePath)
    .pipe(parse({ delimiter: ',', relax_column_count: true }));

  for await (const record of parser) {
    if (record.length >= 2) {
      records.push({ name: record[0].trim(), description: record[1].trim() });
    } else {
      console.warn(`Skipping malformed row: ${record.join(', ')}`);
    }
  }

  console.log(`Found ${records.length} records in CSV.`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const record of records) {
    try {
      await prisma.nodeModifier.create({
        data: {
          name: record.name,
          description: record.description,
        },
      });
      createdCount++;
    } catch (error: any) {
      if (error.code === 'P2002') { // Unique constraint violation
        console.warn(`Skipping duplicate modifier: "${record.name}" - "${record.description}"`);
        skippedCount++;
      } else {
        console.error(`Error creating modifier "${record.name}":`, error);
      }
    }
  }

  console.log(`
Import complete:`);
  console.log(`- Created: ${createdCount} new modifiers`);
  console.log(`- Skipped (duplicates): ${skippedCount} modifiers`);

  await prisma.$disconnect();
}

importNodeModifiers()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
