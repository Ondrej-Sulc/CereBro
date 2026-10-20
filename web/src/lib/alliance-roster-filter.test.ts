import { describe, expect, it } from "vitest";
import { matchesAllianceRosterFilters } from "./alliance-roster-filter";

describe("alliance roster filters", () => {
  it("combines ascension with class, stars and rank, including legacy A1 entries", () => {
    const entries = [
      { id: "legacy", championClass: "COSMIC" as const, stars: 7, rank: 4, isAscended: true, ascensionLevel: 0 },
      { id: "unascended", championClass: "COSMIC" as const, stars: 7, rank: 4, isAscended: false, ascensionLevel: 0 },
      { id: "different-class", championClass: "MUTANT" as const, stars: 7, rank: 4, isAscended: true, ascensionLevel: 1 },
      { id: "different-stars", championClass: "COSMIC" as const, stars: 6, rank: 4, isAscended: true, ascensionLevel: 1 },
      { id: "different-rank", championClass: "COSMIC" as const, stars: 7, rank: 3, isAscended: true, ascensionLevel: 1 },
    ];
    const filters = { classes: ["COSMIC" as const], stars: "7", ranks: ["4"], ascensionLevels: [1] };

    expect(entries.filter(entry => matchesAllianceRosterFilters(entry, filters)).map(entry => entry.id)).toEqual(["legacy"]);
  });

  it("supports A0, multiple levels, no matches, and clearing ascension while keeping other filters", () => {
    const entries = [
      { id: "A0", championClass: "TECH" as const, stars: 7, rank: 3, isAscended: false, ascensionLevel: 0 },
      { id: "A2", championClass: "TECH" as const, stars: 7, rank: 3, isAscended: true, ascensionLevel: 2 },
      { id: "A5", championClass: "TECH" as const, stars: 7, rank: 4, isAscended: true, ascensionLevel: 5 },
    ];
    const matching = (ascensionLevels: number[], ranks: string[] = []) => entries
      .filter(entry => matchesAllianceRosterFilters(entry, { classes: [], stars: "ALL", ranks, ascensionLevels }))
      .map(entry => entry.id);

    expect(matching([0])).toEqual(["A0"]);
    expect(matching([2, 5])).toEqual(["A2", "A5"]);
    expect(matching([1, 4])).toEqual([]);
    expect(matching([], ["3"])).toEqual(["A0", "A2"]);
    expect(matching([])).toEqual(["A0", "A2", "A5"]);
  });
});
