import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import manifest from "../../data/game-quests/reward-artwork/manifest.json";
import shared from "../../data/game-reward-artwork/manifest.json";
import { getQuestRewardArtwork } from "../../data/game-quests/reward-artwork";
import { getRewardArtwork } from "../../data/game-reward-artwork";

describe("Additional native quest/Tower reward artwork", () => {
  it("resolves exact reward identities without full/fragment or inventory aliases", () => {
    expect(getQuestRewardArtwork("inv", "refined_xp_token")?.url).toBeTruthy();
    expect(getQuestRewardArtwork("inv", "rankup_epic1_chemical")?.url).toBeTruthy();
    expect(getQuestRewardArtwork("gs", "4_star_cosmic_hero_crystal")?.url).toBeTruthy();
    expect(getQuestRewardArtwork("inv", "refined_xp_token", "fragment")).toBeNull();
    expect(getQuestRewardArtwork("gs", "refined_xp_token")).toBeNull();
    expect(getQuestRewardArtwork("inv", "unobserved_saga_rankup")).toBeNull();
  });
  it("keeps reused artwork source-bound and local assets content-addressed", () => {
    const identities = new Set<string>();
    for (const asset of manifest.assets) {
      const id = JSON.stringify([asset.type, asset.data, asset.role]);
      expect(identities.has(id)).toBe(false); identities.add(id);
      const resolved = getQuestRewardArtwork(asset.type, asset.data, asset.role as "full" | "fragment");
      expect(resolved?.url).toBe(getRewardArtwork(asset.type, asset.data, asset.role as "full" | "fragment")?.url ?? asset.url);
      if (resolved?.url !== asset.url) {
        expect(["ebp", "ebpf"]).toContain(asset.type);
        expect(resolved?.inputSha256).toBe(asset.inputSha256);
        expect(resolved?.reference).toBe(asset.reference);
      }
      if (asset.url.startsWith("/game-quests/reward-artwork/")) {
        expect(asset.url).toBe(`/game-quests/reward-artwork/${asset.role}/${asset.sha256}.webp`);
        const bytes = readFileSync(`web/public${asset.url}`);
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(asset.sha256);
        expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
      } else {
        expect(shared.assets.some(s => s.url === asset.url && s.sha256 === asset.sha256 && s.source === asset.source && s.reference === asset.reference && JSON.stringify(s.renderTint) === JSON.stringify("renderTint" in asset ? asset.renderTint : undefined))).toBe(true);
      }
    }
  });
});
