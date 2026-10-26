import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { Prisma, PrismaClient, ChampionClass } from "@prisma/client";
import { z } from "zod";
import {
  validateRelicPortraitUrls,
  type RelicPortraitUrls,
} from "./relicPortraitService";
import {
  parseRelicCatalog,
  relicFamilyKey,
  relicSlug,
  selectableRelicRarities,
  type RelicCatalog,
} from "../domain/relic-catalog";

const checksum = (value: Uint8Array | string) =>
  createHash("sha256").update(value).digest("hex");
const manifestSchema = z
  .object({
    files: z.record(
      z.string(),
      z.object({
        bytes: z.number().int().nonnegative(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      }),
    ),
  })
  .passthrough();
export type RelicBundle = {
  catalog: RelicCatalog;
  sourceHash: string;
  manifest: Prisma.InputJsonObject;
  snapshot: Prisma.InputJsonObject;
  contexts: Array<{ relicId: string; [key: string]: unknown }>;
  assets: Array<{ name: string; file: string; sha256: string }>;
};
const json = (value: unknown) =>
  JSON.parse(JSON.stringify(value)) as Prisma.InputJsonObject;

/** Verify the complete delivered package before reading any of it into the catalog. */
export async function readRelicBundle(directory: string): Promise<RelicBundle> {
  const root = path.resolve(directory),
    manifestBytes = await fs.readFile(path.join(root, "manifest.json"));
  const manifest = manifestSchema.parse(
    JSON.parse(manifestBytes.toString("utf8")),
  );
  for (const [relative, record] of Object.entries(manifest.files)) {
    const file = path.resolve(root, relative.replaceAll("\\", "/"));
    if (!file.startsWith(root + path.sep))
      throw new Error("Manifest path escapes package");
    const bytes = await fs.readFile(file);
    if (bytes.length !== record.bytes || checksum(bytes) !== record.sha256)
      throw new Error(`Package hash mismatch: ${relative}`);
  }
  const read = async (name: string): Promise<unknown> => {
    if (!manifest.files[name])
      throw new Error(`Unverified package file: ${name}`);
    const bytes = await fs.readFile(path.join(root, name));
    if (checksum(bytes) !== manifest.files[name].sha256)
      throw new Error(`Package file changed after verification: ${name}`);
    return JSON.parse(bytes.toString("utf8")) as unknown;
  };
  const [
    catalogInput,
    raw,
    scaling,
    dependencies,
    assetsInput,
    contract,
    validation,
  ] = await Promise.all(
    [
      "mcoc_relics.json",
      "mcoc_relics.raw.json",
      "mcoc_relics.scaling.json",
      "mcoc_relics.dependencies.json",
      "assets-manifest.json",
      "data-contract.json",
      "validation-report.json",
    ].map(read),
  );
  const catalog = parseRelicCatalog(catalogInput);
  const rawTables = z.record(z.string(), z.unknown()).parse(raw);
  const rawRelics = z.record(z.string(), z.unknown()).parse(rawTables.Relics),
    rawSockets = z.record(z.string(), z.unknown()).parse(rawTables.SocketItems);
  if (
    Object.keys(rawRelics).length !== catalog.relics.length ||
    Object.keys(rawSockets).length !== catalog.socketItems.length
  )
    throw new Error("Raw/normalized count mismatch");
  for (const relic of catalog.relics)
    if (!rawRelics[relic.id]) throw new Error(`Missing raw relic ${relic.id}`);
  for (const item of catalog.socketItems)
    if (!rawSockets[item.id]) throw new Error(`Missing raw socket ${item.id}`);
  const contexts = z
    .object({
      contexts: z.array(
        z
          .object({
            relicId: z.string(),
            rarityId: z.string(),
            socketItemId: z.string(),
            sourceRarityIndex: z.number().int(),
            parameters: z.record(z.string(), z.unknown()),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse(scaling);
  const contextIds = new Set<string>();
  for (const context of contexts.contexts) {
    const relic = catalog.relics.find((r) => r.id === context.relicId),
      rarity = relic?.rarities.find((r) => r.id === context.rarityId);
    const item = catalog.socketItems.find((i) => i.id === context.socketItemId);
    if (
      !relic ||
      !rarity ||
      !item ||
      rarity.sourceOrderIndex !== context.sourceRarityIndex
    )
      throw new Error("Scaling context identity/index mismatch");
    if (
      ![
        ...relic.innateSocketItemIds,
        ...relic.slots.flatMap((s) => s.socketItemIds),
      ].includes(item.id)
    )
      throw new Error("Unrelated scaling socket");
    const key = `${relic.id}:${rarity.id}:${item.id}`;
    if (contextIds.has(key)) throw new Error("Duplicate scaling context");
    contextIds.add(key);
  }
  for (const relic of catalog.relics)
    for (const rarity of relic.rarities)
      for (const item of new Set([
        ...relic.innateSocketItemIds,
        ...relic.slots.flatMap((s) => s.socketItemIds),
      ]))
        if (!contextIds.has(`${relic.id}:${rarity.id}:${item}`))
          throw new Error(
            `Missing scaling context ${relic.id}/${rarity.id}/${item}`,
          );
  const imageManifest = z
    .object({
      images: z.record(
        z.string(),
        z
          .object({
            file: z.string(),
            sha256: z.string().regex(/^[a-f0-9]{64}$/),
          })
          .passthrough(),
      ),
    })
    .passthrough()
    .parse(assetsInput);
  const assets = Object.entries(imageManifest.images).map(([name, image]) => {
    if (!/^[a-z0-9_]+$/i.test(name)) throw new Error("Unsafe asset name");
    const verified = manifest.files[image.file];
    if (!verified || verified.sha256 !== image.sha256)
      throw new Error("Portrait manifest mismatch");
    return {
      name,
      file: path.resolve(root, image.file.replaceAll("\\", "/")),
      sha256: image.sha256,
    };
  });
  for (const relic of catalog.relics)
    for (const name of [relic.portraitAsset, relic.smallPortraitAsset])
      if (!assets.some((a) => a.name === name))
        throw new Error(`Missing portrait ${name}`);
  return {
    catalog,
    sourceHash: checksum(manifestBytes),
    manifest: json(manifest),
    snapshot: json({
      catalog: catalogInput,
      raw,
      scaling,
      dependencies,
      assets: assetsInput,
      contract,
      validation,
    }),
    contexts: contexts.contexts,
    assets,
  };
}

export async function importRelicCatalog(
  prisma: PrismaClient,
  bundle: RelicBundle,
  options: {
    write?: boolean;
    allowRetire?: boolean;
    portraitUrls?: RelicPortraitUrls;
  } = {},
) {
  const existing = await prisma.gameRelic.findMany({
    where: { isCurrent: true },
    select: { id: true },
  });
  const retiredIds = existing
    .filter((row) => !bundle.catalog.relics.some((r) => r.id === row.id))
    .map((row) => row.id);
  const report = {
    sourceHash: bundle.sourceHash,
    relics: bundle.catalog.relics.length,
    socketItems: bundle.catalog.socketItems.length,
    rarities: bundle.catalog.relics.reduce((n, r) => n + r.rarities.length, 0),
    selectableRarities: bundle.catalog.relics.reduce(
      (n, r) => n + selectableRelicRarities(r).length,
      0,
    ),
    retiredIds,
    canWrite: retiredIds.length === 0 || options.allowRetire === true,
    written: false,
  };
  if (!options.write) return report;
  if (!report.canWrite)
    throw new Error(
      "Relics would be retired; review the preview before allowing retirement",
    );
  const portraitUrls = options.portraitUrls ?? {};
  validateRelicPortraitUrls(bundle, portraitUrls);
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(718263, 2)`;
      const current = await tx.gameRelic.findMany({
        where: { isCurrent: true },
        select: { id: true },
      });
      if (
        !options.allowRetire &&
        current.some(
          (row) => !bundle.catalog.relics.some((r) => r.id === row.id),
        )
      )
        throw new Error("Catalog changed after preview");
      // Prisma's JSON write protocol rounds some high-precision source doubles.
      // Bind JSON text and let PostgreSQL parse it without a second numeric codec.
      const manifestText = JSON.stringify(bundle.manifest);
      const snapshotText = JSON.stringify(bundle.snapshot);
      const generatedAt = new Date(bundle.catalog.metadata.generatedAt);
      await tx.$executeRaw`
        INSERT INTO "GameRelicImport" (id, "generatedAt", manifest, snapshot)
        VALUES (${bundle.sourceHash}, ${generatedAt}, ${manifestText}::jsonb, ${snapshotText}::jsonb)
        ON CONFLICT (id) DO NOTHING
      `;
      const [stored] = await tx.$queryRaw<Array<{ matches: boolean }>>`
        SELECT manifest = ${manifestText}::jsonb
          AND snapshot = ${snapshotText}::jsonb
          AND "generatedAt" = ${generatedAt} AS matches
        FROM "GameRelicImport" WHERE id = ${bundle.sourceHash}
      `;
      if (!stored?.matches)
        throw new Error("Immutable relic snapshot differs from the verified source package");
      await tx.gameRelic.updateMany({ data: { isCurrent: false } });
      await tx.gameRelicRarity.updateMany({
        data: { isCurrent: false, selectable: false },
      });
      await tx.gameRelicSocketItem.updateMany({ data: { isCurrent: false } });
      for (const item of bundle.catalog.socketItems) {
        const data = {
          name: item.name,
          type: item.type,
          definition: json(item),
          sourceHash: checksum(JSON.stringify(item)),
          isCurrent: true,
          importId: bundle.sourceHash,
        };
        await tx.gameRelicSocketItem.upsert({
          where: { id: item.id },
          create: { id: item.id, ...data },
          update: data,
        });
      }
      for (const relic of bundle.catalog.relics) {
        const data = {
          slug: relicSlug(relic.id),
          name: relic.name,
          shortName: relic.shortName,
          type: relic.type,
          class: relic.className.toUpperCase() as ChampionClass,
          familyKey: relicFamilyKey(relic),
          primaryAttribute: relic.statcastPrimaryAttribute,
          secondaryAttribute: relic.statcastSecondaryAttribute,
          portraitPath: portraitUrls[relic.portraitAsset],
          definition: json(relic),
          scalingContexts: bundle.contexts.filter(
            (c) => c.relicId === relic.id,
          ) as Prisma.InputJsonArray,
          sourceHash: checksum(JSON.stringify(relic)),
          isCurrent: true,
          importId: bundle.sourceHash,
        };
        await tx.gameRelic.upsert({
          where: { id: relic.id },
          create: { id: relic.id, ...data },
          update: data,
        });
        const selected = new Set(
          selectableRelicRarities(relic).map((r) => r.id),
        );
        for (const rarity of relic.rarities) {
          const data = {
            stars: rarity.stars,
            sourceOrderIndex: rarity.sourceOrderIndex,
            maxRank: rarity.maxRank,
            maxSignature: rarity.maxSignature,
            selectable: selected.has(rarity.id),
            isCurrent: true,
            raw: json(rarity),
          };
          await tx.gameRelicRarity.upsert({
            where: {
              relicId_sourceRarityId: {
                relicId: relic.id,
                sourceRarityId: rarity.id,
              },
            },
            create: { relicId: relic.id, sourceRarityId: rarity.id, ...data },
            update: data,
          });
        }
      }
    },
    { timeout: 120000, maxWait: 15000 },
  );
  return { ...report, written: true };
}
