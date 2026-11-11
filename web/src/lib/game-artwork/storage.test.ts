import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LocalArtworkLibrary } from "./storage";
import { assetId, parseFilters } from "./contract";
const binding = vi.hoisted(() => ({ library: null as unknown }));
vi.mock("./storage", async original => ({ ...await original<typeof import("./storage")>(), artworkLibrary: () => { if (!binding.library) throw new Error("storage offline"); return binding.library; } }));
import { artworkFile, artworkFailure } from "./http";
interface FixtureDb { exec(sql: string): void; close(): void; prepare(sql: string): { run(...values: (string | number)[]): unknown } }
const { DatabaseSync } = (process as typeof process & { getBuiltinModule(name: string): unknown }).getBuiltinModule("node:sqlite") as { DatabaseSync: new (path: string) => FixtureDb };
const id = "a".repeat(64), other = "c".repeat(64), hash = "b".repeat(64);
let root: string, outside: string, db: FixtureDb, library: LocalArtworkLibrary;
const original = `originals/bb/${hash}.png`, preview = `previews/bb/${hash}.png`;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==", "base64");
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "artwork-test-")); outside = mkdtempSync(path.join(tmpdir(), "artwork-outside-"));
  for (const file of [original, preview]) { mkdirSync(path.dirname(path.join(root, file)), { recursive: true }); writeFileSync(path.join(root, file), png); }
  db = new DatabaseSync(path.join(root, "catalog.sqlite"));
  db.exec(`CREATE TABLE meta(key TEXT,value TEXT); INSERT INTO meta VALUES('schema_version','1');
    CREATE TABLE assets(id TEXT,kind TEXT,width INTEGER,height INTEGER,format TEXT,alpha_min INTEGER,pixel_sha256 TEXT,blob_sha256 TEXT,preview TEXT);
    CREATE TABLE blobs(sha256 TEXT,path TEXT,bytes INTEGER); CREATE TABLE sources(id TEXT,root TEXT,path TEXT,sha256 TEXT,status TEXT);
    CREATE TABLE objects(id TEXT,asset_id TEXT,source_id TEXT); CREATE TABLE aliases(id TEXT,object_id TEXT,name TEXT,path TEXT,category TEXT,evidence TEXT);
    CREATE VIRTUAL TABLE alias_search USING fts5(alias_id UNINDEXED,name,path,category);`);
  db.prepare("INSERT INTO assets VALUES(?,?,?,?,?,?,?,?,?)").run(id, "sprite", 40, 40, "PNG", 0, hash, hash, preview);
  db.prepare("INSERT INTO assets VALUES(?,?,?,?,?,?,?,?,?)").run(other, "texture", 512, 256, "PNG", 255, hash, hash, preview);
  db.prepare("INSERT INTO blobs VALUES(?,?,?)").run(hash, original, png.length);
  db.exec("INSERT INTO sources VALUES('s','installed','ui/star.bundle','source-hash','done'),('stale','installed','old','hash','absent');");
  db.prepare("INSERT INTO objects VALUES(?,?,?)").run("o", id, "s");
  db.prepare("INSERT INTO objects VALUES(?,?,?)").run("o2", other, "s");
  db.prepare("INSERT INTO objects VALUES(?,?,?)").run("old", id, "stale");
  for (const [alias, object, name, category] of [["1", "o", "star", "ui"], ["2", "o", "star native", "ui"], ["3", "o2", "background", "background"], ["4", "old", "outdated", "effect"]]) {
    db.prepare("INSERT INTO aliases VALUES(?,?,?,?,?,?)").run(alias, object, name, `images/${name}`, category, "native");
    db.prepare("INSERT INTO alias_search VALUES(?,?,?,?)").run(alias, name, `images/${name}`, category);
  }
  library = new LocalArtworkLibrary(root); binding.library = library;
});
afterEach(() => { binding.library = null; library.close(); db.close(); rmSync(root, { recursive: true, force: true }); rmSync(outside, { recursive: true, force: true }); });
describe("catalog adapter boundaries", () => {
  it("deduplicates aliases, combines filters, and returns stable bounded pages", () => {
    const result = library.search(parseFilters(new URLSearchParams("q=star&kind=sprite&source=installed&category=ui&minWidth=40&maxHeight=40&pageSize=1&page=999")));
    expect(result).toMatchObject({ total: 1, libraryTotal: 2, page: 1 }); expect(result.items[0]).toMatchObject({ id, aliasCount: 2 });
    expect(library.search(parseFilters(new URLSearchParams("pageSize=1&page=2"))).items[0].id).toBe(id);
    expect(library.search(parseFilters(new URLSearchParams("q=outdated"))).total).toBe(0);
    expect(library.search(parseFilters(new URLSearchParams("q=' OR 1=1 --"))).total).toBe(0);
    expect(library.detail(id).aliases).toHaveLength(2);
  });
  it.each(["page=-1", "page=1.5", "pageSize=10000", "q=" + "x".repeat(161), "kind=sql", "source=../../", "minWidth=99&maxWidth=2", "page=1&page=2", "path=/secret"])("rejects malformed filters: %s", query => {
    expect(() => parseFilters(new URLSearchParams(query))).toThrow();
  });
  it("rejects IDs and unknown assets without path lookup", async () => {
    expect(() => assetId("../secret")).toThrow();
    expect(() => library.detail("d".repeat(64))).toThrow("not found");
    await expect(library.file("d".repeat(64), "original")).rejects.toThrow("not found");
  });
  it("refuses traversal, absolute paths and missing catalog files", async () => {
    for (const value of ["../secret.png", path.join(outside, "secret.png"), `originals/bb/${"f".repeat(64)}.png`]) {
      db.prepare("UPDATE blobs SET path=?").run(value);
      await expect(library.file(id, "original")).rejects.toThrow("unavailable");
    }
  });
  it("realpath blocks catalog-owned paths redirected by a directory junction", async () => {
    writeFileSync(path.join(outside, `${hash}.png`), png);
    rmSync(path.join(root, "originals/bb"), { recursive: true });
    symlinkSync(outside, path.join(root, "originals/bb"), process.platform === "win32" ? "junction" : "dir");
    await expect(library.file(id, "original")).rejects.toThrow("unavailable");
  });
  it("rejects byte-size drift and an unsupported catalog schema", async () => {
    db.exec("UPDATE blobs SET bytes=999; UPDATE meta SET value='999'");
    await expect(library.file(id, "original")).rejects.toThrow("unavailable");
    expect(() => new LocalArtworkLibrary(root)).toThrow("schema");
  });
  it("never permits catalog writes and requires an absolute trusted root", () => {
    expect(() => (library as unknown as { db: FixtureDb }).db.exec("CREATE TABLE forbidden(id TEXT)")).toThrow();
    expect(() => new LocalArtworkLibrary("relative-library")).toThrow("absolute");
  });
  it("bounds image file sizes even when catalog byte lengths agree", async () => {
    truncateSync(path.join(root, original), 64 * 1024 * 1024 + 1);
    db.prepare("UPDATE blobs SET bytes=?").run(64 * 1024 * 1024 + 1);
    await expect(library.file(id, "original")).rejects.toThrow("unavailable");
    truncateSync(path.join(root, preview), 8 * 1024 * 1024 + 1);
    await expect(library.file(id, "preview")).rejects.toThrow("unavailable");
  });
  it("caps slow streams, then releases their handles and capacity on cancellation", async () => {
    writeFileSync(path.join(root, original), Buffer.alloc(1024 * 1024));
    db.prepare("UPDATE blobs SET bytes=?").run(1024 * 1024);
    const request = new Request(`http://localhost/api/game-artwork/${id}/original`);
    const responses: Response[] = [];
    try {
      for (let i = 0; i < 32; i++) responses.push(await artworkFile(request, id, "original"));
      expect(responses.every(response => response.status === 200)).toBe(true);
      expect((await artworkFile(request, id, "original")).status).toBe(429);
    } finally {
      await Promise.all(responses.map(response => response.body?.cancel()));
    }
    await new Promise(resolve => setImmediate(resolve));
    const recovered = await artworkFile(request, id, "original");
    expect(recovered.status).toBe(200);
    await recovered.body?.cancel();
    await new Promise(resolve => setImmediate(resolve));
  });
  it("streams exact bytes with MIME, safe filenames, HEAD and conditional caching", async () => {
    const request = new Request(`http://localhost/api/game-artwork/${id}/original?download=1`);
    const response = await artworkFile(request, id, "original");
    expect(response.status).toBe(200); expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="artwork-${id}.png"`);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    const cached = await artworkFile(new Request(request, { headers: { "if-none-match": response.headers.get("etag")! } }), id, "original");
    expect(cached.status).toBe(304); expect(await cached.text()).toBe("");
    const weak = await artworkFile(new Request(request, { headers: { "if-none-match": `W/${response.headers.get("etag")}` } }), id, "original");
    expect(weak.status).toBe(304);
    const head = await artworkFile(new Request(request, { method: "HEAD" }), id, "original"); expect(head.status).toBe(200); expect(await head.text()).toBe("");
    const unknown = await artworkFile(request, "f".repeat(64), "preview"); expect(unknown.status).toBe(404);
    binding.library = null;
    expect((await artworkFile(request, id, "preview")).status).toBe(503);
    expect(await artworkFailure(new Error("C:/private/secret")).text()).not.toContain("private");
  });
  it("serves a catalog PNG retained as bin with a verified signature and safe PNG filename", async () => {
    const binary = `originals/bb/${hash}.bin`;
    writeFileSync(path.join(root, binary), png);
    db.prepare("UPDATE blobs SET path=?").run(binary);
    const response = await artworkFile(new Request(`http://localhost/api/game-artwork/${id}/original?download=1`), id, "original");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("content-disposition")).toBe(`attachment; filename="artwork-${id}.png"`);
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);

    writeFileSync(path.join(root, binary), Buffer.alloc(png.length));
    await expect(library.file(id, "original")).rejects.toThrow("unavailable");
    writeFileSync(path.join(root, binary), png);
    db.exec("UPDATE assets SET format='SVG'");
    await expect(library.file(id, "original")).rejects.toThrow("unavailable");
  });
});
