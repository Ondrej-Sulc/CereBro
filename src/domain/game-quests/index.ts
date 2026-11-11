export type Coordinate = [number, number];
export type ChampionIdentity = { id: number; slug: string; name: string };
export type GameIdentity = { tierId: string; gameId: string; rarity: number; name: string; champion: ChampionIdentity | null };
export type QuestSummary = {
  id: string; name: string; category: string; mapId: string;
  containerSetId: string; containerSetName: string; summarySetId: string; summarySetName: string;
  actIndex: number; chapterIndex: number; questIndex: number;
  hierarchy: { actId: string; actName: string; actGroupIndex: number; actDisplayIndex: number; chapterId: string; chapterName: string }[];
  hierarchyBinding: string; difficultyId: string; difficulty: string; setDifficulty: string;
  minProgressionRank: number | null; maxProgressionRank: number | null; scalingCurve: string | null;
  coverage: "full-map" | "summary-only"; walkableNodes: number | null; authoredPaths: number | null;
  placedEncounters: number | null; sourceHash: string;
  section?: "Story" | "Special";
  mapSourceHash?: string;
};
export type QuestApplication = {
  id: string; effectId: string; target: "attacker" | "defender"; name: string; description: string | null; rawDescription: string;
  amount: number; extra: boolean; sourceCoordinate: Coordinate; sourceType: string; remainActive: boolean | null;
  linkedTargets: Coordinate[]; parameters: Record<string, unknown>;
  iconKey?: string | null;
};
export type QuestTile = {
  coordinate: Coordinate; nodeNumber: number; start: boolean; final: boolean; hidden: boolean;
  links: Coordinate[]; portals: { target: Coordinate; label: string; randomChance: number; tags: string[] }[];
  randomPortal: boolean; barrier: string; applications: QuestApplication[];
};
export type QuestEncounter = GameIdentity & {
  id: string; coordinate: Coordinate; bossKey: string; rank: number; level: number;
  signature: number; ascension: number; final: boolean; candidates: GameIdentity[]; pathIndices: number[];
};
export type QuestMap = {
  modifierCoverage?: { applications: number; resolvedDefinitions: number; verifiedIcons: number };
  version: number; questId: string; mapId: string; sourceHash: string; capturedAt: string; sourceFile: string;
  gridDimension: number; adaptive: boolean; tiles: QuestTile[]; paths: { index: number; coordinates: Coordinate[] }[];
  encounters: QuestEncounter[];
  rewards: { fixedChampions: (GameIdentity & { scope: string; quantity: number })[]; possibleCrystals: { scope: string; token: string; quantity: number }[] };
};
export type EncounterOccurrence = {
  questId: string; mapId: string; sourceHash: string; encounterId: string; coordinate: Coordinate;
  gameId: string; name: string; rarity: number; final: boolean; pathIndices: number[];
};
export const coordinateKey = (c: Coordinate) => c.join(",");
export function routeEncounters(map: QuestMap, pathIndex: number): QuestEncounter[] {
  return (map.paths.find(p => p.index === pathIndex)?.coordinates ?? []).flatMap(c => map.encounters.filter(e => coordinateKey(e.coordinate) === coordinateKey(c)));
}
export function effectOccurrences(map: QuestMap, effectId: string) {
  return map.tiles.flatMap(tile => tile.applications.filter(a => a.effectId === effectId).map(a => ({
    ...a, applicationId: `${map.questId}:${map.sourceHash}:${a.id}`, questId: map.questId, mapId: map.mapId,
    sourceHash: map.sourceHash, coordinate: tile.coordinate, nodeNumber: tile.nodeNumber,
    pathIndices: map.paths.filter(p => p.coordinates.some(c => coordinateKey(c) === coordinateKey(tile.coordinate))).map(p => p.index),
    encounterIds: map.encounters.filter(e => coordinateKey(e.coordinate) === coordinateKey(tile.coordinate)).map(e => e.id),
  })));
}
export function validateQuestMap(map: QuestMap): string[] {
  const errors: string[] = [];
  const keys = new Set(map.tiles.map(t => coordinateKey(t.coordinate)));
  const edge = new Set<string>();
  if (keys.size !== map.tiles.length) errors.push("duplicate coordinate");
  for (const t of map.tiles) {
    if (t.coordinate.some(v => !Number.isInteger(v) || v < 0 || v >= map.gridDimension)) errors.push("coordinate bounds");
    for (const c of [...t.links, ...t.portals.map(p => p.target)]) {
      if (!keys.has(coordinateKey(c))) errors.push("missing edge endpoint");
      edge.add(`${coordinateKey(t.coordinate)}>${coordinateKey(c)}`);
    }
    for (const a of t.applications) {
      if (!a.effectId || !keys.has(coordinateKey(a.sourceCoordinate))) errors.push("missing application source");
      if (a.linkedTargets.some(c => !keys.has(coordinateKey(c)))) errors.push("missing linked target");
    }
  }
  for (const p of map.paths) {
    if (!p.coordinates.length) errors.push("empty path");
    p.coordinates.forEach((c, i) => {
      if (!keys.has(coordinateKey(c))) errors.push("missing path tile");
      if (i && !edge.has(`${coordinateKey(p.coordinates[i - 1])}>${coordinateKey(c)}`)) errors.push("invalid path step");
    });
  }
  const encounters = new Set<string>();
  for (const e of map.encounters) {
    if (encounters.has(e.id)) errors.push("duplicate placement");
    encounters.add(e.id);
    if (!keys.has(coordinateKey(e.coordinate)) || !e.bossKey || !e.gameId || !e.tierId) errors.push("invalid placement");
    const paths = map.paths.filter(p => p.coordinates.some(c => coordinateKey(c) === coordinateKey(e.coordinate))).map(p => p.index);
    if (JSON.stringify(paths) !== JSON.stringify(e.pathIndices)) errors.push("placement path mismatch");
  }
  return errors;
}
export function hierarchyLabel(q: QuestSummary) {
  return `${q.actIndex}.${q.chapterIndex}.${q.questIndex}`;
}
export function gameText(text: string | null | undefined) {
  return (text ?? "")
    .replace(/\[k=[^\]]*\]|\[\/k\]|\[(?:[a-f\d]{6,8}|-)\]/gi, "")
    .replace(/\\r\\n|\\[nr]/g, "\n");
}
