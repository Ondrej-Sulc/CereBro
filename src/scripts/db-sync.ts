import { PrismaClient } from "@prisma/client";
import { gcpStorageService } from "../services/gcpStorageService";
import logger from "../services/loggerService";

const prisma = new PrismaClient();
const SYNC_FILE_PATH = "backups/game-data-sync.json";

const STATIC_TABLES = [
  "abilityCategory",
  "ability",
  "tag",
  "champion",
  "championPrestige",
  "championAbilityLink",
  "championAbilitySynergy",
  "attack",
  "hit",
  "warNode",
  "nodeModifier",
  "warNodeAllocation",
  "warTactic",
  "seasonBan",
  "systemConfig",
  "duel",
] as const;

type StaticTableName = (typeof STATIC_TABLES)[number];

async function exportToGCS() {
  logger.info("🚀 Starting export of static tables to GCS...");
  const data: Record<string, any[]> = {};

  for (const table of STATIC_TABLES) {
    logger.info(`📦 Fetching ${table}...`);
    // @ts-ignore - Dynamically accessing prisma models
    data[table] = await prisma[table].findMany();
    logger.info(`✅ Fetched ${data[table].length} records from ${table}`);
  }

  await gcpStorageService.uploadJson(data, SYNC_FILE_PATH);
  logger.info(`✨ Export complete! Uploaded to GCS: ${SYNC_FILE_PATH}`);
}

async function importFromGCS() {
  logger.info("🚀 Starting import of static tables from GCS...");
  const data = await gcpStorageService.downloadJson<Record<string, any[]>>(
    SYNC_FILE_PATH
  );

  for (const table of STATIC_TABLES) {
    const records = data[table];
    if (!records) continue;

    logger.info(`💾 Upserting ${records.length} records into ${table}...`);

    for (const record of records) {
      try {
        // Handling primary keys correctly for each table
        let where: any = { id: record.id };

        // Some tables use composite unique keys or strings
        if (table === "championPrestige") {
          where = {
            championId_rarity_rank_sig: {
              championId: record.championId,
              rarity: record.rarity,
              rank: record.rank,
              sig: record.sig,
            },
          };
        } else if (table === "championAbilityLink") {
          where = {
            championId_abilityId_type_source: {
              championId: record.championId,
              abilityId: record.abilityId,
              type: record.type,
              source: record.source,
            },
          };
        } else if (table === "championAbilitySynergy") {
           where = {
             championAbilityLinkId_championId: {
                championAbilityLinkId: record.championAbilityLinkId,
                championId: record.championId
             }
           }
        } else if (table === "tag") {
          where = {
            name_category: {
              name: record.name,
              category: record.category,
            },
          };
        } else if (table === "attack") {
          where = {
            championId_type: {
              championId: record.championId,
              type: record.type,
            },
          };
        } else if (table === "warNode") {
          where = { nodeNumber: record.nodeNumber };
        } else if (table === "nodeModifier") {
          where = {
            name_description: {
              name: record.name,
              description: record.description,
            },
          };
        } else if (table === "warTactic") {
          where = {
            season_minTier_maxTier: {
              season: record.season,
              minTier: record.minTier,
              maxTier: record.maxTier,
            },
          };
        } else if (table === "seasonBan") {
           where = {
             season_minTier_maxTier_championId: {
               season: record.season,
               minTier: record.minTier,
               maxTier: record.maxTier,
               championId: record.championId
             }
           }
        } else if (table === "systemConfig") {
          where = { key: record.key };
        } else if (table === "duel") {
          where = {
            championId_playerName: {
              championId: record.championId,
              playerName: record.playerName,
            },
          };
        }

        // @ts-ignore - Dynamically accessing prisma models
        await prisma[table].upsert({
          where,
          update: record,
          create: record,
        });
      } catch (e: any) {
        logger.error({ error: e.message, table, record }, "Error during upsert");
      }
    }
    logger.info(`✅ Finished ${table}`);
  }

  logger.info("✨ Import complete!");
}

async function main() {
  const action = process.argv[2];

  if (action === "export") {
    await exportToGCS();
  } else if (action === "import") {
    await importFromGCS();
  } else {
    console.log("Usage: tsx src/scripts/db-sync.ts [export|import]");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
