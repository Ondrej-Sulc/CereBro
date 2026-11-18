import { coordinateKey, type QuestMap } from "@cerebro/core/domain/game-quests";
import { questEncounterIsBoss } from "@cerebro/core/domain/game-quests/boss-display";
import { questMarkerScales, type QuestMarkerFootprint } from "@cerebro/core/domain/game-quests/marker-scale";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import type { QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import { questGateMarkerHeight, questGateMarkerWidth } from "./quest-gate-marker";
import type { regionBoardGeometry } from "./quest-spawn-region-presentation";

/** Complete visual and hit area, including quantity labels and combined slots. */
function featureRadius(location: QuestMapFeatureLocation): number {
  const slots = Number(Boolean(location.gates.length)) + Number(location.pickups.some(p=>p.rewards.length)) + Number(Boolean(location.chests?.length));
  const gate = location.gates[0];
  const width = gate ? questGateMarkerWidth(gate) + 8 : 56;
  const height = gate ? Math.max(58, questGateMarkerHeight(gate)) + 20 : 78;
  return Math.hypot(width / 2 + Math.max(0, slots - 1) * 25, height / 2 + 1);
}

/** One footprint per native location: co-located badges grow with their portrait. */
export function questMapMarkerLayout(map: QuestMap, board: ReturnType<typeof regionBoardGeometry>, locations: readonly QuestMapFeatureLocation[], zoom: number, layer?: QuestSpawnRegionLayer) {
  const footprints = new Map<string, QuestMarkerFootprint>();
  const put = (key: string, x: number, y: number, radius: number) => {
    const fullRadius = Math.max(footprints.get(key)?.radius ?? 0, radius);
    footprints.set(key, {id:key, x, y, radius:fullRadius, preferredRadius:fullRadius * 24 / 27});
  };
  for (const encounter of map.encounters) {
    const [x,y] = board.point(encounter.coordinate);
    // The boss emblem compensates for zoom, so reserve its maximum outer reach.
    put(coordinateKey(encounter.coordinate), x, y, (encounter.final ? 33 : 27) + (questEncounterIsBoss(map, encounter) ? 31 : 8));
  }
  for (const region of layer?.regions ?? []) {
    const [x,y] = board.point(region.anchor);
    put(coordinateKey(region.anchor), x, y, 36);
  }
  for (const location of locations) {
    const key = coordinateKey(location.coordinate), [x,y] = board.point(location.coordinate);
    // Compact badges are offset (37,35), scaled .65, and share the parent's transform.
    const radius = footprints.has(key) ? Math.hypot(37,35) + featureRadius(location) * .65 : featureRadius(location);
    put(key, x, y, radius);
  }
  const destinations = new Set(board.edges.filter(edge=>edge.portal).map(edge=>coordinateKey(edge.to)));
  for (const tile of map.tiles) {
    const key = coordinateKey(tile.coordinate);
    const portal = Boolean(tile.portals.length || tile.randomPortal || destinations.has(key));
    if (!tile.start && !portal) continue;
    const [x,y] = board.point(tile.coordinate);
    put(key, x, y, portal ? (footprints.get(key)?.radius ?? 20) + 10 : 29);
  }
  const scales = questMarkerScales([...footprints.values()], zoom, board);
  const radii = new Map([...footprints].map(([key, marker])=>[key, marker.radius * (scales.get(key) ?? 1)]));
  const obstacles = [...footprints.values()].map(marker=>({x:marker.x,y:marker.y,radius:radii.get(marker.id)!}));
  return {scales, radii, obstacles};
}
