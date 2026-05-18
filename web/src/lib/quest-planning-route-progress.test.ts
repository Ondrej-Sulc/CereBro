import { describe, expect, it } from "vitest";
import {
  createInitialQuestRouteChoices,
  orderQuestEncounterIdsByRoute,
  projectQuestRouteProgress,
  sanitizeQuestRouteChoices,
} from "./quest-planning-route-progress";

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

describe("Quest Planning Route Progress", () => {
  it("projects visible sections, selected route paths, and active encounters", () => {
    const progress = projectQuestRouteProgress({
      routeSections,
      routeChoices: {
        root: "right",
        "right-child": "upper",
      },
      encounters: [
        { id: "shared", routePathId: null, sequence: 1 },
        { id: "left-fight", routePathId: "left", sequence: 2 },
        { id: "right-fight", routePathId: "right", sequence: 3 },
        { id: "upper-fight", routePathId: "upper", sequence: 4 },
      ],
    });

    expect(progress.visibleRouteSections.map(section => section.id)).toEqual(["root", "right-child"]);
    expect(progress.selectedRoutePathIds).toEqual(["right", "upper"]);
    expect(progress.routeFilteredEncounters.map(encounter => encounter.id)).toEqual([
      "shared",
      "right-fight",
      "upper-fight",
    ]);
    expect([...progress.activeEncounterIds]).toEqual(["shared", "right-fight", "upper-fight"]);
  });

  it("creates and sanitizes route choices through one route interface", () => {
    expect(createInitialQuestRouteChoices({
      routeSections,
      savedRouteChoices: [{ questRouteSectionId: "root", questRoutePathId: "right" }],
    })).toEqual({
      root: "right",
      "right-child": "upper",
    });

    expect(sanitizeQuestRouteChoices(routeSections, {
      root: "missing",
      "right-child": "lower",
      unrelated: "value",
    })).toEqual({
      "right-child": "lower",
    });
  });

  it("orders encounters by route tree and appends unassigned encounters", () => {
    const ordered = orderQuestEncounterIdsByRoute({
      routeSections: [
        {
          id: "root",
          parentPathId: null,
          paths: [
            { id: "left", encounters: [{ id: "left-1", sequence: 2 }] },
            { id: "right", encounters: [{ id: "right-1", sequence: 3 }] },
          ],
        },
        {
          id: "child",
          parentPathId: "right",
          paths: [
            { id: "upper", encounters: [{ id: "upper-1", sequence: 4 }] },
          ],
        },
      ],
      unassignedEncounters: [{ id: "shared", sequence: 1 }],
    });

    expect(ordered).toEqual(["left-1", "right-1", "upper-1", "shared"]);
  });
});
