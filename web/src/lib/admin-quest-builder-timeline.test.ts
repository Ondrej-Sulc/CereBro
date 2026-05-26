import { describe, expect, it } from "vitest";
import { projectAdminQuestBuilderTimeline } from "./admin-quest-builder-timeline";

const encounters = [
  { id: "shared", routePathId: null, sequence: 1 },
  { id: "left", routePathId: "left-path", sequence: 2 },
  { id: "right", routePathId: "right-path", sequence: 3 },
  { id: "after-endpoint", routePathId: "right-path", sequence: 4 },
];

const routeSections = [{
  id: "start",
  title: "Start",
  parentPathId: null,
  paths: [
    { id: "left-path", title: "Left" },
    { id: "right-path", title: "Right" },
  ],
}];

describe("admin quest builder timeline projection", () => {
  it("filters base fights by selected route path", () => {
    const projection = projectAdminQuestBuilderTimeline({
      encounters,
      routeSections,
      routeChoices: { start: "left-path" },
      showAllFights: false,
    });

    expect(projection.filteredEncounters.map(encounter => encounter.id)).toEqual(["shared", "left"]);
  });

  it("applies objective route defaults and locked choices", () => {
    const projection = projectAdminQuestBuilderTimeline({
      encounters,
      routeSections,
      activeObjective: {
        id: "objective_1",
        slug: "right-side",
        title: "Right Side",
        order: 1,
        requiredTags: [],
        routeChoices: [{
          questRouteSectionId: "start",
          questRoutePathId: "right-path",
          isLocked: true,
        }],
      },
      showAllFights: false,
    });

    expect(projection.routeChoices.start).toBe("right-path");
    expect(projection.lockedRouteChoices.get("start")).toBe("right-path");
    expect(projection.filteredEncounters.map(encounter => encounter.id)).toEqual(["shared", "right", "after-endpoint"]);
  });

  it("stops at objective endpoint unless continuation is enabled", () => {
    const objective = {
      id: "objective_1",
      slug: "right-side",
      title: "Right Side",
      order: 1,
      requiredTags: [],
      endpointEncounterId: "right",
      routeChoices: [{
        questRouteSectionId: "start",
        questRoutePathId: "right-path",
      }],
    };

    expect(projectAdminQuestBuilderTimeline({
      encounters,
      routeSections,
      activeObjective: objective,
      showAllFights: false,
    }).filteredEncounters.map(encounter => encounter.id)).toEqual(["shared", "right"]);

    expect(projectAdminQuestBuilderTimeline({
      encounters,
      routeSections,
      activeObjective: objective,
      showObjectiveContinuation: true,
      showAllFights: false,
    }).filteredEncounters.map(encounter => encounter.id)).toEqual(["shared", "right", "after-endpoint"]);
  });
});
