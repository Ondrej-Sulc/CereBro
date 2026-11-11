import snapshot from "./catalog.json";

export type PublicResourceArtworkStatus = "resolved" | "native-empty" | "unresolved";
export type PublicResourceDefinition = Readonly<{
  name?: string;
  description?: string;
  imageUrl?: string;
  artworkStatus: PublicResourceArtworkStatus;
}>;

const IDS = ["eod2026_doomscrip", "essentia_currency", "mysterium", "sp", "sp-max", "tower_challenge_energy", "tower_energy"];
const HASH = /^[a-f0-9]{64}$/;
const IMAGE = /^\/game-rewards\/resource-definitions\/([a-f0-9]{64})\.png$/;
const SOURCE_PINS: Record<string, string> = {
  captureSha256: "3eeacc019365e8a53a1048777f6b5639fd2ce155ef0aa21e2431a7546528800d",
  readerSha256: "608f7079de57e1257eb9892ff20740a3aefd2a997328f0d935cc58342786acd0",
  scopeSha256: "783016140a72c139df2e533779a0cebb797b7d9a6ad068d2dea42e10c2ceabc0",
  layoutSha256: "a37071c661b5966d992241c1cc1c833695f592383135c6a9badd96e00bcc82d3",
  nativeProofSha256: "357b936abbeb46d7e67c471e6414403ba95eee23411568a0616cd9b09aa2b996",
  allowlistSha256: "2cfac5db2ba5788fc0411b3b12634a16eeeb43feeaeff38fdb5f4ee79f558b39",
  idsSha256: "df53a55307cc26f023f4b5fc37b627e525f08603ee1ef4f7093f4b5a728f264e",
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid public resource record");
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[]): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error("Unexpected public resource field");
}
function text(value: unknown, max: number): string {
  if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) throw new Error("Invalid native resource text");
  return value;
}

/** Exact resource metadata lookup; artwork state never classifies prize/quantity. */
export function createPublicResourceDefinitionCatalog(input: unknown) {
  const catalog = record(input);
  keys(catalog, ["version", "source", "resources", "assets"]);
  if (catalog.version !== 1) throw new Error("Unsupported public resource catalog");
  const source = record(catalog.source);
  keys(source, [...Object.keys(SOURCE_PINS), "capturedAt", "artworkProofSha256"]);
  if (Object.entries(SOURCE_PINS).some(([key, value]) => source[key] !== value)) throw new Error("Public resource source pin mismatch");
  if (source.capturedAt !== "2026-11-10T21:21:22.381997+00:00") throw new Error("Public resource capture date mismatch");
  if (source.artworkProofSha256 !== undefined && (typeof source.artworkProofSha256 !== "string" || !HASH.test(source.artworkProofSha256))) throw new Error("Invalid resource artwork proof pin");
  const assets = record(catalog.assets);
  if (Object.keys(assets).length > 7 || (Object.keys(assets).length && !source.artworkProofSha256)) throw new Error("Unbounded/unproved resource artwork");
  for (const [hash, raw] of Object.entries(assets)) {
    const asset = record(raw);
    keys(asset, ["imageUrl", "width", "height", "byteLength"]);
    if (!HASH.test(hash) || asset.imageUrl !== `/game-rewards/resource-definitions/${hash}.png`) throw new Error("Unbound resource artwork");
    for (const dimension of [asset.width, asset.height]) if (!Number.isInteger(dimension) || (dimension as number) < 1 || (dimension as number) > 4096) throw new Error("Invalid resource image dimensions");
    if (!Number.isInteger(asset.byteLength) || (asset.byteLength as number) < 1 || (asset.byteLength as number) > 8 * 1024 * 1024) throw new Error("Invalid resource image size");
  }
  if (!Array.isArray(catalog.resources) || catalog.resources.length !== IDS.length) throw new Error("Incomplete public resource catalog");
  const lookup = new Map<string, PublicResourceDefinition>();
  const used = new Set<string>();
  for (const raw of catalog.resources) {
    const row = record(raw);
    keys(row, ["type", "data", "name", "description", "iconTexture", "sourcePointer", "artworkStatus", "imageUrl", "inputSha256"]);
    const id = text(row.data, 128);
    if (row.type !== "res" || !IDS.includes(id) || lookup.has(id)) throw new Error("Duplicate/unknown public resource identity");
    const name = text(row.name, 8192), description = text(row.description, 8192), iconTexture = text(row.iconTexture, 8192);
    if (text(row.sourcePointer, 64) !== `/definitions/${IDS.indexOf(id)}`) throw new Error("Unbound public resource source pointer");
    const status = row.artworkStatus;
    if (status !== "resolved" && status !== "native-empty" && status !== "unresolved") throw new Error("Invalid resource artwork status");
    if ((status === "native-empty") !== (iconTexture === "")) throw new Error("Native-empty status must preserve exact empty IconTexture");
    const value: { name?: string; description?: string; imageUrl?: string; artworkStatus: PublicResourceArtworkStatus } = { artworkStatus: status };
    if (name) value.name = name;
    if (description) value.description = description;
    if (status === "resolved") {
      const imageUrl = text(row.imageUrl, 150), match = IMAGE.exec(imageUrl);
      if (!match || !Object.hasOwn(assets, match[1]) || row.inputSha256 !== match[1]) throw new Error("Unbound or external resource image");
      value.imageUrl = imageUrl;
      used.add(match[1]);
    } else if (row.imageUrl !== undefined || row.inputSha256 !== undefined) throw new Error("Empty/unresolved resource has invented artwork");
    lookup.set(id, Object.freeze(value));
  }
  if (used.size !== Object.keys(assets).length) throw new Error("Unreferenced resource artwork");
  return Object.freeze({
    source: Object.freeze({ ...source }),
    getPublicResourceDefinition(type: string, data: string): PublicResourceDefinition | undefined {
      return type === "res" && typeof data === "string" ? lookup.get(data) : undefined;
    },
  });
}

const catalog = createPublicResourceDefinitionCatalog(snapshot);
export const getPublicResourceDefinition = catalog.getPublicResourceDefinition;
export const publicResourceDefinitionsSource = catalog.source;
