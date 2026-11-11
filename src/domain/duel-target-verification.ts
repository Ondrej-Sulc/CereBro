/** Offline, read-only projection of the 59.1.0 client profile contract.
 * No transport, credentials, database, status mutations, or implicit deletion.
 * A same-defender result establishes a client preview, not an activated duel.
 */
export interface EvidenceReceipt {
  kind: "static-contract-fixture" | "saved-profile-response" | "client-memory-duel-preview" | "client-memory-search-profile";
  source: string;
  capturedAt: string | null;
  importedAt: string;
  sourceSha256: string;
}

export interface BlueprintIdentity {
  championGameId: string;
  stars: number;
}

export interface DefenderProjection {
  blueprintId: string;
  championGameId: string | null;
  stars: number | null;
  rank: number | null;
  level: number | null;
  signature: number | null;
  ascension: number | null;
  statFocusAttack: string | null;
  statFocusDefense: string | null;
  cosmetic: string | null;
}

export interface ProfileProjection {
  playerId: string;
  name: string;
  binding: "top-h-first" | "legacy-ush" | "unknown";
  defender: DefenderProjection | null;
  completeBuild: boolean;
  evidence: EvidenceReceipt;
}

interface ParseIssue { path: string; reason: string }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** IDs are opaque decimal strings; never round through a JS number. */
export function parseGamePlayerId(value: unknown): string | null {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
  return BigInt(value) <= 9223372036854775807n ? value : null;
}

function instant(value: string | null | undefined): number {
  // Require timezone-bearing ISO input, so machine timezone cannot change freshness.
  return value && /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
}

/** Takes the service result dictionary (users), NOT an unknown HTTP envelope.
 * Accepts only decoded object gamestats.top. Serialized/other stat formats stay
 * unknown until observed. It deliberately does not emulate client build defaults.
 */
export function parseProfileUsers(
  payload: unknown,
  blueprints: ReadonlyMap<string, BlueprintIdentity>,
  evidence: EvidenceReceipt,
): { profiles: ProfileProjection[]; issues: ParseIssue[] } {
  if (!record(payload) || !Array.isArray(payload.users)) throw new Error("Expected service result users array");
  if (!Number.isFinite(instant(evidence.importedAt)) ||
      (evidence.capturedAt !== null && !Number.isFinite(instant(evidence.capturedAt))) ||
      !/^[a-f0-9]{64}$/.test(evidence.sourceSha256) || !evidence.source ||
      !["static-contract-fixture", "saved-profile-response", "client-memory-duel-preview", "client-memory-search-profile"].includes(evidence.kind) ||
      (evidence.kind !== "static-contract-fixture" && evidence.capturedAt === null)) {
    throw new Error("Invalid evidence receipt");
  }
  const profiles: ProfileProjection[] = [];
  const issues: ParseIssue[] = [];
  payload.users.forEach((row: unknown, index: number) => {
    const path = `users[${index}]`;
    if (!record(row)) { issues.push({ path, reason: "Expected object" }); return; }
    const playerId = parseGamePlayerId(row.uid);
    if (!playerId) { issues.push({ path: `${path}.uid`, reason: "Missing/invalid exact Int64 player ID" }); return; }
    if (typeof row.name !== "string" || row.name.trim().length === 0) {
      issues.push({ path: `${path}.name`, reason: "Missing player name" }); return;
    }
    const stats = record(row.gamestats) ? row.gamestats : {};
    const top = record(stats.top) ? stats.top : null;
    const profile: ProfileProjection = {
      playerId, name: row.name, binding: "unknown", defender: null, completeBuild: false, evidence: { ...evidence },
    };
    profiles.push(profile);
    const heroes: unknown[] | null = top && Array.isArray(top.h) ? top.h : null;
    if (!heroes || heroes.length === 0) {
      if (typeof stats.ush === "string" && stats.ush.length > 0) profile.binding = "legacy-ush";
      if (stats.top !== undefined && (!top || !heroes)) {
        issues.push({ path: `${path}.gamestats.top`, reason: "Unsupported top stat shape; no decoding inferred" });
      }
      return;
    }
    const first = heroes[0];
    const heroPath = `${path}.gamestats.top.h[0]`;
    if (!record(first) || typeof first.b !== "string" || first.b.length === 0) {
      issues.push({ path: heroPath, reason: "Invalid first top hero; do not select a later hero" }); return;
    }
    const hero = first;
    function integer(key: string, minimum: number): number | null {
      const value = hero[key];
      if (value === undefined) return null;
      if (typeof value === "number" && Number.isSafeInteger(value) && value >= minimum) return value;
      issues.push({ path: `${heroPath}.${key}`, reason: "Invalid explicit build integer" }); return null;
    }
    function optionalText(key: string): string | null {
      if (hero[key] === undefined) return null;
      if (typeof hero[key] === "string") return hero[key];
      issues.push({ path: `${heroPath}.${key}`, reason: "Invalid explicit string" }); return null;
    }
    const identity = blueprints.get(first.b);
    const validIdentity = identity && identity.championGameId.length > 0 &&
      Number.isInteger(identity.stars) && identity.stars >= 1 && identity.stars <= 7;
    const defender: DefenderProjection = {
      blueprintId: first.b,
      championGameId: validIdentity ? identity.championGameId : null,
      stars: validIdentity ? identity.stars : null,
      rank: integer("r", 1), level: integer("l", 1), signature: integer("sl", 0), ascension: integer("at", 0),
      statFocusAttack: optionalText("sfa"), statFocusDefense: optionalText("sfd"), cosmetic: optionalText("c"),
    };
    profile.binding = "top-h-first";
    profile.defender = defender;
    profile.completeBuild = [defender.championGameId, defender.stars, defender.rank, defender.level,
      defender.signature, defender.ascension].every((value) => value !== null);
  });
  return { profiles, issues };
}

/** The single-profile service callback receives the profile dictionary itself. */
export function parseSingleProfile(payload: unknown, blueprints: ReadonlyMap<string, BlueprintIdentity>, evidence: EvidenceReceipt) {
  if (evidence.kind.startsWith("client-memory-")) throw new Error("Client memory is not a single service response");
  return parseProfileUsers({ users: [payload] }, blueprints, evidence);
}

/** Explicit adapter for the bounded external reader. This synthesizes a parser
 * projection from named fields; it never claims to contain raw server stat keys.
 */
export function parseClientDuelPreview(payload: unknown, blueprints: ReadonlyMap<string, BlueprintIdentity>, evidence: EvidenceReceipt) {
  if (evidence.kind !== "client-memory-duel-preview" || !record(payload) || payload.version !== 1 ||
      payload.kind !== evidence.kind || payload.firstHeroMatchesPreview !== true ||
      typeof payload.capturedAt !== "string" || !Number.isFinite(instant(payload.capturedAt)) ||
      instant(payload.capturedAt) !== instant(evidence.capturedAt) || !record(payload.defender) ||
      ![payload.gameSha256, payload.layoutSha256, payload.helperSha256, payload.readerSha256]
        .every(value => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) ||
      !record(payload.readOnlyCapture) || payload.readOnlyCapture.accessMask !== "0x410" ||
      payload.readOnlyCapture.handleClosed !== true || payload.readOnlyCapture.serverReceipt !== false ||
      payload.readOnlyCapture.processWrites !== 0 || payload.readOnlyCapture.gameMethodCalls !== 0) {
    throw new Error("Invalid client-memory preview evidence/binding");
  }
  const defender = payload.defender;
  const identity = typeof defender.blueprintId === "string" ? blueprints.get(defender.blueprintId) : undefined;
  if (!identity || defender.championGameId !== identity.championGameId || defender.stars !== identity.stars) {
    throw new Error("Client preview differs from the exact source catalog join");
  }
  return parseProfileUsers({ users: [{ uid: payload.playerId, name: payload.name, gamestats: { top: { h: [{
    b: defender.blueprintId, r: defender.rank, l: defender.level, sl: defender.signature, at: defender.ascension,
  }] } } }] }, blueprints, evidence);
}

export interface ExistingDuelTarget {
  duelId: number;
  playerName: string;
  playerId: string | null;
  championGameId: string;
  stars?: number | null;
  lastObservedAt?: string | null;
}

export type ProfileReadResult =
  | { kind: "success"; profiles: readonly ProfileProjection[] }
  | { kind: "unavailable" | "rate-limited" | "unauthorized" | "unsupported" };

export type ReconciliationOutcome = "same-defender" | "renamed" | "defender-changed" |
  "build-incomplete" | "identity-review" | "missing" | "ambiguous" | "unavailable";

/** A review proposal only. No deletion outcome or status field exists here. */
export function reconcileDuelTarget(target: ExistingDuelTarget, result: ProfileReadResult): {
  duelId: number; outcome: ReconciliationOutcome; requiresReview: true; candidates: readonly ProfileProjection[];
} {
  const proposal = (outcome: ReconciliationOutcome, candidates: readonly ProfileProjection[] = []) =>
    ({ duelId: target.duelId, outcome, requiresReview: true as const, candidates });
  if (result.kind !== "success") return proposal("unavailable");
  if (target.playerId !== null && !parseGamePlayerId(target.playerId)) return proposal("identity-review");
  // Case folding, trimming, fuzzy matching, and champion equality cannot establish identity.
  const candidates = result.profiles.filter((profile) => target.playerId !== null
    ? profile.playerId === target.playerId : profile.name === target.playerName);
  if (candidates.length === 0) return proposal("missing");
  if (candidates.length > 1) return proposal("ambiguous", candidates);
  if (target.playerId === null) return proposal("identity-review", candidates);
  const profile = candidates[0];
  const defender = profile.defender;
  if (defender?.championGameId && (defender.championGameId !== target.championGameId ||
      (target.stars != null && defender.stars !== null && target.stars !== defender.stars))) {
    return proposal("defender-changed", candidates);
  }
  if (!profile.completeBuild) return proposal("build-incomplete", candidates);
  return proposal(profile.name === target.playerName ? "same-defender" : "renamed", candidates);
}

/** Local scheduling batches; batchSize is operator input, NOT a proven server cap.
 * Checkpoints must belong to the same immutable job/input hash and contain only
 * successful durable observations. Freshness is from source capture, never import time.
 */
export function planVerificationBatches(
  targets: readonly ExistingDuelTarget[],
  options: { batchSize: number; now: string; maxAgeMs: number; completedPlayerIds?: readonly string[] },
) {
  const now = instant(options.now);
  if (!Number.isInteger(options.batchSize) || options.batchSize < 1 || options.batchSize > 1000 ||
      !Number.isFinite(now) || !Number.isFinite(options.maxAgeMs) || options.maxAgeMs < 0) {
    throw new Error("Invalid offline batching options");
  }
  const unresolvedDuelIds: number[] = [];
  const grouped = new Map<string, ExistingDuelTarget[]>();
  for (const target of targets) {
    const playerId = parseGamePlayerId(target.playerId);
    if (!playerId) { unresolvedDuelIds.push(target.duelId); continue; }
    const group = grouped.get(playerId) ?? [];
    group.push(target);
    grouped.set(playerId, group);
  }
  const completed = new Set(options.completedPlayerIds ?? []);
  const due: string[] = [], freshPlayerIds: string[] = [], resumedPlayerIds: string[] = [];
  for (const [playerId, group] of grouped) {
    if (completed.has(playerId)) { resumedPlayerIds.push(playerId); continue; }
    const allFresh = group.every((target) => {
      const observed = instant(target.lastObservedAt);
      return Number.isFinite(observed) && observed <= now && now - observed <= options.maxAgeMs;
    });
    if (allFresh) freshPlayerIds.push(playerId); else due.push(playerId);
  }
  const batches: string[][] = [];
  for (let offset = 0; offset < due.length; offset += options.batchSize) batches.push(due.slice(offset, offset + options.batchSize));
  return { batches, unresolvedDuelIds, freshPlayerIds, resumedPlayerIds };
}

export function classifySearchCoverage(resultCount: number, requestedMax: number | null) {
  if (!Number.isSafeInteger(resultCount) || resultCount < 0 ||
      (requestedMax !== null && (!Number.isSafeInteger(requestedMax) || requestedMax < 1))) {
    throw new Error("Invalid search count");
  }
  return requestedMax !== null && resultCount >= requestedMax ? "at-requested-limit" : "coverage-unknown";
}
