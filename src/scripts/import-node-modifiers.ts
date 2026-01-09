import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse';
import logger from '../services/loggerService';

const prisma = new PrismaClient();

async function importNodeModifiers() {
  const filePath = path.resolve(__dirname, 'node_modifiers.csv'); // Assuming CSV is in the same directory as the script
  const records: { name: string; description: string }[] = [];

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    logger.error(`Error: CSV file not found at ${filePath}`);
    process.exit(1);
  }

  const parser = fs
    .createReadStream(filePath)
    .pipe(parse({ delimiter: ',', relax_column_count: true }));

  for await (const record of parser) {
    if (record.length >= 2) {
      records.push({ name: record[0].trim(), description: record[1].trim() });
    } else {
      logger.warn({ record: record.join(', ') }, 'Skipping malformed row');
    }
  }

  logger.info({ count: records.length }, 'Found records in CSV');

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
        logger.warn(
          { name: record.name, description: record.description },
          'Skipping duplicate modifier'
        );
        skippedCount++;
      } else {
        logger.error({ error, name: record.name }, 'Error creating modifier');
      }
    }
  }

  logger.info(
    { created: createdCount, skipped: skippedCount },
    'Import complete'
  );

  await prisma.$disconnect();
}

importNodeModifiers()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
