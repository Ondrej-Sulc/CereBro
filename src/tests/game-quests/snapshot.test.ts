import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "../../data/game-quests/manifest.json";
import { questCatalog, loadQuestMap } from "../../data/game-quests";

describe("allowlisted snapshot integrity", () => {
  it("pins every public projection and the current game BCG label source", () => {
    for (const [file, hash] of Object.entries(manifest.outputs)) {
      const data = readFileSync(resolve("src/data/game-quests", file));
      expect(createHash("sha256").update(data).digest("hex"), file).toBe(hash);
    }
    expect(manifest.labelEvidence.sha256).toBe("b821489b5451d1d6ee0927f39a80d964f6c1d3aaf13bd76531e5f77d93deba8e");
  });
  it("contains no account/progression/session capture fields", async () => {
    const forbidden = new Set(["ActiveQuests", "ExpiredQuests", "completed", "mastered", "cleared", "ownerUid", "userTitle", "userRank", "Balance", "Context", "ContextProto", "claimed", "LockedHeroesList", "LockedRelicsList", "savedTeams", "activeTeams", "token", "accountId"]);
    // The explicit possible crystal reward `token` is a public item ID, not a session token.
    const violations: string[] = [];
    function check(value: unknown, reward = false) {
      if (Array.isArray(value)) { value.forEach(v => check(v, reward)); return; }
      if (value && typeof value === "object") for (const [key, v] of Object.entries(value)) {
        if (forbidden.has(key) && !(reward && key === "token")) violations.push(key);
        check(v, reward || key === "possibleCrystals");
      }
    }
    check(questCatalog);
    for (const q of questCatalog.filter(q => q.coverage === "full-map")) check(await loadQuestMap(q.id));
    expect(violations).toEqual([]);
  });
});
