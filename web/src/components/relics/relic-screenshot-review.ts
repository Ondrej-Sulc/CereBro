import type { RelicScreenshotRow } from '@cerebro/core/domain/relic-screenshot';

export type RelicReviewRow = RelicScreenshotRow & {
  imageUrl: string;
  fileName: string;
  choice: number | null;
  included: boolean;
  skipped: boolean;
};

/** Keep source cards visible, but count duplicate inventory identities only once. */
export function summarizeRelicReview(rows: readonly RelicReviewRow[]) {
  const selected = rows.flatMap(row => {
    const match = row.choice === null ? null : row.matches[row.choice];
    return !row.skipped && row.included && match ? [{ ...match, expectedPrestige:row.rating, rowId:row.id }] : [];
  });
  const identities = new Map<string, typeof selected>();
  for (const match of selected) {
    const key = `${match.relicId}:${match.stars}`;
    identities.set(key, [...(identities.get(key) ?? []), match]);
  }
  const conflictIds = new Set<string>();
  for (const matches of identities.values()) {
    if (matches.some(m => m.rank !== matches[0].rank || m.sigLevel !== matches[0].sigLevel))
      matches.forEach(m => conflictIds.add(m.rowId));
  }
  return {
    selected,
    uniqueCount:identities.size,
    conflictIds,
    decisions:rows.filter(row => !row.skipped && row.matches.length > 0 && (row.choice === null || !row.included || conflictIds.has(row.id))),
    unmatched:rows.filter(row => !row.skipped && row.matches.length === 0),
    ready:rows.filter(row => !row.skipped && row.choice !== null && row.included && !conflictIds.has(row.id)),
    skipped:rows.filter(row => row.skipped),
  };
}
