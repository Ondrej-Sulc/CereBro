import { describe, expect, it } from "vitest";
import features from "@cerebro/core/data/game-quests/map-features.json";
import type { QuestGateDefinition, QuestMapFeatureLayer } from "@cerebro/core/domain/game-quests/map-features";
import { projectQuestGateVisual } from "./gate-presentation";
import { matchesQuestGateChampionFilter, parseQuestChampionFilterParams, questGateChampionLinks, questGateFilterHref, type QuestGateChampionFilterGroups } from "./gate-champion-filter";
import { createOwnedRosterFilterIndex, filterRosterWithFacets, type FilterableRosterEntry, type RosterFiltersState } from "../roster-filtering";

const tag = (value: string, negated = false) => ({ kind: "tag" as const, value, negated });
const klass = (value: "SCIENCE" | "TECH", negated = false) => ({ kind: "class" as const, value, negated });
const champion = (tags: string[], championClass: "SCIENCE" | "TECH" = "SCIENCE") => ({ class: championClass, tags: tags.map(name => ({ name })) });
const defaults: RosterFiltersState = { search: "", classes: [], stars: [], ranks: [], ascension: [], tags: [], tagLogic: "AND", showUnowned: false, abilities: [], categories: [], immunities: [], includeResistances: true };

describe("quest gate champion links", () => {
  it("activates positive tag AND and OR with explicit catalog and owned roster destinations", () => {
    const cases: { groups: QuestGateChampionFilterGroups; logic: "AND" | "OR" }[] = [
      { groups: [[tag("Hero"), tag("Gamma")]], logic: "AND" },
      { groups: [[tag("Hero")], [tag("Gamma")]], logic: "OR" },
    ];
    for (const { groups, logic } of cases) {
      const links = questGateChampionLinks({ kind: "tags", images: [], filterGroups: groups })!;
      const catalog = new URL(links.champions, "https://cerebro.test");
      const roster = new URL(links.roster, catalog);
      expect(catalog.pathname).toBe("/champions"); expect(catalog.searchParams.get("view")).toBe("catalog");
      expect(roster.pathname).toBe("/profile/roster"); expect(roster.searchParams.get("unowned")).toBe("false");
      expect(catalog.searchParams.get("questTags")).toBeNull();
      expect(parseQuestChampionFilterParams(catalog.searchParams)).toMatchObject({ tags: ["Hero", "Gamma"], tagLogic: logic, questGate: null });
    }
  });

  it("preserves grouped alternatives, negative terms and exact class fields through URL and roster matching", () => {
    const groups: QuestGateChampionFilterGroups = [[klass("SCIENCE"), tag("Hero"), tag("Metal", true)], [tag("Villain"), tag("Gamma")]];
    const links = questGateChampionLinks({ kind: "tags", images: [], filterGroups: groups })!;
    const parsed = parseQuestChampionFilterParams(new URL(links.champions, "https://cerebro.test").searchParams);
    expect(parsed.questGate).toEqual(groups);
    const rows: FilterableRosterEntry[] = [champion(["#Hero"]), champion(["Hero", "Metal"]), champion(["Hero"], "TECH"), champion(["Villain", "Gamma"], "TECH"), champion(["Villain"]), champion(["Hero", "Science"], "TECH")].map((champion, i) => ({ id: `${i}`, championId: i, stars: 7, rank: 1, isAscended: false, ascensionLevel: 0, champion: { name: `${i}`, ...champion } }));
    const filtered = filterRosterWithFacets(createOwnedRosterFilterIndex(rows), { ...defaults, ...parsed });
    expect(filtered.entries.map(row => row.id)).toEqual(["0", "3"]);
    expect(filtered.counts.classes).toEqual({ SCIENCE: 1, TECH: 1 });
    expect(matchesQuestGateChampionFilter(champion(["Gamma-Ray"]), [[tag("Gamma")]])).toBe(false);
    expect(matchesQuestGateChampionFilter(champion(["#hErO"]), [[tag("Hero")]])).toBe(true);
    expect(matchesQuestGateChampionFilter(champion(["Science"], "TECH"), [[klass("SCIENCE", true)]])).toBe(true);
    expect(matchesQuestGateChampionFilter(champion([]), [[klass("SCIENCE", true)]])).toBe(false);
  });

  it("fails closed on malformed, empty, oversized and ambiguous explicit groups", () => {
    for (const value of ["nope", "null", "[]", "[[]]", JSON.stringify([[{ kind: "class", value: "chemical", negated: false }]]), JSON.stringify([[{ kind: "tag", value: "Hero", negated: "false" }]]), JSON.stringify(Array.from({ length: 100 }, () => [tag("Hero")]))]) {
      const parsed = parseQuestChampionFilterParams(new URLSearchParams({ questTags: value }));
      expect(parsed.questGate, value).toBe("invalid");
      expect(matchesQuestGateChampionFilter(champion(["Hero"]), parsed.questGate)).toBe(false);
    }
    expect(parseQuestChampionFilterParams(new URLSearchParams('tags=%5B%22Hero%22%5D&questTags=%5B%5D')).questGate).toBe("invalid");
    expect(parseQuestChampionFilterParams(new URLSearchParams('tags=%5B%22Hero%22%5D&tagLogic=X')).questGate).toBe("invalid");
  });

  it("removes the complete gate rule while retaining unrelated URL state", () => {
    const href = questGateFilterHref("https://cerebro.test/champions?view=catalog&questTags=bad&other=kept#results", { tags: [], tagLogic: "AND", questGate: null });
    expect(href).toBe("/champions?view=catalog&other=kept#results");
    expect(matchesQuestGateChampionFilter(champion([]), null)).toBe(true);
  });

  it("makes a truthful filter link for every published tag gate without flattening native groups", () => {
    const gates = (Object.values(features.maps) as unknown as QuestMapFeatureLayer[]).flatMap(layer => layer.gates).filter(gate => gate.kind === "tags");
    expect(gates).toHaveLength(40);
    for (const gate of gates) {
      const visual = projectQuestGateVisual(gate as QuestGateDefinition);
      expect(visual.filterGroups?.map(group => group.length), gate.id).toEqual(gate.constraints!.tags!.map(group => group.split(":" ).length));
      const links = questGateChampionLinks(visual);
      expect(links, gate.id).toBeDefined();
      const parsed = parseQuestChampionFilterParams(new URL(links!.champions, "https://cerebro.test").searchParams);
      expect(parsed.questGate, gate.id).not.toBe("invalid");
      expect(parsed.tags.length || Array.isArray(parsed.questGate) && parsed.questGate.length, gate.id).toBeTruthy();
    }
    expect(questGateChampionLinks({ kind: "unknown", images: [] })).toBeUndefined();
  });
});
