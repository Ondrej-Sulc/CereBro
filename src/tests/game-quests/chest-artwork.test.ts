import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getQuestChestArtwork } from "../../data/game-quests/chest-artwork";
import manifest from "../../data/game-quests/chest-artwork.json";

describe("Native quest chest artwork", () => {
  it("resolves only exact native chest asset identities", () => {
    expect(getQuestChestArtwork("object_chest_level03")?.asset).toBe("object_chest_level03");
    expect(getQuestChestArtwork("object_chest_book2_level01")?.asset).toBe("object_chest_book2_level01");
    for (const unknown of [null, "", "chests03", "OBJECT_CHEST_LEVEL03", "object_chest_level99", "toString", "__proto__"])
      expect(getQuestChestArtwork(unknown)).toBeUndefined();
  });

  it("retains the exact source definition, loader path and original PNG bytes", () => {
    expect(Object.keys(manifest.quests)).toHaveLength(234);
    expect(manifest.quests).toHaveProperty("eq_labyrinth");
    expect(manifest.quests).toHaveProperty("me_crucible_ch01_q01");
    expect(manifest.quests).toHaveProperty("realm3");
    expect(Object.keys(manifest.assets)).toHaveLength(12);
    expect(manifest.unresolved).toEqual([]);
    for (const [asset, record] of Object.entries(manifest.assets)) {
      const resolved = getQuestChestArtwork(asset);
      expect(resolved?.imageUrl).toBe(`/game-quests/chest-art/${record.sha256}.png`);
      expect(record.reference).toBe(`chests/${asset}`);
      expect(record.nativePack.path).toBe(`chests/${asset}.png`);
      expect(record.definitionBindings.length).toBeGreaterThan(0);
      for (const binding of record.definitionBindings) {
        const quest = manifest.quests[binding.questId as keyof typeof manifest.quests];
        expect((quest.chests as Record<string, string>)[binding.chestId]).toBe(asset);
        expect(binding.pointer).toBe(`${quest.pointer}/chests/${binding.chestId}`);
        expect(binding.sourceSha256).toBe(quest.sourceSha256);
      }
      const bytes = readFileSync(`web/public${resolved?.imageUrl}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(record.sha256);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.readUInt32BE(16)).toBe(record.width);
      expect(bytes.readUInt32BE(20)).toBe(record.height);
      expect(bytes.length).toBe(record.byteLength);
      expect(record.rgbaSha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});
