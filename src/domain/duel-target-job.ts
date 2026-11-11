/** File-backed dry runs only. Planning/import/review have no game or DB transport. */
import { createHash } from "node:crypto";
import { z } from "zod";
import { type BlueprintIdentity, type EvidenceReceipt, type ProfileProjection, parseClientDuelPreview,
  parseGamePlayerId, parseProfileUsers, parseSingleProfile, reconcileDuelTarget } from "./duel-target-verification";
import { parseClientSearchProfile } from "./duel-search-observation";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const timestamp = z.string().refine(v => /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v)), "Expected ISO timestamp with timezone");
const playerId = z.string().refine(v => parseGamePlayerId(v) === v, "Expected exact positive Int64 ID");
const targetSchema = z.strictObject({ duelId: z.number().int().positive(), playerName: z.string().min(1),
  playerId: playerId.nullable(), championGameId: z.string().min(1), stars: z.number().int().min(1).max(7).nullable().optional(),
  source: z.string().min(1), status: z.enum(["ACTIVE", "OUTDATED", "ARCHIVED", "SUGGESTED"]), rankText: z.string().nullable(),
  lastObservedAt: timestamp.nullable().optional(), lastObservedFingerprint: digest.nullable().optional() });
const specSchema = z.strictObject({ namespace: z.string().min(1), plannedAt: timestamp, catalogSha256: digest, contractVersion: z.string().min(1), parserVersion: z.string().min(1),
  freshnessMaxAgeMs: z.number().int().min(0).optional(),
  budgets: z.strictObject({ maxRequests: z.number().int().min(1).max(1000), maxBatchSize: z.number().int().min(1).max(20),
    maxAttemptsPerIdentity: z.number().int().min(1).max(5), backoffMs: z.number().int().min(1).max(86400000) }),
  targets: z.array(targetSchema).min(1).max(100000) });
export type DuelJobSpec = z.infer<typeof specSchema>;

const receiptSchema = z.strictObject({ kind: z.enum(["static-contract-fixture", "saved-profile-response", "client-memory-duel-preview", "client-memory-search-profile"]),
  source: z.string().min(1), capturedAt: timestamp.nullable(), importedAt: timestamp, sourceSha256: digest });
const defenderSchema = z.strictObject({ blueprintId: z.string(), championGameId: z.string().nullable(), stars: z.number().int().nullable(),
  rank: z.number().int().nullable(), level: z.number().int().nullable(), signature: z.number().int().nullable(), ascension: z.number().int().nullable(),
  statFocusAttack: z.string().nullable(), statFocusDefense: z.string().nullable(), cosmetic: z.string().nullable() });
const profileSchema = z.strictObject({ playerId, name: z.string().min(1), binding: z.enum(["top-h-first", "legacy-ush", "unknown"]),
  defender: defenderSchema.nullable(), completeBuild: z.boolean(), evidence: receiptSchema });
const requestSchema = z.strictObject({ kind: z.enum(["uid", "name"]), values: z.array(z.string().min(1)).min(1).max(20) });
const resultSchema = z.enum(["success", "missing", "not-found", "unavailable", "rate-limited", "unauthorized", "unsupported"]);
const attemptSchema = z.strictObject({ id: digest, request: requestSchema, result: resultSchema, recordedAt: timestamp, retryAt: timestamp,
  profiles: z.array(profileSchema).max(20), issues: z.array(z.strictObject({ path: z.string(), reason: z.string() })),
  receipt: receiptSchema.nullable() });
const stateSchema = z.strictObject({ version: z.literal(1), mode: z.literal("DRY_RUN"), jobId: digest, spec: specSchema, attempts: z.array(attemptSchema).max(1000) });
export type DuelVerificationJob = z.infer<typeof stateSchema>;
type Request = z.infer<typeof requestSchema>;
type Result = z.infer<typeof resultSchema>;
type Attempt = z.infer<typeof attemptSchema>;

function normalizedSpec(value: unknown): DuelJobSpec {
  const spec = specSchema.parse(value);
  if (new Set(spec.targets.map(t => t.duelId)).size !== spec.targets.length) throw new Error("Duplicate Duel row IDs");
  spec.targets.sort((a, b) => a.duelId - b.duelId);
  return spec;
}

export function createDuelVerificationJob(value: unknown): DuelVerificationJob {
  const spec = normalizedSpec(value);
  return { version: 1, mode: "DRY_RUN", jobId: hash(spec), spec, attempts: [] };
}

const key = (kind: Request["kind"], value: string) => JSON.stringify([kind, value]);
const targetKey = (target: DuelJobSpec["targets"][number]) => key(target.playerId ? "uid" : "name", target.playerId ?? target.playerName);
const matching = (attempt: Attempt, kind: Request["kind"], value: string) => attempt.profiles.filter(p => kind === "uid" ? p.playerId === value : p.name === value);
const usable = (attempt: Attempt, kind: Request["kind"], value: string) => {
  const profiles = matching(attempt, kind, value);
  return attempt.result === "success" && profiles.length === 1 && profiles[0].completeBuild;
};

function historyIndex(job: DuelVerificationJob) {
  const index = new Map<string, Attempt[]>();
  for (const attempt of job.attempts) for (const value of attempt.request.values) {
    const unit = key(attempt.request.kind, value);
    const history = index.get(unit) ?? [];
    history.push(attempt);
    index.set(unit, history);
  }
  return index;
}

function units(job: DuelVerificationJob, evaluatedAt = job.spec.plannedAt) {
  const grouped = new Map<string, DuelJobSpec["targets"]>();
  for (const target of job.spec.targets) {
    const identity = targetKey(target), group = grouped.get(identity) ?? [];
    group.push(target); grouped.set(identity, group);
  }
  const histories = historyIndex(job);
  return [...grouped].map(([identity, associations]) => {
    const target = associations[0];
    const kind = target.playerId ? "uid" as const : "name" as const;
    const value = target.playerId ?? target.playerName;
    const attempts = histories.get(identity) ?? [];
    const last = attempts.at(-1);
    const planned = Date.parse(evaluatedAt);
    const fresh = kind === "uid" && job.spec.freshnessMaxAgeMs !== undefined && associations.every(t =>
      !!t.lastObservedFingerprint && !!t.lastObservedAt && Date.parse(t.lastObservedAt) <= planned &&
      planned - Date.parse(t.lastObservedAt) <= job.spec.freshnessMaxAgeMs!);
    return { kind, value, attempts, last, complete: !!last && usable(last, kind, value), fresh };
  });
}

/** Returns the next bounded request description; never dispatches it. */
export function nextDuelRead(job: DuelVerificationJob, now: string): { status: string; request?: Request; nextEligibleAt?: string } {
  const time = Date.parse(timestamp.parse(now));
  if (job.attempts.some(a => ["unauthorized", "unsupported"].includes(a.result))) return { status: "blocked" };
  const pending = units(job, now).filter(unit => !unit.complete && !unit.fresh);
  if (pending.length === 0) return { status: "complete" };
  if (job.attempts.length >= job.spec.budgets.maxRequests) return { status: "budget-exhausted" };
  const eligible = pending.filter(unit => unit.attempts.length < job.spec.budgets.maxAttemptsPerIdentity);
  if (eligible.length === 0) return { status: "exhausted" };
  // Any throttle delays the entire source-namespaced queue, including unattempted IDs.
  const globalRetry = Math.max(0, ...job.attempts.filter(a => a.result === "rate-limited").map(a => Date.parse(a.retryAt)));
  const ready = eligible.filter(unit => time >= Math.max(globalRetry, Date.parse(unit.last?.retryAt ?? "1970-01-01T00:00:00Z")));
  if (ready.length === 0) return { status: "waiting", nextEligibleAt: new Date(Math.max(globalRetry,
    Math.min(...eligible.map(unit => Date.parse(unit.last?.retryAt ?? "1970-01-01T00:00:00Z"))))).toISOString() };
  const first = ready[0];
  // A name lookup has no proven bulk contract. Only known UIDs form a batch.
  return { status: "ready", request: { kind: first.kind, values: first.kind === "name" ? [first.value] : ready.filter(u => u.kind === "uid").slice(0, job.spec.budgets.maxBatchSize).map(u => u.value) } };
}

export interface DuelEvidenceInput {
  request: Request;
  result: Result;
  format?: "single-profile" | "bulk-profile" | "client-preview" | "client-search";
  payload?: unknown;
  evidence?: EvidenceReceipt;
  recordedAt: string;
  retryAt?: string;
}

/** Import existing evidence under a budget. Source kind and receipt time survive.
 * A parse issue quarantines the attempt instead of producing clean missing IDs.
 */
export function importDuelEvidence(job: DuelVerificationJob, input: DuelEvidenceInput, blueprints: ReadonlyMap<string, BlueprintIdentity>): DuelVerificationJob {
  const request = requestSchema.parse(input.request);
  const recordedAt = timestamp.parse(input.recordedAt);
  const result = resultSchema.parse(input.result);
  if (new Set(request.values).size !== request.values.length || request.values.length > job.spec.budgets.maxBatchSize ||
      (request.kind === "name" && request.values.length !== 1)) throw new Error("Invalid bounded request");
  const allowed = new Set(job.spec.targets.map(targetKey));
  if (request.values.some(value => !allowed.has(key(request.kind, value)))) throw new Error("Request outside job snapshot");
  const receipt = input.evidence ? receiptSchema.parse(input.evidence) : null;
  if (result === "success" && !receipt) throw new Error("Successful evidence requires a receipt");
  if (receipt?.kind !== "static-contract-fixture" && receipt?.capturedAt && Date.parse(receipt.capturedAt) > Date.parse(recordedAt)) {
    throw new Error("Observation capture is after import attempt");
  }
  const receiptKey = result === "success" && receipt ? { kind: receipt.kind, source: receipt.source, capturedAt: receipt.capturedAt, sourceSha256: receipt.sourceSha256 } : { recordedAt };
  const id = hash({ request, result, receipt: receiptKey });
  if (job.attempts.some(attempt => attempt.id === id)) return job;
  if (job.attempts.some(a => Date.parse(a.recordedAt) > Date.parse(recordedAt))) throw new Error("Out-of-order attempt time");
  const next = nextDuelRead(job, recordedAt);
  if (next.status !== "ready") throw new Error(`Job cannot import a new attempt: ${next.status}`);
  const stateUnits = units(job, recordedAt);
  const globalRetry = Math.max(0, ...job.attempts.filter(a => a.result === "rate-limited").map(a => Date.parse(a.retryAt)));
  for (const value of request.values) {
    const unit = stateUnits.find(u => u.kind === request.kind && u.value === value)!;
    if (unit.complete || unit.attempts.length >= job.spec.budgets.maxAttemptsPerIdentity ||
        Date.parse(recordedAt) < Math.max(globalRetry, Date.parse(unit.last?.retryAt ?? "1970-01-01T00:00:00Z"))) {
      throw new Error("Requested identity is complete, exhausted or waiting for backoff");
    }
  }
  let profiles: ProfileProjection[] = [], issues: { path: string; reason: string }[] = [];
  let actualResult = result;
  if (result === "success") {
    if (input.format === "client-preview") {
      if (request.values.length !== 1) throw new Error("One client preview cannot establish a bulk response");
      ({ profiles, issues } = parseClientDuelPreview(input.payload, blueprints, receipt!));
    } else if (input.format === "client-search") {
      if (request.kind !== "name" || request.values.length !== 1) throw new Error("Search observation requires one exact reviewed name, never a UID bulk request");
      ({ profiles, issues } = parseClientSearchProfile(input.payload, blueprints, receipt!, {
        query: request.values[0], startedAt: job.spec.plannedAt, endedAt: recordedAt,
      }));
    } else {
      if (receipt!.kind.startsWith("client-memory-")) throw new Error("Client observation is not a service-result receipt");
      if (input.format === "single-profile") {
        if (request.values.length !== 1) throw new Error("Single-profile format cannot prove bulk completeness");
        ({ profiles, issues } = parseSingleProfile(input.payload, blueprints, receipt!));
      } else if (input.format === "bulk-profile") {
        if (request.kind !== "uid") throw new Error("Bulk profile evidence requires known requested UIDs");
        ({ profiles, issues } = parseProfileUsers(input.payload, blueprints, receipt!));
      } else throw new Error("Explicit source format required");
    }
    if (profiles.some(p => !request.values.includes(request.kind === "uid" ? p.playerId : p.name))) {
      throw new Error("Response contains identities outside the reviewed request");
    }
    if (profiles.length > 20) throw new Error("Response exceeds bounded import");
    if (issues.length) actualResult = "unsupported";
  }
  const maxAttempts = Math.max(...request.values.map(value => stateUnits.find(u => u.kind === request.kind && u.value === value)!.attempts.length));
  const backoff = new Date(Date.parse(recordedAt) + job.spec.budgets.backoffMs * 2 ** maxAttempts).toISOString();
  const retryAt = input.retryAt ? new Date(Math.max(Date.parse(timestamp.parse(input.retryAt)), Date.parse(backoff))).toISOString() : backoff;
  const attempt = attemptSchema.parse({ id, request, result: actualResult, recordedAt, retryAt, profiles, issues, receipt });
  return { ...job, attempts: [...job.attempts, attempt] };
}

/** The fingerprint excludes mutable names, source times and DB moderation fields. */
export function defenderFingerprint(profile: ProfileProjection): string | null {
  const d = profile.defender;
  return d ? hash([d.blueprintId, d.championGameId, d.stars, d.rank, d.level, d.signature, d.ascension,
    d.statFocusAttack, d.statFocusDefense, d.cosmetic]) : null;
}

export function duelReviewProposals(job: DuelVerificationJob, evaluatedAt = job.spec.plannedAt) {
  const histories = historyIndex(job);
  const cached = new Set(units(job, evaluatedAt).filter(unit => unit.fresh).map(unit => key(unit.kind, unit.value)));
  return job.spec.targets.map(target => {
    const history = histories.get(targetKey(target)) ?? [];
    const last = history.at(-1);
    const kind = target.playerId ? "uid" as const : "name" as const, value = target.playerId ?? target.playerName;
    const successful = history.filter(attempt => attempt.result === "success" && matching(attempt, kind, value).length === 1);
    const lastSuccessfulProfile = successful.length ? matching(successful.at(-1)!, kind, value)[0] : null;
    const lastProfiles = last ? matching(last, kind, value) : [];
    const reconciled = reconcileDuelTarget(target, last?.result === "success" || last?.result === "missing" || last?.result === "not-found"
      ? { kind: "success", profiles: lastProfiles } : { kind: "unavailable" });
    const candidate = lastProfiles.length === 1 ? lastProfiles[0] : null;
    const observedFingerprint = candidate ? defenderFingerprint(candidate) : null;
    const priorFingerprint = target.lastObservedFingerprint ?? (successful.length > 1 ? defenderFingerprint(matching(successful.at(-2)!, kind, value)[0]) : null);
    return { ...reconciled, outcome: last ? reconciled.outcome : cached.has(targetKey(target)) ? "cached-source-observation" : "pending",
      original: target, observationState: last?.result ?? "pending",
      proposedPlayerId: target.playerId === null ? candidate?.playerId ?? null : null,
      nameChanged: !!candidate && candidate.name !== target.playerName,
      championChanged: !!candidate?.defender?.championGameId && candidate.defender.championGameId !== target.championGameId,
      observedFingerprint, priorFingerprint,
      observationChangedFromPrior: observedFingerprint !== null && priorFingerprint !== null ? observedFingerprint !== priorFingerprint : null,
      lastSuccessfulProfile, receipt: last?.receipt ?? null };
  });
}

export function exportDuelCheckpoint(job: DuelVerificationJob) {
  const state = stateSchema.parse(job);
  return { format: "cerebro-duel-dry-run-v1" as const, sha256: hash(state), state };
}

/** Integrity checksum, not authentication. Reviewed import stays subject to auth. */
export function importDuelCheckpoint(value: unknown, expectedSpec: unknown): DuelVerificationJob {
  const checkpoint = z.strictObject({ format: z.literal("cerebro-duel-dry-run-v1"), sha256: digest, state: stateSchema }).parse(value);
  const expected = createDuelVerificationJob(expectedSpec);
  if (hash(checkpoint.state) !== checkpoint.sha256 || checkpoint.state.jobId !== expected.jobId ||
      hash(checkpoint.state.spec) !== expected.jobId) throw new Error("Checkpoint integrity or input binding differs");
  if (new Set(checkpoint.state.attempts.map(a => a.id)).size !== checkpoint.state.attempts.length) throw new Error("Duplicate checkpoint attempts");
  return checkpoint.state;
}
