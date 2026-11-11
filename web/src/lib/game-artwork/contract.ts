export type AssetKind = "texture" | "sprite" | "loose";
export interface ArtworkCard {
  id: string; kind: AssetKind; name: string; width: number; height: number;
  format: string; transparent: boolean; aliasCount: number;
  displayName?: string; families?: string[]; match?: { label: string; basis: EvidenceBasis };
}
export type EvidenceBasis = "registry" | "native-id" | "hint" | "native";
export interface ArtworkIdentity {
  id: string; label: string; domain: string; basis: EvidenceBasis;
  reference: string; source: string; note: string; role?: string; labelSource?: string;
}
export interface ArtworkFamily { id: string; label: string; count: number }
export interface DiscoveryCoverage { total: number; registry: number; nativeId: number; anonymousRegistry: number; unclassified: number }
export interface ArtworkAlias {
  name: string; path: string; category: string; evidence: string;
  source: string; sourcePath: string; sourceSha256: string; objectId: string;
}
export interface ArtworkDetail extends ArtworkCard {
  bytes: number; pixelSha256: string; blobSha256: string; aliases: ArtworkAlias[];
  identities?: ArtworkIdentity[]; identityCount?: number; hints?: { family: string; rule: string }[];
}
export interface ArtworkSearch {
  items: ArtworkCard[]; total: number; libraryTotal: number; page: number; pageSize: number;
  sources: string[]; categories: string[];
  families?: ArtworkFamily[]; discovery?: { status: "ready" | "unavailable"; coverage?: DiscoveryCoverage };
}
export interface ArtworkFilters {
  q: string; kind: string; source: string; category: string;
  family: string; evidence: string;
  minWidth: number; minHeight: number; maxWidth: number; maxHeight: number;
  page: number; pageSize: number;
}
export class ArtworkError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function assetId(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new ArtworkError(404, "Asset not found.");
  return value;
}
export function parseFilters(params: URLSearchParams): ArtworkFilters {
  const allowed = new Set(["q", "kind", "source", "category", "family", "evidence", "minWidth", "minHeight", "maxWidth", "maxHeight", "page", "pageSize"]);
  for (const key of params.keys()) {
    if (!allowed.has(key) || params.getAll(key).length !== 1) throw new ArtworkError(400, "Invalid search parameters.");
  }
  const q = (params.get("q") ?? "").trim();
  if (q.length > 160 || /[\x00-\x1f]/.test(q)) throw new ArtworkError(400, "Search must be at most 160 characters.");
  const kind = params.get("kind") ?? "";
  if (kind && !["texture", "sprite", "loose"].includes(kind)) throw new ArtworkError(400, "Invalid artwork kind.");
  const text = (key: string) => {
    const value = params.get(key) ?? "";
    if (value.length > 80 || (value && !/^[a-zA-Z0-9_-]+$/.test(value))) throw new ArtworkError(400, "Invalid filter.");
    return value;
  };
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const raw = params.get(key);
    if (raw === null || raw === "") return fallback;
    if (!/^\d{1,6}$/.test(raw) || Number(raw) < min || Number(raw) > max) throw new ArtworkError(400, `Invalid ${key}.`);
    return Number(raw);
  };
  const family = text("family"), evidence = text("evidence");
  if (family && !["portraits","crystals","items","currencies","catalysts","combat","quests","backgrounds","interface","materials","unclassified"].includes(family)) throw new ArtworkError(400, "Invalid artwork family.");
  if (evidence && !["registry","native-id","hint"].includes(evidence)) throw new ArtworkError(400, "Invalid evidence filter.");
  const result = { q, kind, family, evidence, source: text("source"), category: text("category"),
    minWidth: integer("minWidth", 0, 0, 32768), minHeight: integer("minHeight", 0, 0, 32768),
    maxWidth: integer("maxWidth", 32768, 1, 32768), maxHeight: integer("maxHeight", 32768, 1, 32768),
    page: integer("page", 1, 1, 100000), pageSize: integer("pageSize", 48, 1, 96) };
  if (result.minWidth > result.maxWidth || result.minHeight > result.maxHeight) throw new ArtworkError(400, "Minimum dimensions exceed maximum dimensions.");
  return result;
}
