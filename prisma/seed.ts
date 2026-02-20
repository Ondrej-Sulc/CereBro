import { PrismaClient } from "@prisma/client";
import { importFromGCS } from "../src/scripts/db-sync";
import logger from "../src/services/loggerService";

async function main() {
  logger.info("🌱 Seeding database from GCS...");

  try {
    await importFromGCS();
    logger.info("✅ Database seeded successfully.");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error({ error: e }, `Could not seed database: ${message}. Have you run 'pnpm run db:dump' on Prod yet?`);
    throw e;
  }
}

main()
  .catch((e) => {
    logger.error(e);
    process.exit(1);
  });
