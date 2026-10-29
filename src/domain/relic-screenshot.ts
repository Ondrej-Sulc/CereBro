import type { RelicPrestigeRank } from './relic-prestige';

export type ScreenshotRelic = {
  relicId: string; name: string; shortName: string; className: string; type: string;
  stars: number; primaryAttribute?: string | null; secondaryAttribute: string | null; ranks: RelicPrestigeRank[] | null;
};
export type RelicObservation = {
  name: string; rating: number; stars: number | null; awakened: boolean | null;
  className: string | null; primaryAttribute?: string | null; secondaryAttribute?: string | null;
  attributeStatus?: 'recognized' | 'unclear' | 'conflict';
};
export type RelicScreenshotMatch = {
  relicId: string; name: string; stars: number; rank: number; sigLevel: number;
  secondaryAttribute: string | null;
};
export type RelicScreenshotRow = RelicObservation & {
  id: string;
  // Normalized coordinates allow the browser to show the original card without uploading it again.
  bounds: { x: number; y: number; width: number; height: number };
  matches: RelicScreenshotMatch[];
};
export const normalizeRelicLabel = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]/g, '').replace('ARMORED', 'ARMOURED');

/** Prestige is a constraint, not an injective rank/signature encoding. Never pick an arbitrary match. */
export function matchRelicScreenshot(observation: RelicObservation, catalog: readonly ScreenshotRelic[]): RelicScreenshotMatch[] {
  if (!Number.isSafeInteger(observation.rating) || observation.rating <= 0 || observation.attributeStatus === 'conflict') return [];
  const label = normalizeRelicLabel(observation.name);
  return catalog.flatMap(relic => {
    if (normalizeRelicLabel(relic.shortName) !== label ||
      (observation.stars !== null && relic.stars !== observation.stars) ||
      (observation.className !== null && relic.className !== observation.className) ||
      (observation.primaryAttribute && relic.primaryAttribute !== observation.primaryAttribute) ||
      (observation.secondaryAttribute && relic.secondaryAttribute !== observation.secondaryAttribute)) return [];
    return relic.ranks?.flatMap(row => row.prestigeBySignature.flatMap((value, sigLevel) => {
      if (value !== observation.rating ||
        (observation.awakened === true && sigLevel === 0) ||
        (observation.awakened === false && sigLevel !== 0)) return [];
      return [{ relicId: relic.relicId, name: relic.name, stars: relic.stars, rank: row.rank, sigLevel, secondaryAttribute: relic.secondaryAttribute }];
    })) ?? [];
  });
}
