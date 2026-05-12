import { describe, expect, it } from "vitest";
import {
  createInitialQuestRouteChoices,
  projectQuestPlanningState,
  projectSelectedQuestTeam,
} from "./quest-planning-projection";

const routeSections = [
  {
    id: "root",
    title: "Opening",
    parentPathId: null,
    paths: [
      { id: "left", title: "Left" },
      { id: "right", title: "Right" },
    ],
  },
  {
    id: "right-child",
    title: "Right Branch",
    parentPathId: "right",
    paths: [
      { id: "upper", title: "Upper" },
      { id: "lower", title: "Lower" },
    ],
  },
];

const encounters = [
  { id: "shared", routePathId: null, sequence: 1, difficulty: "EASY" },
  { id: "left-fight", routePathId: "left", sequence: 2, difficulty: "NORMAL" },
  { id: "right-fight", routePathId: "right", sequence: 3, difficulty: "HARD" },
  { id: "upper-fight", routePathId: "upper", sequence: 4, difficulty: "HARD" },
];

const roster = [
  { id: "r1", championId: 1, stars: 7, rank: 2, champion: { id: 1 } },
  { id: "r2", championId: 2, stars: 6, rank: 4, champion: { id: 2 } },
  { id: "r3", championId: 3, stars: 6, rank: 5, champion: { id: 3 } },
  { id: "r1-alt", championId: 1, stars: 5, rank: 5, champion: { id: 1 } },
];

describe("Quest Planning Projection", () => {
  it("defaults route choices to the first path unless a saved choice exists", () => {
    expect(createInitialQuestRouteChoices({
      routeSections,
      savedRouteChoices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
    })).toEqual({
      root: "right",
      "right-child": "upper",
    });
  });

  it("projects route-aware encounters, selections, route summaries, and revives", () => {
    const projection = projectQuestPlanningState({
      quest: {
        encounters,
        routeSections,
        teamLimit: 3,
      },
      routeChoices: {
        root: "right",
        "right-child": "upper",
      },
      selections: {
        shared: "r1",
        "left-fight": "r2",
        "right-fight": "r2",
      },
      prefightSelections: {
        "upper-fight": "r3",
      },
      synergyIds: [4],
      revivesByEncounterId: {
        shared: 1,
        "left-fight": 9,
        "upper-fight": 2,
      },
      roster,
      savedSynergies: [{ championId: 4, label: "missing roster entry" }],
      difficultyFilter: ["HARD"],
      createSynergyRosterEntry: (synergy) => ({
        id: `synergy-${synergy.championId}`,
        championId: synergy.championId,
        stars: 0,
        rank: 0,
        champion: { id: synergy.championId },
      }),
    });

    expect(projection.visibleRouteSections.map(section => section.id)).toEqual(["root", "right-child"]);
    expect(projection.selectedRoutePathIds).toEqual(["right", "upper"]);
    expect(projection.routeFilteredEncounters.map(encounter => encounter.id)).toEqual(["shared", "right-fight", "upper-fight"]);
    expect(projection.activeSelections).toEqual({
      shared: "r1",
      "right-fight": "r2",
    });
    expect(projection.activePrefightSelections).toEqual({
      "upper-fight": "r3",
    });
    expect(projection.activeQuestAssignments).toEqual([
      { questEncounterId: "shared", selectedChampionId: 1, prefightChampionId: null },
      { questEncounterId: "right-fight", selectedChampionId: 2, prefightChampionId: null },
      { questEncounterId: "upper-fight", selectedChampionId: null, prefightChampionId: 3 },
    ]);
    expect(projection.selectedRouteSummary).toEqual([
      { sectionTitle: "Opening", pathTitle: "Right" },
      { sectionTitle: "Right Branch", pathTitle: "Upper" },
    ]);
    expect(projection.activeRevivesTotal).toBe(3);
    expect(projection.allRevivesTotal).toBe(12);
    expect(projection.filteredEncounters.map(encounter => encounter.id)).toEqual(["right-fight", "upper-fight"]);
    expect(projection.selectedTeam.map(entry => entry.championId)).toEqual([1, 2, 3, 4]);
  });

  it("dedupes team-limited plans by champion but keeps separate rarities for unlimited plans", () => {
    expect(projectSelectedQuestTeam({
      activeSelections: { e1: "r1" },
      activePrefightSelections: { e2: "r1-alt" },
      synergyIds: [],
      roster,
      teamLimit: 5,
    }).map(entry => entry.id)).toEqual(["r1-alt"]);

    expect(projectSelectedQuestTeam({
      activeSelections: { e1: "r1" },
      activePrefightSelections: { e2: "r1-alt" },
      synergyIds: [],
      roster,
      teamLimit: null,
    }).map(entry => entry.id)).toEqual(["r1", "r1-alt"]);
  });
});
