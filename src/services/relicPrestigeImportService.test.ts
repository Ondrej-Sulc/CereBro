import { afterEach, describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { importRelicPrestige, readRelicPrestigeBundle, type RelicPrestigeBundle } from "./relicPrestigeImportService";
import type { RelicBundle } from "./relicCatalogImportService";

const bundle: RelicPrestigeBundle = { sourcePackageHash: "a".repeat(64), gameAssemblyHash: "b".repeat(64),
  captureHash: "c".repeat(64), capturedAt: new Date("2026-10-26T12:00:00Z"),
  tables: [{ relicId: "relic_test", rarityId: "t6", sourceDefinitionHash: "d".repeat(64),
    ranks: [{ rank: 1, socketRanks: { "0": 10 }, prestigeBySignature: [100, 120] }] }] };
function db(drift = false) {
  const write = vi.fn().mockResolvedValue({});
  const tx = { $executeRaw: vi.fn().mockResolvedValue(1),
    gameRelic: { findMany: vi.fn().mockResolvedValue([{ id: "relic_test", sourceHash: drift ? "wrong" : "d".repeat(64), importId: "a".repeat(64) }]) },
    gameRelicRarity: { findMany: vi.fn().mockResolvedValue([{ relicId: "relic_test", sourceRarityId: "t6", maxRank: 1, maxSignature: 1 }]) },
    gameRelicPrestige: { upsert: write } };
  const prisma = { $transaction: async (fn: (value: typeof tx) => Promise<unknown>) => fn(tx) } as unknown as PrismaClient;
  return { prisma, write, tx };
}
describe("verified relic prestige import", () => {
  it("previews without writing", async () => {
    const { prisma, write } = db();
    expect(await importRelicPrestige(prisma, bundle)).toMatchObject({ written: false, tables: 1, builds: 2 });
    expect(write).not.toHaveBeenCalled();
  });
  it("rechecks source identity under the shared catalog lock", async () => {
    const { prisma, write, tx } = db(true);
    await expect(importRelicPrestige(prisma, bundle, { write: true })).rejects.toThrow(/source/);
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });
  it("refuses incomplete curves before any writes", async () => {
    const { prisma, write } = db();
    const incomplete = structuredClone(bundle); incomplete.tables[0].ranks[0].prestigeBySignature.pop();
    await expect(importRelicPrestige(prisma, incomplete, { write: true })).rejects.toThrow(/Incomplete/);
    expect(write).not.toHaveBeenCalled();
  });
  it("writes the complete exact curve with provenance", async () => {
    const { prisma, write } = db();
    expect(await importRelicPrestige(prisma, bundle, { write: true })).toMatchObject({ written: true, builds: 2 });
    expect(write).toHaveBeenCalledOnce();
    expect(write.mock.calls[0][0].create).toMatchObject({ sourceDefinitionHash: "d".repeat(64),
      sourcePackageHash: bundle.sourcePackageHash, captureHash: "c".repeat(64), ranks: bundle.tables[0].ranks });
  });
});

const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0)) {
    if (path.dirname(directory) !== os.tmpdir() || !path.basename(directory).startsWith("relic-prestige-test-"))
      throw new Error("Unsafe test fixture cleanup");
    await fs.rm(directory, { recursive: true });
  }
});
async function captureFixture(mode: "valid" | "hash" | "unbound" | "partial" | "source" = "valid") {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "relic-prestige-test-")); directories.push(directory);
  // Boundary fixture: readRelicBundle already validated the source package.
  const source = { sourceHash: "a".repeat(64), catalog: { relics: [{ id: "relic_test", type: "battlecast",
    unlockConfigurationId: "cfg", rarities: [{ id: "t6", stars: 6, sourceOrderIndex: 0, maxRank: 1, maxSignature: 0 }],
    slots: [{ index: 0, socketItemIds: ["rune"] }] }] },
    snapshot: { raw: { UnlockConfigurations: { cfg: { Strategies: ["s"] } },
      UnlockStrategies: { s: { UnlockOrder: [0], UnlockRank: [1] } } } },
    contexts: [{ relicId: "relic_test", rarityId: "t6", socketItemId: "rune", maxSocketLevelByRelicRank: [{ relicRank: 1, maxSocketLevel: 10 }] }],
  } as unknown as RelicBundle;
  const request = [{ Id: "relic_test", RarityId: "t6", Rank: 1, InnateAbilityLevel: 0, SocketRanks: { "0": 10 } }];
  const records: unknown[] = [{ event: "plan", count: 1 }];
  if (mode !== "unbound") records.push({ event: "sent", request });
  if (mode !== "partial") records.push({ event: "response", request, error: "",
    result: [{ Id: "relic_test", RarityId: "t6", Rank: 1, InnateAbilityLevel: 0, Pi: 100, Sockets: { "0": { Rank: 10 } } }] });
  const bytes = Buffer.from(records.map(r => JSON.stringify(r)).join("\n") + "\n");
  await fs.writeFile(path.join(directory, "capture.jsonl"), bytes);
  await fs.writeFile(path.join(directory, "manifest.json"), JSON.stringify({ schemaVersion: "mcoc-relic-prestige-v1",
    sourcePackageHash: mode === "source" ? "f".repeat(64) : source.sourceHash, gameAssemblyHash: "b".repeat(64),
    capturedAt: "2026-10-26T12:00:00Z", socketPolicy: "max-unlocked-per-rank",
    capture: { file: "capture.jsonl", bytes: bytes.length,
      sha256: mode === "hash" ? "e".repeat(64) : createHash("sha256").update(bytes).digest("hex") } }));
  return { directory, source };
}
describe("capture package integrity", () => {
  it("reads exact, hash-bound responses into source-bound tables", async () => {
    const { directory, source } = await captureFixture();
    const parsed = await readRelicPrestigeBundle(directory, source);
    expect(parsed.tables[0].ranks[0].prestigeBySignature).toEqual([100]);
    expect(parsed.tables[0].sourceDefinitionHash).toBe(createHash("sha256").update(JSON.stringify(source.catalog.relics[0])).digest("hex"));
  });
  it.each(["hash", "unbound", "partial", "source"] as const)("rejects %s evidence", async mode => {
    const { directory, source } = await captureFixture(mode);
    await expect(readRelicPrestigeBundle(directory, source)).rejects.toThrow();
  });
});
