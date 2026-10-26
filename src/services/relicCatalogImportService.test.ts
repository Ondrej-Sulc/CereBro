import { describe, it, expect, afterEach, vi } from "vitest";
import type { PrismaClient } from "@prisma/client";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  readRelicBundle,
  importRelicCatalog,
} from "./relicCatalogImportService";

const created: string[] = [];
afterEach(async () => {
  for (const dir of created.splice(0)) {
    if (
      path.dirname(dir) !== os.tmpdir() ||
      !path.basename(dir).startsWith("cerebro-relic-test-")
    )
      throw new Error("Unsafe fixture cleanup");
    await fs.rm(dir, { recursive: true });
  }
});
const hash = (value: Uint8Array) =>
  createHash("sha256").update(value).digest("hex");
async function fixture() {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "cerebro-relic-test-"),
  );
  created.push(directory);
  const relic = {
    id: "relic_test",
    name: "Test",
    shortName: "Test",
    type: "statcast",
    classId: "mutant",
    className: "Mutant",
    descriptionTemplate: "",
    rarities: [
      {
        id: "leg",
        stars: 5,
        sourceOrderIndex: 2,
        maxRank: 4,
        maxSignature: 200,
      },
    ],
    restrictionSelectors: [],
    recommendedChampions: [],
    innateSocketItemIds: ["striker_test"],
    slots: [],
    unlockConfigurationId: "config",
    portraitAsset: "portrait",
    smallPortraitAsset: "small_portrait",
    modelAsset: "Test",
    baseModelAsset: "",
    statcastPrimaryAttribute: "Armor",
    statcastSecondaryAttribute: "Energy Resistance",
    supportCombatRateMultipliers: [],
    availability: "cached",
  };
  const item = {
    id: "striker_test",
    name: "Test",
    type: "striker",
    classId: "mutant",
    innateOnly: true,
    descriptionTemplate: "Deals damage.",
    unequippedDescriptionTemplate: "",
    commonStatModIds: [],
    tieredStatModIds: [],
    placeholders: [],
  };
  const images = {
    portrait: { file: "portrait.png", sha256: "" },
    small_portrait: { file: "small.png", sha256: "" },
  };
  const png = Buffer.from("89504e470d0a1a0a", "hex");
  for (const image of Object.values(images)) image.sha256 = hash(png);
  const files: Record<string, Uint8Array> = {
    "portrait.png": png,
    "small.png": png,
  };
  const objects: Record<string, unknown> = {
    "mcoc_relics.json": {
      metadata: {
        schemaVersion: "mcoc-relic-data-v1",
        generatedAt: "2026-10-18T18:31:20Z",
        counts: { Relics: 1, SocketItems: 1 },
      },
      relics: [relic],
      socketItems: [item],
    },
    "mcoc_relics.raw.json": {
      Relics: {
        relic_test: { Id: "relic_test", AbsentFieldNotInvented: false },
      },
      SocketItems: { striker_test: { Id: "striker_test" } },
      SocketTierBackingColours: [],
    },
    "mcoc_relics.scaling.json": {
      contexts: [
        {
          relicId: relic.id,
          rarityId: "leg",
          socketItemId: item.id,
          sourceRarityIndex: 2,
          parameters: {},
        },
      ],
    },
    "mcoc_relics.dependencies.json": { modifiers: {} },
    "assets-manifest.json": { images },
    "data-contract.json": { format: "mcoc-relic-data-v1" },
    "validation-report.json": { referenceErrors: [] },
  };
  for (const [name, value] of Object.entries(objects))
    files[name] = Buffer.from(JSON.stringify(value));
  const manifest = {
    files: Object.fromEntries(
      Object.entries(files).map(([name, bytes]) => [
        name,
        { bytes: bytes.length, sha256: hash(bytes) },
      ]),
    ),
  };
  for (const [name, bytes] of Object.entries(files))
    await fs.writeFile(path.join(directory, name), bytes);
  await fs.writeFile(
    path.join(directory, "manifest.json"),
    JSON.stringify(manifest),
  );
  return { directory, manifest, files, objects };
}
describe("verified relic package import", () => {
  it("accepts raw array tables and preserves absent fields/source rarity indexes", async () => {
    const f = await fixture();
    const bundle = await readRelicBundle(f.directory);
    expect(bundle.catalog.relics[0].rarities[0].sourceOrderIndex).toBe(2);
    expect(bundle.snapshot.raw).toEqual(f.objects["mcoc_relics.raw.json"]);
    expect(bundle.contexts).toHaveLength(1);
  });
  it("rejects a changed file before import", async () => {
    const f = await fixture();
    await fs.appendFile(path.join(f.directory, "mcoc_relics.json"), " ");
    await expect(readRelicBundle(f.directory)).rejects.toThrow(/hash mismatch/);
  });
  it("refuses a manifest path outside the package", async () => {
    const f = await fixture();
    f.manifest.files["../escape.json"] = {
      bytes: 0,
      sha256: hash(Buffer.from("")),
    };
    await fs.writeFile(
      path.join(f.directory, "manifest.json"),
      JSON.stringify(f.manifest),
    );
    await expect(readRelicBundle(f.directory)).rejects.toThrow(/escapes/);
  });
  it("refuses source-rarity reindexing even when file hashes match", async () => {
    const f = await fixture();
    const name = "mcoc_relics.scaling.json";
    const bytes = Buffer.from(
      JSON.stringify({
        contexts: [
          {
            relicId: "relic_test",
            rarityId: "leg",
            socketItemId: "striker_test",
            sourceRarityIndex: 0,
            parameters: {},
          },
        ],
      }),
    );
    await fs.writeFile(path.join(f.directory, name), bytes);
    f.manifest.files[name] = { bytes: bytes.length, sha256: hash(bytes) };
    await fs.writeFile(
      path.join(f.directory, "manifest.json"),
      JSON.stringify(f.manifest),
    );
    await expect(readRelicBundle(f.directory)).rejects.toThrow(
      /index mismatch/,
    );
  });
  it("refuses database publication without verified cloud portrait references", async () => {
    const f = await fixture();
    const bundle = await readRelicBundle(f.directory);
    const db = {
      gameRelic: { findMany: vi.fn().mockResolvedValue([]) },
      $transaction: vi.fn(),
    };
    await expect(
      importRelicCatalog(db as unknown as PrismaClient, bundle, {
        write: true,
      }),
    ).rejects.toThrow(/portrait URL/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("stores cloud URLs while preserving the original relic definition and scaling data", async () => {
    const f = await fixture();
    const bundle = await readRelicBundle(f.directory);
    const portraits = Object.fromEntries(
      bundle.assets.map((a) => [
        a.name,
        `https://storage.googleapis.com/test-images/relics/${a.name}/${a.sha256}.png`,
      ]),
    );
    const tx = {
      $executeRaw: vi.fn(),
      $queryRaw: vi.fn().mockResolvedValue([{ matches: true }]),
      gameRelic: {
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
        upsert: vi.fn(),
      },
      gameRelicRarity: { updateMany: vi.fn(), upsert: vi.fn() },
      gameRelicSocketItem: { updateMany: vi.fn(), upsert: vi.fn() },
    };
    const db = {
      gameRelic: tx.gameRelic,
      $transaction: (callback: (client: typeof tx) => Promise<void>) =>
        callback(tx),
    };
    await importRelicCatalog(db as unknown as PrismaClient, bundle, {
      write: true,
      portraitUrls: portraits,
    });
    expect(tx.gameRelic.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          portraitPath: portraits.portrait,
          definition: bundle.catalog.relics[0],
          scalingContexts: bundle.contexts,
        }),
      }),
    );
  });
});
