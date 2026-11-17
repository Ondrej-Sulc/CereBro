import { describe, expect, it } from "vitest";
import {
  getNativeSpecialChampion,
  nativeSpecialsCatalog,
  readNativeSpecialsCatalog,
} from "./native-specials";

describe("source-bound native special characters", () => {
  it("retains finite coverage and exact existing identity repairs", () => {
    expect(nativeSpecialsCatalog.champions).toHaveLength(306);
    expect(nativeSpecialsCatalog.champions.filter(row => row.existingChampion === null)).toHaveLength(297);
    expect(getNativeSpecialChampion("ares")?.existingChampion?.id).toBe(799);
    expect(getNativeSpecialChampion("grandmaster_blackorder")?.existingChampion).toMatchObject({ id: 809, isPlayable: true, gameId: null });
    expect(getNativeSpecialChampion("punisher_legacy")?.isLegacy).toBe(true);
    expect(getNativeSpecialChampion("maestro")?.name).toBe("MAESTRO [maestro]");
    expect(getNativeSpecialChampion("maestro_trophy")).toBeUndefined();
    expect(getNativeSpecialChampion("Ares")).toBeUndefined();
  });

  it("leaves unestablished fields unknown and excludes reviewed source holds", () => {
    expect(nativeSpecialsCatalog.champions.every(row => row.releaseDate === null)).toBe(true);
    for (const gameId of ["tuning_normal", "striker", "howardfrontend", "jessicajones", "venomtheduckfrontend", "comingsoon", "heimdall_legacy"]) {
      expect(getNativeSpecialChampion(gameId)).toBeUndefined();
      expect(nativeSpecialsCatalog.exclusions.some(row => row.gameId === gameId)).toBe(true);
    }
    expect(getNativeSpecialChampion("chair")?.portrait).toBeNull();
    expect(getNativeSpecialChampion("doombot_tech")?.sourceBlueprints.some(row => row.userCollection)).toBe(true);
  });

  it("rejects source drift, duplicate identities, portrait mixing, or missing existing proof", () => {
    const source = structuredClone(nativeSpecialsCatalog);
    source.source.bcgSha256 = "0".repeat(64);
    expect(() => readNativeSpecialsCatalog(source)).toThrow(/source drift/);
    const duplicate = structuredClone(nativeSpecialsCatalog);
    duplicate.champions[1].gameId = duplicate.champions[0].gameId;
    expect(() => readNativeSpecialsCatalog(duplicate)).toThrow(/Duplicate/);
    const portrait = structuredClone(nativeSpecialsCatalog);
    const artwork = portrait.champions.find(row => row.portrait)?.portrait;
    if (!artwork) throw new Error("Missing fixture artwork");
    artwork.sourceBcgSha256 = "0".repeat(64);
    expect(() => readNativeSpecialsCatalog(portrait)).toThrow(/evidence/);
    const proof = structuredClone(nativeSpecialsCatalog);
    const existing = proof.champions.find(row => row.existingChampion);
    if (!existing) throw new Error("Missing fixture existing identity");
    existing.identityEvidence = null;
    expect(() => readNativeSpecialsCatalog(proof)).toThrow(/evidence/);
  });
});
