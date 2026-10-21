import { afterEach, describe, expect, it, vi } from "vitest";
import { loadRosterAddDefaults, normalizeRosterAddDefaults, saveRosterAddDefaults } from "./roster-add-defaults";

afterEach(() => vi.unstubAllGlobals());

describe("manual roster add defaults", () => {
  it("remembers stars and rank across visits without retaining other champion fields", () => {
    const entries = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => entries.get(key) ?? null,
        setItem: (key: string, value: string) => entries.set(key, value),
      },
    });

    const champion = { stars: 7, rank: 4, championId: 10, sigLevel: 200, isAwakened: true, ascensionLevel: 5 };
    saveRosterAddDefaults(champion);
    expect(loadRosterAddDefaults()).toEqual({ stars: 7, rank: 4 });
    expect([...entries.values()].map(value => JSON.parse(value))).toEqual([{ stars: 7, rank: 4 }]);
    saveRosterAddDefaults({ stars: 6, rank: 3 });
    expect(loadRosterAddDefaults()).toEqual({ stars: 6, rank: 3 });
  });

  it.each([
    [null, { stars: 6, rank: 1 }],
    [[], { stars: 6, rank: 1 }],
    ["7R4", { stars: 6, rank: 1 }],
    [{ stars: "7", rank: "4" }, { stars: 6, rank: 1 }],
    [{ stars: 3, rank: 99 }, { stars: 6, rank: 5 }],
    [{ stars: 7, rank: 6 }, { stars: 7, rank: 6 }],
    [{ stars: 6, rank: 6 }, { stars: 6, rank: 5 }],
    [{ stars: 5, rank: -2 }, { stars: 5, rank: 1 }],
    [{ stars: 4, rank: 6 }, { stars: 4, rank: 5 }],
    [{ stars: 7, rank: 2.5 }, { stars: 7, rank: 1 }],
    [{ stars: Number.NaN, rank: Infinity }, { stars: 6, rank: 1 }],
  ])("normalizes malformed or unsupported preferences and rank limits: %j", (input, expected) => {
    expect(normalizeRosterAddDefaults(input)).toEqual(expected);
  });

  it("is safe without a browser and preserves session defaults when storage is blocked", () => {
    vi.stubGlobal("window", undefined);
    expect(loadRosterAddDefaults()).toEqual({ stars: 6, rank: 1 });
    expect(() => saveRosterAddDefaults({ stars: 7, rank: 4 })).not.toThrow();

    vi.stubGlobal("window", {
      get localStorage() { throw new Error("Storage access denied"); },
    });
    expect(loadRosterAddDefaults({ stars: 7, rank: 4 })).toEqual({ stars: 7, rank: 4 });
    expect(() => saveRosterAddDefaults({ stars: 7, rank: 4 })).not.toThrow();
  });

  it("recovers from corrupt JSON and stale stored ranks, including write failures", () => {
    let stored: string | null = "{broken";
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => stored,
        setItem: () => { throw new Error("Quota exceeded"); },
      },
    });
    expect(loadRosterAddDefaults()).toEqual({ stars: 6, rank: 1 });
    stored = '{"stars":4,"rank":6}';
    expect(loadRosterAddDefaults()).toEqual({ stars: 4, rank: 5 });
    stored = '{"stars":"7","rank":"4"}';
    expect(loadRosterAddDefaults()).toEqual({ stars: 6, rank: 1 });
    stored = null;
    expect(loadRosterAddDefaults({ stars: 7, rank: 6 })).toEqual({ stars: 7, rank: 6 });
    expect(() => saveRosterAddDefaults({ stars: 7, rank: 4 })).not.toThrow();
  });
});
