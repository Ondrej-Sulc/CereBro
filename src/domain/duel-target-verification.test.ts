import { describe, expect, it } from "vitest";
import {
  classifySearchCoverage,
  parseGamePlayerId,
  parseProfileUsers,
  planVerificationBatches,
  reconcileDuelTarget,
} from "./duel-target-verification";
import { blueprintFixture, profileFixture, receiptFixture } from "./duel-target-verification.fixtures";

const parse = (users: unknown[]) => parseProfileUsers({ users }, blueprintFixture, receiptFixture);
const target = { duelId: 1, playerName: "Fixture Player", playerId: "9007199254740993", championGameId: "storm" };

describe("offline duel profile evidence", () => {
  it("binds the first top hero and exact blueprint rarity, independently of avatar and attack", () => {
    const result = parse([profileFixture()]);
    expect(result.issues).toEqual([]);
    expect(result.profiles[0]).toMatchObject({
      playerId: "9007199254740993", name: "Fixture Player",
      defender: { blueprintId: "storm_rar", championGameId: "storm", stars: 3, rank: 4, level: 32, signature: 50, ascension: 0 },
      binding: "top-h-first", evidence: receiptFixture,
    });
  });

  it("retains identity but never promotes ush fallback defaults into a build", () => {
    const result = parse([{ uid: "12", name: "Legacy", gamestats: { ush: "storm_rar" } }]);
    expect(result.profiles[0]).toMatchObject({ playerId: "12", binding: "legacy-ush", defender: null });
  });

  it("keeps absent build fields unknown, including ascension (a is attack)", () => {
    const fixture = profileFixture();
    delete fixture.gamestats.top.h[0].at;
    delete fixture.gamestats.top.h[0].sl;
    const result = parse([fixture]);
    expect(result.profiles[0].defender).toMatchObject({ signature: null, ascension: null });
    expect(result.profiles[0].completeBuild).toBe(false);
  });

  it("does not infer champion/star from a blueprint suffix or skip an invalid first hero", () => {
    const fixture = profileFixture();
    fixture.gamestats.top.h[0].b = "unknown_leg";
    expect(parse([fixture]).profiles[0].defender).toMatchObject({ championGameId: null, stars: null });
    const invalid = { uid: "12", name: "Bad first", gamestats: { top: { h: [null, { b: "storm_rar" }] } } };
    expect(parse([invalid]).profiles[0].defender).toBeNull();
    expect(parse([invalid]).issues).not.toEqual([]);
  });

  it("rejects lossy numeric IDs, malformed fields, and invalid envelopes without dropping the whole batch", () => {
    const invalid = { ...profileFixture(), uid: 9007199254740992 };
    const result = parse([invalid, profileFixture()]);
    expect(result.profiles).toHaveLength(1);
    expect(result.issues[0].path).toBe("users[0].uid");
    expect(() => parseProfileUsers({}, blueprintFixture, receiptFixture)).toThrow("users");
    const bad = profileFixture();
    bad.gamestats.top.h[0].r = -1;
    expect(parse([bad]).profiles[0].completeBuild).toBe(false);
    expect(parse([bad]).issues.some((issue) => issue.path.endsWith(".r"))).toBe(true);
  });

  it("never copies unrelated profile/account data into its projection", () => {
    const result = parse([{ ...profileFixture(), friends: ["private"], res: { secret: "private" } }]);
    expect(JSON.stringify(result)).not.toContain("private");
  });

  it("accepts exact positive Int64 IDs only", () => {
    expect(parseGamePlayerId("9223372036854775807")).toBe("9223372036854775807");
    expect(parseGamePlayerId(42)).toBe("42");
    for (const value of ["9223372036854775808", "01", " 12", "1e3", "0", -1, 1.2, null]) {
      expect(parseGamePlayerId(value)).toBeNull();
    }
  });

  it("rejects unbound source receipts and encoded top stats without decoding by guess", () => {
    expect(() => parseProfileUsers({ users: [] }, blueprintFixture, { ...receiptFixture, kind: "saved-profile-response" })).toThrow("receipt");
    expect(() => parseProfileUsers({ users: [] }, blueprintFixture, { ...receiptFixture, sourceSha256: "bad" })).toThrow("receipt");
    const result = parse([{ uid: "12", name: "Encoded", gamestats: { top: '{"h":[]}' } }]);
    expect(result.profiles[0].completeBuild).toBe(false);
    expect(result.issues).toHaveLength(1);
  });
});

describe("identity reconciliation and offline batching", () => {
  it("uses ID through renames and does not bind a reused exact name to another ID", () => {
    const renamed = parse([{ ...profileFixture(), name: "New Name" }]).profiles;
    expect(reconcileDuelTarget(target, { kind: "success", profiles: renamed }).outcome).toBe("renamed");
    const reused = parse([{ ...profileFixture(), uid: "99" }]).profiles;
    expect(reconcileDuelTarget(target, { kind: "success", profiles: reused }).outcome).toBe("missing");
    expect(reconcileDuelTarget({ ...target, playerId: null }, { kind: "success", profiles: reused }).outcome).toBe("identity-review");
  });

  it("requires review for duplicate IDs and names, preserves status on transport failures", () => {
    const profiles = parse([profileFixture(), profileFixture()]).profiles;
    expect(reconcileDuelTarget(target, { kind: "success", profiles }).outcome).toBe("ambiguous");
    expect(reconcileDuelTarget({ ...target, playerId: null }, { kind: "success", profiles }).outcome).toBe("ambiguous");
    for (const kind of ["unavailable", "rate-limited", "unauthorized", "unsupported"] as const) {
      expect(reconcileDuelTarget(target, { kind }).outcome).toBe("unavailable");
    }
    expect(reconcileDuelTarget(target, { kind: "success", profiles: [] }).outcome).toBe("missing");
  });

  it("reports mismatches and partial evidence without labeling fixtures live-verified", () => {
    const profiles = parse([profileFixture()]).profiles;
    expect(reconcileDuelTarget(target, { kind: "success", profiles })).toMatchObject({ outcome: "same-defender", requiresReview: true });
    expect(reconcileDuelTarget({ ...target, championGameId: "hulk" }, { kind: "success", profiles }).outcome).toBe("defender-changed");
    expect(reconcileDuelTarget({ ...target, stars: 7 }, { kind: "success", profiles }).outcome).toBe("defender-changed");
    const fixture = profileFixture();
    delete fixture.gamestats.top.h[0].at;
    expect(reconcileDuelTarget(target, { kind: "success", profiles: parse([fixture]).profiles }).outcome).toBe("build-incomplete");
  });

  it("deduplicates stable IDs and applies explicit freshness and checkpoint inputs", () => {
    const plan = planVerificationBatches([
      { ...target, lastObservedAt: "2026-11-01T00:00:00.000Z" },
      { ...target, duelId: 2 },
      { ...target, duelId: 3, playerId: null },
      { ...target, duelId: 4, playerId: "12", lastObservedAt: "2026-11-09T00:00:00.000Z" },
      { ...target, duelId: 5, playerId: "13" },
    ], { batchSize: 2, now: "2026-11-09T00:01:00.000Z", maxAgeMs: 3600000, completedPlayerIds: ["13"] });
    expect(plan.batches).toEqual([["9007199254740993"]]);
    expect(plan.unresolvedDuelIds).toEqual([3]);
    expect(plan.freshPlayerIds).toEqual(["12"]);
    expect(plan.resumedPlayerIds).toEqual(["13"]);
  });

  it("does not let a fresh duplicate suppress an older association, or accept future/invalid time as fresh", () => {
    const rows = [
      { ...target, lastObservedAt: "2026-11-09T00:00:00Z" },
      { ...target, duelId: 2, lastObservedAt: "invalid" },
      { ...target, duelId: 3, playerId: "12", lastObservedAt: "2027-01-01T00:00:00Z" },
    ];
    expect(planVerificationBatches(rows, { batchSize: 1, now: "2026-11-09T00:01:00Z", maxAgeMs: 3600000 }).batches)
      .toEqual([["9007199254740993"], ["12"]]);
    expect(() => planVerificationBatches([], { batchSize: 0, now: "invalid", maxAgeMs: 0 })).toThrow();
  });

  it("flags saturation without claiming completeness below an unknown server cap", () => {
    expect(classifySearchCoverage(10, 10)).toBe("at-requested-limit");
    expect(classifySearchCoverage(2, 10)).toBe("coverage-unknown");
    expect(classifySearchCoverage(10, null)).toBe("coverage-unknown");
  });
});
