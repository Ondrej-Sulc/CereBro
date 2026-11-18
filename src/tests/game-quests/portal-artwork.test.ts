import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getQuestPortalArtwork, type QuestPortalArtworkKey } from "../../data/game-quests/portal-artwork";
import manifest from "../../data/game-quests/portal-artwork.json";
import proof from "../../data/game-quests/portal-artwork-proof.json";

const expected = {
  entranceHalf: { name: "Portal_Entrance_Ring_Half", width: 170, height: 340, sha256: "0ff9acb158b053c92cf8c8deb3278d3b50d05a6f5235a5ffabae54771528d1a7" },
  summoningQuarter: { name: "Portal_Summoning_Ring_Quarter", width: 114, height: 114, sha256: "3e83937e74e058e52d88aa52ecc1bb5c5139a31fb75e36028a9e21ccc9314790" },
  exitQuarter: { name: "Portal_ExitRing_White_Quarter", width: 114, height: 114, sha256: "b0b621790a4f19d6dc17a306ae893e697edab2b16807e94abc5e97fd5b64e17b" },
  small: { name: "PortalSmall", width: 96, height: 96, sha256: "bb72453ae263261aefcddc69332db0688c28ff4667d39ed8581aa56b4166156a" },
} as const;

describe("Native quest portal artwork", () => {
  it("exposes only the four explicitly selected decorative identities", () => {
    expect(Object.keys(manifest).sort()).toEqual(Object.keys(expected).sort());
    for (const key of Object.keys(expected) as QuestPortalArtworkKey[]) {
      const record = expected[key];
      expect(getQuestPortalArtwork(key)).toEqual({
        url: `/game-quests/portal-art/${record.sha256}.png`,
        width: record.width, height: record.height, sha256: record.sha256,
      });
    }
    for (const key of [null, "", "PortalSmall", "entrancehalf", "toString", "__proto__"])
      expect(getQuestPortalArtwork(key as QuestPortalArtworkKey)).toBeUndefined();
  });

  it("preserves exact RGBA PNG bytes, native dimensions and typed source provenance", () => {
    expect(proof.usage).toBe("Decorative quest-map markers; asset names do not establish native arrival/departure roles.");
    for (const key of Object.keys(expected) as QuestPortalArtworkKey[]) {
      const pinned = expected[key];
      const record = proof.assets[key];
      const bytes = readFileSync(`web/public${manifest[key].url}`);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(pinned.sha256);
      expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
      expect(bytes.readUInt32BE(16)).toBe(pinned.width);
      expect(bytes.readUInt32BE(20)).toBe(pinned.height);
      expect(bytes[25]).toBe(6); // Native export contains RGBA, including transparent RGB.
      expect(bytes.length).toBe(record.output.byteLength);
      expect(record.selectedObject.name).toBe(pinned.name);
      expect(record.selectedObject.type).toBe("Sprite");
      expect(record.selectedObject.root).toBe("installed");
      expect(record.selectedObject.blobSha256).toBe(pinned.sha256);
      expect(record.selectedObject.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.selectedObject.rawObjectSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.nativePack.bundleSha256).toBe(record.selectedObject.sourceSha256);
      expect(record.selectedObject.sourcePath).toBe(`Resources/Data/${record.nativePack.bundleFile}`);
      expect(record.nativePack.packManifestSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.nativePack.tocSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(record.output.rgbaSha256).toBe(record.nativeDecode.rgbaSha256);
      expect(record.nativeDecode.rawObjectSha256).toBe(record.selectedObject.rawObjectSha256);
      expect(record.selectedObject.provenance.originalRect).toMatchObject({ width: pinned.width, height: pinned.height });
      expect(record.selectedObject.provenance.textureRect).toMatchObject({ width: pinned.width, height: pinned.height });
      for (const match of record.exactNameMatches) {
        expect(match.name).toBe(pinned.name);
        expect(match.blobSha256).toBe(pinned.sha256);
      }
    }
  });
});
