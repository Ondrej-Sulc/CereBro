import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import {
  readRelicBundle,
  importRelicCatalog,
} from "../services/relicCatalogImportService";
import { publishRelicPortraits } from "../services/relicPortraitService";

async function main() {
  const args = process.argv.slice(2);
  for (const arg of args)
    if (
      !arg.startsWith("--directory=") &&
      !["--write", "--upload-assets", "--allow-retire"].includes(arg)
    )
      throw new Error(
        `Unknown option: ${arg}. Relic images use --upload-assets (Google Cloud Storage).`,
      );
  const write = args.includes("--write");
  const upload = args.includes("--upload-assets");
  if (write && !upload)
    throw new Error(
      "Use --write --upload-assets so every cloud portrait is verified before publishing database references.",
    );
  const directory = process.argv
    .find((a) => a.startsWith("--directory="))
    ?.slice(12);
  if (!directory)
    throw new Error(
      "Usage: pnpm import:mcoc-relics --directory=PACKAGE [--write --upload-assets] [--allow-retire]",
    );
  const bundle = await readRelicBundle(directory);
  const db = new PrismaClient();
  try {
    const preview = await importRelicCatalog(db, bundle, {
      allowRetire: args.includes("--allow-retire"),
    });
    if (!preview.canWrite && (write || upload))
      throw new Error(
        "Relics would be retired; review the preview before allowing retirement",
      );
    // Importing data without publishing images remains a credential-free preview.
    const portraitUrls = upload
      ? await publishRelicPortraits(
          bundle,
          (await import("../services/gcpStorageService.js")).gcpStorageService,
        )
      : undefined;
    const report = await importRelicCatalog(db, bundle, {
      write,
      allowRetire: args.includes("--allow-retire"),
      portraitUrls,
    });
    console.log(
      JSON.stringify(
        {
          mode: write ? "write" : "preview",
          portraits: {
            storage: "gcs",
            verified: portraitUrls ? Object.keys(portraitUrls).length : 0,
            urls: portraitUrls,
          },
          ...report,
        },
        null,
        2,
      ),
    );
    if (!report.canWrite) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Relic import failed");
  process.exitCode = 1;
});
