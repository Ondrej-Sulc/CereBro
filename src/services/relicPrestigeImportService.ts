import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { RelicPrestigeCapture, type RelicPrestigeTable } from "../domain/relic-prestige-capture";
import { createRelicPrestigePlan } from "../domain/relic-prestige-plan";
import { parseRelicPrestigeRanks } from "../domain/relic-prestige";
import type { RelicBundle } from "./relicCatalogImportService";

const checksum = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const manifestSchema = z.object({
  schemaVersion: z.literal("mcoc-relic-prestige-v1"),
  sourcePackageHash: hash, gameAssemblyHash: hash,
  capturedAt: z.string().datetime({ offset: true }),
  socketPolicy: z.literal("max-unlocked-per-rank"),
  capture: z.object({ file: z.literal("capture.jsonl"), sha256: hash, bytes: z.number().int().positive() }).strict(),
}).strict();
export type RelicPrestigeBundle = {
  sourcePackageHash: string; gameAssemblyHash: string; captureHash: string; capturedAt: Date;
  tables: Array<RelicPrestigeTable & { sourceDefinitionHash: string }>;
};

/** Hash and validate the same bytes streamed into the parser, without a check/read race. */
export async function readRelicPrestigeBundle(directory: string, source: RelicBundle): Promise<RelicPrestigeBundle> {
  const manifest = manifestSchema.parse(JSON.parse(await fs.readFile(path.join(directory, "manifest.json"), "utf8")));
  if (manifest.sourcePackageHash !== source.sourceHash) throw new Error("Capture/source package mismatch");
  const plan = createRelicPrestigePlan(source.catalog.relics, source.snapshot.raw, source.contexts);
  const capture = new RelicPrestigeCapture(plan);
  const digest = createHash("sha256"); let bytes = 0, started = false, pending: string | null = null;
  const input = createReadStream(path.join(directory, manifest.capture.file));
  input.on("data", chunk => { digest.update(chunk); bytes += chunk.length; });
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) throw new Error("Blank capture record");
      const event = z.object({ event: z.string() }).passthrough().parse(JSON.parse(line));
      if (!started) {
        if (event.event !== "plan" || event.count !== capture.expectedCount) throw new Error("Capture plan coverage mismatch");
        started = true; continue;
      }
      if (event.event === "sent") {
        if (pending !== null) throw new Error("Overlapping capture requests");
        pending = JSON.stringify(event.request);
      } else if (event.event === "response") {
        if (pending === null || pending !== JSON.stringify(event.request)) throw new Error("Unbound capture response");
        capture.addResponse(event); pending = null;
      } else throw new Error(`Unexpected capture event: ${event.event}`);
    }
  } finally { lines.close(); input.destroy(); }
  if (!started || pending !== null) throw new Error("Incomplete capture request");
  if (bytes !== manifest.capture.bytes || digest.digest("hex") !== manifest.capture.sha256)
    throw new Error("Capture checksum mismatch");
  const definitions = new Map(source.catalog.relics.map(r => [r.id, checksum(JSON.stringify(r))]));
  return { sourcePackageHash: source.sourceHash, gameAssemblyHash: manifest.gameAssemblyHash,
    captureHash: manifest.capture.sha256, capturedAt: new Date(manifest.capturedAt),
    tables: capture.finish().map(table => ({ ...table, sourceDefinitionHash: definitions.get(table.relicId)! })),
  };
}

export async function importRelicPrestige(prisma: PrismaClient, bundle: RelicPrestigeBundle, options: { write?: boolean } = {}) {
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
    const [relics, rarities] = await Promise.all([
      tx.gameRelic.findMany({ where: { isCurrent: true }, select: { id: true, sourceHash: true, importId: true } }),
      tx.gameRelicRarity.findMany({ where: { isCurrent: true, selectable: true },
        select: { relicId: true, sourceRarityId: true, maxRank: true, maxSignature: true } }),
    ]);
    const relicIndex = new Map(relics.map(r => [r.id, r]));
    const rarityIndex = new Map(rarities.map(r => [`${r.relicId}:${r.sourceRarityId}`, r]));
    if (!bundle.tables.length || new Set(bundle.tables.map(t => `${t.relicId}:${t.rarityId}`)).size !== bundle.tables.length ||
      bundle.tables.length !== rarities.length) throw new Error("Incomplete or duplicate catalog coverage");
    // Validate every member before performing the first write.
    for (const table of bundle.tables) {
      const relic = relicIndex.get(table.relicId), rarity = rarityIndex.get(`${table.relicId}:${table.rarityId}`);
      if (!relic || !rarity || relic.sourceHash !== table.sourceDefinitionHash || relic.importId !== bundle.sourcePackageHash)
        throw new Error("Current relic source differs from capture");
      parseRelicPrestigeRanks(table.ranks, { maxRank: rarity.maxRank, maxSignature: rarity.maxSignature });
    }
    if (options.write) for (const table of bundle.tables) {
      const data = { sourceDefinitionHash: table.sourceDefinitionHash, sourcePackageHash: bundle.sourcePackageHash, gameAssemblyHash: bundle.gameAssemblyHash,
        captureHash: bundle.captureHash, capturedAt: bundle.capturedAt,
        ranks: JSON.parse(JSON.stringify(table.ranks)) as Prisma.InputJsonArray };
      await tx.gameRelicPrestige.upsert({ where: { relicId_sourceRarityId: { relicId: table.relicId, sourceRarityId: table.rarityId } },
        create: { relicId: table.relicId, sourceRarityId: table.rarityId, ...data }, update: data });
    }
    return { written: Boolean(options.write), tables: bundle.tables.length,
      builds: bundle.tables.reduce((n, t) => n + t.ranks.reduce((m, r) => m + r.prestigeBySignature.length, 0), 0),
      captureHash: bundle.captureHash, sourcePackageHash: bundle.sourcePackageHash };
  }, { timeout: 120000, maxWait: 15000 });
}
