/** Offline fixture benchmark and optional saved-service-result dry run. No transport. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import path from "node:path";
import {
  type BlueprintIdentity, type ExistingDuelTarget,
  parseProfileUsers, planVerificationBatches, reconcileDuelTarget,
} from "../domain/duel-target-verification";
import { blueprintFixture, profileFixture, receiptFixture } from "../domain/duel-target-verification.fixtures";
import { createDuelVerificationJob, nextDuelRead } from "../domain/duel-target-job";

async function main() {
  const flags = new Map<string, string>();
  const allowed = new Set(["--input", "--targets", "--blueprints", "--captured-at", "--out", "--iterations"]);
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index], value = process.argv[index + 1];
    if (!allowed.has(key) || !value || flags.has(key)) throw new Error(`Invalid/duplicate argument: ${key}`);
    flags.set(key, value);
  }
  const iterations = Number(flags.get("--iterations") ?? 1000);
  if (!Number.isInteger(iterations) || iterations < 1 || iterations > 10000) throw new Error("iterations must be 1..10000");
  // Research output stays inside this checkout's already ignored temp directory.
  const tempRoot = path.resolve("temp/duel-target-investigation");
  const out = path.resolve(flags.get("--out") ?? path.join(tempRoot, "offline-report.json"));
  const relative = path.relative(tempRoot, out);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.endsWith(".json")) {
    throw new Error("--out must be a JSON file under this checkout's temp/duel-target-investigation");
  }
  const usingSaved = flags.has("--input");
  if (usingSaved && ["--targets", "--blueprints", "--captured-at"].some((flag) => !flags.has(flag))) {
    throw new Error("Saved input requires --targets, --blueprints, --captured-at; use only sanitized public profile data");
  }
  if (!usingSaved && ["--targets", "--blueprints", "--captured-at"].some((flag) => flags.has(flag))) {
    throw new Error("Saved inputs must be supplied together with --input");
  }
  const raw = usingSaved ? await readFile(flags.get("--input")!, "utf8") : JSON.stringify({ users: [profileFixture()] });
  const payload: unknown = JSON.parse(raw);
  const receipt = usingSaved ? {
    kind: "saved-profile-response" as const, source: "operator-supplied-sanitized-service-result",
    capturedAt: flags.get("--captured-at")!, importedAt: new Date().toISOString(),
    sourceSha256: createHash("sha256").update(raw).digest("hex"),
  } : receiptFixture;
  let blueprints: ReadonlyMap<string, BlueprintIdentity> = blueprintFixture;
  let targets: ExistingDuelTarget[] = [{ duelId: 1, playerId: "9007199254740993", playerName: "Fixture Player", championGameId: "storm" }];
  if (usingSaved) {
    const bp: unknown = JSON.parse(await readFile(flags.get("--blueprints")!, "utf8"));
    const rows: unknown = JSON.parse(await readFile(flags.get("--targets")!, "utf8"));
    if (!Array.isArray(bp) || !Array.isArray(rows)) throw new Error("blueprints and targets must be arrays");
    // Reuse the project's runtime validator for file inputs, without changing manifests.
    const { z } = await import("zod");
    const identities = z.array(z.object({ blueprintId: z.string().min(1), championGameId: z.string().min(1), stars: z.number().int().min(1).max(7) })).parse(bp);
    if (new Set(identities.map((row) => row.blueprintId)).size !== identities.length) throw new Error("Duplicate blueprint identity");
    blueprints = new Map(identities.map((row) => [row.blueprintId, row]));
    targets = z.array(z.object({ duelId: z.number().int().positive(), playerId: z.string().nullable(), playerName: z.string().min(1),
      championGameId: z.string().min(1), stars: z.number().int().min(1).max(7).nullable().optional(), lastObservedAt: z.string().nullable().optional() })).parse(rows);
  }
  const parsed = parseProfileUsers(payload, blueprints, receipt);
  // Index once; local reconciliation must not repeatedly scan thousands of profiles.
  const byId = new Map<string, typeof parsed.profiles>();
  const byName = new Map<string, typeof parsed.profiles>();
  for (const profile of parsed.profiles) {
    byId.set(profile.playerId, [...(byId.get(profile.playerId) ?? []), profile]);
    byName.set(profile.name, [...(byName.get(profile.name) ?? []), profile]);
  }
  const proposals = targets.map((target) => reconcileDuelTarget(target, {
    kind: "success", profiles: target.playerId ? byId.get(target.playerId) ?? [] : byName.get(target.playerName) ?? [],
  }));
  function measure(operation: () => void) {
    const samplesMs: number[] = [];
    for (let sample = 0; sample < 5; sample++) {
      const start = performance.now();
      for (let loop = 0; loop < iterations; loop++) operation();
      samplesMs.push(performance.now() - start);
    }
    return { iterationsPerSample: iterations, samplesMs, medianMs: [...samplesMs].sort((a, b) => a - b)[2] };
  }
  // Benchmarks always use deterministic, explicitly artificial data, even in saved mode.
  const fixturePayload = { users: [profileFixture()] };
  const syntheticTargets: ExistingDuelTarget[] = Array.from({ length: 5000 }, (_, index) => ({
    duelId: index + 1, playerId: String(100000 + Math.floor(index / 2)),
    playerName: `Synthetic ${index}`, championGameId: "storm",
  }));
  const batchOptions = { batchSize: 10, now: "2026-11-09T00:00:00Z", maxAgeMs: 0 };
  const syntheticJob = createDuelVerificationJob({ namespace: "SYNTHETIC-LOCAL-BENCHMARK", plannedAt: batchOptions.now,
    contractVersion: "fixture", parserVersion: "2", catalogSha256: "a".repeat(64),
    budgets: { maxRequests: 10, maxBatchSize: 2, maxAttemptsPerIdentity: 2, backoffMs: 2000 },
    targets: syntheticTargets.map(target => ({ ...target, source: "SYNTHETIC", status: "ACTIVE", rankText: null })) });
  const benchmark = {
    scope: "LOCAL CPU ONLY; reconstructed contract fixture, not captured server throughput",
    parseOneProfile: measure(() => { parseProfileUsers(fixturePayload, blueprintFixture, receiptFixture); }),
    plan5000Rows2500Ids: measure(() => { planVerificationBatches(syntheticTargets, batchOptions); }),
    scheduleJob5000Rows2500Ids: measure(() => { nextDuelRead(syntheticJob, batchOptions.now); }),
    plannedBatchCount: planVerificationBatches(syntheticTargets, batchOptions).batches.length,
    operatorChosenBatchSize: 10,
    serverRequestsPerformed: 0,
    serverProfilesPerSecond: null,
    serverBatchLimit: null,
  };
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify({ version: 1, mode: usingSaved ? "saved-input-dry-run" : "static-contract-fixture",
    generatedAt: new Date().toISOString(), issues: parsed.issues, proposals, benchmark }, null, 2) + "\n");
  process.stdout.write(`Offline report: ${out}\nProfiles parsed: ${parsed.profiles.length}; proposals: ${proposals.length}; server requests: 0\n`);
}

main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Offline harness failed"}\n`); process.exitCode = 1; });
