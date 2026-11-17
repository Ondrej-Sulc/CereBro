import { expect, it } from "vitest";
import { championScopeHref, matchesChampionScope, normalizeChampionScope } from "./champion-catalog-scope";

it("uses playable as the default and requires explicit false for NPC identities", () => {
  expect(normalizeChampionScope("invalid")).toBe("playable");
  expect(matchesChampionScope({}, "playable")).toBe(true);
  expect(matchesChampionScope({ isPlayable: false }, "nonPlayable")).toBe(true);
  expect(matchesChampionScope({ isPlayable: true }, "nonPlayable")).toBe(false);
  expect(matchesChampionScope({ isPlayable: false }, "all")).toBe(true);
});

it("shares scope in URLs without disturbing the view, other filters or hash", () => {
  const url = "https://cerebro.test/champions?view=catalog&stars=7#results";
  expect(championScopeHref(url, "nonPlayable")).toBe("/champions?view=catalog&stars=7&championScope=nonPlayable#results");
  expect(championScopeHref("https://cerebro.test/champions?view=personal&championScope=all#results", "playable")).toBe("/champions?view=personal#results");
});
