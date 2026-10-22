import type { ResistanceMechanism } from './champion-resistance';
import { classifyResistanceSource, fixedResistancePercent, resistanceEvidenceHash, resistanceEvidenceRecords, type ResistanceSource } from './champion-resistance-classification';

export type ResistancePlanRow = {
  championId: number; championName: string; championAbilityLinkId: number; effectId: number; effect: string;
  mechanism: ResistanceMechanism; percent: number | null; sourceHash: string; evidence: unknown;
};
type CurrentLink = ResistanceSource & { id: number; championId: number; sourceHash: string; reviewHash: string | null };
type RecordEvidence = { id: number; championId: number; template: unknown };

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
  if (records.some(record => !record) || fixedResistancePercent(link.source!, records.map(record => record!.template)) !== row.percent) {
    throw new Error('Numeric evidence drift');
  }
}
