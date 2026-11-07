import { describe, expect, it } from "vitest";
import { ascensionEligibilityHref, getRosterAscensionLevel, matchesRosterAscensionFilter } from "./roster-ascension-filter";

describe("roster ascension filtering", () => {
  it.each(["all", "primordial-dust", "seven-star", ""])("shares canonical seven-star eligibility from old %s scope", scope => {
    const href = `https://cerebro.example/player/one/roster?ascensionEligible=true&ascensionScope=${scope}&stars=6&other=kept#results`;
    const shared = new URL(ascensionEligibilityHref(href, true));
    expect(shared.searchParams.get("ascensionScope")).toBe("seven-star");
    expect(shared.searchParams.get("ascensionEligible")).toBe("true");
    expect(shared.searchParams.get("stars")).toBe("6");
    expect(shared.searchParams.get("other")).toBe("kept");
    expect(shared.hash).toBe("#results");
    const removed = new URL(ascensionEligibilityHref(shared.href, false));
    expect(removed.searchParams.has("ascensionEligible")).toBe(false);
    expect(removed.searchParams.has("ascensionScope")).toBe(false);
    expect(removed.searchParams.get("stars")).toBe("6");
  });
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
