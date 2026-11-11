import { describe, expect, it } from "vitest";
import { blueprintFixture, profileFixture, receiptFixture } from "./duel-target-verification.fixtures";
import { parseClientDuelPreview, parseSingleProfile } from "./duel-target-verification";
import { createDuelVerificationJob, exportDuelCheckpoint, importDuelCheckpoint, importDuelEvidence, nextDuelRead, duelReviewProposals, defenderFingerprint } from "./duel-target-job";

const at = "2026-11-09T10:00:00.000Z";
const spec = () => ({ namespace: "mcoc-public-client", plannedAt: at, catalogSha256: "a".repeat(64), contractVersion: "59.1.0", parserVersion: "2",
  budgets: { maxRequests: 4, maxBatchSize: 2, maxAttemptsPerIdentity: 2, backoffMs: 2000 },
  targets: [{ duelId: 1, playerName: "Fixture Player", playerId: "9007199254740993", championGameId: "storm", source: "MCOCHUB", status: "ACTIVE", rankText: "7* R4" }] });
const input = () => ({ request: { kind: "uid" as const, values: ["9007199254740993"] }, result: "success" as const,
  format: "single-profile" as const, payload: profileFixture(), evidence: receiptFixture, recordedAt: at });

describe("separate public-profile evidence adapters", () => {
  it("wraps a single service dictionary without guessing an HTTP envelope", () => {
    expect(parseSingleProfile(profileFixture(), blueprintFixture, receiptFixture).profiles).toHaveLength(1);
    expect(parseSingleProfile({ data: profileFixture() }, blueprintFixture, receiptFixture).profiles).toHaveLength(0);
  });
  it("keeps client memory provenance and requires first-hero binding plus exact catalog identity", () => {
    const source = { kind: "client-memory-duel-preview", version: 1, capturedAt: at, firstHeroMatchesPreview: true,
      playerId: "42", name: "Sanitized observed shape", gameSha256: "a".repeat(64), layoutSha256: "b".repeat(64),
      helperSha256: "c".repeat(64), readerSha256: "d".repeat(64),
      defender: { blueprintId: "storm_rar", championGameId: "storm", stars: 3, rank: 5, level: 65, signature: 200, ascension: 2 },
      readOnlyCapture: { accessMask: "0x410", handleClosed: true, serverReceipt: false, processWrites: 0, gameMethodCalls: 0 } };
    const receipt = { ...receiptFixture, kind: "client-memory-duel-preview" as const, capturedAt: at };
    const parsed = parseClientDuelPreview(source, blueprintFixture, receipt);
    expect(parsed.profiles[0]).toMatchObject({ playerId: "42", defender: { ascension: 2 }, evidence: { kind: "client-memory-duel-preview" } });
    expect(() => parseClientDuelPreview(source, blueprintFixture, receiptFixture)).toThrow();
    expect(() => parseClientDuelPreview({ ...source, firstHeroMatchesPreview: false }, blueprintFixture, receipt)).toThrow();
    expect(() => parseClientDuelPreview({ ...source, defender: { ...source.defender, stars: 7 } }, blueprintFixture, receipt)).toThrow();
  });
});

describe("review-only resumable duel jobs", () => {
  it("binds checkpoint to source namespace, target snapshot, catalog and parser; rejects tampering", () => {
    const job = createDuelVerificationJob(spec());
    const checkpoint = exportDuelCheckpoint(job);
    expect(importDuelCheckpoint(checkpoint, spec())).toEqual(job);
    expect(() => importDuelCheckpoint({ ...checkpoint, sha256: "f".repeat(64) }, spec())).toThrow();
    expect(() => importDuelCheckpoint(checkpoint, { ...spec(), namespace: "other" })).toThrow();
    expect(() => importDuelCheckpoint(checkpoint, { ...spec(), catalogSha256: "b".repeat(64) })).toThrow();
    expect(() => importDuelCheckpoint(checkpoint, { ...spec(), parserVersion: "3" })).toThrow();
  });
  it("dedupes IDs, completes only usable observations, and resumes without rereading completed IDs", () => {
    const configuration = spec();
    configuration.targets.push({ ...configuration.targets[0], duelId: 2 });
    let job = createDuelVerificationJob(configuration);
    expect(nextDuelRead(job, at).request).toEqual({ kind: "uid", values: ["9007199254740993"] });
    job = importDuelEvidence(job, input(), blueprintFixture);
    expect(nextDuelRead(importDuelCheckpoint(exportDuelCheckpoint(job), configuration), at).status).toBe("complete");
    expect(duelReviewProposals(job)).toHaveLength(2);
    expect(duelReviewProposals(job)[0]).toMatchObject({ outcome: "same-defender", requiresReview: true, original: { source: "MCOCHUB", status: "ACTIVE", rankText: "7* R4" } });
  });
  it("imports each receipt idempotently without spending a second attempt", () => {
    const job = importDuelEvidence(createDuelVerificationJob(spec()), input(), blueprintFixture);
    expect(importDuelEvidence(job, { ...input(), recordedAt: "2026-11-09T10:02:00Z" }, blueprintFixture)).toEqual(job);
    expect(job.attempts).toHaveLength(1);
  });
  it("reports malformed/partial bulk results per requested ID; omitted IDs remain retryable", () => {
    const configuration = spec();
    configuration.targets.push({ ...configuration.targets[0], duelId: 2, playerId: "12", playerName: "Other" });
    let job = createDuelVerificationJob(configuration);
    job = importDuelEvidence(job, { ...input(), format: "bulk-profile", request: { kind: "uid", values: ["9007199254740993", "12"] }, payload: { users: [profileFixture()] } }, blueprintFixture);
    expect(duelReviewProposals(job).map(p => p.outcome)).toEqual(["same-defender", "missing"]);
    expect(nextDuelRead(job, "2026-11-09T10:00:02Z").request?.values).toEqual(["12"]);
    const bad = importDuelEvidence(createDuelVerificationJob(spec()), { ...input(), format: "bulk-profile", payload: { users: [null] } }, blueprintFixture);
    expect(duelReviewProposals(bad)[0].outcome).toBe("unavailable");
    expect(bad.attempts[0].issues).not.toEqual([]);
  });
  it("does not treat parser defaults or conflicting duplicate identities as complete", () => {
    const incomplete = profileFixture(); delete incomplete.gamestats.top.h[0].at;
    const job = importDuelEvidence(createDuelVerificationJob(spec()), { ...input(), payload: incomplete }, blueprintFixture);
    expect(duelReviewProposals(job)[0].outcome).toBe("build-incomplete");
    expect(nextDuelRead(job, "2026-11-09T10:00:02Z").status).toBe("ready");
    const duplicate = importDuelEvidence(createDuelVerificationJob(spec()), { ...input(), format: "bulk-profile", payload: { users: [profileFixture(), profileFixture()] } }, blueprintFixture);
    expect(duelReviewProposals(duplicate)[0].outcome).toBe("ambiguous");
    expect(nextDuelRead(duplicate, at).status).not.toBe("complete");
  });
  it("honors Retry-After, finite retry/request budgets, and terminal authorization failures", () => {
    let job = createDuelVerificationJob(spec());
    const failed = { ...input(), result: "rate-limited" as const, retryAt: "2026-11-09T10:01:00Z" };
    job = importDuelEvidence(job, failed, blueprintFixture);
    expect(nextDuelRead(job, "2026-11-09T10:00:10Z").status).toBe("waiting");
    expect(nextDuelRead(job, "2026-11-09T10:01:00Z").status).toBe("ready");
    job = importDuelEvidence(job, { ...failed, recordedAt: "2026-11-09T10:01:00Z" }, blueprintFixture);
    expect(nextDuelRead(job, "2026-11-09T10:02:00Z").status).toBe("exhausted");
    const denied = importDuelEvidence(createDuelVerificationJob(spec()), { ...input(), result: "unauthorized" }, blueprintFixture);
    expect(nextDuelRead(denied, "2026-11-09T10:02:00Z").status).toBe("blocked");
    const capped = createDuelVerificationJob({ ...spec(), budgets: { ...spec().budgets, maxRequests: 1 } });
    expect(nextDuelRead(importDuelEvidence(capped, failed, blueprintFixture), "2026-11-09T10:01:00Z").status).toBe("budget-exhausted");
  });
  it("keeps name-only identity review distinct, with champion drift and provenance retained", () => {
    const configuration = { ...spec(), targets: [{ ...spec().targets[0], playerId: null, championGameId: "hulk" }] };
    const job = importDuelEvidence(createDuelVerificationJob(configuration), { ...input(), request: { kind: "name", values: ["Fixture Player"] } }, blueprintFixture);
    expect(duelReviewProposals(job)[0]).toMatchObject({ outcome: "identity-review", championChanged: true, proposedPlayerId: "9007199254740993", requiresReview: true });
    expect(job.spec.targets[0].playerId).toBeNull();
  });
  it("rejects out-of-scope IDs, over-sized batches, early retries and out-of-order attempts", () => {
    const job = createDuelVerificationJob(spec());
    expect(() => importDuelEvidence(job, { ...input(), request: { kind: "uid", values: ["99"] } }, blueprintFixture)).toThrow();
    expect(() => importDuelEvidence(job, { ...input(), payload: { ...profileFixture(), uid: "99" } }, blueprintFixture)).toThrow();
    const failed = importDuelEvidence(job, { ...input(), result: "unavailable" }, blueprintFixture);
    expect(() => importDuelEvidence(failed, { ...input(), recordedAt: "2026-11-09T10:00:01Z" }, blueprintFixture)).toThrow();
  });
  it("fingerprints build fields deterministically, detects deltas, and preserves catalog status on failure", () => {
    let job = importDuelEvidence(createDuelVerificationJob(spec()), input(), blueprintFixture);
    const first = duelReviewProposals(job)[0].lastSuccessfulProfile!;
    expect(defenderFingerprint(first)).toBe(defenderFingerprint({ ...first, name: "Renamed" }));
    expect(defenderFingerprint(first)).not.toBe(defenderFingerprint({ ...first, defender: { ...first.defender!, ascension: 2 } }));
    // A new job binds a fresh input snapshot; old successful observations stay in the old checkpoint.
    expect(importDuelCheckpoint(exportDuelCheckpoint(job), spec()).attempts[0].profiles[0]).toEqual(first);
    job = createDuelVerificationJob({ ...spec(), budgets: { ...spec().budgets, maxRequests: 1 } });
    job = importDuelEvidence(job, { ...input(), result: "unavailable" }, blueprintFixture);
    expect(duelReviewProposals(job)[0].original.status).toBe("ACTIVE");
  });
  it("keeps the last successful partial observation when a later retry is unavailable", () => {
    const partial = profileFixture(); delete partial.gamestats.top.h[0].at;
    let job = importDuelEvidence(createDuelVerificationJob(spec()), { ...input(), payload: partial }, blueprintFixture);
    job = importDuelEvidence(job, { ...input(), result: "unavailable", recordedAt: "2026-11-09T10:00:03Z" }, blueprintFixture);
    expect(duelReviewProposals(job)[0]).toMatchObject({ outcome: "unavailable", lastSuccessfulProfile: { defender: { ascension: null } } });
  });
  it("uses source capture freshness only, and compares a prior reviewed fingerprint across jobs", () => {
    const configuration = { ...spec(), freshnessMaxAgeMs: 3600000, targets: [{ ...spec().targets[0], lastObservedAt: "2026-11-09T09:59:00Z", lastObservedFingerprint: "c".repeat(64) }] };
    expect(nextDuelRead(createDuelVerificationJob(configuration), at).status).toBe("complete");
    expect(nextDuelRead(createDuelVerificationJob(configuration), "2026-11-10T10:00:00Z").status).toBe("ready");
    const expired = { ...configuration, plannedAt: "2026-11-10T10:00:00Z" };
    expect(nextDuelRead(createDuelVerificationJob(expired), expired.plannedAt).status).toBe("ready");
    const result = importDuelEvidence(createDuelVerificationJob(expired), { ...input(), recordedAt: expired.plannedAt }, blueprintFixture);
    expect(duelReviewProposals(result)[0]).toMatchObject({ priorFingerprint: "c".repeat(64), observationChangedFromPrior: true });
    const future = { ...configuration, targets: [{ ...configuration.targets[0], lastObservedAt: "2027-01-01T00:00:00Z" }] };
    expect(nextDuelRead(createDuelVerificationJob(future), at).status).toBe("ready");
  });
  it("does not let one fresh association hide a stale duplicate UID", () => {
    const original = spec().targets[0];
    const configuration = { ...spec(), freshnessMaxAgeMs: 3600000, targets: [
      { ...original, lastObservedAt: "2026-11-09T09:59:00Z", lastObservedFingerprint: "c".repeat(64) },
      { ...original, duelId: 2, lastObservedAt: "2026-11-01T00:00:00Z", lastObservedFingerprint: "c".repeat(64) },
    ] };
    expect(nextDuelRead(createDuelVerificationJob(configuration), at).request?.values).toEqual([original.playerId]);
  });
});
