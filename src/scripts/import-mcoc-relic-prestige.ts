import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { readRelicBundle } from "../services/relicCatalogImportService";
import { readRelicPrestigeBundle, importRelicPrestige } from "../services/relicPrestigeImportService";

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => !arg.startsWith("--source=") && !arg.startsWith("--capture=") && arg !== "--write"))
    throw new Error("Unknown relic prestige import option");
  const sourceDirectory = args.find(arg => arg.startsWith("--source="))?.slice(9);
  const captureDirectory = args.find(arg => arg.startsWith("--capture="))?.slice(10);
  if (!sourceDirectory || !captureDirectory)
    throw new Error("Usage: pnpm import:relic-prestige --source=CATALOG_PACKAGE --capture=CAPTURE_PACKAGE [--write]");
  const source = await readRelicBundle(sourceDirectory);
  const capture = await readRelicPrestigeBundle(captureDirectory, source);
  const db = new PrismaClient();
  try {
    console.log(JSON.stringify(await importRelicPrestige(db, capture, { write: args.includes("--write") }), null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Relic prestige import failed"); process.exitCode = 1; });
