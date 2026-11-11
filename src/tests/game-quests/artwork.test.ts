import { expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { getQuestArtwork, getGroupArtwork } from "../../data/game-quests/artwork";
import { findQuest, questCatalog } from "../../data/game-quests";
import manifest from "../../data/game-quests/artwork.json";

it("binds actual quest themes and exports hash-verified native game textures", () => {
  for (const q of questCatalog) {
    const art = getQuestArtwork(q.id);
    expect(art, q.id).not.toBeNull();
    if (!art) throw new Error(`Missing bound artwork: ${q.id}`);
    expect(art.sourceHash).toBe(q.sourceHash);
    expect(manifest.themes[art.theme as keyof typeof manifest.themes].field).toBe("questboardBg");
    expect(manifest.themes[art.theme as keyof typeof manifest.themes].texturePathId).toMatch(/^-?\d+$/);
    expect(createHash("sha256").update(readFileSync(`web/public${art.url}`)).digest("hex")).toBe(art.sha256);
  }
  expect(getQuestArtwork("a05_ch01_q01")?.theme).toBe("ThemeAct04_desert");
  expect(getQuestArtwork("a04_ch04_q06")?.theme).toBe("ThemeAct04_lava");
  expect(getQuestArtwork("nonexistent")).toBeNull();
  const group = [findQuest("a04_ch04_q06")!];
  expect(getGroupArtwork(group)?.questId).toBe(group[0].id);
});
