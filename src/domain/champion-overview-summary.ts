import { z } from 'zod';
import { artifactHash } from './champion-effect-enrichment';
import type { EffectSourceMetadata } from './ability-source';

export type OverviewSource = EffectSourceMetadata & {
  id: number; championId: number; abilityId: number; name: string; type: 'ABILITY' | 'IMMUNITY'; source: string | null; synergyChampionIds: number[];
};
export type OverviewSummaryInput = { sources: OverviewSource[]; documents: Array<{ id: string; text: string }> };
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const evidence = z.object({ documentId: z.string().min(1), quote: z.string().trim().min(1) }).strict();
export const overviewSummaryDraftSchema = z.object({
  schemaVersion: z.literal(1), author: z.string().min(1), snapshotHash: hash,
  entries: z.array(z.object({
    championId: z.number().int().positive(), linkId: z.number().int().positive(), sourceHash: hash,
    summary: z.string().trim().min(1).max(360).nullable(),
    evidence: z.array(evidence),
    retainedValues: z.array(z.object({ text: z.string().min(1), reason: z.string().min(8), evidence: z.array(evidence).min(1) }).strict()),
    note: z.string().optional(),
  }).strict()),
}).strict();
export const overviewSummaryReviewSchema = z.object({ schemaVersion: z.literal(1), reviewer: z.string().min(1),
  snapshotHash: hash, draftHash: hash, decision: z.enum(['approve', 'reject']), findings: z.array(z.string()) }).strict();
export type OverviewSummaryDraft = z.infer<typeof overviewSummaryDraftSchema>;
export type OverviewSummaryValidationOptions = { summaryLengthOverrides?: Readonly<Record<number, number>> };

export function overviewSourceHash(source: OverviewSource): string {
  return artifactHash({ id: source.id, championId: source.championId, abilityId: source.abilityId, name: source.name,
    type: source.type, source: source.source, effectForm: source.effectForm, effectDirection: source.effectDirection,
    synergyChampionIds: [...source.synergyChampionIds].sort((a, b) => a - b) });
}

export function getCurrentOverviewSummary(source: OverviewSource, saved: { text: string; sourceHash: string } | null | undefined, currentSource = source): string | null {
  return saved?.sourceHash === overviewSourceHash(source) && saved.sourceHash === overviewSourceHash(currentSource) ? saved.text : null;
}

/** Attack identifiers are navigation labels; all other digits need a retained-value proof. */
function numericTokens(summary: string): string[] {
  return [...new Set(summary.replace(/\b(?:special(?: attack)?\s*|sp)[123]\b/gi, '').match(/\d+(?:\.\d+)?/g) ?? [])];
}

export function validateOverviewSummaries(input: OverviewSummaryInput, rawDraft: unknown, rawReview?: unknown, options?: OverviewSummaryValidationOptions): OverviewSummaryDraft {
  const overrides = options?.summaryLengthOverrides ?? {};
  for (const [id, limit] of Object.entries(overrides)) if (!input.sources.some(source => source.id === Number(id)) || !Number.isSafeInteger(limit) || limit < 360 || limit > 1000) throw new Error('Invalid scoped summary length authorization.');
  const draft = Object.keys(overrides).length ? overviewSummaryDraftSchema.extend({ entries: z.array(overviewSummaryDraftSchema.shape.entries.element.extend({ summary: z.string().trim().min(1).nullable() })) }).parse(rawDraft) : overviewSummaryDraftSchema.parse(rawDraft);
  if (draft.snapshotHash !== artifactHash(input)) throw new Error('Summary input hash mismatch.');
  const sources = new Map(input.sources.map(source => [source.id, source]));
  const documents = new Map(input.documents.map(document => [document.id, document.text]));
  const seen = new Set<number>();
  const checkEvidence = (citations: Array<z.infer<typeof evidence>>) => {
    for (const citation of citations) if (!documents.get(citation.documentId)?.includes(citation.quote)) throw new Error('Invalid summary evidence quote.');
  };
  for (const entry of draft.entries) {
    if (entry.summary !== null && entry.summary.length > (overrides[entry.linkId] ?? 360)) throw new Error('Summary exceeds its scoped authorized length.');
    if (seen.has(entry.linkId)) throw new Error('Duplicate summary source.');
    seen.add(entry.linkId);
    const source = sources.get(entry.linkId);
    if (!source || source.championId !== entry.championId || overviewSourceHash(source) !== entry.sourceHash) throw new Error('Summary source binding mismatch.');
    checkEvidence(entry.evidence);
    if (entry.summary === null) {
      if (!entry.note || entry.retainedValues.length) throw new Error('Unavailable summaries need a reason and no values.');
      continue;
    }
    if (!entry.evidence.length) throw new Error('Summary evidence is required.');
    if (/[{}]|\b(?:unresolved|legacy|audit)\b|\btext:\s*\d+|\bvalue\s+(?:missing|not recorded)/i.test(entry.summary)) throw new Error('Summary contains placeholders or audit prose.');
    const tokens = numericTokens(entry.summary);
    for (const token of tokens) if (!entry.retainedValues.some(value => value.text === token)) throw new Error('Retained summary number lacks proof.');
    for (const value of entry.retainedValues) {
      if (!tokens.includes(value.text)) throw new Error('Unused retained summary value.');
      checkEvidence(value.evidence);
      if (!value.evidence.some(citation => {
        const quotedNumbers: string[] = citation.quote.match(/\d+(?:\.\d+)?/g) ?? [];
        return quotedNumbers.includes(value.text);
      })) throw new Error('Retained summary value not present in its evidence.');
    }
  }
  if (seen.size !== input.sources.length) throw new Error('Summary source coverage mismatch.');
  if (rawReview !== undefined) {
    const review = overviewSummaryReviewSchema.parse(rawReview);
    if (review.snapshotHash !== draft.snapshotHash || review.draftHash !== artifactHash(draft)) throw new Error('Review does not match this summary draft.');
    if (review.reviewer === draft.author) throw new Error('Summary review must be independent.');
    if (review.decision !== 'approve') throw new Error('Summary review has not approved this draft.');
  }
  return draft;
}
