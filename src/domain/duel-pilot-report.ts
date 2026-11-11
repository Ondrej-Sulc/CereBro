/** Summarize bounded human/normal-client pilot receipts; never infer server QPS. */
import { z } from "zod";
import { classifySearchCoverage, parseGamePlayerId } from "./duel-target-verification";

const instant = z.string().refine(v => /(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)), "Expected timestamp with timezone");
const target = z.strictObject({ duelId: z.number().int().positive(), playerName: z.string().min(1), championGameId: z.string().min(1),
  rank: z.string().nullable(), source: z.string(), status: z.string() });
const observation = z.strictObject({ playerId: z.string().refine(value => parseGamePlayerId(value) === value), name: z.string().min(1), blueprintId: z.string(), championGameId: z.string(),
  stars: z.number().int().min(1).max(7), rank: z.number().int().min(1), level: z.number().int().min(1), signature: z.number().int().min(0), ascension: z.number().int().min(0) });
const attempt = z.strictObject({ duelId: z.number().int(), query: z.string(), startedAt: instant, endedAt: instant,
  searchSubmitted: z.boolean(), returnedCount: z.number().int().min(0).max(20), requestedMax: z.number().int().min(1).nullable(),
  exactNameMatches: z.number().int().min(0).max(20), previewOpened: z.boolean(), captureAttempts: z.number().int().min(0).max(3),
  resultCountSource: z.enum(["resident-search-list", "operator-observed-ui"]).default("operator-observed-ui"),
  result: z.enum(["complete", "incomplete", "ambiguous", "missing", "unavailable", "throttled"]),
  observed: observation.optional(), receiptSha256: z.string().regex(/^[a-f0-9]{64}$/).optional() });

export function summarizeDuelPilot(value: unknown) {
  const pilot = z.strictObject({ startedAt: instant, endedAt: instant, targets: z.array(target).min(1).max(20), attempts: z.array(attempt).max(20) }).parse(value);
  if (Date.parse(pilot.endedAt) < Date.parse(pilot.startedAt)) throw new Error("Pilot ended before start");
  const targets = new Map(pilot.targets.map(row => [row.duelId, row]));
  if (targets.size !== pilot.targets.length || new Set(pilot.attempts.map(a => a.duelId)).size !== pilot.attempts.length) throw new Error("Duplicate pilot target/attempt");
  let previousEnd = Date.parse(pilot.startedAt);
  const rows = pilot.attempts.map(item => {
    const original = targets.get(item.duelId);
    if (!original || original.playerName !== item.query) throw new Error("Attempt is outside the reviewed exact-query scope");
    const elapsedMs = Date.parse(item.endedAt) - Date.parse(item.startedAt);
    if (elapsedMs < 0 || Date.parse(item.startedAt) < previousEnd || Date.parse(item.endedAt) > Date.parse(pilot.endedAt) ||
        item.exactNameMatches > item.returnedCount) throw new Error("Invalid pilot timing/result counts");
    previousEnd = Date.parse(item.endedAt);
    if (item.result === "complete" && (!item.observed || !item.receiptSha256 || !item.previewOpened || item.captureAttempts < 1 ||
        !item.searchSubmitted || item.exactNameMatches !== 1 || item.observed.name !== item.query)) throw new Error("Complete row requires exact query and actual preview capture evidence");
    // Only the exact supported legacy spelling is parsed; source text is preserved.
    const legacy = original.rank?.match(/^([1-7])(?:\*|★|⭐)(?:\s+R([1-6]))?$/);
    const expectedStars = legacy ? Number(legacy[1]) : null, expectedRank = legacy?.[2] ? Number(legacy[2]) : null;
    const championChanged = item.observed ? item.observed.championGameId !== original.championGameId : null;
    const starChanged = item.observed && expectedStars !== null ? item.observed.stars !== expectedStars : null;
    const rankChanged = item.observed && expectedRank !== null ? item.observed.rank !== expectedRank : null;
    const differs = championChanged || starChanged || rankChanged;
    const assessment = item.result === "complete" ? differs ? "candidate-build-differs" : expectedRank !== null && expectedStars !== null ? "candidate-catalog-match" : "candidate-champion-match-build-unverified"
      : item.result === "missing" ? "missing-in-query" : item.result;
    return { original, ...item, elapsedMs, expectedStars, expectedRank, championChanged, starChanged, rankChanged, assessment,
      identityReviewRequired: !!item.observed, coverage: classifySearchCoverage(item.returnedCount, item.requestedMax) };
  });
  return { version: 1, scope: "bounded-normal-client-pilot", startedAt: pilot.startedAt, endedAt: pilot.endedAt,
    counts: { selected: pilot.targets.length, attempted: rows.length, complete: rows.filter(r => r.result === "complete").length,
      incomplete: rows.filter(r => r.result === "incomplete").length, ambiguous: rows.filter(r => r.result === "ambiguous").length,
      missing: rows.filter(r => r.result === "missing").length, unavailable: rows.filter(r => r.result === "unavailable").length,
      throttled: rows.filter(r => r.result === "throttled").length, championChanged: rows.filter(r => r.championChanged).length,
      rankChanged: rows.filter(r => r.rankChanged).length, starChanged: rows.filter(r => r.starChanged).length,
      querySaturated: rows.filter(r => r.coverage === "at-requested-limit").length,
      identityReviewRequired: rows.filter(r => r.identityReviewRequired).length,
      distinctObservedUids: new Set(rows.flatMap(r => r.observed ? [r.observed.playerId] : [])).size },
    measurements: { wallElapsedMs: Date.parse(pilot.endedAt) - Date.parse(pilot.startedAt), sumTargetFlowMs: rows.reduce((sum,r) => sum+r.elapsedMs,0),
      normalSearchSubmissions: rows.filter(r => r.searchSubmitted).length, previewOpens: rows.filter(r => r.previewOpened).length,
      residentCaptureAttempts: rows.reduce((sum,r) => sum+r.captureAttempts,0), serverRequests: null, serverProfilesPerSecond: null },
    bulk: { actualBulkReceipts: 0, completeness: "unverified" }, databaseWrites: 0, rows };
}
