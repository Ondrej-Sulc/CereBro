import { describe, expect, it } from "vitest";
import { compareSearchCandidateToPreview, parseClientSearchObservation } from "./duel-search-observation";
import { createDuelVerificationJob, duelReviewProposals, exportDuelCheckpoint, importDuelCheckpoint, importDuelEvidence } from "./duel-target-job";

// Sanitized shape of the 2026-11-09 normal-client observation; invented identity.
// This is neither a saved server response nor a live public-player fixture.
const core = { blueprintId: "storm_t7", championGameId: "storm", stars: 7, rank: 5, level: 65, signature: 200, ascension: 2 };
const capturedAt = "2026-11-09T13:00:00Z";
const payload = { version: 1, kind: "client-memory-search-summary", query: "Sanitized Target", capturedAt,
  returnedCount: 9, requestedMax: 10, exactNameMatches: 1,
  exactMatches: [{ rowIndex: 0, name: "Sanitized Target", playerId: "42" }],
  candidateProfile: { kind: "client-memory-search-profile", name: "Sanitized Target", playerId: "42", firstHeroMatchesTopProfile: true, defender: core },
  source: "FriendsSearchState._lastSearch + UserListState._profiles", serverReceipt: false,
  gameSha256: "a".repeat(64), layoutSha256: "b".repeat(64), routeLayoutSha256: "c".repeat(64), searchReaderSha256: "d".repeat(64),
  readOnlyCapture: { accessMask: "0x410", reads: 404, bytes: 12830, elapsedMs: 18.32, handleClosed: true } };
const catalog = new Map([["storm_t7", { championGameId: "storm", stars: 7 }]]);
const receipt = { sourceSha256: "e".repeat(64), query: "Sanitized Target", startedAt: "2026-11-09T12:59:59Z", endedAt: "2026-11-09T13:00:30Z" };
const preview = { playerId: "42", name: "Sanitized Target", completeBuild: true, defender: { ...core, statFocusAttack: null, statFocusDefense: null, cosmetic: null } };

describe("source-bound public search observations", () => {
  it("keeps search evidence distinct and matches the selected preview's core fields", () => {
    const parsed = parseClientSearchObservation(payload, catalog, receipt);
    expect(parsed).toMatchObject({ kind: "client-memory-search-summary", sourceSha256: receipt.sourceSha256, capturedAt, returnedCount: 9, completeCoreBuild: true });
    expect(compareSearchCandidateToPreview(parsed, preview)).toBe("equal-core-fields");
  });
  it("rejects identity substitution, nonexact names, duplicate candidate matches and wrong catalog joins", () => {
    expect(() => parseClientSearchObservation({ ...payload, candidateProfile: { ...payload.candidateProfile, playerId: "43" } }, catalog, receipt)).toThrow();
    expect(() => parseClientSearchObservation({ ...payload, query: "Other" }, catalog, receipt)).toThrow();
    expect(() => parseClientSearchObservation({ ...payload, exactMatches: [payload.exactMatches[0], payload.exactMatches[0]], exactNameMatches: 2 }, catalog, receipt)).toThrow();
    expect(() => parseClientSearchObservation(payload, new Map([["storm_t7", { championGameId: "cyclops", stars: 7 }]]), receipt)).toThrow();
  });
  it("preserves missing/ambiguous results without inventing a defender or deleted account", () => {
    const missing = parseClientSearchObservation({ ...payload, exactMatches: [], exactNameMatches: 0, candidateProfile: null }, catalog, receipt);
    expect(missing.candidate).toBeNull();
    expect(compareSearchCandidateToPreview(missing, preview)).toBe("unavailable");
    const ambiguous = parseClientSearchObservation({ ...payload, exactMatches: [...payload.exactMatches, { ...payload.exactMatches[0], rowIndex: 1, playerId: "43" }], exactNameMatches: 2, candidateProfile: null }, catalog, receipt);
    expect(ambiguous.exactNameMatches).toBe(2);
    expect(ambiguous.candidate).toBeNull();
  });
  it("keeps absent build values unknown and detects real build/identity differences", () => {
    const partial = parseClientSearchObservation({ ...payload, candidateProfile: { ...payload.candidateProfile, defender: { ...core, signature: undefined } } }, catalog, receipt);
    expect(partial.candidate?.defender.signature).toBeNull();
    expect(partial.completeCoreBuild).toBe(false);
    expect(compareSearchCandidateToPreview(partial, preview)).toBe("incomplete");
    const parsed = parseClientSearchObservation(payload, catalog, receipt);
    expect(compareSearchCandidateToPreview(parsed, { ...preview, defender: { ...preview.defender, signature: 199 } })).toBe("different-core-fields");
    expect(compareSearchCandidateToPreview(parsed, { ...preview, playerId: "43" })).toBe("different-identity");
  });
  it("fails closed on stale scope/timestamps, reader bounds, unclosed handles and server relabeling", () => {
    for (const altered of [{ ...payload, capturedAt: "2026-11-09T12:00:00Z" }, { ...payload, serverReceipt: true },
      { ...payload, readOnlyCapture: { ...payload.readOnlyCapture, handleClosed: false } },
      { ...payload, readOnlyCapture: { ...payload.readOnlyCapture, reads: 1025 } },
      { ...payload, readOnlyCapture: { ...payload.readOnlyCapture, bytes: 65537 } }]) {
      expect(() => parseClientSearchObservation(altered, catalog, receipt)).toThrow();
    }
  });
  it("imports search evidence as its own review-only source with idempotent checkpoint resume", () => {
    const spec = { namespace: "sanitized-search", plannedAt: receipt.startedAt, catalogSha256: "a".repeat(64), contractVersion: "59.1.0", parserVersion: "3",
      budgets: { maxRequests: 2, maxBatchSize: 1, maxAttemptsPerIdentity: 1, backoffMs: 2000 },
      targets: [{ duelId: 1, playerName: payload.query, playerId: null, championGameId: "cyclops", source: "MCOCHUB", status: "ACTIVE", rankText: "7* R4" }] };
    const input = { request: { kind: "name" as const, values: [payload.query] }, result: "success" as const, format: "client-search" as const, payload,
      evidence: { kind: "client-memory-search-profile" as const, source: "sanitized-observation", capturedAt, importedAt: receipt.endedAt, sourceSha256: receipt.sourceSha256 }, recordedAt: receipt.endedAt };
    const job = importDuelEvidence(createDuelVerificationJob(spec), input, catalog);
    expect(job.attempts[0].profiles[0].evidence.kind).toBe("client-memory-search-profile");
    expect(duelReviewProposals(job)[0]).toMatchObject({ outcome: "identity-review", championChanged: true, proposedPlayerId: "42", original: spec.targets[0] });
    const resumed = importDuelCheckpoint(exportDuelCheckpoint(job), spec);
    expect(exportDuelCheckpoint(importDuelEvidence(resumed, input, catalog))).toEqual(exportDuelCheckpoint(job));
    expect(() => importDuelEvidence(createDuelVerificationJob(spec), { ...input, format: "single-profile" }, catalog)).toThrow();
    expect(() => importDuelEvidence(createDuelVerificationJob(spec), { ...input, evidence: { ...input.evidence, kind: "saved-profile-response" } }, catalog)).toThrow();
  });
});
