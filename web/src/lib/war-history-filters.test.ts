import { describe, expect, it } from "vitest";
import { loadHistoryFilters, saveHistoryFilters } from "./war-history-filters";

const storage = () => {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
};

describe("planner historical fight preferences", () => {
  it("restores all three preferences on a fresh read, independently for attack and defense", () => {
    const local = storage();
    const filters = { onlyCurrentTier: false, onlyAlliance: false, minSeason: 59 };
    saveHistoryFilters(local, "attack", filters);
    expect(loadHistoryFilters(local, "attack", 60)).toEqual(filters);
    expect(loadHistoryFilters(local, "defense", 60)).toEqual({ onlyCurrentTier: true, onlyAlliance: true, minSeason: undefined });
    saveHistoryFilters(local, "defense", { ...filters, onlyAlliance: true, minSeason: undefined });
    expect(loadHistoryFilters(local, "attack", 60)).toEqual(filters);
    expect(loadHistoryFilters(local, "defense", 60)).toEqual({ ...filters, onlyAlliance: true, minSeason: undefined });
  });

  it.each(["not json", "null", "[]", '{"onlyCurrentTier":"false","onlyAlliance":0,"minSeason":"59"}'])("recovers malformed stored data (%s)", value => {
    expect(loadHistoryFilters({ getItem: () => value }, "attack", 60)).toEqual({ onlyCurrentTier: true, onlyAlliance: true, minSeason: undefined });
  });

  it.each([0, -1, 1.5, 61, Number.MAX_SAFE_INTEGER])("clears an invalid or stale season (%s) while keeping valid switches", minSeason => {
    const local = storage();
    saveHistoryFilters(local, "defense", { onlyCurrentTier: false, onlyAlliance: true, minSeason });
    expect(loadHistoryFilters(local, "defense", 60)).toEqual({ onlyCurrentTier: false, onlyAlliance: true, minSeason: undefined });
  });

  it("clears a season with no available history and tolerates SSR or denied/quota storage", () => {
    const local = storage();
    const defaults = { onlyCurrentTier: true, onlyAlliance: true, minSeason: undefined };
    saveHistoryFilters(local, "attack", { ...defaults, minSeason: 59 });
    expect(loadHistoryFilters(local, "attack", null)).toEqual(defaults);
    expect(loadHistoryFilters(undefined, "attack", 60)).toEqual(defaults);
    const denied = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("quota"); } };
    expect(loadHistoryFilters(denied, "attack", 60)).toEqual(defaults);
    expect(saveHistoryFilters(denied, "attack", defaults)).toBe(false);
    expect(saveHistoryFilters(undefined, "attack", defaults)).toBe(false);
  });
});
