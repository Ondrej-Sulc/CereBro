import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import snapshot from "./catalog.json";
import { createPublicRewardDefinitionCatalog, getPublicRewardDefinition, publicRewardDefinitionsSource } from "./index";

function copy() { return JSON.parse(JSON.stringify(snapshot)); }

test("all 34 exact native identities have immutable local images", () => {
  assert.equal(snapshot.rewards.length, 34);
  const counts: Record<string, number> = {};
  for (const row of snapshot.rewards) {
    counts[row.type] = (counts[row.type] ?? 0) + 1;
    const value = getPublicRewardDefinition(row.type, row.data);
    assert.ok(value);
    assert.equal(value.name, row.name);
    assert.equal(value.imageUrl, row.imageUrl);
    assert.equal(Object.isFrozen(value), true);
    assert.deepEqual(Object.keys(value).sort(), row.description ? ["description", "imageUrl", "name"] : ["imageUrl", "name"]);
  }
  assert.deepEqual(counts, { emote: 3, profilebadge: 9, sra: 12, utitle: 10 });
  assert.equal(publicRewardDefinitionsSource.captureSha256, "04b720d1cabb8303d9889bd8c9b9144e0b561864084a5f19761876d813b3cbfd");
});

test("Act10 presentation uses captured SRA art and exact native title", () => {
  const selector = getPublicRewardDefinition("sra", "6a1634a25c05d7cb80f87fdd");
  assert.equal(selector?.name, "7-STAR ABYSS NEXUS CRYSTAL SELECTOR");
  const title = getPublicRewardDefinition("utitle", "spec_happilyeverafter");
  assert.equal(title?.name, "Happily Ever After?");
  assert.equal(title?.description, "Fully Explored the Epilogue Quest.");
  const badge = getPublicRewardDefinition("profilebadge", "epilogue_completion_pic_rar");
  assert.equal(badge?.name, ""); // Native badge title is absent; no ID-based naming.
  assert.ok(badge?.imageUrl);
  assert.notEqual(badge?.imageUrl, selector?.imageUrl);
});

test("titles share the native reward icon, while selector field role stays SRA", () => {
  const titles = snapshot.rewards.filter(row => row.type === "utitle");
  assert.equal(new Set(titles.map(row => row.imageUrl)).size, 1);
  assert.ok(titles.every(row => row.imageReference === "misc/title_icon" && row.imageField === "nativeRedeemerIcon"));
  assert.ok(snapshot.rewards.filter(row => row.type === "sra").every(row => row.imageField === "sraIconPath"));
});

test("lookup is exact and does not produce aliases or resource substitutions", () => {
  assert.equal(getPublicRewardDefinition("SRA", "6a1634a25c05d7cb80f87fdd"), undefined);
  assert.equal(getPublicRewardDefinition("sra", "6a1634a25c05d7cb80f87fdd "), undefined);
  assert.equal(getPublicRewardDefinition("profilebadge", "__proto__"), undefined);
  for (const id of snapshot.excludedResourceIds) assert.equal(getPublicRewardDefinition("res", id), undefined);
});

test("every PNG is content addressed and matches the catalog dimensions", () => {
  for (const [hash, row] of Object.entries(snapshot.assets)) {
    const bytes = readFileSync(resolve(__dirname, "../../../web/public", row.imageUrl.slice(1)));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), hash);
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.byteLength, row.byteLength);
    assert.equal(bytes.readUInt32BE(16), row.width);
    assert.equal(bytes.readUInt32BE(20), row.height);
  }
});

test("strict catalog rejects expanded scope, wrong roles, duplicate IDs and missing pins", () => {
  const mutations = [
    (d: ReturnType<typeof copy>) => { d.rewards.push(d.rewards[0]); },
    (d: ReturnType<typeof copy>) => { d.rewards[0].type = "res"; },
    (d: ReturnType<typeof copy>) => { d.rewards[0].account = "forbidden"; },
    (d: ReturnType<typeof copy>) => { d.rewards[0].sourcePointer = "/account/0"; },
    (d: ReturnType<typeof copy>) => { d.rewards.find((r: { type: string }) => r.type === "sra").imageField = "questIconPath"; },
    (d: ReturnType<typeof copy>) => { d.source.captureSha256 = "drift"; },
    (d: ReturnType<typeof copy>) => { delete d.source.readerSha256; },
    (d: ReturnType<typeof copy>) => { d.rewards[0].imageUrl = "https://untrusted/image.png"; },
    (d: ReturnType<typeof copy>) => { d.rewards[0].inputSha256 = "0".repeat(64); },
    (d: ReturnType<typeof copy>) => { d.rewards[0].name = "x".repeat(8193); },
    (d: ReturnType<typeof copy>) => { d.rewards = Array(129).fill(d.rewards[0]); },
    (d: ReturnType<typeof copy>) => { d.excludedResourceIds.push(d.excludedResourceIds[0]); },
  ];
  for (const mutate of mutations) {
    const d = copy(); mutate(d);
    assert.throws(() => createPublicRewardDefinitionCatalog(d));
  }
});
