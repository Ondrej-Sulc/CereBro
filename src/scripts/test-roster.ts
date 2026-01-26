import { PrismaClient } from "@prisma/client";
import { prisma } from "../services/prismaService";
import { processRosterScreenshot } from "../commands/roster/ocr/process";
import { RosterUpdateResult, RosterDebugResult } from "../commands/roster/ocr/types";
import * as fs from "fs/promises";
import * as path from "path";
import logger from "../services/loggerService";

// URL from the user
const imageUrl =
  "https://media.discordapp.net/ephemeral-attachments/1422501362201006128/1464713628291961094/Screenshot_20260124_140759_Champions.jpg?ex=69791b5e&is=6977c9de&hm=41ccfac95207c3f3ffa71639e97da425d7fe530296b95c1f1c6ae05ea24dccaa&=&format=webp&width=1739&height=811";
const stars = 6;
const rank = 5;

// Test player data
const testPlayerData = {
  discordId: "test-discord-id",
  ingameName: "TestPlayer",
};

async function testRoster() {
  const debugMode = true; // Set to true to test without saving to DB
  logger.info({ debugMode }, "Starting roster processing test...");
  try {
    let result: RosterUpdateResult | RosterDebugResult;
    if (debugMode) {
      result = await processRosterScreenshot(
        imageUrl,
        stars,
        rank,
        false,
        true
      );
    } else {
      // Ensure the test player exists
      const player = await prisma.player.upsert({
        where: { 
          discordId_ingameName: {
            discordId: testPlayerData.discordId,
            ingameName: testPlayerData.ingameName,
          }
        },
        update: {},
        create: testPlayerData,
      });
      logger.info(
        { ingameName: player.ingameName, id: player.id },
        "Test player ensured"
      );
      result = await processRosterScreenshot(
        imageUrl,
        stars,
        rank,
        false,
        false,
        player.id
      );
    }
    logger.info("Processing finished.");

    if ("message" in result) {
      logger.info({ message: result.message }, "Result message");
    } else {
      logger.info(`Result: ${result.count} champions processed.`);
      logger.info(
        { champions: result.champions.flat().map((c: any) => c.champion.name) },
        "Champions processed"
      );
    }

    if ("debugImageBuffer" in result && result.debugImageBuffer) {
      const debugDir = path.join(__dirname, "..", "..", "temp");
      await fs.mkdir(debugDir, { recursive: true });

      if (result.imageBuffer) {
        const basePath = path.join(debugDir, "roster_base.png");
        await fs.writeFile(basePath, result.imageBuffer);
        logger.info(`Saved base image to: ${basePath}`);
      }
      if (result.debugImageBuffer) {
        const debugPath = path.join(debugDir, "roster_debug.png");
        await fs.writeFile(debugPath, result.debugImageBuffer);
        logger.info(`Saved debug image to: ${debugPath}`);
      }
    }
  } catch (error) {
    logger.error({ error }, "An error occurred during roster processing");
  } finally {
    await prisma.$disconnect();
  }
}

testRoster();
