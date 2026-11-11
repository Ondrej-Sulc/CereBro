/** Import sanitized existing evidence into a resumable local DRY_RUN job.
 * No game/API/database transport. Outputs only under this checkout's ignored temp.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { createDuelVerificationJob, duelReviewProposals, exportDuelCheckpoint, importDuelCheckpoint, importDuelEvidence, nextDuelRead } from "../domain/duel-target-job";
import { type EvidenceReceipt } from "../domain/duel-target-verification";

const sha = (raw: string | Buffer) => createHash("sha256").update(raw).digest("hex");
const entrySchema = z.strictObject({ request: z.strictObject({ kind: z.enum(["uid", "name"]), values: z.array(z.string()).min(1).max(20) }),
  result: z.enum(["success", "missing", "not-found", "unavailable", "rate-limited", "unauthorized", "unsupported"]),
  format: z.enum(["single-profile", "bulk-profile", "client-preview", "client-search"]).optional(), file: z.string().optional(),
  source: z.string().min(1).optional(), capturedAt: z.string().optional(), recordedAt: z.string().optional(), retryAt: z.string().optional() });

function outputPath(input: string) {
  const root = path.resolve("temp/duel-target-investigation"), output = path.resolve(input), relative = path.relative(root, output);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !relative.endsWith(".json")) {
    throw new Error("Output must be JSON under this checkout's temp/duel-target-investigation");
  }
  return output;
}

async function atomicJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true });
  const pending = `${file}.${process.pid}.pending`;
  await writeFile(pending, JSON.stringify(value, null, 2) + "\n", { flag: "wx" });
  await rename(pending, file);
}

async function main() {
  const options = new Map<string, string>(), allowed = new Set(["--spec", "--blueprints", "--bundle", "--checkpoint", "--report", "--now"]);
  for (let index = 2; index < process.argv.length; index += 2) {
    const key = process.argv[index], value = process.argv[index + 1];
    if (!allowed.has(key) || !value || options.has(key)) throw new Error(`Invalid/duplicate argument: ${key}`);
    options.set(key, value);
  }
  if (["--spec", "--blueprints", "--bundle", "--checkpoint", "--report"].some(key => !options.has(key))) {
    throw new Error("Required: --spec --blueprints --bundle --checkpoint --report; optional --now (ISO timezone)");
  }
  const checkpointPath = outputPath(options.get("--checkpoint")!), reportPath = outputPath(options.get("--report")!);
  if (checkpointPath === reportPath) throw new Error("Checkpoint and report paths must differ");
  const rawSpec = await readFile(options.get("--spec")!, "utf8"), blueprintBytes = await readFile(options.get("--blueprints")!);
  const specification: unknown = JSON.parse(rawSpec);
  let job = createDuelVerificationJob(specification);
  if (job.spec.catalogSha256 !== sha(blueprintBytes)) throw new Error("Exact blueprint catalog hash differs from job input");
  const blueprintRows = z.array(z.strictObject({ blueprintId: z.string().min(1), championGameId: z.string().min(1), stars: z.number().int().min(1).max(7) })).parse(JSON.parse(blueprintBytes.toString("utf8")));
  if (new Set(blueprintRows.map(row => row.blueprintId)).size !== blueprintRows.length) throw new Error("Duplicate blueprint identities");
  const blueprints = new Map(blueprintRows.map(row => [row.blueprintId, row]));
  try { job = importDuelCheckpoint(JSON.parse(await readFile(checkpointPath, "utf8")), specification); }
  catch (error: unknown) { if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error; }
  const bundlePath = path.resolve(options.get("--bundle")!);
  const entries = z.array(entrySchema).max(job.spec.budgets.maxRequests).parse(JSON.parse(await readFile(bundlePath, "utf8")));
  const inputPaths = [options.get("--spec")!, options.get("--blueprints")!, bundlePath,
    ...entries.filter(entry => entry.file).map(entry => path.resolve(path.dirname(bundlePath), entry.file!))].map(file => path.resolve(file).toLowerCase());
  if ([checkpointPath, reportPath].some(file => inputPaths.includes(file.toLowerCase()))) throw new Error("Output cannot replace an evidence input");
  const importedAt = options.get("--now") ?? new Date().toISOString();
  // Persist initial input binding too, so a crash before first import remains resumable.
  await atomicJson(checkpointPath, exportDuelCheckpoint(job));
  for (const entry of entries) {
    let payload: unknown, evidence: EvidenceReceipt | undefined;
    if (entry.result === "success") {
      if (!entry.file || !entry.format || !entry.source) throw new Error("Successful bundle entry requires file, format and source");
      const file = path.resolve(path.dirname(bundlePath), entry.file), raw = await readFile(file);
      if (raw.length > 1024 * 1024) throw new Error("Sanitized profile receipt exceeds 1 MiB import bound");
      payload = JSON.parse(raw.toString("utf8"));
      const capturedAt = entry.format === "client-preview" || entry.format === "client-search"
        ? z.object({ capturedAt: z.string() }).parse(payload).capturedAt : entry.capturedAt;
      if (!capturedAt) throw new Error("Saved service result requires source capture time");
      evidence = { kind: entry.format === "client-preview" ? "client-memory-duel-preview" : entry.format === "client-search" ? "client-memory-search-profile" : "saved-profile-response",
        source: entry.source, capturedAt, importedAt, sourceSha256: sha(raw) };
    }
    job = importDuelEvidence(job, { ...entry, payload, evidence, recordedAt: entry.recordedAt ?? importedAt }, blueprints);
    await atomicJson(checkpointPath, exportDuelCheckpoint(job));
  }
  const proposals = duelReviewProposals(job, importedAt);
  const observed = new Set(job.attempts.flatMap(attempt => attempt.profiles.map(profile => profile.playerId)));
  const report = { version: 1, mode: "DRY_RUN", jobId: job.jobId, namespace: job.spec.namespace, generatedAt: importedAt,
    sourceKinds: [...new Set(job.attempts.flatMap(attempt => attempt.profiles.map(profile => profile.evidence.kind)))],
    observations: { distinctPublicPlayerIds: observed.size, importedAttempts: job.attempts.length,
      rawServerReceipts: job.attempts.filter(attempt => attempt.receipt?.kind === "saved-profile-response").length,
      clientMemoryReceipts: job.attempts.filter(attempt => attempt.receipt?.kind.startsWith("client-memory-")).length,
      clientPreviewReceipts: job.attempts.filter(attempt => attempt.receipt?.kind === "client-memory-duel-preview").length,
      clientSearchReceipts: job.attempts.filter(attempt => attempt.receipt?.kind === "client-memory-search-profile").length },
    proposals, next: nextDuelRead(job, importedAt),
    requiresReview: true, databaseWrites: 0, gameRequestsByThisTool: 0, serverProfilesPerSecond: null, bulkCompleteness: "unverified" };
  await atomicJson(reportPath, report);
  process.stdout.write(`DRY_RUN: ${observed.size} distinct public IDs; ${job.attempts.length} evidence imports; ${proposals.length} review-only proposals\nCheckpoint: ${checkpointPath}\nReport: ${reportPath}\n`);
}

main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Offline verification failed"}\n`); process.exitCode = 1; });
