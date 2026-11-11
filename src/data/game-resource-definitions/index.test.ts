import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import snapshot from "./catalog.json";
import { createPublicResourceDefinitionCatalog, getPublicResourceDefinition, publicResourceDefinitionsSource } from "./index";

const repo = path.resolve(__dirname, "../../..");
const hash = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
const clone = () => JSON.parse(JSON.stringify(snapshot));

test("all seven exact native resource identities are represented", () => {
  assert.deepEqual(snapshot.resources.map(row => row.data), ["eod2026_doomscrip", "essentia_currency", "mysterium", "sp", "sp-max", "tower_challenge_energy", "tower_energy"]);
  for (const row of snapshot.resources) {
    const result = getPublicResourceDefinition("res", row.data);
    assert.ok(result);
    assert.ok(Object.isFrozen(result));
    assert.equal(result.name, row.name || undefined);
    assert.equal(result.description, row.description || undefined);
    assert.equal(result.artworkStatus, row.artworkStatus);
  }
  assert.equal(getPublicResourceDefinition("res", "tower_energy")?.name, "CLASS TOWER ENTRY");
  assert.equal(getPublicResourceDefinition("res", "tower_challenge_energy")?.name, "CHALLENGE TOWER ENTRY");
  assert.equal(getPublicResourceDefinition("res", "essentia_currency")?.name, "ESSENTIA");
});

test("sp metadata keeps the fixed icon override available and sp-max stays defined", () => {
  assert.deepEqual(getPublicResourceDefinition("res", "sp"), {
    artworkStatus: "native-empty", name: "MASTERY POINT", description: "Use to Rank Up Masteries.",
  });
  assert.deepEqual(getPublicResourceDefinition("res", "sp-max"), { artworkStatus: "native-empty" });
  assert.deepEqual(snapshot.resources.filter(row => row.artworkStatus === "native-empty").map(row => row.data), ["sp", "sp-max"]);
  for (const row of snapshot.resources.filter(row => row.artworkStatus === "native-empty")) assert.equal(row.iconTexture, "");
  assert.equal(getPublicResourceDefinition("res", "SP"), undefined);
  assert.equal(getPublicResourceDefinition("resource", "sp"), undefined);
  assert.equal(getPublicResourceDefinition("sra", "essentia_currency"), undefined);
  assert.equal(getPublicResourceDefinition("res", "xp"), undefined);
  assert.equal(getPublicResourceDefinition("res", "sp-max "), undefined);
});

test("five resolved images are local immutable PNGs with exact byte hashes and sizes", () => {
  assert.equal(snapshot.resources.filter(row => row.artworkStatus === "resolved").length, 5);
  assert.equal(snapshot.resources.filter(row => row.artworkStatus === "unresolved").length, 0);
  assert.equal(Object.keys(snapshot.assets).length, 5);
  for (const [sha, asset] of Object.entries(snapshot.assets)) {
    const bytes = readFileSync(path.join(repo, "web/public", asset.imageUrl));
    assert.equal(hash(bytes), sha);
    assert.equal(bytes.length, asset.byteLength);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), asset.width);
    assert.equal(bytes.readUInt32BE(20), asset.height);
  }
  assert.equal(getPublicResourceDefinition("res", "essentia_currency")?.imageUrl,
    "/game-rewards/resource-definitions/85de8eea25c67848a32f3b781df3da50dd561979191f09a5729cd761c7455ab3.png");
});

test("proof retains exact capture bytes, native fields, dates, native atlas and getter sources", () => {
  const raw = readFileSync(path.join(__dirname, "proof.json"));
  const proof = JSON.parse(raw.toString("utf8"));
  assert.equal(hash(raw), publicResourceDefinitionsSource.artworkProofSha256);
  const receipt = proof.sources["public-resource-metadata.json"];
  assert.equal(hash(Buffer.from(receipt.utf8)), "3eeacc019365e8a53a1048777f6b5639fd2ce155ef0aa21e2431a7546528800d");
  const captured = JSON.parse(receipt.utf8);
  assert.equal(publicResourceDefinitionsSource.capturedAt, captured.capturedAt);
  assert.equal(captured.capturedAt, "2026-11-10T21:21:22.381997+00:00");
  for (const [i, row] of snapshot.resources.entries()) {
    assert.deepEqual({ id: row.data, name: row.name, description: row.description, iconTexture: row.iconTexture }, captured.definitions[i]);
    assert.equal(row.sourcePointer, `/definitions/${i}`);
  }
  for (const value of Object.values(proof.sources) as { sha256: string; utf8: string }[]) assert.equal(hash(Buffer.from(value.utf8)), value.sha256);
  const native = JSON.parse(proof.sources["essentia-binding-proof.json"].utf8);
  assert.equal(native.nativeAtlasIndex.exactName, "iconCurrencyEssentia");
  assert.equal(native.nativeAtlasIndex.atlasName, "MainAtlas");
  assert.equal(native.nativeAtlasIndex.index, 365);
  assert.deepEqual(native.nativeAtlasIndex.spritePointer, { m_FileID: 0, m_PathID: 1047 });
  const rendering = JSON.parse(proof.sources["native-rendering-proof.json"].utf8);
  assert.ok(rendering.sources.some((source: { source: string }) => source.source === "Fuse.Runtime/UnityAtlasWrapper.txt"));
  assert.ok(Object.isFrozen(publicResourceDefinitionsSource));
});

test("strict validation rejects new scope, aliases, private fields, source drift and bad bounds", () => {
  const mutations = [
    (d: any) => d.resources.pop(),
    (d: any) => d.resources.push(d.resources[0]),
    (d: any) => d.resources[0].data = "sp",
    (d: any) => d.resources[0].type = "resource",
    (d: any) => d.resources[0].balance = 1,
    (d: any) => d.resources[0].sourcePointer = "/definitions/1",
    (d: any) => d.resources[0].name = "x".repeat(8193),
    (d: any) => d.source.captureSha256 = "0".repeat(64),
    (d: any) => d.source.capturedAt = "2026-11-11",
    (d: any) => d.source.account = {},
    (d: any) => d.version = 2,
    (d: any) => Object.values(d.assets).forEach((asset: any) => asset.width = 4097),
  ];
  for (const mutate of mutations) {
    const invalid = clone(); mutate(invalid);
    assert.throws(() => createPublicResourceDefinitionCatalog(invalid));
  }
});

test("strict validation rejects invented empty artwork, remote paths and unbound hashes", () => {
  const mutations = [
    (d: any) => d.resources[4].imageUrl = d.resources[0].imageUrl,
    (d: any) => d.resources[4].artworkStatus = "resolved",
    (d: any) => d.resources[0].artworkStatus = "native-empty",
    (d: any) => d.resources[0].artworkStatus = "unknown",
    (d: any) => d.resources[0].imageUrl = d.resources[0].iconTexture,
    (d: any) => d.resources[0].inputSha256 = "0".repeat(64),
    (d: any) => delete d.source.artworkProofSha256,
    (d: any) => delete d.assets[d.resources[0].inputSha256],
  ];
  for (const mutate of mutations) {
    const invalid = clone(); mutate(invalid);
    assert.throws(() => createPublicResourceDefinitionCatalog(invalid));
  }
  const unresolved = clone();
  const row = unresolved.resources[0], sha = row.inputSha256;
  row.artworkStatus = "unresolved";
  delete row.imageUrl; delete row.inputSha256; delete unresolved.assets[sha];
  assert.equal(createPublicResourceDefinitionCatalog(unresolved).getPublicResourceDefinition("res", row.data)?.artworkStatus, "unresolved");
});
