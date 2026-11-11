// Server-only adapter. Never import this module from a client component.
import { realpathSync } from "node:fs";
import { open, realpath } from "node:fs/promises";
import path from "node:path";
import { loadArtworkDiscovery, requireDiscoveryFilter, type ArtworkDiscovery } from "./discovery";
import { ArtworkError, assetId, type ArtworkCard, type ArtworkDetail, type ArtworkFilters, type ArtworkSearch } from "./contract";

// Structural types keep an unconfigured Node 20 deployment buildable. The adapter
// requires Node >=22.13 with node:sqlite at runtime (tested on 24.4).
type Row = Record<string, string | number | null>;
interface Statement { all(...values: (string | number)[]): Row[]; get(...values: (string | number)[]): Row | undefined }
interface Database { prepare(sql: string): Statement; exec(sql: string): void; close(): void }
type Sqlite = { DatabaseSync: new (file: string, options: { readOnly: boolean }) => Database };
const active = "s.status IN ('done','done-with-errors')";
const joins = "FROM assets a JOIN objects o ON o.asset_id=a.id JOIN sources s ON s.id=o.source_id JOIN aliases l ON l.object_id=o.id";
const namedAlias = "l.name<>'' AND NOT(length(l.name)>=40 AND substr(l.name,1,40) NOT GLOB '*[^a-fA-F0-9]*')";
const cardColumns = `a.id,a.kind,a.width,a.height,a.format,a.alpha_min,COALESCE(MIN(CASE WHEN ${namedAlias} THEN l.name END COLLATE NOCASE),MIN(NULLIF(l.name,'')), 'Unnamed native image') name,COUNT(DISTINCT l.id) aliasCount`;
function card(row: Row): ArtworkCard {
  return { id: String(row.id), kind: row.kind as ArtworkCard["kind"], name: String(row.name || "Unnamed native image"),
    width: Number(row.width), height: Number(row.height), format: String(row.format), transparent: row.alpha_min !== null && Number(row.alpha_min) < 255, aliasCount: Number(row.aliasCount) };
}
function within(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative !== "" && !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative);
}
export class LocalArtworkLibrary {
  readonly root: string;
  private db: Database;
  private discovery?: ArtworkDiscovery;
  private facets: { sources: string[]; categories: string[]; libraryTotal: number };
  constructor(root: string) {
    const runtime = process as typeof process & { getBuiltinModule?: (name: string) => unknown };
    const [major, minor] = process.versions.node.split(".").map(Number);
    if (major < 22 || (major === 22 && minor < 13) || !runtime.getBuiltinModule) throw new ArtworkError(503, "The artwork storage adapter needs Node 22.13 or newer.");
    const sqlite = runtime.getBuiltinModule("node:sqlite") as Sqlite | undefined;
    if (!sqlite?.DatabaseSync) throw new ArtworkError(503, "SQLite artwork storage is unavailable on this server.");
    if (!path.isAbsolute(root)) throw new ArtworkError(503, "Artwork storage needs an absolute server library root.");
    this.root = realpathSync(root);
    const catalog = realpathSync(path.join(this.root, "catalog.sqlite"));
    if (!within(this.root, catalog)) throw new ArtworkError(503, "Artwork catalog is unavailable.");
    this.db = new sqlite.DatabaseSync(catalog, { readOnly: true });
    try {
      // Bounded per-process cache; immutable content is provisioned separately.
      this.db.exec("PRAGMA query_only=ON; PRAGMA busy_timeout=1000; PRAGMA cache_size=-65536; PRAGMA mmap_size=67108864;");
      if (this.db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value !== "1") throw new Error("schema");
      this.facets = {
        sources: this.db.prepare(`SELECT DISTINCT s.root value ${joins} WHERE ${active} ORDER BY value`).all().map(r => String(r.value)),
        categories: this.db.prepare(`SELECT DISTINCT l.category value ${joins} WHERE ${active} ORDER BY value`).all().map(r => String(r.value)),
        libraryTotal: Number(this.db.prepare(`SELECT COUNT(DISTINCT a.id) total ${joins} WHERE ${active}`).get()?.total),
      };
      this.discovery = loadArtworkDiscovery(catalog, this.facets.libraryTotal);
    } catch { this.db.close(); throw new ArtworkError(503, "Artwork catalog is unavailable or has an unsupported schema."); }
  }
  close() { this.db.close(); }
  search(filters: ArtworkFilters): ArtworkSearch {
    if (this.discovery) return { ...this.discovery.search(filters), ...this.facets };
    requireDiscoveryFilter(filters);
    const where = [active, "a.width>=?", "a.height>=?", "a.width<=?", "a.height<=?"];
    const values: (string | number)[] = [filters.minWidth, filters.minHeight, filters.maxWidth, filters.maxHeight];
    let sqlJoins = joins;
    if (filters.q) {
      // Literal FTS tokens, never user-supplied FTS syntax or SQL fragments.
      const tokens = filters.q.match(/[\p{L}\p{N}_]+/gu)?.slice(0, 24) ?? [];
      if (!tokens.length) where.push("0");
      else {
        sqlJoins += " JOIN alias_search f ON f.alias_id=l.id";
        where.push("alias_search MATCH ?");
        values.push(tokens.map(token => `"${token}"*`).join(" AND "));
      }
    }
    for (const [column, value] of [["a.kind", filters.kind], ["s.root", filters.source], ["l.category", filters.category]]) {
      if (value) { where.push(`${column}=?`); values.push(value); }
    }
    const base = `${sqlJoins} WHERE ${where.join(" AND ")}`;
    const total = Number(this.db.prepare(`SELECT COUNT(DISTINCT a.id) total ${base}`).get(...values)?.total);
    const page = Math.min(filters.page, Math.max(1, Math.ceil(total / filters.pageSize)));
    const items = this.db.prepare(`SELECT ${cardColumns} ${base} GROUP BY a.id ORDER BY CASE WHEN a.width<32 OR a.height<32 THEN 1 ELSE 0 END, CASE WHEN MAX(CASE WHEN ${namedAlias} THEN 1 ELSE 0 END)=1 THEN 0 ELSE 1 END,name COLLATE NOCASE,a.id LIMIT ? OFFSET ?`).all(...values, filters.pageSize, (page - 1) * filters.pageSize).map(card);
    return { items, total, page, pageSize: filters.pageSize, ...this.facets, discovery: { status: "unavailable" } };
  }
  detail(id: string): ArtworkDetail {
    assetId(id);
    const row = this.db.prepare(`SELECT ${cardColumns},a.pixel_sha256,a.blob_sha256,b.bytes ${joins} JOIN blobs b ON b.sha256=a.blob_sha256 WHERE a.id=? AND ${active} GROUP BY a.id`).get(id);
    if (!row) throw new ArtworkError(404, "Asset not found.");
    const aliases = this.db.prepare(`SELECT l.name,l.path,l.category,l.evidence,s.root source,s.path sourcePath,s.sha256 sourceSha256,o.id objectId ${joins} WHERE a.id=? AND ${active} ORDER BY l.path,l.id LIMIT 200`).all(id) as unknown as ArtworkDetail["aliases"];
    return { ...card(row), ...this.discovery?.detail(id), bytes: Number(row.bytes), pixelSha256: String(row.pixel_sha256), blobSha256: String(row.blob_sha256), aliases };
  }
  async file(id: string, variant: "preview" | "original") {
    assetId(id);
    const row = this.db.prepare(`SELECT a.preview,a.format,a.pixel_sha256,a.blob_sha256,b.path,b.bytes FROM assets a JOIN blobs b ON b.sha256=a.blob_sha256 WHERE a.id=? AND EXISTS(SELECT 1 FROM objects o JOIN sources s ON s.id=o.source_id WHERE o.asset_id=a.id AND ${active})`).get(id);
    if (!row) throw new ArtworkError(404, "Asset not found.");
    const relative = String(variant === "preview" ? row.preview : row.path);
    const folder = variant === "preview" ? "previews" : "originals";
    // Only extractor-owned content-addressed raster files, even if the catalog is damaged.
    const extensions = `png|jpe?g|webp|gif|bmp|tiff?|ico${variant === "original" ? "|bin" : ""}`;
    if (!new RegExp(`^${folder}/[a-f0-9]{2}/[a-f0-9]{64}\\.(${extensions})$`, "i").test(relative)) throw new ArtworkError(404, "Image file is unavailable.");
    let handle;
    try {
      const resolved = await realpath(path.join(this.root, relative));
      if (!within(this.root, resolved)) throw new ArtworkError(404, "Image file is unavailable.");
      handle = await open(resolved, "r");
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size < 1 || stat.size > (variant === "preview" ? 8 : 64) * 1024 * 1024 || (variant === "original" && stat.size !== Number(row.bytes))) throw new ArtworkError(404, "Image file is unavailable.");
      let ext = path.extname(relative).slice(1).toLowerCase();
      if (ext === "bin") {
        // The extractor retained one PNG under a binary suffix. Verify its
        // recorded raster format and bytes before exposing it as an image.
        const signature = Buffer.alloc(8);
        const { bytesRead } = await handle.read(signature, 0, signature.length, 0);
        if (String(row.format).toUpperCase() !== "PNG" || bytesRead !== 8 || !signature.equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new ArtworkError(404, "Image file is unavailable.");
        ext = "png";
      }
      const mime = ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", bmp: "image/bmp", tif: "image/tiff", tiff: "image/tiff", ico: "image/x-icon" } as Record<string, string>)[ext];
      // Original hash is byte-addressed; preview validator also changes on replacement.
      const etag = `"${variant === "original" ? row.blob_sha256 : `${row.pixel_sha256}-${stat.size}-${stat.mtimeMs}`}"`;
      return { handle, size: stat.size, mime, etag, filename: `artwork-${id}.${ext}` };
    } catch (error) {
      await handle?.close();
      if (error instanceof ArtworkError) throw error;
      throw new ArtworkError(404, "Image file is unavailable.");
    }
  }
}
let singleton: { root: string; library: LocalArtworkLibrary } | undefined;
export function artworkLibrary() {
  const root = process.env.GAME_ARTWORK_LIBRARY_ROOT;
  if (!root) throw new ArtworkError(503, "The artwork library is not connected yet. Try again when storage is available.");
  try {
    if (singleton?.root !== root) {
      singleton?.library.close();
      singleton = { root, library: new LocalArtworkLibrary(root) };
    }
    return singleton.library;
  } catch (error) {
    if (error instanceof ArtworkError) throw error;
    throw new ArtworkError(503, "The artwork library is temporarily unavailable.");
  }
}
