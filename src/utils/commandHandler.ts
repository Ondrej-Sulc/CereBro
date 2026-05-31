import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { Collection } from "discord.js";
import { Command } from "../types/command";
import logger from "../services/loggerService";

const commandsPath = join(__dirname, "..", "commands");

export const commands = new Collection<string, Command>();
let commandLoadPromise: Promise<void> | null = null;
let commandsLoaded = false;

async function findCommandFiles(dir: string): Promise<string[]> {
  const entries = readdirSync(dir);
  const files: string[] = [];
  const isTsMode = process.env.TS_MODE_ENABLED === "true";
  const fileExtension = isTsMode ? ".ts" : ".js";

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      const indexFile = join(fullPath, `index${fileExtension}`);
      try {
        statSync(indexFile); // Check if index file exists
        files.push(indexFile);
      } catch (e) {
        // Not a command directory, ignore
      }
    } else if (
      entry.endsWith(fileExtension) &&
      entry !== `index${fileExtension}`
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

export async function loadCommands() {
  const commandFiles = await findCommandFiles(commandsPath);

  logger.info(`🔎 Found ${commandFiles.length} command files.`);

  for (const filePath of commandFiles) {
    try {
      const commandModule = await import(pathToFileURL(filePath).href);
      const command = commandModule.command || commandModule.default;

      if (command && "data" in command && "execute" in command) {
        commands.set(command.data.name, command);
        logger.info(`   ✅ Loaded command: /${command.data.name}`);
      } else {
        logger.warn(
          `   ⚠️ [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
        );
      }
    } catch (error: unknown) {
      logger.error({ error: String(error) }, `   ❌ Error loading command from ${filePath}:`);
    }
  }
}

export async function ensureCommandsLoaded() {
  if (commandsLoaded) return;
  if (!commandLoadPromise) {
    commandLoadPromise = loadCommands()
      .then(() => {
        commandsLoaded = true;
      })
      .finally(() => {
        commandLoadPromise = null;
      });
  }
  await commandLoadPromise;
}
