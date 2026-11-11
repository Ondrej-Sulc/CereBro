import { describe, expect, it } from "vitest";
import { summarizeDuelPilot } from "./duel-pilot-report";

const start = "2026-11-09T13:00:00Z", end = "2026-11-09T13:02:00Z";
const row = { duelId: 1, playerName: "Sanitized Target", championGameId: "storm", rank: "7* R4", source: "MCOCHUB", status: "ACTIVE" };
const attempt = { duelId: 1, query: row.playerName, startedAt: start, endedAt: "2026-11-09T13:00:20Z",
  searchSubmitted: true, returnedCount: 10, requestedMax: 10, exactNameMatches: 1,
  previewOpened: true, captureAttempts: 1, result: "complete" as const,
  observed: { playerId: "42", name: row.playerName, championGameId: "storm", blueprintId: "storm_t7", stars: 7, rank: 5, level: 65, signature: 200, ascension: 2 },
  receiptSha256: "a".repeat(64) };

describe("bounded real-pilot summaries", () => {
  it("separates wall time from per-target flow time and server throughput", () => {
    const report = summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row], attempts: [attempt] });
    expect(report.measurements).toMatchObject({ wallElapsedMs: 120000, sumTargetFlowMs: 20000, normalSearchSubmissions: 1, previewOpens: 1, residentCaptureAttempts: 1, serverRequests: null, serverProfilesPerSecond: null });
    expect(report.counts).toMatchObject({ complete: 1, rankChanged: 1, championChanged: 0, querySaturated: 1, identityReviewRequired: 1 });
    expect(report.rows[0]).toMatchObject({ original: row, assessment: "candidate-build-differs", identityReviewRequired: true });
  });
  it("does not infer deletion or completeness from empty or capped queries", () => {
    const report = summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row], attempts: [{ ...attempt, result: "missing", observed: undefined, receiptSha256: undefined, returnedCount: 0, exactNameMatches: 0, previewOpened: false, captureAttempts: 0 }] });
    expect(report.counts.missing).toBe(1);
    expect(report.rows[0].assessment).toBe("missing-in-query");
    expect(report.rows[0].coverage).toBe("coverage-unknown");
  });
  it("counts unique observed UIDs separately from names and retains source rows", () => {
    const second = { ...row, duelId: 2, playerName: "Another Target", source: "COCPIT" };
    const report = summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row, second], attempts: [attempt, { ...attempt, duelId: 2, query: second.playerName, observed: { ...attempt.observed, name: second.playerName }, startedAt: "2026-11-09T13:00:21Z", endedAt: "2026-11-09T13:00:40Z" }] });
    expect(report.counts.distinctObservedUids).toBe(1);
    expect(report.rows[1].original.source).toBe("COCPIT");
  });
  it("requires actual capture evidence for complete rows and rejects scope/time/count violations", () => {
    expect(() => summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row], attempts: [{ ...attempt, receiptSha256: undefined }] })).toThrow();
    expect(() => summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row], attempts: [{ ...attempt, duelId: 99 }] })).toThrow();
    expect(() => summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row], attempts: [{ ...attempt, endedAt: "2026-11-09T12:59:00Z" }] })).toThrow();
    expect(() => summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row], attempts: [{ ...attempt, exactNameMatches: 11 }] })).toThrow();
    expect(() => summarizeDuelPilot({ startedAt: start, endedAt: end, targets: Array.from({ length: 21 }, (_, i) => ({ ...row, duelId: i + 1 })), attempts: [] })).toThrow();
  });
  it("keeps incomplete, ambiguous, unavailable and throttled cases explicit", () => {
    for (const result of ["incomplete", "ambiguous", "unavailable", "throttled"] as const) {
      const report = summarizeDuelPilot({ startedAt: start, endedAt: end, targets: [row], attempts: [{ ...attempt, result, observed: undefined, receiptSha256: undefined }] });
      expect(report.counts[result]).toBe(1);
      expect(report.counts.complete).toBe(0);
    }
  });
});
