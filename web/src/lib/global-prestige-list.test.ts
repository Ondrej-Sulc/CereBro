import { describe, expect, it } from "vitest";
import { ChampionClass } from "@prisma/client";
import {
  buildGlobalPrestigeList,
  normalizeGlobalPrestigeListOptions,
  type GlobalPrestigeChampion,
  type GlobalPrestigeListOptions,
  type GlobalPrestigeRosterEntry,
  type GlobalPrestigeRow,
} from "./global-prestige-list";

const emptyImages = {
  hero: "",
  full_primary: "",
  full_secondary: "",
  p_32: "",
  s_32: "",
  p_64: "",
  s_64: "",
  p_128: "",
  s_128: "",
};

const defaultOptions: GlobalPrestigeListOptions = {
  rarity: 7,
  rank: 4,
  sig: 200,
  ascensionLevel: 0,
  classFilter: [],
  ownership: "all",
  sagaOnly: false,
  search: "",
  limit: 100,
};

function champion({
  id,
  name,
  championClass = ChampionClass.COSMIC,
  obtainable = ["7*"],
  tags = [],
  isPlayable = true,
}: {
  id: number;
  name: string;
  championClass?: ChampionClass;
  obtainable?: string[];
  tags?: string[];
  isPlayable?: boolean;
}): GlobalPrestigeChampion {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    class: championClass,
    images: emptyImages,
    obtainable,
    isPlayable,
    tags: tags.map(name => ({ name })),
  };
}

function rosterEntry({
  id,
  championId,
  stars = 7,
  rank = 3,
  sigLevel = 20,
  ascensionLevel = 0,
}: {
  id: string;
  championId: number;
  stars?: number;
  rank?: number;
  sigLevel?: number;
  ascensionLevel?: number;
}): GlobalPrestigeRosterEntry {
  return { id, championId, stars, rank, sigLevel, ascensionLevel };
}

function prestigeRows(championId: number, rank: number, values: Record<number, number>, rarity = 7): GlobalPrestigeRow[] {
  return Object.entries(values).map(([sig, prestige]) => ({
    championId,
    rarity,
    rank,
    sig: Number(sig),
    prestige,
  }));
}

describe("Global Prestige List", () => {
  it("defaults non-7-star target rank to max rank", () => {
    expect(normalizeGlobalPrestigeListOptions({ globalRarity: "6" }, { targetRank: 3 })).toMatchObject({
      rarity: 6,
      rank: 5,
    });
  });

  it("ranks champions by selected target prestige", () => {
    const result = buildGlobalPrestigeList({
      champions: [
        champion({ id: 1, name: "Alpha" }),
        champion({ id: 2, name: "Bravo" }),
        champion({ id: 3, name: "Charlie" }),
      ],
      roster: [],
      prestigeRows: [
        ...prestigeRows(1, 4, { 0: 10000, 1: 10100, 200: 30000 }),
        ...prestigeRows(2, 4, { 0: 10000, 1: 10100, 200: 35000 }),
        ...prestigeRows(3, 4, { 0: 10000, 1: 10100, 200: 30000 }),
      ],
      options: defaultOptions,
    });

    expect(result.entries.map(entry => [entry.globalRank, entry.championName])).toEqual([
      [1, "Bravo"],
      [2, "Alpha"],
      [3, "Charlie"],
    ]);
  });

  it("overlays selected-rarity ownership and labels missing champions", () => {
    const result = buildGlobalPrestigeList({
      champions: [
        champion({ id: 1, name: "Alpha" }),
        champion({ id: 2, name: "Bravo" }),
      ],
      roster: [rosterEntry({ id: "owned-alpha", championId: 1, rank: 3, sigLevel: 20 })],
      prestigeRows: [
        ...prestigeRows(1, 3, { 0: 9000, 1: 9100, 200: 20000 }),
        ...prestigeRows(1, 4, { 0: 10000, 1: 10100, 200: 30000 }),
        ...prestigeRows(2, 4, { 0: 10000, 1: 10100, 200: 31000 }),
      ],
      options: defaultOptions,
    });

    const alpha = result.entries.find(entry => entry.championName === "Alpha");
    const bravo = result.entries.find(entry => entry.championName === "Bravo");

    expect(alpha).toMatchObject({
      isOwned: true,
      ownedGapLabel: "Owned R3 S20 A0",
      ownership: {
        rosterId: "owned-alpha",
        rank: 3,
        sigLevel: 20,
        ascensionLevel: 0,
      },
    });
    expect(alpha?.ownership?.currentPrestige).toBeGreaterThan(9100);
    expect(bravo).toMatchObject({
      isOwned: false,
      ownership: null,
      ownedGapLabel: "Missing 7\u2605",
    });
  });

  it("filters ownership without renumbering global ranks", () => {
    const shared = {
      champions: [
        champion({ id: 1, name: "Alpha" }),
        champion({ id: 2, name: "Bravo" }),
        champion({ id: 3, name: "Charlie" }),
      ],
      roster: [rosterEntry({ id: "owned-charlie", championId: 3 })],
      prestigeRows: [
        ...prestigeRows(1, 4, { 0: 10000, 1: 10100, 200: 35000 }),
        ...prestigeRows(2, 4, { 0: 10000, 1: 10100, 200: 33000 }),
        ...prestigeRows(3, 4, { 0: 10000, 1: 10100, 200: 30000 }),
        ...prestigeRows(3, 3, { 0: 9000, 1: 9100, 200: 20000 }),
      ],
    };

    const owned = buildGlobalPrestigeList({ ...shared, options: { ...defaultOptions, ownership: "owned" } });
    const missing = buildGlobalPrestigeList({ ...shared, options: { ...defaultOptions, ownership: "missing" } });

    expect(owned.entries.map(entry => [entry.globalRank, entry.championName])).toEqual([[3, "Charlie"]]);
    expect(missing.entries.map(entry => [entry.globalRank, entry.championName])).toEqual([
      [1, "Alpha"],
      [2, "Bravo"],
    ]);
  });

  it("excludes champions not obtainable at the selected rarity", () => {
    const result = buildGlobalPrestigeList({
      champions: [
        champion({ id: 1, name: "Alpha", obtainable: ["6*"] }),
        champion({ id: 2, name: "Bravo", obtainable: ["7*"] }),
      ],
      roster: [],
      prestigeRows: [
        ...prestigeRows(1, 4, { 0: 10000, 1: 10100, 200: 35000 }),
        ...prestigeRows(2, 4, { 0: 10000, 1: 10100, 200: 30000 }),
      ],
      options: defaultOptions,
    });

    expect(result.entries.map(entry => entry.championName)).toEqual(["Bravo"]);
  });

  it("applies class, Saga, and search filters", () => {
    const result = buildGlobalPrestigeList({
      champions: [
        champion({ id: 1, name: "Alpha Prime", championClass: ChampionClass.COSMIC, tags: ["#Saga Champions"] }),
        champion({ id: 2, name: "Alpha Other", championClass: ChampionClass.MUTANT, tags: ["#Saga Champions"] }),
        champion({ id: 3, name: "Bravo Prime", championClass: ChampionClass.COSMIC }),
      ],
      roster: [],
      prestigeRows: [
        ...prestigeRows(1, 4, { 0: 10000, 1: 10100, 200: 35000 }),
        ...prestigeRows(2, 4, { 0: 10000, 1: 10100, 200: 34000 }),
        ...prestigeRows(3, 4, { 0: 10000, 1: 10100, 200: 33000 }),
      ],
      options: {
        ...defaultOptions,
        classFilter: [ChampionClass.COSMIC],
        sagaOnly: true,
        search: "alpha",
      },
    });

    expect(result.entries.map(entry => entry.championName)).toEqual(["Alpha Prime"]);
  });

  it("matches the imported Saga tag name without a leading hash", () => {
    const result = buildGlobalPrestigeList({
      champions: [
        champion({ id: 1, name: "Alpha Prime", tags: ["Saga Champions"] }),
        champion({ id: 2, name: "Bravo Prime" }),
      ],
      roster: [],
      prestigeRows: [
        ...prestigeRows(1, 4, { 0: 10000, 1: 10100, 200: 35000 }),
        ...prestigeRows(2, 4, { 0: 10000, 1: 10100, 200: 34000 }),
      ],
      options: { ...defaultOptions, sagaOnly: true },
    });

    expect(result.entries.map(entry => entry.championName)).toEqual(["Alpha Prime"]);
  });

  it("applies 7-star ascension projection", () => {
    const base = {
      champions: [champion({ id: 1, name: "Alpha" })],
      roster: [],
      prestigeRows: prestigeRows(1, 4, { 0: 10000, 1: 10100, 200: 30000 }),
    };

    const a0 = buildGlobalPrestigeList({ ...base, options: { ...defaultOptions, ascensionLevel: 0 } });
    const a5 = buildGlobalPrestigeList({ ...base, options: { ...defaultOptions, ascensionLevel: 5 } });

    expect(a0.entries[0].targetPrestige).toBe(30000);
    expect(a5.entries[0].targetPrestige).toBe(42000);
  });
});
