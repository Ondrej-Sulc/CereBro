import { expect, it } from "vitest";
import { matchesRewardSearch, rankRewardSearchOptions, rewardSearchLabel, type RewardSearchOption } from "./reward-search-ranking";

const option = (key: string, name: string, rarity: number | null = null): RewardSearchOption => ({ key, name, rarity, href: `/rewards?item=${key}`, imageUrl: null, sources: 2 });
const options = [
  option("shards", "7-Star Hero Crystal Shard"),
  option("crystal", "7-Star Hero Crystal"),
  option("hero", "Spider-Man", 7),
  option("gem", "Mutant Rank-Up Gem"),
  option("iso", "Tier 6 Class ISO-8 Selector"),
];

it("matches star notation, reordered words and punctuation while respecting rarity", () => {
  for (const query of ["7* crystal", "7★ CRYSTAL", "crystal 7-star", "  7 star  crystal  "]) {
    expect(rankRewardSearchOptions(options, query).map(row => row.key)).toEqual(["crystal", "shards"]);
  }
  expect(matchesRewardSearch(options[2], "7* spider man")).toBe(true);
  expect(matchesRewardSearch(options[2], "6* spider man")).toBe(false);
  expect(matchesRewardSearch(options[3], "rankup mutant")).toBe(true);
  expect(matchesRewardSearch(options[4], "iso8 tIEr 6")).toBe(true);
});

it("ranks exact names before prefixes without mutating the catalog", () => {
  const before = structuredClone(options);
  expect(rankRewardSearchOptions(options, "7-star hero crystal", 1).map(row => row.key)).toEqual(["crystal"]);
  expect(options).toEqual(before);
  expect(rankRewardSearchOptions(options, "missing")).toEqual([]);
  expect(rankRewardSearchOptions(options, "   ")).toEqual([]);
  expect(rewardSearchLabel(options[2])).toBe("7★ Spider-Man");
});

it("preserves distinct reward identities and keeps star numbers on token boundaries", () => {
  const rewards = [option("seven", "7-Star Hero Crystal"), option("other-seven", "7-Star Hero Crystal"), option("seventeen", "17-Star Hero Crystal"), option("fifty-seven", "57-Star Hero Crystal")];
  expect(rankRewardSearchOptions(rewards, "7* crystal", rewards.length).map(row => row.key).sort()).toEqual(["other-seven", "seven"]);
  expect(rankRewardSearchOptions(rewards, "17-star").map(row => row.key)).toEqual(["seventeen"]);
  expect(matchesRewardSearch(option("accent", "Réunion Crystal"), "reunion")).toBe(true);
});

it("accepts familiar plural reward terms without changing meaningful class words", () => {
  expect(rankRewardSearchOptions(options, "7* crystals").map(row => row.key)).toEqual(["crystal", "shards"]);
  expect(rankRewardSearchOptions(options, "rank up gems").map(row => row.key)).toEqual(["gem"]);
  const rewards = [option("catalyst", "Tier 6 Class Catalyst Fragment Selector"), option("token", "7-Star Class Ascension Token")];
  for (const query of ["class catalysts", "catalyst fragments", "selectors", "t6 catalysts", "tier6 class catalyst"]) {
    expect(rankRewardSearchOptions(rewards, query).map(row => row.key)).toEqual(["catalyst"]);
  }
  expect(rankRewardSearchOptions(rewards, "ascension tokens").map(row => row.key)).toEqual(["token"]);
  expect(rankRewardSearchOptions(rewards, "clash catalysts")).toEqual([]);
});
