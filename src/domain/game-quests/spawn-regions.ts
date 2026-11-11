import { coordinateKey, type Coordinate, type QuestMap } from "./index";

/** A representative display marker and its possible source tiles, not a fixed fight. */
export type QuestSpawnRegion = {
  id: string;
  anchor: Coordinate;
  coordinates: Coordinate[];
  pathIndices: number[];
  defender: {
    tierId: string; gameId: string; name: string; rarity: number; imageUrl: string;
    rank: number; level: number; signature: number; ascensionTier: number;
  };
  definitionCandidateCount: number;
};

export type QuestSpawnRegionLayer = {
  questId: string;
  regions: QuestSpawnRegion[];
  unmappedDefinitionCount: number;
  provenance: { geometry: "game"; defenderBindings: "archived-reference" };
};

export type QuestSpawnRegionRecord = {
  version: 1; questId: string; mapId: string; mapSourceHash: string;
  regions: Omit<QuestSpawnRegion, "pathIndices">[];
  unmappedDefinitionCount: number;
  provenance: QuestSpawnRegionLayer["provenance"];
};

/** Exact source/version join. Approximate markers never enter the native encounter set. */
export function projectQuestSpawnRegions(map: QuestMap, record: QuestSpawnRegionRecord): QuestSpawnRegionLayer | undefined {
  if (!record || record.version !== 1 || record.questId !== map.questId || record.mapId !== map.mapId ||
      record.mapSourceHash !== map.sourceHash || record.provenance?.geometry !== "game" ||
      record.provenance?.defenderBindings !== "archived-reference" ||
      !Number.isInteger(record.unmappedDefinitionCount) || record.unmappedDefinitionCount < 0 ||
      !Array.isArray(record.regions) || !record.regions.length || record.regions.length > 128) return undefined;
  const visible = new Set(map.tiles.filter(tile => !tile.hidden).map(tile => coordinateKey(tile.coordinate)));
  const fixed = new Set(map.encounters.map(encounter => coordinateKey(encounter.coordinate)));
  const ids = new Set<string>(), claimed = new Set<string>();
  const regions: QuestSpawnRegion[] = [];
  const validCoordinate = (value: Coordinate) => Array.isArray(value) && value.length === 2 &&
    value.every(v => Number.isInteger(v) && v >= 0 && v < map.gridDimension);
  for (const region of record.regions) {
    if (!region || typeof region.id !== "string" || !region.id.startsWith(`${map.questId}:`) || ids.has(region.id) ||
        !validCoordinate(region.anchor) || !Array.isArray(region.coordinates) || !region.coordinates.length ||
        region.coordinates.length > map.tiles.length || !Number.isInteger(region.definitionCandidateCount) || region.definitionCandidateCount < 1) return undefined;
    ids.add(region.id);
    const keys = new Set<string>();
    for (const coordinate of region.coordinates) {
      if (!validCoordinate(coordinate)) return undefined;
      const key = coordinateKey(coordinate);
      if (!visible.has(key) || keys.has(key) || claimed.has(key)) return undefined;
      keys.add(key); claimed.add(key);
    }
    const anchorKey = coordinateKey(region.anchor);
    if (!keys.has(anchorKey) || (fixed.has(anchorKey) && [...keys].some(key => !fixed.has(key)))) return undefined;
    const defender = region.defender;
    if (!defender || ![defender.tierId, defender.gameId].every(id => typeof id === "string" && /^[a-zA-Z][a-zA-Z0-9_-]{0,159}$/.test(id)) ||
        typeof defender.name !== "string" || !defender.name || defender.name.length > 512 ||
        typeof defender.imageUrl !== "string" || !/^\/game-quests\/unplaced-art\/[a-f0-9]{64}\.webp$/.test(defender.imageUrl) ||
        !Number.isInteger(defender.rarity) || defender.rarity < 1 || defender.rarity > 12 ||
        ![defender.rank, defender.level].every(n => Number.isSafeInteger(n) && n > 0) ||
        ![defender.signature, defender.ascensionTier].every(n => Number.isSafeInteger(n) && n >= 0)) return undefined;
    const pathIndices = [...new Set(map.paths.filter(path => path.coordinates.some(c => keys.has(coordinateKey(c)))).map(path => path.index))].sort((a, b) => a - b);
    regions.push({ id: region.id, anchor: [...region.anchor], coordinates: region.coordinates.map(c => [...c]),
      definitionCandidateCount: region.definitionCandidateCount, defender: {
        tierId: defender.tierId, gameId: defender.gameId, name: defender.name, rarity: defender.rarity,
        imageUrl: defender.imageUrl, rank: defender.rank, level: defender.level,
        signature: defender.signature, ascensionTier: defender.ascensionTier,
      }, pathIndices });
  }
  return { questId: map.questId, regions, unmappedDefinitionCount: record.unmappedDefinitionCount,
    provenance: { geometry: "game", defenderBindings: "archived-reference" } };
}
