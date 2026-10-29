import type { RelicScreenshotMatch, RelicScreenshotRow } from '@cerebro/core/domain/relic-screenshot';

export type RelicReviewRow = RelicScreenshotRow & {
  imageUrl: string;
  fileName: string;
  choice: number | null;
  pendingVariantId?: string | null;
  included: boolean;
  skipped: boolean;
};

/** A variant is one identity, even when prestige leaves several rarities/builds possible. */
export function groupRelicReviewVariants(matches: readonly RelicScreenshotMatch[]) {
  const variants = new Map<string, {
    relicId: string; name: string; attribute: string | null;
    choices: {index: number; match: RelicScreenshotMatch}[];
  }>();
  matches.forEach((match, index) => {
    const variant = variants.get(match.relicId) ?? {
      relicId:match.relicId, name:match.name, attribute:match.secondaryAttribute, choices:[],
    };
    variant.choices.push({index, match});
    variants.set(match.relicId, variant);
  });
  return [...variants.values()];
}

export function sharedRelicReviewBuild(matches: readonly RelicScreenshotMatch[]) {
  const first = matches[0];
  return first && matches.every(m => m.stars === first.stars && m.rank === first.rank && m.sigLevel === first.sigLevel)
    ? {stars:first.stars, rank:first.rank, sigLevel:first.sigLevel} : null;
}

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
