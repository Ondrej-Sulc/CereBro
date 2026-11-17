import { z } from "zod";
import snapshot from "./native-specials.json";

const identity = z.string().min(1).refine(value => value === value.trim());
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const championClass = z.enum(["SCIENCE", "MYSTIC", "COSMIC", "SKILL", "MUTANT", "TECH", "SUPERIOR"]);
const portrait = z.object({
  url: z.string().regex(/^\/game-(?:champions\/native-art|quests\/(?:permanent|progressed)-art)\/[a-f0-9]{64}\.webp$/),
  sha256: hash,
  sourceSha256: hash,
  imageId: identity,
  sourceBcgSha256: hash,
  nativePack: z.object({
    pack: identity,
    path: identity,
    packManifestSha256: hash,
    tocSha256: hash,
    binding: z.literal("PackDriver.Exists FindOptions=3: exact path, ignore extension, ordinal-ignore-case"),
  }).strict(),
}).strict();

const champion = z.object({
  gameId: identity,
  nativeName: identity,
  name: identity,
  slug: identity,
  class: championClass,
  nativeRarities: z.array(z.number().int().min(1).max(7)).min(1),
  isLegacy: z.boolean(),
  sourceCategory: z.enum(["noncollection", "reviewed-npc-template"]),
  sourceBlueprints: z.array(z.object({
    id: identity,
    rarity: z.number().int().min(1).max(7),
    userCollection: z.boolean(),
    isEventCharacter: z.boolean(),
  }).strict()).min(1),
  /** Unknown in the native definitions. Existing database dates must be preserved. */
  releaseDate: z.null(),
  existingChampion: z.object({
    id: z.number().int().positive(),
    gameId: identity.nullable(),
    isPlayable: z.boolean(),
    name: identity,
    slug: identity,
  }).strict().nullable(),
  identityEvidence: z.object({ rows: z.number().int().positive(), orderedRecordsSha256: hash }).strict().nullable(),
  portrait: portrait.nullable(),
}).strict();

const catalog = z.object({
  version: z.literal(1),
  source: z.record(identity, hash),
  coverage: z.object({
    sourceCharacters: z.literal(736),
    sourceBlueprints: z.literal(3821),
    noncollectionCharacters: z.literal(281),
    reviewedNpcTemplates: z.literal(30),
    catalogCharacters: z.literal(306),
    existingCharacters: z.literal(9),
    newCharacters: z.literal(297),
    legacyCharacters: z.literal(13),
    portraitBound: z.literal(296),
    portraitUnresolved: z.literal(10),
  }).strict(),
  policy: z.object({
    identity, releaseDate: identity, rarities: identity, existingRecords: identity,
    portraits: identity, classification: identity,
  }).strict(),
  champions: z.array(champion).length(306),
  exclusions: z.array(z.object({
    gameId: identity,
    nativeName: identity,
    reason: z.enum(["no-blueprint-class", "source-role-review", "native-placeholder"]),
    sourceModelId: identity.nullable(),
    detail: identity.nullable(),
  }).strict()).length(91),
}).strict();

export type NativeSpecialChampion = z.infer<typeof champion>;
export type NativeSpecialsCatalog = z.infer<typeof catalog>;

/** Exact native identities only. This catalog never grants roster ownership or upgrades. */
export function readNativeSpecialsCatalog(input: unknown): NativeSpecialsCatalog {
  const data = catalog.parse(input);
  if (data.source.bcgSha256 !== "b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e"
      || data.source.schemaSha256 !== "9cc5236aef043cf7e5655458e790ed1f0897f67398e37af3020bca74511e97c4"
      || data.source.packManifestSha256 !== "0baf2b2a75789331ce0cbc7e4062bcd9867387fe0b2218f7463adc34b338740d") {
    throw new Error("Native special-character source drift");
  }
  const ids = new Set<string>();
  const names = new Set<string>();
  const slugs = new Set<string>();
  for (const row of data.champions) {
    if (ids.has(row.gameId) || names.has(row.name.toLowerCase()) || slugs.has(row.slug)) throw new Error("Duplicate native special-character identity");
    ids.add(row.gameId); names.add(row.name.toLowerCase()); slugs.add(row.slug);
    const rarities = [...new Set(row.sourceBlueprints.map(blueprint => blueprint.rarity))].sort();
    if (JSON.stringify(rarities) !== JSON.stringify(row.nativeRarities)
        || row.isLegacy !== row.nativeName.includes("(LEGACY)")
        || (row.existingChampion !== null) !== (row.identityEvidence !== null)
        || (row.existingChampion && (row.name !== row.existingChampion.name || row.slug !== row.existingChampion.slug
          || (row.existingChampion.gameId !== null && row.existingChampion.gameId !== row.gameId)))
        || (row.sourceCategory === "noncollection" && row.sourceBlueprints.some(blueprint => blueprint.userCollection))
        || (row.portrait && (row.portrait.sourceBcgSha256 !== data.source.bcgSha256
          || row.portrait.nativePack.packManifestSha256 !== data.source.packManifestSha256))) {
      throw new Error(`Inconsistent native special-character evidence: ${row.gameId}`);
    }
  }
  if (data.champions.filter(row => row.existingChampion).length !== data.coverage.existingCharacters
      || data.champions.filter(row => row.isLegacy).length !== data.coverage.legacyCharacters
      || data.champions.filter(row => row.portrait).length !== data.coverage.portraitBound
      || data.exclusions.some(row => ids.has(row.gameId))) throw new Error("Native special-character coverage drift");
  return data;
}

export const nativeSpecialsCatalog = readNativeSpecialsCatalog(snapshot);
const byGameId = new Map(nativeSpecialsCatalog.champions.map(row => [row.gameId, row]));

export function getNativeSpecialChampion(gameId: string): NativeSpecialChampion | undefined {
  return byGameId.get(gameId);
}
