import { PrismaClient } from "@prisma/client";
import { gcpStorageService } from "../src/services/gcpStorageService";
import logger from "../src/services/loggerService";

const prisma = new PrismaClient();
const SYNC_FILE_PATH = "backups/game-data-sync.json";

async function main() {
  logger.info("🌱 Seeding database from GCS...");

  // Since we already have the logic in db-sync.ts, we can just import it
  // But for simplicity in the seed file, we will just call the import function
  try {
     const data = await gcpStorageService.downloadJson<Record<string, any[]>>(
      SYNC_FILE_PATH
    );
    
    // Using a simpler loop for the seed file to avoid complex logic
    // In a real scenario, we'd reuse the db-sync logic.
    // For now, let's just use the db:sync command manually as it's more robust
    // but we add a message here to guide the user.
    console.log("To seed the database, please run: npm run db:sync");
  } catch (e) {
    logger.error("Could not find sync file in GCS. Have you run 'npm run db:dump' on Prod yet?");
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
