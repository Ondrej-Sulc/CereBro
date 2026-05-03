import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { importGlossaryIcons } from "../services/glossaryIconsImportService";

const prisma = new PrismaClient();

async function run() {
  const defaultPath = "C:\\Games\\Marvel Contest of Champions\\default\\game\\Scripts\\poc_glossary_gcp_db_updates_execute_en.json";
  const dataPath = path.resolve(
    process.argv[2] || process.env.GLOSSARY_PATH || defaultPath
  );
  if (!fs.existsSync(dataPath)) {
    throw new Error(`File not found: ${dataPath}`);
  }

  const updates = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  console.log(`Loaded ${updates.length} updates from JSON.`);

  const report = await importGlossaryIcons(prisma, updates, { write: true });

  console.log(`\nImport complete!`);
  console.log(`GameGlossaryTerms updated: ${report.written?.termsUpdated ?? 0}`);
  console.log(`Abilities updated/linked: ${report.written?.abilitiesLinked ?? 0}`);
  console.log(`New Abilities created: ${report.written?.abilitiesCreated ?? 0}`);
  
  if (report.unmatchedTerms.length > 0) {
    console.warn(`\nUnmatched terms: ${report.unmatchedTerms.length}`);
  }
}

run()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
