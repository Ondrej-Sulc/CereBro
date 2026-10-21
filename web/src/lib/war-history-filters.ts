export interface HistoryFilters {
  onlyCurrentTier: boolean;
  onlyAlliance: boolean;
  minSeason: number | undefined;
}

export type HistoryFilterScope = "attack" | "defense";
export type HistoryFilterStorage = Pick<Storage, "getItem" | "setItem">;

export const historyFilterStorageKey = (scope: HistoryFilterScope) => `cerebro:war-history-filters:${scope}:v1`;

export function parseHistoryFilters(raw: string | null, latestSeason: number | null): HistoryFilters {
  let value: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) value = parsed as Record<string, unknown>;
  } catch { /* Corrupt browser preferences fall back to defaults. */ }
  return {
    onlyCurrentTier: typeof value.onlyCurrentTier === "boolean" ? value.onlyCurrentTier : true,
    onlyAlliance: typeof value.onlyAlliance === "boolean" ? value.onlyAlliance : true,
    // This is a numeric lower bound: gaps in recorded seasons remain valid.
    minSeason: typeof value.minSeason === "number" && Number.isSafeInteger(value.minSeason) && value.minSeason > 0 && latestSeason !== null && value.minSeason <= latestSeason ? value.minSeason : undefined,
  };
}

export function loadHistoryFilters(storage: Pick<Storage, "getItem"> | undefined, scope: HistoryFilterScope, latestSeason: number | null): HistoryFilters {
  try {
    return parseHistoryFilters(storage?.getItem(historyFilterStorageKey(scope)) ?? null, latestSeason);
  } catch {
    return parseHistoryFilters(null, latestSeason);
  }
}

export function saveHistoryFilters(storage: HistoryFilterStorage | undefined, scope: HistoryFilterScope, filters: HistoryFilters): boolean {
  if (!storage) return false;
  try {
    storage.setItem(historyFilterStorageKey(scope), JSON.stringify(filters));
    return true;
  } catch {
    return false;
  }
}
