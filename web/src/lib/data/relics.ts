import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { relicParameterDisplay } from "@cerebro/core/domain/relic-values";
import { parseRelicPrestigeRanks, type RelicPrestigeRank } from "@cerebro/core/domain/relic-prestige";
import {
  buildRelicRuneIcons,
  relicRuneGlossaryId,
} from "@/lib/relic-rune-icons";
import { cache } from "react";
import { getFromCache } from "@/lib/cache";
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper";
import {
  buildRelicAttributeIcons,
  RELIC_ATTRIBUTE_GLOSSARY_IDS,
  type RelicAttributeIcon,
} from "@/lib/relic-attribute-icons";
import {
  buildRelicFamilies,
  relicDefinitionSchema,
  relicSocketSchema,
  selectableRelicRarities,
  type RelicFamily,
  type RelicFamilyMember,
  type RelicScalingContext,
  type RelicSocketItem,
} from "@cerebro/core/domain/relic-catalog";

export type RelicSummary = RelicFamilyMember & {
  slug: string;
  portraitPath: string;
  stars: number[];
};
export type RelicCatalogData = {
  families: RelicFamily<RelicSummary>[];
  attributeIcons: Record<string, RelicAttributeIcon>;
  generatedAt: string | null;
  variants: number;
};
function getRelicAttributeIcons() {
  return getFromCache("relic-attribute-icons-v1", 300, async () =>
    buildRelicAttributeIcons(
      await prisma.gameGlossaryTerm.findMany({
        where: { id: { in: Object.values(RELIC_ATTRIBUTE_GLOSSARY_IDS) } },
        select: { id: true, iconUrl: true, raw: true },
      }),
    ),
  );
}
async function getRelicRuneIcons(
  items: RelicSocketItem[],
): Promise<Record<string, RelicAttributeIcon>> {
  const ids = [
    ...new Set(
      items
        .map((item) => relicRuneGlossaryId(item.name))
        .filter((id): id is string => !!id),
    ),
  ].sort();
  if (!ids.length) return {};
  const terms = await getFromCache(
    `relic-rune-icons-v1:${ids.join(",")}`,
    300,
    () =>
      prisma.gameGlossaryTerm.findMany({
        where: { id: { in: ids } },
        select: { id: true, iconUrl: true, raw: true },
      }),
  );
  return buildRelicRuneIcons(items, terms);
}
export function getRelicCatalog(): Promise<RelicCatalogData> {
  return getFromCache("relic-catalog-v3", 300, async () => {
    const [rows, strikers, champions, attributeIcons] = await Promise.all([
      prisma.gameRelic.findMany({
        where: { isCurrent: true },
        select: {
          slug: true,
          portraitPath: true,
          definition: true,
          importedFrom: { select: { generatedAt: true } },
        },
        orderBy: { id: "asc" },
      }),
      prisma.gameRelicSocketItem.findMany({
        where: { isCurrent: true, type: "striker" },
        select: { id: true, name: true },
      }),
      prisma.champion.findMany({
        where: { isPlayable: true },
        select: { name: true },
      }),
      getRelicAttributeIcons(),
    ]);
    const names = new Map(strikers.map((s) => [s.id, s.name]));
    const championNames = new Map(
      champions.map((c) => [c.name.toLowerCase(), c.name]),
    );
    const relics: RelicSummary[] = rows.map((row) => {
      const r = relicDefinitionSchema.parse(row.definition);
      const striker = r.innateSocketItemIds
        .map((id) => names.get(id))
        .find(Boolean);
      const label =
        r.type === "battlecast"
          ? r.name.replace(/\s+Battlecast$/i, "")
          : (striker ?? r.shortName).replace(/\s+Relic$/i, "");
      return {
        id: r.id,
        slug: row.slug,
        portraitPath: row.portraitPath,
        name: r.name,
        shortName:
          r.type === "statcast"
            ? (championNames.get(label.toLowerCase()) ?? label)
            : label,
        type: r.type,
        classId: r.classId,
        className: r.className,
        modelAsset: r.modelAsset,
        statcastPrimaryAttribute: r.statcastPrimaryAttribute,
        statcastSecondaryAttribute: r.statcastSecondaryAttribute,
        stars: selectableRelicRarities(r).map((r) => r.stars),
      };
    });
    return {
      families: buildRelicFamilies(relics),
      attributeIcons,
      generatedAt: rows[0]?.importedFrom.generatedAt.toISOString() ?? null,
      variants: rows.length,
    };
  });
}

async function loadRelicFamily(familyKey: string) {
  const rows = await prisma.gameRelic.findMany({
    where: { familyKey, isCurrent: true },
    select: {
      id: true,
      slug: true,
      name: true,
      secondaryAttribute: true,
      definition: true,
      portraitPath: true,
      scalingContexts: true,
      sourceHash: true,
      importId: true,
      importedFrom: { select: { generatedAt: true } },
    },
    orderBy: { secondaryAttribute: "asc" },
  });
  const relics = rows.map((row) => {
    const relic = relicDefinitionSchema.parse(row.definition);
    if (relic.id !== row.id)
      throw new Error("Relic definition identity mismatch");
    return relic;
  });
  const variants = rows.map(({ id, slug, name, secondaryAttribute }) => ({
    id,
    slug,
    name,
    secondaryAttribute,
  }));
  const ids = [
    ...new Set(
      relics.flatMap((relic) => [
        ...relic.innateSocketItemIds,
        ...relic.slots.flatMap((s) => s.socketItemIds),
      ]),
    ),
  ];
  const [sockets, champions, attributeIcons, prestigeRows] = await Promise.all([
    prisma.gameRelicSocketItem.findMany({
      where: { id: { in: ids }, isCurrent: true },
      select: { definition: true },
    }),
    prisma.champion.findMany({
      where: {
        gameId: {
          in: [...new Set(relics.flatMap((relic) => relic.recommendedChampions.map((c) => c.gameId)))],
        },
        isPlayable: true,
      },
      select: {
        gameId: true,
        name: true,
        slug: true,
        class: true,
        images: true,
      },
    }),
    getRelicAttributeIcons(),
    prisma.gameRelicPrestige.findMany({
      where: { relicId: { in: rows.map(row => row.id) } },
      select: { relicId: true, sourceRarityId: true, sourceDefinitionHash: true, sourcePackageHash: true, ranks: true },
    }),
  ]);
  const items: Record<string, RelicSocketItem> = {};
  for (const socket of sockets) {
    const item = relicSocketSchema.parse(socket.definition);
    items[item.id] = item;
  }
  for (const id of ids)
    if (!items[id]) throw new Error(`Missing current relic socket ${id}`);
  // Read the family's formatter dependencies once per immutable import.
  // Do not load the multi-megabyte source snapshot into the page payload.
  const tieredIds = [
    ...new Set(Object.values(items).flatMap((item) => item.tieredStatModIds)),
  ].sort();
  const importIds = [...new Set(rows.map((row) => row.importId))];
  const displayEntries = await Promise.all(importIds.map(async (importId) => {
    const displayRows = tieredIds.length
    ? await getFromCache(
        `relic-value-formats-v1:${importId}:${tieredIds.join(",")}`,
        300,
        () =>
          prisma.$queryRaw<Array<{ id: string; display: unknown }>>(Prisma.sql`
      SELECT tiered.key AS id,
        jsonb_build_object(
          'modSource', modifier.value->'ModSource',
          'durSource', modifier.value->'DurSource',
          'chanceSource', modifier.value->'ChanceSource',
          'formulaId', modifier.value->'DisplayFormulaId',
          'formula', source.snapshot->'dependencies'->'stat_modifier_formulas'->(modifier.value->>'DisplayFormulaId')
        ) AS display
      FROM "GameRelicImport" source
      CROSS JOIN LATERAL jsonb_each(source.snapshot->'raw'->'SocketItemsTiereds') tiered
      CROSS JOIN LATERAL (SELECT source.snapshot->'dependencies'->'stat_modifiers'->(tiered.value->>'StatModId') AS value) modifier
      WHERE source.id = ${importId} AND tiered.key IN (${Prisma.join(tieredIds)})
    `),
      )
    : [];
    return [importId, new Map(displayRows.map((entry) => [entry.id, entry.display]))] as const;
  }));
  const displaysByImport = new Map(displayEntries);
  const runeIcons = await getRelicRuneIcons(
    [...new Set(relics.flatMap((relic) => relic.slots.flatMap((slot) => slot.socketItemIds)))].map((id) => items[id]),
  );
  return rows.map((row, index) => {
    const relic = relics[index];
    const displays = displaysByImport.get(row.importId)!;
    const contexts: Record<string, Record<string, RelicScalingContext>> = {};
    if (Array.isArray(row.scalingContexts))
      for (const entry of row.scalingContexts) {
        if (
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          typeof entry.rarityId !== "string" ||
          typeof entry.socketItemId !== "string" ||
          !entry.parameters ||
          typeof entry.parameters !== "object" ||
          Array.isArray(entry.parameters)
        )
          continue;
        const parameters: RelicScalingContext["parameters"] = {};
        for (const [id, raw] of Object.entries(entry.parameters)) {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
          parameters[id] = {};
          for (const [key, value] of Object.entries(raw)) {
            if (!value || typeof value !== "object" || Array.isArray(value))
              continue;
            parameters[id][key] = {
              display: relicParameterDisplay(key, displays.get(id)) ?? null,
              constantRaw:
                typeof value.constantRaw === "string" ? value.constantRaw : null,
              minAtRarity:
                typeof value.minAtRarity === "string" ? value.minAtRarity : null,
              maxAtRarity:
                typeof value.maxAtRarity === "string" ? value.maxAtRarity : null,
              usesChallengeRating:
                typeof value.usesChallengeRating === "boolean"
                  ? value.usesChallengeRating
                  : undefined,
              exponent:
                typeof value.exponent === "number" ? value.exponent : undefined,
            };
          }
        }
        (contexts[entry.rarityId] ??= {})[entry.socketItemId] = { parameters };
      }
    const prestige: Record<string, RelicPrestigeRank[]> = {};
    for (const captured of prestigeRows) {
      if (captured.relicId !== relic.id || captured.sourceDefinitionHash !== row.sourceHash ||
        captured.sourcePackageHash !== row.importId) continue;
      const rarity = selectableRelicRarities(relic).find(r => r.id === captured.sourceRarityId);
      if (rarity) prestige[rarity.id] = parseRelicPrestigeRanks(captured.ranks, rarity);
    }
    return {
      slug: row.slug,
      relic,
      items,
      runeIcons,
      variants,
      contexts,
      prestige,
      attributeIcons,
      portraitPath: row.portraitPath,
      generatedAt: row.importedFrom.generatedAt.toISOString(),
      recommendations: relic.recommendedChampions.map((r) => {
        const champion = champions.find((c) => c.gameId === r.gameId);
        return {
          gameId: r.gameId,
          name: champion?.name ?? r.name,
          slug: champion?.slug ?? null,
          className: champion?.class ?? null,
          portraitUrl: champion
            ? getChampionImageUrlOrPlaceholder(champion.images, "64")
            : null,
        };
      }),
    };
  });
}

// A family is the small set of secondary variants, never the entire catalog.
// Shared sockets/icons are fetched once and shared in the client payload.
export const getRelicFamilyDetails = cache(async (slug: string) => {
  const row = await prisma.gameRelic.findUnique({
    where: { slug },
    select: { id: true, isCurrent: true, familyKey: true, importId: true },
  });
  if (!row?.isCurrent) return null;
  const members = await getFromCache(
    `relic-family-details-v2:${row.familyKey}:${row.importId}`,
    300,
    () => loadRelicFamily(row.familyKey),
  );
  if (!members.some((member) => member.relic.id === row.id && member.slug === slug))
    return null;
  return { initialId: row.id, members };
});

export const getRelicDetails = cache(async (slug: string) => {
  const family = await getRelicFamilyDetails(slug);
  return family?.members.find((member) => member.slug === slug) ?? null;
});
export type RelicFamilyDetails = NonNullable<
  Awaited<ReturnType<typeof getRelicFamilyDetails>>
>;
export type RelicDetailData = RelicFamilyDetails["members"][number];
