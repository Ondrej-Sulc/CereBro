import { expect, it } from "vitest";
import preview from "./fixtures/planner-bridge.json";
import { mapLoaders } from "../../data/game-quests/map-loaders";
import type { QuestMap } from "../../domain/game-quests";
import { routeEncounters } from "../../domain/game-quests";
import { createInitialQuestRouteChoices, projectQuestRouteProgress, orderQuestEncounterIdsByRoute, type QuestPlanningRouteSection } from "../../../web/src/lib/quest-planning-route-progress";

it("reuses the real planner projection for the seven proven offline routes", async () => {
  let checked = 0;
  for (const q of preview.quests) {
    const map = (await mapLoaders[q.questId as keyof typeof mapLoaders]()).default as unknown as QuestMap; // Archival fixture stays validated independently of public scope.
    for (const route of q.routes) {
      const choices = { ...createInitialQuestRouteChoices<QuestPlanningRouteSection>({ routeSections: q.routeSections }), ...route.choices };
      const projection = projectQuestRouteProgress({ encounters: q.encounters, routeSections: q.routeSections, routeChoices: choices });
      expect(projection.routeFilteredEncounters.map(e => e.id)).toEqual(route.encounterIds);
      expect(projection.routeFilteredEncounters.map(e => [e.coordinate, e.bossKey])).toEqual(routeEncounters(map, route.sourcePathIndex).map(e => [e.coordinate, e.bossKey]));
      expect(projection.activeEncounterIds.size).toBe(route.encounterIds.length);
      checked++;
    }
    expect(orderQuestEncounterIdsByRoute({ routeSections: q.routeSections.map(s => ({ ...s, paths: s.paths.map(p => ({ ...p, encounters: q.encounters.filter(e => e.routePathId === p.id) })) })), unassignedEncounters: q.encounters.filter(e => !e.routePathId) })).toEqual(q.encounters.map(e => e.id));
  }
  expect(checked).toBe(7);
});
