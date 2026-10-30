export const RELIC_PRESTIGE_COUNT = 30;

/** Known-entry preview until at least 30 relics are recorded with complete ratings. */
export function calculatePlayerRelicPrestige(entries: readonly { id: string; prestige: number | null }[]) {
  const known = entries.filter((entry): entry is { id: string; prestige: number } =>
    entry.prestige !== null && Number.isSafeInteger(entry.prestige) && entry.prestige >= 0,
  ).sort((a, b) => b.prestige - a.prestige || a.id.localeCompare(b.id));
  const top = known.slice(0, RELIC_PRESTIGE_COUNT);
  const missingCount = entries.length - known.length;
  return {
    average: top.length ? Math.round(top.reduce((sum, entry) => sum + entry.prestige, 0) / top.length) : null,
    contributorIds: top.map((entry) => entry.id),
    cutoff: top.length === RELIC_PRESTIGE_COUNT ? top[top.length - 1].prestige : null,
    missingCount,
    ready: top.length === RELIC_PRESTIGE_COUNT && missingCount === 0,
  };
}

export type PlayerRelicPrestige = ReturnType<typeof calculatePlayerRelicPrestige> & {
  automatic: boolean;
  recorded: number | null;
  champion: number | null;
  summoner: number | null;
  revision: string;
};
