/** Allowlisted resident search fields, explicitly separate from service receipts. */
import { z } from "zod";
import { parseGamePlayerId, parseProfileUsers, type BlueprintIdentity, type EvidenceReceipt, type ProfileProjection } from "./duel-target-verification";

const instant = z.string().refine(value => /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)));
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const uid = z.string().refine(value => parseGamePlayerId(value) === value);
const build = z.strictObject({ blueprintId: z.string().min(1), championGameId: z.string().min(1), stars: z.number().int().min(1).max(7),
  rank: z.number().int().min(1).nullish(), level: z.number().int().min(1).nullish(),
  signature: z.number().int().min(0).nullish(), ascension: z.number().int().min(0).nullish() });
const summary = z.strictObject({ version: z.literal(1), kind: z.literal("client-memory-search-summary"), query: z.string().min(1), capturedAt: instant,
  returnedCount: z.number().int().min(0).max(10), requestedMax: z.literal(10), exactNameMatches: z.number().int().min(0).max(10),
  exactMatches: z.array(z.strictObject({ rowIndex: z.number().int().min(0).max(9), name: z.string(), playerId: uid })).max(10),
  candidateProfile: z.strictObject({ kind: z.literal("client-memory-search-profile"), name: z.string(), playerId: uid,
    firstHeroMatchesTopProfile: z.literal(true), defender: build }).nullable(),
  source: z.literal("FriendsSearchState._lastSearch + UserListState._profiles"), serverReceipt: z.literal(false),
  gameSha256: hash, layoutSha256: hash, routeLayoutSha256: hash, searchReaderSha256: hash,
  readOnlyCapture: z.strictObject({ accessMask: z.literal("0x410"), reads: z.number().int().min(1).max(1024),
    bytes: z.number().int().min(1).max(65536), elapsedMs: z.number().min(0).max(2000), handleClosed: z.literal(true) }) });

export function parseClientSearchObservation(payload: unknown, catalog: ReadonlyMap<string, BlueprintIdentity>, context: {
  sourceSha256: string; query: string; startedAt: string; endedAt: string;
}) {
  const value = summary.parse(payload);
  hash.parse(context.sourceSha256); instant.parse(context.startedAt); instant.parse(context.endedAt);
  if (value.query !== context.query || Date.parse(value.capturedAt) < Date.parse(context.startedAt) || Date.parse(value.capturedAt) > Date.parse(context.endedAt) ||
      value.exactNameMatches !== value.exactMatches.length || value.exactNameMatches > value.returnedCount ||
      value.exactMatches.some(match => match.name !== value.query || match.rowIndex >= value.returnedCount) ||
      new Set(value.exactMatches.map(match => match.playerId)).size !== value.exactMatches.length ||
      new Set(value.exactMatches.map(match => match.rowIndex)).size !== value.exactMatches.length) {
    throw new Error("Search observation differs from exact query, source time or candidate counts");
  }
  const candidate = value.candidateProfile;
  if (candidate && (value.exactNameMatches !== 1 || candidate.name !== value.query || candidate.playerId !== value.exactMatches[0].playerId)) {
    throw new Error("Search build is not bound to the unique reviewed exact identity");
  }
  if (candidate) {
    const identity = catalog.get(candidate.defender.blueprintId);
    if (!identity || candidate.defender.championGameId !== identity.championGameId || candidate.defender.stars !== identity.stars) {
      throw new Error("Search blueprint differs from exact source catalog join");
    }
  }
  return { kind: value.kind, sourceSha256: context.sourceSha256, capturedAt: value.capturedAt,
    query: value.query, returnedCount: value.returnedCount, requestedMax: value.requestedMax, exactNameMatches: value.exactNameMatches,
    exactMatches: value.exactMatches, completeCoreBuild: !!candidate && [candidate.defender.rank, candidate.defender.level,
      candidate.defender.signature, candidate.defender.ascension].every(field => field != null),
    candidate: candidate ? { name: candidate.name, playerId: candidate.playerId, defender: { ...candidate.defender,
      rank: candidate.defender.rank ?? null, level: candidate.defender.level ?? null,
      signature: candidate.defender.signature ?? null, ascension: candidate.defender.ascension ?? null } } : null,
    sourceHashes: { gameSha256: value.gameSha256, layoutSha256: value.layoutSha256, routeLayoutSha256: value.routeLayoutSha256, searchReaderSha256: value.searchReaderSha256 },
    readOnlyCapture: value.readOnlyCapture };
}

/** Equality covers observed core fields only, never a server-activated defender. */
export function compareSearchCandidateToPreview(search: ReturnType<typeof parseClientSearchObservation>, preview: Pick<ProfileProjection, "playerId" | "name" | "defender" | "completeBuild">) {
  if (!search.candidate || !preview.defender) return "unavailable";
  if (search.candidate.playerId !== preview.playerId || search.candidate.name !== preview.name) return "different-identity";
  if (!search.completeCoreBuild || !preview.completeBuild) return "incomplete";
  return Object.entries(search.candidate.defender).every(([key,value]) => preview.defender?.[key as keyof NonNullable<typeof preview.defender>] === value)
    ? "equal-core-fields" : "different-core-fields";
}

/** Project only the reviewed exact candidate(s), retaining the search source kind.
 * This internal adapter does not claim the client payload contained wire stat keys.
 */
export function parseClientSearchProfile(payload: unknown, catalog: ReadonlyMap<string, BlueprintIdentity>, evidence: EvidenceReceipt,
  context: { query: string; startedAt: string; endedAt: string }) {
  if (evidence.kind !== "client-memory-search-profile") throw new Error("Search observation requires its own client-memory receipt kind");
  const search = parseClientSearchObservation(payload, catalog, { ...context, sourceSha256: evidence.sourceSha256 });
  if (Date.parse(search.capturedAt) !== Date.parse(evidence.capturedAt ?? "")) throw new Error("Search source capture time differs from receipt");
  return parseProfileUsers({ users: search.exactMatches.map(match => {
    const defender = search.candidate?.playerId === match.playerId ? search.candidate.defender : null;
    return { uid: match.playerId, name: match.name, ...(defender ? { gamestats: { top: { h: [{
      b: defender.blueprintId, ...(defender.rank !== null ? { r: defender.rank } : {}),
      ...(defender.level !== null ? { l: defender.level } : {}), ...(defender.signature !== null ? { sl: defender.signature } : {}),
      ...(defender.ascension !== null ? { at: defender.ascension } : {}),
    }] } } } : {}) };
  }) }, catalog, evidence);
}
