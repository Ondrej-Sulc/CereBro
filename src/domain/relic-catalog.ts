import { z } from "zod";
import {
  formatRelicRange,
  relicRangeUnit,
  relicTemplateSuppliesReduction,
  type RelicValueDisplay,
} from "./relic-values";

const id = z.string().regex(/^[a-z0-9_]+$/i);
export const relicRaritySchema = z
  .object({
    id,
    stars: z.number().int().min(1).max(7),
    sourceOrderIndex: z.number().int().nonnegative(),
    maxRank: z.number().int().positive(),
    maxSignature: z.number().int().nonnegative(),
  })
  .passthrough();
export const relicSocketSchema = z
  .object({
    id,
    name: z.string().min(1),
    type: z.enum(["striker", "innate", "ability", "attribute"]),
    classId: z.string(),
    innateOnly: z.boolean(),
    descriptionTemplate: z.string(),
    unequippedDescriptionTemplate: z.string(),
    commonStatModIds: z.array(id),
    tieredStatModIds: z.array(id),
    placeholders: z.array(
      z
        .object({
          token: z.string(),
          tieredId: id,
          parameter: z.enum(["a", "b", "c"]),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export const relicDefinitionSchema = z
  .object({
    id,
    name: z.string().min(1),
    shortName: z.string().min(1),
    type: z.enum(["battlecast", "statcast"]),
    classId: z.string().min(1),
    className: z.enum([
      "Science",
      "Skill",
      "Mutant",
      "Mystic",
      "Tech",
      "Cosmic",
    ]),
    descriptionTemplate: z.string(),
    rarities: z.array(relicRaritySchema).min(1),
    restrictionSelectors: z.array(z.string()),
    recommendedChampions: z.array(
      z
        .object({ gameId: id, name: z.string(), source: z.string() })
        .passthrough(),
    ),
    innateSocketItemIds: z.array(id),
    slots: z.array(
      z
        .object({
          index: z.number().int().nonnegative(),
          sourceSelector: z.string(),
          type: z.string(),
          classId: z.string(),
          socketItemIds: z.array(id).min(1),
        })
        .passthrough(),
    ),
    unlockConfigurationId: id,
    portraitAsset: id,
    smallPortraitAsset: id,
    modelAsset: z.string(),
    baseModelAsset: z.string(),
    statcastPrimaryAttribute: z.string().nullable(),
    statcastSecondaryAttribute: z.string().nullable(),
    supportCombatRateMultipliers: z.array(z.number().finite()),
    availability: z.string(),
  })
  .passthrough();
const catalogSchema = z
  .object({
    metadata: z
      .object({
        schemaVersion: z.literal("mcoc-relic-data-v1"),
        generatedAt: z.string().datetime({ offset: true }),
        counts: z
          .object({
            Relics: z.number().int().positive(),
            SocketItems: z.number().int().positive(),
          })
          .passthrough(),
      })
      .passthrough(),
    relics: z.array(relicDefinitionSchema).min(1),
    socketItems: z.array(relicSocketSchema).min(1),
  })
  .superRefine((data, ctx) => {
    if (
      data.metadata.counts.Relics !== data.relics.length ||
      data.metadata.counts.SocketItems !== data.socketItems.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Catalog record count mismatch",
      });
    for (const rows of [data.relics, data.socketItems])
      if (new Set(rows.map((row) => row.id)).size !== rows.length)
        ctx.addIssue({ code: "custom", message: "Duplicate source ID" });
    const items = new Set(data.socketItems.map((item) => item.id));
    for (const relic of data.relics) {
      if (new Set(relic.slots.map((s) => s.index)).size !== relic.slots.length)
        ctx.addIssue({
          code: "custom",
          message: `Duplicate slot position: ${relic.id}`,
        });
      if (
        new Set(relic.rarities.map((r) => r.id)).size !==
          relic.rarities.length ||
        new Set(relic.rarities.map((r) => r.sourceOrderIndex)).size !==
          relic.rarities.length ||
        new Set(relic.rarities.map((r) => r.stars)).size !==
          relic.rarities.length
      )
        ctx.addIssue({
          code: "custom",
          message: `Duplicate rarity identity: ${relic.id}`,
        });
      for (const ref of [
        ...relic.innateSocketItemIds,
        ...relic.slots.flatMap((s) => s.socketItemIds),
      ])
        if (!items.has(ref))
          ctx.addIssue({
            code: "custom",
            message: `Missing socket item ${ref} for ${relic.id}`,
          });
    }
  });
export type RelicDefinition = z.infer<typeof relicDefinitionSchema>;
export type RelicSocketItem = z.infer<typeof relicSocketSchema>;
export type RelicCatalog = z.infer<typeof catalogSchema>;
export function parseRelicCatalog(value: unknown): RelicCatalog {
  return catalogSchema.parse(value);
}
/** Template presence does not imply obtainability. User-confirmed Statcast launch range is 5–7 stars. */
export function selectableRelicRarities(relic: RelicDefinition) {
  return relic.rarities.filter(
    (r) => relic.type !== "statcast" || r.stars >= 5,
  );
}
export function relicSlug(id: string) {
  return id.replace(/^relic_/, "").replace(/_/g, "-");
}
export type RelicFamilyMember = Pick<
  RelicDefinition,
  | "id"
  | "name"
  | "shortName"
  | "type"
  | "classId"
  | "className"
  | "modelAsset"
  | "statcastPrimaryAttribute"
  | "statcastSecondaryAttribute"
>;
export function relicFamilyKey(relic: RelicFamilyMember) {
  return relic.type === "battlecast"
    ? relic.id
    : `statcast:${relic.classId}:${relic.modelAsset}:${relic.statcastPrimaryAttribute}`;
}
export type RelicFamily<T extends RelicFamilyMember = RelicDefinition> = {
  id: string;
  title: string;
  type: RelicDefinition["type"];
  className: RelicDefinition["className"];
  variants: T[];
};
export function buildRelicFamilies<T extends RelicFamilyMember>(
  relics: T[],
): RelicFamily<T>[] {
  const groups = new Map<string, RelicFamily<T>>();
  for (const relic of relics) {
    const key = relicFamilyKey(relic);
    let family = groups.get(key);
    if (!family) {
      family = {
        id: key,
        title: relic.shortName,
        type: relic.type,
        className: relic.className,
        variants: [],
      };
      groups.set(key, family);
    }
    family.variants.push(relic);
  }
  return [...groups.values()].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
}
export type RelicFilters = {
  query: string;
  type: "all" | "battlecast" | "statcast";
  className: string;
  attribute: string;
};
export function filterRelicFamilies<T extends RelicFamilyMember>(
  families: RelicFamily<T>[],
  filters: RelicFilters,
) {
  const query = filters.query.trim().toLocaleLowerCase();
  return families.flatMap((family) => {
    const variants = family.variants.filter(
      (relic) =>
        (filters.type === "all" || relic.type === filters.type) &&
        (filters.className === "all" ||
          relic.className === filters.className) &&
        (filters.attribute === "all" ||
          [
            relic.statcastPrimaryAttribute,
            relic.statcastSecondaryAttribute,
          ].includes(filters.attribute)) &&
        (!query ||
          [
            relic.name,
            relic.shortName,
            relic.className,
            relic.statcastPrimaryAttribute,
            relic.statcastSecondaryAttribute,
          ]
            .filter(Boolean)
            .join(" ")
            .toLocaleLowerCase()
            .includes(query)),
    );
    return variants.length ? [{ ...family, variants }] : [];
  });
}
export type RelicScalingParameter = {
  constantRaw?: string | null;
  minAtRarity?: string | null;
  maxAtRarity?: string | null;
  display?: RelicValueDisplay | null;
  usesChallengeRating?: boolean;
  exponent?: number;
  [key: string]: unknown;
};
export type RelicScalingContext = {
  parameters: Record<string, Record<string, RelicScalingParameter>>;
};
export type RelicDescriptionPart = {
  text: string;
  unresolved?: boolean;
  range?: boolean;
  basis?: RelicValueDisplay["basis"];
};
/** Rarity endpoints need verified display metadata; unknown units stay unresolved. */
export function resolveRelicDescription(
  template: string,
  context?: RelicScalingContext,
): RelicDescriptionPart[] {
  const parts: RelicDescriptionPart[] = [];
  let cursor = 0;
  for (const match of template.matchAll(/\{([^{}]+)\}/g)) {
    if (match.index! > cursor)
      parts.push({ text: template.slice(cursor, match.index) });
    const ref = /^([a-z0-9_]+)\.([abc])$/i.exec(match[1]);
    const parameter = ref ? context?.parameters[ref[1]]?.[ref[2]] : undefined;
    const literal = parameter?.constantRaw;
    // The verified client's GetStatModValue does not read its CR arguments;
    // GetStatModValNumberStr formats a direct ChanceSource as value * 100.
    // Permit the recorded chance range even when the legacy CCR flag is set.
    // Other CR-marked parameters remain unresolved without a supported path.
    const canShowRange =
      parameter?.usesChallengeRating === false ||
      (parameter?.usesChallengeRating === true &&
        parameter.display?.basis === "chance-percent");
    const formatted =
      parameter?.display && canShowRange
        ? formatRelicRange(
            literal ?? parameter.minAtRarity,
            literal ?? parameter.maxAtRarity,
            parameter.display,
            relicTemplateSuppliesReduction(template.slice(0, match.index)),
          )
        : undefined;
    if (formatted !== undefined) {
      const basis = parameter!.display!.basis;
      const unit = relicRangeUnit(
        basis,
        template.slice(match.index! + match[0].length),
      );
      parts.push({
        text: `${formatted}${unit}`,
        range: true,
        basis,
      });
    } else if (
      parameter?.display === undefined &&
      typeof literal === "string" &&
      /^-?\d+(?:\.\d+)?$/.test(literal) &&
      parameter?.usesChallengeRating === false &&
      parameter.exponent === 0
    )
      parts.push({ text: literal });
    else parts.push({ text: "Build-dependent", unresolved: true });
    cursor = match.index! + match[0].length;
  }
  if (cursor < template.length) parts.push({ text: template.slice(cursor) });
  return parts;
}
