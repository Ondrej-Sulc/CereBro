import { describe, expect, it } from "vitest";
import { calculatePlayerRelicPrestige } from "./player-relic-prestige";

const entry = (id: string, prestige: number | null) => ({ id, prestige });
describe("owned relic prestige", () => {
  it("averages the highest 30 across variants and rarities, rounding only the final average", () => {
    const entries = Array.from({ length: 31 }, (_, i) => entry(String(i), 100 + i));
    const result = calculatePlayerRelicPrestige(entries);
    expect(result).toMatchObject({ average: 116, cutoff: 101, ready: true, missingCount: 0 });
    expect(result.contributorIds).toHaveLength(30);
    expect(result.contributorIds).not.toContain("0");
    expect(entries[0].id).toBe("0");
  });
  it("breaks ties deterministically without including more than 30", () => {
    const entries = Array.from({ length: 32 }, (_, i) => entry(String(i).padStart(2, "0"), 500));
    expect(calculatePlayerRelicPrestige(entries).contributorIds).toEqual(
      calculatePlayerRelicPrestige([...entries].reverse()).contributorIds,
    );
    expect(calculatePlayerRelicPrestige(entries).contributorIds).toHaveLength(30);
  });
  it("keeps incomplete and empty inventories as previews", () => {
    expect(calculatePlayerRelicPrestige([])).toMatchObject({ average: null, ready: false, contributorIds: [] });
    expect(calculatePlayerRelicPrestige([entry("one", 500)])).toMatchObject({ average: 500, ready: false });
  });
  it("does not silently exclude unknown or stale ratings, even outside 30 known entries", () => {
    const entries = Array.from({ length: 30 }, (_, i) => entry(String(i), 100));
    expect(calculatePlayerRelicPrestige([...entries, entry("unknown", null)])).toMatchObject({
      average: 100, missingCount: 1, ready: false,
    });
  });
  it("does not treat an invalid rating as usable data", () => {
    expect(calculatePlayerRelicPrestige([entry("bad", NaN), entry("bad2", -1)])).toMatchObject({
      average: null, missingCount: 2, ready: false,
    });
  });
});
