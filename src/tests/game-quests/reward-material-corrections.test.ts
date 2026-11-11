import { expect, it } from "vitest";
import { getRewardArtwork } from "../../data/game-reward-artwork";
import legacy from "../../data/game-reward-artwork/manifest.json";
import corrected from "../../data/game-reward-artwork/corrections.json";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

it("uses the proven native overlay for the real dark full and fragment catalyst identities", () => {
  for (const type of ["ebp", "ebpf"]) for (const data of ["t6_generic", "t7_generic", "legendary_event"]) {
    const current = getRewardArtwork(type, data)!;
    const original = legacy.assets.find(a => a.type === type && a.data === data)!;
    expect(current.url).not.toBe(original.url);
    expect(current.url).toMatch(/^\/game-rewards\/(full|fragment)\/[a-f0-9]{64}\.webp$/);
    expect(current.reference).toBe(original.reference);
    expect(current.inputSha256).toBe(original.inputSha256);
    expect(current.renderTint?.rgba).toEqual(original.renderTint?.rgba);
    expect(current.renderTint?.blendMode).toBe("overlay");
  }
});

it("serves every corrected material as exact immutable bytes with the dedicated native shader proof", () => {
  expect(corrected.source.materialShader.bindingProofSha256).toBe("7d6c8c80868340a3c215545b7e1ac8f675ed3bde4f94e9b91a49889d363e93a3");
  for (const row of corrected.assets) {
    const asset = getRewardArtwork(row.type, row.data, row.role as "full" | "fragment")!;
    expect(["ebp", "ebpf"]).toContain(row.type);
    expect(asset.url).toBe(`/game-rewards/${row.role}/${row.sha256}.webp`);
    expect(asset.renderTint?.blendMode).toBe("overlay");
    const bytes = readFileSync(`web/public${asset.url}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(row.sha256);
    expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  }
  expect(getRewardArtwork("inv", "awaken_t6_mutant")?.url).toBe(legacy.assets.find(a => a.type === "inv" && a.data === "awaken_t6_mutant")?.url);
});
