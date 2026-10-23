import type { ResistanceMechanism } from './champion-resistance';
import { classifyResistanceSource, fixedResistancePercent, resistanceEvidenceHash, resistanceEvidenceRecords, type ResistanceSource } from './champion-resistance-classification';

export type ResistancePlanRow = {
  championId: number; championName: string; championAbilityLinkId: number; effectId: number; effect: string;
  mechanism: ResistanceMechanism; percent: number | null; sourceHash: string; evidence: unknown;
};
type CurrentLink = ResistanceSource & { id: number; championId: number; sourceHash: string; reviewHash: string | null };
type RecordEvidence = { id: number; championId: number; template: unknown };

/** Existing classifications are immutable here; only null -> evidenced fixed percentage is permitted. */
export function planResistancePercentageRefresh(current: Array<Pick<ResistancePlanRow,
  'championAbilityLinkId' | 'effectId' | 'mechanism' | 'percent' | 'sourceHash' | 'evidence'>>, proposed: ResistancePlanRow[]): ResistancePlanRow[] {
  const key = (row: { championAbilityLinkId: number; effectId: number }) => `${row.championAbilityLinkId}:${row.effectId}`;
  const stored = new Map(current.map(row => [key(row), row]));
  if (stored.size !== current.length || new Set(proposed.map(key)).size !== proposed.length || current.length !== proposed.length) {
    throw new Error('Classification set changed');
  }
  return proposed.filter(row => {
    const before = stored.get(key(row));
    // Expanded imported record references are allowed; all other evidence fields stay exact.
    const basis = (evidence: unknown) => {
      if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('Invalid evidence');
      const { records: _records, ...rest } = evidence as Record<string, unknown>;
      return resistanceEvidenceHash(rest);
    };
    if (!before || before.mechanism !== row.mechanism || before.sourceHash !== row.sourceHash
      || basis(before.evidence) !== basis(row.evidence)) throw new Error('Existing classification drift');
    if (before.percent !== null && before.percent !== row.percent) throw new Error('Existing percentage changed');
    if (row.percent !== null && (!Number.isFinite(row.percent) || row.percent < 0 || row.percent > 10000)) throw new Error('Invalid percentage');
    return before.percent === null && row.percent !== null;
  });
}

/** Validate an additive classification against live source, target, review and imported numeric evidence. */
export function validateResistancePlanRow(row: ResistancePlanRow, link: CurrentLink | undefined,
  effect: { id: number; name: string } | undefined, texts: RecordEvidence[]): void {
  if (!link || link.id !== row.championAbilityLinkId || link.championId !== row.championId
    || effect?.id !== row.effectId || effect.name !== row.effect || row.sourceHash !== link.sourceHash
    || !classifyResistanceSource(link).some(proposal => proposal.target === row.effect && proposal.mechanism === row.mechanism)) {
    throw new Error('Classification or source drift');
  }
  const evidence = row.evidence as { source?: unknown; overviewReviewHash?: unknown } | null;
  const refs = resistanceEvidenceRecords(evidence);
  if (!evidence || evidence.source !== link.source || !link.reviewHash || evidence.overviewReviewHash !== link.reviewHash
    || !refs || new Set(refs.map(ref => ref.recordId)).size !== refs.length) throw new Error('Review or evidence binding mismatch');
  const records = refs.map(ref => texts.find(text => text.id === ref.recordId && text.championId === row.championId
    && resistanceEvidenceHash(text.template) === ref.templateHash));
  if (records.some(record => !record) || fixedResistancePercent(link.source!, records.map(record => record!.template), row.effect) !== row.percent) {
    throw new Error('Numeric evidence drift');
  }
}
