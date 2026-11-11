/** File-only summary of the normal-client pilot, preserving all source rows. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { summarizeDuelPilot } from "../domain/duel-pilot-report";
import { parseClientDuelPreview } from "../domain/duel-target-verification";
import type { ProfileProjection } from "../domain/duel-target-verification";
import { compareSearchCandidateToPreview, parseClientSearchObservation } from "../domain/duel-search-observation";

async function main() {
  const [input, catalog, output] = process.argv.slice(2);
  if (!input || !catalog || !output || process.argv.length !== 5) throw new Error("Usage: summarize-duel-pilot.ts pilot-manifest.json blueprints.json output.json");
  const root = path.resolve("temp/duel-target-investigation"), destination = path.resolve(output), relative = path.relative(root, destination);
  if (relative.startsWith("..") || path.isAbsolute(relative) || !relative.endsWith(".json") || path.resolve(input).toLowerCase() === destination.toLowerCase()) {
    throw new Error("Output must be separate JSON under this checkout's ignored duel evidence directory");
  }
  const manifest = z.strictObject({ pilot: z.unknown(), receipts: z.array(z.strictObject({ duelId: z.number().int(), previewFile: z.string().optional(), searchFile: z.string().optional() })).max(20) }).parse(JSON.parse(await readFile(input, "utf8")));
  const report = summarizeDuelPilot(manifest.pilot);
  const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
  const blueprints = new Map(z.array(z.object({ blueprintId: z.string(), championGameId: z.string(), stars: z.number().int() })).parse(JSON.parse(await readFile(catalog, "utf8"))).map(row => [row.blueprintId, row]));
  const refs = new Map(manifest.receipts.map(ref => [ref.duelId, ref]));
  if (refs.size !== manifest.receipts.length) throw new Error("Duplicate receipt references");
  let previewReadMs = 0, searchReadMs = 0;
  const searchComparisons: { duelId: number; observation: ReturnType<typeof parseClientSearchObservation>;
    comparison: ReturnType<typeof compareSearchCandidateToPreview> }[] = [];
  for (const row of report.rows) {
    const ref = refs.get(row.original.duelId);
    let actual: ProfileProjection | null = null;
    if (row.result === "complete") {
      if (!ref?.previewFile) throw new Error("Complete row needs a real client-preview receipt file");
      const file = path.resolve(path.dirname(input), ref.previewFile);
      if (file.toLowerCase() === destination.toLowerCase()) throw new Error("Cannot replace a receipt");
      const raw = await readFile(file), payload: unknown = JSON.parse(raw.toString("utf8"));
      if (sha(raw) !== row.receiptSha256) throw new Error("Preview receipt content hash differs");
      const times = z.object({ capturedAt: z.string(), readOnlyCapture: z.object({ elapsedMs: z.number().min(0) }) }).parse(payload);
      if (Date.parse(times.capturedAt) < Date.parse(row.startedAt) || Date.parse(times.capturedAt) > Date.parse(row.endedAt)) throw new Error("Capture is outside target-flow interval");
      const parsed = parseClientDuelPreview(payload, blueprints, { kind: "client-memory-duel-preview", source: "bounded-normal-client-pilot",
        capturedAt: times.capturedAt, importedAt: new Date().toISOString(), sourceSha256: sha(raw) });
      actual = parsed.profiles[0] ?? null;
      if (!actual?.completeBuild || parsed.issues.length || !row.observed || actual.name !== row.observed.name || actual.playerId !== row.observed.playerId ||
          Object.entries(row.observed).some(([key,value]) => key !== "name" && key !== "playerId" && actual?.defender?.[key as keyof NonNullable<ProfileProjection["defender"]>] !== value)) {
        throw new Error("Summary differs from source-bound preview observation");
      }
      previewReadMs += times.readOnlyCapture.elapsedMs;
    }
    if (row.resultCountSource === "resident-search-list") {
      if (!ref?.searchFile) throw new Error("Resident search counts require a search-summary receipt");
      const file = path.resolve(path.dirname(input), ref.searchFile);
      if (file.toLowerCase() === destination.toLowerCase()) throw new Error("Cannot replace a search receipt");
      const raw = await readFile(file);
      const search = parseClientSearchObservation(JSON.parse(raw.toString("utf8")), blueprints,
        { sourceSha256: sha(raw), query: row.query, startedAt: row.startedAt, endedAt: row.endedAt });
      if (search.query !== row.query || search.returnedCount !== row.returnedCount || search.exactNameMatches !== row.exactNameMatches) throw new Error("Search counts differ from captured normal-client query");
      searchReadMs += search.readOnlyCapture.elapsedMs;
      searchComparisons.push({ duelId: row.duelId, observation: search,
        comparison: actual ? compareSearchCandidateToPreview(search, actual) : "unavailable" });
    }
  }
  const verifiedReport = { ...report, residentReadMeasurements: { previewReadMs, searchReadMs, totalReadMs: previewReadMs + searchReadMs,
    successfulPreviewReads: report.counts.complete, successfulSearchReads: searchComparisons.length, includesServerLatency: false },
    searchProfileEvidence: { summaryReceipts: searchComparisons.length,
      exactCandidateProfiles: searchComparisons.filter(item => item.observation.candidate !== null).length,
      equalCoreFields: searchComparisons.filter(item => item.comparison === "equal-core-fields").length,
      differentCoreFields: searchComparisons.filter(item => item.comparison === "different-core-fields").length,
      differentIdentity: searchComparisons.filter(item => item.comparison === "different-identity").length,
      incomplete: searchComparisons.filter(item => item.comparison === "incomplete").length,
      comparisons: searchComparisons } };
  await writeFile(destination, JSON.stringify(verifiedReport, null, 2) + "\n");
  process.stdout.write(JSON.stringify({ counts: report.counts, measurements: report.measurements, bulk: report.bulk }, null, 2) + "\n");
}
main().catch((error: unknown) => { process.stderr.write(`${error instanceof Error ? error.message : "Pilot summary failed"}\n`); process.exitCode = 1; });
