import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { importRelicCatalog, type RelicBundle } from "./relicCatalogImportService";
import { parseRelicCatalog } from "../domain/relic-catalog";

// A dedicated loopback DB only: the test creates and drops its own random schema.
const connection = process.env.RELIC_TEST_DATABASE_URL;
describe.skipIf(!connection)("relic source preservation in PostgreSQL", () => {
  it("preserves source decimals and refuses conflicting immutable snapshots", async () => {
    const url = new URL(connection!);
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
    const schema = `relic_import_test_${randomUUID().replaceAll("-", "")}`;
    url.searchParams.set("schema", schema);
    const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
    let created = false;
    try {
      await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      created = true;
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe(`CREATE TYPE "ChampionClass" AS ENUM ('SCIENCE','SKILL','MYSTIC','COSMIC','TECH','MUTANT','SUPERIOR')`);
        for (const name of ["20261025170000_add_relic_catalog", "20261025171000_add_relic_scaling_projection"]) {
          const sql = await fs.readFile(path.resolve("prisma/migrations", name, "migration.sql"), "utf8");
          for (const statement of sql.replace(/^\s*--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean))
            await tx.$executeRawUnsafe(statement);
        }
      });
      const bundle: RelicBundle = {
        sourceHash: "a".repeat(64),
        manifest: { source: "fixture" },
        snapshot: { raw: { small: 0.10000000149011612, negative: -0.30000001192092896, curve: 0.020500000566244125 } },
        contexts: [],
        assets: [{ name: "portrait", file: "not-read-by-importer.png", sha256: "b".repeat(64) }],
        catalog: parseRelicCatalog({
          metadata: { schemaVersion: "mcoc-relic-data-v1", generatedAt: "2026-10-18T00:00:00Z", counts: { Relics: 1, SocketItems: 1 } },
          relics: [{
            id: "relic_test", name: "Test", shortName: "Test", type: "battlecast", classId: "tech", className: "Tech",
            descriptionTemplate: "", rarities: [{ id: "leg", stars: 5, sourceOrderIndex: 0, maxRank: 5, maxSignature: 200 }],
            restrictionSelectors: [], recommendedChampions: [], innateSocketItemIds: ["striker_test"], slots: [],
            unlockConfigurationId: "config", portraitAsset: "portrait", smallPortraitAsset: "portrait", modelAsset: "Test", baseModelAsset: "",
            statcastPrimaryAttribute: null, statcastSecondaryAttribute: null, supportCombatRateMultipliers: [], availability: "cached",
          }],
          socketItems: [{
            id: "striker_test", name: "Test", type: "striker", classId: "tech", innateOnly: true,
            descriptionTemplate: "Deals damage.", unequippedDescriptionTemplate: "", commonStatModIds: [], tieredStatModIds: [], placeholders: [],
          }],
        }),
      };
      const options = { write: true, portraitUrls: { portrait: `https://storage.googleapis.com/test-images/relics/portrait/${"b".repeat(64)}.png` } };
      await importRelicCatalog(db, bundle, options);
      const stored = await db.gameRelicImport.findUniqueOrThrow({ where: { id: bundle.sourceHash } });
      expect(stored.snapshot).toEqual(bundle.snapshot);
      await importRelicCatalog(db, bundle, options);
      expect(await db.gameRelicImport.findUniqueOrThrow({ where: { id: bundle.sourceHash } })).toEqual(stored);
      const conflicting = { ...bundle, snapshot: { raw: { changed: true } } };
      await expect(importRelicCatalog(db, conflicting, options)).rejects.toThrow(/immutable.*snapshot/i);
      expect(await db.gameRelicImport.findUniqueOrThrow({ where: { id: bundle.sourceHash } })).toEqual(stored);
      expect(await db.gameRelic.count({ where: { isCurrent: true } })).toBe(1);
    } finally {
      if (created) {
        expect(schema).toMatch(/^relic_import_test_[a-f0-9]{32}$/);
        await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      }
      await db.$disconnect();
    }
  }, 30000);
});
