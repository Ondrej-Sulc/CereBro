import { describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  addPlayerRelic,
  listPlayerRelics,
  updatePlayerRelic,
  removePlayerRelic,
  getPlayerRelicState,
  setPlayerRelicPrestigeSource,
  importPlayerRelics,
} from "./playerRelicService";
import { recordChampionPrestige, recordPlayerPrestige } from "./playerPrestigeService";

const connection = process.env.RELIC_TEST_DATABASE_URL;
describe.skipIf(!connection)("player relic inventory in PostgreSQL", () => {
  it("isolates profiles and variants, rejects duplicates/stale edits, and preserves saved retired relics", async () => {
    const url = new URL(connection!);
    expect(["localhost", "127.0.0.1", "[::1]"]).toContain(url.hostname);
    const schema = `player_relic_test_${randomUUID().replaceAll("-", "")}`;
    url.searchParams.set("schema", schema);
    const db = new PrismaClient({
      datasources: { db: { url: url.toString() } },
    });
    let created = false;
    try {
      await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      created = true;
      await db.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
        await tx.$executeRawUnsafe(
          `CREATE TYPE "ChampionClass" AS ENUM ('SCIENCE','SKILL','MYSTIC','COSMIC','TECH','MUTANT','SUPERIOR')`,
        );
        await tx.$executeRawUnsafe(
          `CREATE TABLE "Player" ("id" TEXT PRIMARY KEY, "relicPrestige" INTEGER, "championPrestige" INTEGER, "summonerPrestige" INTEGER, "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`,
        );
        await tx.$executeRawUnsafe(`CREATE TABLE "PrestigeLog" ("id" SERIAL PRIMARY KEY, "playerId" TEXT NOT NULL REFERENCES "Player"("id") ON DELETE CASCADE, "relicPrestige" INTEGER NOT NULL, "championPrestige" INTEGER NOT NULL, "summonerPrestige" INTEGER NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
        for (const name of [
          "20261025170000_add_relic_catalog",
          "20261025171000_add_relic_scaling_projection",
          "20261026130000_add_relic_prestige",
          "20261026154000_bind_relic_prestige_source",
          "20261027100000_add_player_relic_inventory",
          "20261028110000_add_inventory_prestige",
        ]) {
          const sql = await fs.readFile(
            path.resolve("prisma/migrations", name, "migration.sql"),
            "utf8",
          );
          for (const statement of sql
            .replace(/^\s*--.*$/gm, "")
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean))
            await tx.$executeRawUnsafe(statement);
        }
      });
      await db.$executeRaw`INSERT INTO "Player" ("id", "relicPrestige") VALUES ('a', 1234), ('b', 5678)`;
      await db.gameRelicImport.create({
        data: {
          id: "fixture",
          generatedAt: new Date(),
          manifest: {},
          snapshot: {},
        },
      });
      for (const id of ["variant-armor", "variant-resistance"]) {
        await db.gameRelic.create({
          data: {
            id,
            slug: id,
            name: id,
            shortName: id,
            type: "statcast",
            class: "TECH",
            familyKey: "same-family",
            portraitPath: "test.png",
            definition: {},
            sourceHash: id,
            importId: "fixture",
            rarities: {
              create: [5, 6].map((stars, index) => ({
                sourceRarityId: `t${stars}`,
                stars,
                sourceOrderIndex: index,
                maxRank: 2,
                maxSignature: 1,
                selectable: true,
                raw: {},
              })),
            },
          },
        });
        await db.gameRelicPrestige.create({
          data: {
            relicId: id,
            sourceRarityId: "t6",
            sourceDefinitionHash: id,
            sourcePackageHash: "fixture",
            gameAssemblyHash: "test",
            captureHash: "test",
            capturedAt: new Date(),
            ranks: [1, 2].map((rank) => ({
              rank,
              socketRanks: {},
              prestigeBySignature: [rank * 100, rank * 100 + 25],
            })),
          },
        });
      }
      const build = {
        relicId: "variant-armor",
        stars: 6,
        rank: 1,
        sigLevel: 0,
      };
      const a = await addPlayerRelic(db, "a", build);
      expect(a.prestige).toBe(100);
      await expect(addPlayerRelic(db, "a", build)).rejects.toThrow(
        /already own/i,
      );
      await expect(
        addPlayerRelic(db, "a", { ...build, rank: 3 }),
      ).rejects.toThrow(/limits/i);
      await addPlayerRelic(db, "b", build);
      await addPlayerRelic(db, "a", {
        ...build,
        relicId: "variant-resistance",
      });
      await addPlayerRelic(db, "a", { ...build, stars: 5 });
      expect(await listPlayerRelics(db, "a")).toHaveLength(3);
      expect(await listPlayerRelics(db, "b")).toHaveLength(1);
      const beforeImport = await getPlayerRelicState(db, 'a');
      const scanBuild = { ...build, expectedPrestige: 100 };
      await expect(importPlayerRelics(db, 'a', { revision: beforeImport.prestige.revision, entries: [
        { ...scanBuild, relicId: 'variant-resistance', rank: 2, expectedPrestige: 200 }, { ...scanBuild, stars: 3 },
      ] })).rejects.toThrow(/available/);
      expect(await getPlayerRelicState(db, 'a')).toEqual(beforeImport);
      await expect(importPlayerRelics(db, 'a', { revision: beforeImport.prestige.revision, entries: [scanBuild, { ...scanBuild, rank: 2 }] })).rejects.toThrow(/conflicting/i);
      await expect(importPlayerRelics(db, 'a', { revision: beforeImport.prestige.revision, entries: [{ ...scanBuild, expectedPrestige: 101 }] })).rejects.toThrow(/no longer matches/);
      const imported = await importPlayerRelics(db, 'a', { revision: beforeImport.prestige.revision, entries: [
        scanBuild, scanBuild, { ...scanBuild, relicId: 'variant-resistance', rank: 2, expectedPrestige: 200 },
      ] });
      expect(imported.entries).toHaveLength(3); // exact duplicate scans coalesce; unrelated owned rarities survive
      expect(imported.entries.find(e => e.relicId === 'variant-resistance')?.rank).toBe(2);
      expect(imported.entries.find(e => e.id === a.id)?.updatedAt).toBe(a.updatedAt); // no-op stays a no-op
      await expect(importPlayerRelics(db, 'a', { revision: beforeImport.prestige.revision, entries: [scanBuild] })).rejects.toThrow(/changed/i);
      expect((await listPlayerRelics(db, 'b'))[0].rank).toBe(1);
      await expect(
        updatePlayerRelic(db, "b", {
          id: a.id,
          updatedAt: a.updatedAt,
          rank: 2,
          sigLevel: 1,
        }),
      ).rejects.toThrow(/not found/i);
      await expect(
        removePlayerRelic(db, "b", { id: a.id, updatedAt: a.updatedAt }),
      ).rejects.toThrow();
      const edited = await updatePlayerRelic(db, "a", {
        id: a.id,
        updatedAt: a.updatedAt,
        rank: 2,
        sigLevel: 1,
      });
      expect(edited.prestige).toBe(225);
      await expect(
        updatePlayerRelic(db, "a", {
          id: a.id,
          updatedAt: a.updatedAt,
          rank: 1,
          sigLevel: 0,
        }),
      ).rejects.toThrow(/changed/i);
      await expect(
        removePlayerRelic(db, "a", { id: a.id, updatedAt: a.updatedAt }),
      ).rejects.toThrow(/changed/i);
      await db.gameRelic.update({
        where: { id: build.relicId },
        data: { isCurrent: false },
      });
      const retired = (await listPlayerRelics(db, "a")).find(
        (entry) => entry.id === a.id,
      )!;
      expect(retired).toMatchObject({
        current: false,
        prestige: null,
        rank: 2,
        sigLevel: 1,
      });
      await expect(
        updatePlayerRelic(db, "a", {
          id: a.id,
          updatedAt: edited.updatedAt,
          rank: 1,
          sigLevel: 0,
        }),
      ).rejects.toThrow(/available/i);
      await expect(
        db.gameRelic.delete({ where: { id: build.relicId } }),
      ).rejects.toThrow(/foreign key constraint/i);
      await removePlayerRelic(db, "a", {
        id: a.id,
        updatedAt: edited.updatedAt,
      });
      expect(
        (await listPlayerRelics(db, "a")).some((entry) => entry.id === a.id),
      ).toBe(false);
      expect(await db.$queryRaw`SELECT "id", "relicPrestige" FROM "Player" ORDER BY "id"`).toEqual([
        { id: "a", relicPrestige: 1234 },
        { id: "b", relicPrestige: 5678 },
      ]);
      await db.$executeRaw`DELETE FROM "Player" WHERE "id" = 'a'`;
      expect(await listPlayerRelics(db, "a")).toEqual([]);
      expect(await listPlayerRelics(db, "b")).toHaveLength(1);

      // Existing manual values survive an incomplete inventory and missing data.
      let state = await getPlayerRelicState(db, "b");
      await expect(setPlayerRelicPrestigeSource(db, "b", { enabled: true, confirmedTop30: true, revision: state.prestige.revision })).rejects.toThrow(/at least 30/);
      await removePlayerRelic(db, "b", { id: state.entries[0].id, updatedAt: state.entries[0].updatedAt });
      await recordPlayerPrestige(db, "b", { championPrestige: 30000, relicPrestige: 2000 });
      for (let i = 0; i < 32; i++) {
        const id = `prestige-${i}`;
        await db.gameRelic.create({ data: {
          id, slug: id, name: id, shortName: id, type: i % 2 ? "statcast" : "battlecast", class: "TECH", familyKey: id,
          portraitPath: "test.png", definition: {}, sourceHash: id, importId: "fixture",
          rarities: { create: { sourceRarityId: "t6", stars: 6, sourceOrderIndex: 0, maxRank: 2, maxSignature: 1, selectable: true, raw: {} } },
        } });
        await db.gameRelicPrestige.create({ data: {
          relicId: id, sourceRarityId: "t6", sourceDefinitionHash: id, sourcePackageHash: "fixture",
          gameAssemblyHash: "test", captureHash: "test", capturedAt: new Date(),
          ranks: [1, 2].map((rank) => ({ rank, socketRanks: {}, prestigeBySignature: [rank * 100, rank * 100 + 25] })),
        } });
        if (i < 30) await addPlayerRelic(db, "b", { relicId: id, stars: 6, rank: 1, sigLevel: 0 });
      }
      state = await getPlayerRelicState(db, "b");
      expect(state.prestige).toMatchObject({ average: 100, recorded: 2000, automatic: false, ready: true, summoner: 32000 });
      await expect(setPlayerRelicPrestigeSource(db, "b", { enabled: true, revision: state.prestige.revision })).rejects.toThrow(/confirm/);
      const active = await setPlayerRelicPrestigeSource(db, "b", { enabled: true, confirmedTop30: true, revision: state.prestige.revision });
      expect(active.prestige).toMatchObject({ recorded: 100, summoner: 30100, automatic: true });
      await expect(setPlayerRelicPrestigeSource(db, "b", { enabled: false, revision: state.prestige.revision })).rejects.toThrow(/changed/);
      const row = active.entries[0];
      const upgraded = await updatePlayerRelic(db, "b", { id: row.id, updatedAt: row.updatedAt, rank: 2, sigLevel: 1 });
      expect((await getPlayerRelicState(db, "b")).prestige).toMatchObject({ recorded: 104, summoner: 30104 });
      const extra = await addPlayerRelic(db, "b", { relicId: "prestige-30", stars: 6, rank: 2, sigLevel: 1 });
      expect((await getPlayerRelicState(db, "b")).prestige.recorded).toBe(108);
      await removePlayerRelic(db, "b", { id: extra.id, updatedAt: extra.updatedAt });
      expect((await getPlayerRelicState(db, "b")).prestige.recorded).toBe(104);
      // Deleting below 30 pauses sync; recorded values never become a partial average.
      const low = active.entries[1];
      await removePlayerRelic(db, "b", { id: low.id, updatedAt: low.updatedAt });
      state = await getPlayerRelicState(db, "b");
      expect(state.prestige).toMatchObject({ ready: false, recorded: 104, automatic: true });
      const replacement = await addPlayerRelic(db, "b", { relicId: low.relicId, stars: 6, rank: 1, sigLevel: 0 });
      // Unknown data pauses updates even if the other 30 ratings are known.
      await db.gameRelicPrestige.update({ where: { relicId_sourceRarityId: { relicId: "prestige-31", sourceRarityId: "t6" } }, data: { sourcePackageHash: "drift" } });
      const unknown = await addPlayerRelic(db, "b", { relicId: "prestige-31", stars: 6, rank: 1, sigLevel: 0 });
      await updatePlayerRelic(db, "b", { id: replacement.id, updatedAt: replacement.updatedAt, rank: 2, sigLevel: 1 });
      expect((await getPlayerRelicState(db, "b")).prestige).toMatchObject({ ready: false, missingCount: 1, recorded: 104 });
      await removePlayerRelic(db, "b", { id: unknown.id, updatedAt: unknown.updatedAt });
      expect((await getPlayerRelicState(db, "b")).prestige.recorded).toBe(108);
      // Inventory, aggregates and history roll back together if logging fails.
      await db.$executeRawUnsafe(`ALTER TABLE "PrestigeLog" ADD CONSTRAINT "reject_fixture_log" CHECK ("relicPrestige" <= 108) NOT VALID`);
      const another = (await listPlayerRelics(db, "b")).find((entry) => entry.rank === 1)!;
      await expect(updatePlayerRelic(db, "b", { id: another.id, updatedAt: another.updatedAt, rank: 2, sigLevel: 1 })).rejects.toThrow();
      expect((await listPlayerRelics(db, "b")).find((entry) => entry.id === another.id)?.rank).toBe(1);
      expect((await getPlayerRelicState(db, "b")).prestige.recorded).toBe(108);
      await db.$executeRawUnsafe(`ALTER TABLE "PrestigeLog" DROP CONSTRAINT "reject_fixture_log"`);
      // Concurrent champion/relic writes preserve the latest value of both components.
      await Promise.all([
        recordChampionPrestige(db, "b", 31000),
        updatePlayerRelic(db, "b", { id: upgraded.id, updatedAt: upgraded.updatedAt, rank: 1, sigLevel: 0 }),
      ]);
      state = await getPlayerRelicState(db, "b");
      expect(state.prestige).toMatchObject({ champion: 31000, recorded: 104, summoner: 31104 });
      const logs = await db.prestigeLog.count({ where: { playerId: "b" } });
      await recordChampionPrestige(db, "b", 31000);
      expect(await db.prestigeLog.count({ where: { playerId: "b" } })).toBe(logs);
      // Manual edit / OCR import opts out; later inventory edits leave that value intact.
      await recordPlayerPrestige(db, "b", { relicPrestige: 1800 });
      state = await getPlayerRelicState(db, "b");
      expect(state.prestige).toMatchObject({ automatic: false, recorded: 1800, summoner: 32800 });
      await updatePlayerRelic(db, "b", { id: another.id, updatedAt: another.updatedAt, rank: 2, sigLevel: 1 });
      expect((await getPlayerRelicState(db, "b")).prestige.recorded).toBe(1800);
      await recordPlayerPrestige(db, "b", { relicPrestige: 1900, championPrestige: 32000 });
      state = await getPlayerRelicState(db, "b");
      expect(state.prestige).toMatchObject({ automatic: false, recorded: 1900, summoner: 33900, champion: 32000 });
      await setPlayerRelicPrestigeSource(db, "b", { enabled: true, confirmedTop30: true, revision: state.prestige.revision });
      state = await getPlayerRelicState(db, "b");
      const batch = state.entries.filter(entry => entry.rank === 1).slice(0, 2).map(entry => ({ relicId: entry.relicId, stars: entry.stars, rank: 2, sigLevel: 1, expectedPrestige: 225 }));
      const logsBeforeImport = await db.prestigeLog.count({ where: { playerId: 'b' } });
      const batchResult = await importPlayerRelics(db, 'b', { revision: state.prestige.revision, entries: batch });
      expect(batchResult.prestige.automatic).toBe(true);
      expect(batchResult.prestige.recorded).toBe(batchResult.prestige.average);
      expect(batchResult.prestige.summoner).toBe(32000 + batchResult.prestige.average!);
      expect(await db.prestigeLog.count({ where: { playerId: 'b' } })).toBe(logsBeforeImport+1);
      state = batchResult;
      const stopped = await setPlayerRelicPrestigeSource(db, "b", { enabled: false, revision: state.prestige.revision });
      expect(stopped.prestige).toMatchObject({ automatic: false, recorded: state.prestige.recorded, summoner: state.prestige.summoner });
    } finally {
      if (created) {
        expect(schema).toMatch(/^player_relic_test_[a-f0-9]{32}$/);
        await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
      }
      await db.$disconnect();
    }
  }, 30000);
});
