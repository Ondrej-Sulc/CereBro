import { z } from "zod";
import { coordinateKey, type Coordinate, type QuestMap } from "./index";
import type { QuestFeatureSource } from "./map-features";

export type QuestChampionRequirement = { groups: string[][]; label: string; resolved: boolean };
export type QuestPreparation = {
  energyPerTile?: number; recommendedTeamRating?: number; minTeamSize?: number; maxTeamSize?: number;
  championRequirement?: QuestChampionRequirement; source: QuestFeatureSource;
};
export type QuestChest = {
  id: string; coordinate: Coordinate; pathIndices: number[]; chestId: string; asset: string | null; source: QuestFeatureSource;
};
export type QuestDetailsLayer = {
  questId: string; mapId: string; sourceHash: string; publicMapSha256: string;
  preparation: QuestPreparation; chests: QuestChest[]; chestCoverage: "captured" | "uncaptured";
};

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const source = z.object({ file: z.string().min(1).refine(value => !/^(?:[a-z]:|[\\/])|(?:^|[\\/])\.\.(?:[\\/]|$)/i.test(value), "Source file must be relative"),
  sha256: hash, pointer: z.string().startsWith("/"), capturedAt: z.string().min(1) }).strict();
export const questDetailsLayerSchema = z.object({ questId: z.string().min(1), mapId: z.string().min(1), sourceHash: hash, publicMapSha256: hash,
  preparation: z.object({ energyPerTile: z.number().int().nonnegative().optional(), recommendedTeamRating: z.number().int().positive().optional(),
    minTeamSize: z.number().int().positive().optional(), maxTeamSize: z.number().int().positive().optional(),
    championRequirement: z.object({ groups: z.array(z.array(z.string().min(1)).min(1)).min(1), label: z.string().min(1), resolved: z.boolean() }).strict().optional(), source }).strict(),
  chests: z.array(z.object({ id: z.string().min(1), coordinate: z.tuple([z.number().int(), z.number().int()]),
    pathIndices: z.array(z.number().int().nonnegative()), chestId: z.string().min(1), asset: z.string().min(1).nullable(), source }).strict()),
  chestCoverage: z.enum(["captured", "uncaptured"]),
}).strict();

/** Static preparation and chest identities only; no eligibility or chest contents. */
export function applyQuestDetails(map: QuestMap, layer: QuestDetailsLayer): QuestMap {
  questDetailsLayerSchema.parse(layer);
  if (layer.questId !== map.questId || layer.mapId !== map.mapId || layer.sourceHash !== map.sourceHash) throw new Error("Quest details source mismatch");
  const matchesSource = (value: QuestFeatureSource) => value.sha256 === map.sourceHash && value.file === map.sourceFile && value.capturedAt === map.capturedAt;
  if (!matchesSource(layer.preparation.source)) throw new Error("Quest preparation source mismatch");
  const { minTeamSize, maxTeamSize } = layer.preparation;
  if (minTeamSize !== undefined && maxTeamSize !== undefined && minTeamSize > maxTeamSize) throw new Error("Invalid quest team size range");
  const tiles = new Set(map.tiles.map(tile => coordinateKey(tile.coordinate)));
  if (tiles.size !== map.tiles.length) throw new Error("Duplicate quest tile coordinate");
  const ids = new Set<string>(), positions = new Set<string>();
  for (const chest of layer.chests) {
    const key = coordinateKey(chest.coordinate);
    if (ids.has(chest.id) || positions.has(key) || !tiles.has(key)) throw new Error("Invalid quest chest placement");
    ids.add(chest.id); positions.add(key);
    if (!matchesSource(chest.source)) throw new Error("Quest chest source mismatch");
    const paths = map.paths.filter(path => path.coordinates.some(c => coordinateKey(c) === key)).map(path => path.index);
    if (JSON.stringify(paths) !== JSON.stringify(chest.pathIndices)) throw new Error("Quest chest route mismatch");
  }
  return { ...map, details: layer };
}
