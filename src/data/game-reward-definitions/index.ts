import snapshot from "./catalog.json";

export type PublicRewardDefinition = Readonly<{
  name: string;
  description?: string;
  imageUrl?: string;
}>;

type RewardSource = Readonly<Record<string, string>>;
const TYPES = new Set(["sra", "profilebadge", "emote", "utitle"]);
const HASH = /^[a-f0-9]{64}$/;
const IMAGE = /^\/game-rewards\/definitions\/([a-f0-9]{64})\.png$/;
const SOURCE_KEYS = ["captureSha256", "readerSha256", "scopeSha256", "allowlistSha256", "gameAssemblySha256", "nativeUrlProofSha256", "artworkProofSha256"];

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}

function keys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error(`Unexpected ${label} field`);
}

function text(value: unknown, maximum: number, label: string, empty = false): string {
  if (typeof value !== "string" || value.length > maximum || (!empty && !value.length) || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error(`Invalid ${label}`);
  return value;
}

/** Validates a bounded public supplement without importing shared reward data. */
export function createPublicRewardDefinitionCatalog(input: unknown): Readonly<{
  getPublicRewardDefinition: (type: string, data: string) => PublicRewardDefinition | undefined;
  source: RewardSource;
}> {
  const catalog = record(input, "public reward catalog");
  keys(catalog, ["version", "source", "rewards", "assets", "excludedResourceIds"], "catalog");
  if (catalog.version !== 1) throw new Error("Unsupported public reward catalog");
  const source = record(catalog.source, "source");
  keys(source, SOURCE_KEYS, "source");
  if (SOURCE_KEYS.some(key => typeof source[key] !== "string" || !HASH.test(source[key] as string))) throw new Error("Invalid public reward source pin");
  const assets = record(catalog.assets, "assets");
  if (Object.keys(assets).length > 128) throw new Error("Too many public reward assets");
  for (const [hash, value] of Object.entries(assets)) {
    const asset = record(value, "asset");
    keys(asset, ["imageUrl", "width", "height", "byteLength"], "asset");
    if (!HASH.test(hash) || asset.imageUrl !== `/game-rewards/definitions/${hash}.png`) throw new Error("Unbound public reward image");
    for (const dimension of [asset.width, asset.height]) if (!Number.isInteger(dimension) || (dimension as number) < 1 || (dimension as number) > 4096) throw new Error("Invalid public reward dimensions");
    if (!Number.isInteger(asset.byteLength) || (asset.byteLength as number) < 1 || (asset.byteLength as number) > 8 * 1024 * 1024) throw new Error("Invalid public reward image size");
  }
  if (!Array.isArray(catalog.rewards) || catalog.rewards.length > 128) throw new Error("Unbounded public reward definitions");
  const lookup = new Map<string, PublicRewardDefinition>();
  const usedAssets = new Set<string>();
  for (const value of catalog.rewards) {
    const row = record(value, "reward");
    keys(row, ["type", "data", "name", "description", "imageUrl", "sourcePointer", "imageField", "imageReference", "inputSha256"], "reward");
    const type = text(row.type, 32, "type");
    const data = text(row.data, 128, "identity");
    if (!TYPES.has(type) || !/^[a-zA-Z0-9_-]+$/.test(data)) throw new Error("Unsupported public reward identity");
    const key = JSON.stringify([type, data]);
    if (lookup.has(key)) throw new Error("Duplicate public reward identity");
    // Empty native badge titles are retained; callers may keep their generic label.
    const name = text(row.name, 8192, "native name", true);
    const definition: { name: string; description?: string; imageUrl?: string } = { name };
    if (row.description !== undefined) definition.description = text(row.description, 8192, "description", true);
    if (row.imageUrl !== undefined) {
      const imageUrl = text(row.imageUrl, 128, "image URL");
      const match = IMAGE.exec(imageUrl);
      if (!match || !Object.hasOwn(assets, match[1]) || row.inputSha256 !== match[1]) throw new Error("Unbound or external public reward image");
      definition.imageUrl = imageUrl;
      usedAssets.add(match[1]);
    }
    const pointer = text(row.sourcePointer, 160, "source pointer");
    if (!new RegExp(`^/definitions/${type}/[0-9]+$`).test(pointer)) throw new Error("Invalid source pointer");
    const field = text(row.imageField, 64, "image field");
    if (field !== ({ sra: "sraIconPath", profilebadge: "nativeImageInputs/nativeImage", emote: "nativeImageInputs/nativeImage", utitle: "nativeRedeemerIcon" } as Record<string, string>)[type]) throw new Error("Wrong native reward image role");
    text(row.imageReference, 8192, "image reference");
    lookup.set(key, Object.freeze(definition));
  }
  if (usedAssets.size !== Object.keys(assets).length) throw new Error("Unreferenced public reward image");
  if (!Array.isArray(catalog.excludedResourceIds) || catalog.excludedResourceIds.length > 32 || catalog.excludedResourceIds.some(id => typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) || new Set(catalog.excludedResourceIds).size !== catalog.excludedResourceIds.length) throw new Error("Invalid excluded resource identities");
  return Object.freeze({
    source: Object.freeze({ ...source }) as RewardSource,
    getPublicRewardDefinition(type: string, data: string) {
      return typeof type === "string" && typeof data === "string" ? lookup.get(JSON.stringify([type, data])) : undefined;
    },
  });
}

const catalog = createPublicRewardDefinitionCatalog(snapshot);
export const getPublicRewardDefinition = catalog.getPublicRewardDefinition;
export const publicRewardDefinitionsSource = catalog.source;
