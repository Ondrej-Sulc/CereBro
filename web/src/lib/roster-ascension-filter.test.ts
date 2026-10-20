import { describe, expect, it } from "vitest";
import { getRosterAscensionLevel, matchesRosterAscensionFilter } from "./roster-ascension-filter";

describe("roster ascension filtering", () => {
  it("does not filter when no levels are selected", () => {
    expect(matchesRosterAscensionFilter({ isAscended: true, ascensionLevel: 3 }, [])).toBe(true);
  });

  it("matches unascended champions as A0", () => {
    const champion = { isAscended: false, ascensionLevel: 0 };

    expect(getRosterAscensionLevel(champion)).toBe(0);
    expect(matchesRosterAscensionFilter(champion, [0])).toBe(true);
    expect(matchesRosterAscensionFilter(champion, [1])).toBe(false);
  });

  it("normalizes legacy ascended champions without a level to A1", () => {
    const champion = { isAscended: true, ascensionLevel: 0 };

    expect(getRosterAscensionLevel(champion)).toBe(1);
    expect(matchesRosterAscensionFilter(champion, [1])).toBe(true);
  });

  it("matches an explicit ascension level", () => {
    const champion = { isAscended: true, ascensionLevel: 4 };

    expect(matchesRosterAscensionFilter(champion, [2, 4])).toBe(true);
    expect(matchesRosterAscensionFilter(champion, [1, 3])).toBe(false);
  });
});
