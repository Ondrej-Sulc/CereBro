import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getStaticResourceRewardArtwork } from "../../data/game-resource-artwork";
import { projectTowerRewards } from "../../../web/src/lib/game-towers/presentation";
import { getPublicResourceDefinition } from "../../data/game-resource-definitions";

it("uses the exact direct native sp texture, without copying it to other resource IDs or types", () => {
  const art = getStaticResourceRewardArtwork("res", "sp")!;
  expect(art.reference).toBe("summonerlevelup/iconSkillPoints");
  const bytes = readFileSync(`web/public${art.url}`);
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(art.sha256);
  expect(bytes.subarray(1, 4).toString()).toBe("PNG");
  expect(getStaticResourceRewardArtwork("res", "sp-max")).toBeUndefined();
  expect(getStaticResourceRewardArtwork("inv", "sp")).toBeUndefined();
  expect(getStaticResourceRewardArtwork("res", "tower_energy")).toBeUndefined();
});

it("presents the captured resource names and images while retaining an explicitly empty native record", () => {
  const ids = ["eod2026_doomscrip", "essentia_currency", "mysterium", "sp", "sp-max", "tower_challenge_energy", "tower_energy"];
  const source = ids.map((n, index) => ({ t: "res", n, q: index + 1 }));
  const before = JSON.stringify(source);
  const views = projectTowerRewards(source, "actual-public-resource-identities", "Floor rewards");
  expect(views).toHaveLength(7);
  expect(views.find(v => v.token === "tower_energy")?.name).toBe("CLASS TOWER ENTRY");
  expect(views.find(v => v.token === "tower_challenge_energy")?.name).toBe("CHALLENGE TOWER ENTRY");
  expect(views.find(v => v.token === "sp")?.name).toBe("MASTERY POINT");
  expect(views.filter(v => v.token !== "sp-max").every(v => v.imageUrl)).toBe(true);
  expect(views.find(v => v.token === "sp")?.imageUrl).toBe(getStaticResourceRewardArtwork("res", "sp")?.url);
  expect(getPublicResourceDefinition("res", "sp-max")?.artworkStatus).toBe("native-empty");
  expect(views.find(v => v.token === "sp-max")).toMatchObject({ quantity: 5, imageUrl: null });
  expect(JSON.stringify(source)).toBe(before);
});
