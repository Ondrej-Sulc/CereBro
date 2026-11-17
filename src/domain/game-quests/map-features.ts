import { coordinateKey, type Coordinate, type QuestMap } from "./index";
import { z } from "zod";

export type QuestFeatureSource = { file: string; sha256: string; pointer: string; capturedAt: string };
export type QuestPathRewardRow = {
  sourceIndex: number; type: string; data: string; quantity: number;
  minQuantity?: number; maxQuantity?: number; id?: string; displayName?: string;
};
export type QuestGateDefinition = {
  barrierId: string;
  kind: "class" | "champion" | "rarity" | "class-and-rarity" | "tags" | "resource" | "switch" | "unknown";
  label: string; requirements: string[]; resolved: boolean;
  constraints?: { nativeType: string; champions: string[]; class?: string; rarity?: string; count: number; countOperator: string;
    championLogic?: "any"; tags?: string[]; tagLogic?: "any-group-all-terms"; costs?: QuestPathRewardRow[] };
  source?: QuestFeatureSource;
};

const coordinate = z.tuple([z.number().int(), z.number().int()]);
const source = z.object({ file: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/), pointer: z.string().min(1), capturedAt: z.string().min(1) }).strict();
const reward = z.object({ sourceIndex: z.number().int().nonnegative(), type: z.string().min(1), data: z.string().min(1), quantity: z.number().nonnegative(),
  minQuantity: z.number().nonnegative().optional(), maxQuantity: z.number().nonnegative().optional(), id: z.string().optional(), displayName: z.string().optional() }).strict();
const gateDefinition = z.object({ barrierId: z.string().min(1), kind: z.enum(["class","champion","rarity","class-and-rarity","tags","resource","switch","unknown"]),
  label: z.string().min(1), requirements: z.array(z.string()), resolved: z.boolean(), source: source.optional(),
  constraints: z.object({ nativeType: z.string(), champions: z.array(z.string()), class: z.string().optional(), rarity: z.string().optional(), count: z.number(), countOperator: z.string(),
    championLogic: z.literal("any").optional(), tags: z.array(z.string()).optional(), tagLogic: z.literal("any-group-all-terms").optional(), costs: z.array(reward).optional() }).strict().optional() }).strict();
const layerSchema = z.object({ questId: z.string(), mapId: z.string(), sourceHash: z.string(), publicMapSha256: z.string().regex(/^[a-f0-9]{64}$/),
  gates: z.array(gateDefinition.extend({ id: z.string(), coordinate, pathIndices: z.array(z.number().int()) }).strict()),
  unplacedGateDefinitions: z.array(gateDefinition).optional(),
  pathRewards: z.array(z.object({ id: z.string(), coordinate, pathIndices: z.array(z.number().int()), rewards: z.array(reward), source }).strict()),
  coverage: z.object({ gates: z.enum(["complete","partial","uncaptured","none"]), pathRewards: z.enum(["captured","uncaptured"]), unresolvedGateCount: z.number().int().nonnegative() }).strict(),
}).strict();
export type QuestGate = QuestGateDefinition & { id: string; coordinate: Coordinate; pathIndices: number[] };
export type QuestPathReward = {
  id: string; coordinate: Coordinate; pathIndices: number[]; rewards: QuestPathRewardRow[]; source: QuestFeatureSource;
};
export type QuestMapFeatureLayer = {
  questId: string; mapId: string; sourceHash: string; publicMapSha256: string;
  gates: QuestGate[]; pathRewards: QuestPathReward[];
  unplacedGateDefinitions?: QuestGateDefinition[];
  coverage: { gates: "complete" | "partial" | "uncaptured" | "none"; pathRewards: "captured" | "uncaptured"; unresolvedGateCount: number };
};

/** Join public definitions without changing placements or inferring eligibility/collection. */
export function applyQuestMapFeatures(map: QuestMap, layer: QuestMapFeatureLayer): QuestMap {
  layerSchema.parse(layer);
  if (layer.questId !== map.questId || layer.mapId !== map.mapId || layer.sourceHash !== map.sourceHash) throw new Error("Quest map feature source mismatch");
  const tiles = new Map(map.tiles.map(tile => [coordinateKey(tile.coordinate), tile]));
  const ids = new Set<string>();
  const checkPlacement = (row: QuestGate | QuestPathReward) => {
    if (!row.id || ids.has(row.id) || !tiles.has(coordinateKey(row.coordinate))) throw new Error("Invalid quest feature placement");
    ids.add(row.id);
    const paths = map.paths.filter(path => path.coordinates.some(c => coordinateKey(c) === coordinateKey(row.coordinate))).map(path => path.index);
    if (JSON.stringify(paths) !== JSON.stringify(row.pathIndices)) throw new Error("Quest feature route mismatch");
  };
  for (const gate of layer.gates) {
    checkPlacement(gate);
    if (tiles.get(coordinateKey(gate.coordinate))?.barrier !== gate.barrierId || !gate.label || !gate.requirements.length && gate.resolved) throw new Error("Invalid quest gate binding");
  }
  if (layer.gates.length !== map.tiles.filter(tile => tile.barrier).length) throw new Error("Quest gate placement coverage mismatch");
  for (const pickup of layer.pathRewards) {
    checkPlacement(pickup);
    if (!pickup.rewards.length) throw new Error("Empty quest path reward");
    for (const reward of pickup.rewards) {
      if (!reward.type || !reward.data || !Number.isInteger(reward.sourceIndex) || reward.sourceIndex < 0 || !Number.isFinite(reward.quantity) || reward.quantity < 0) throw new Error("Invalid quest path reward");
      if ((reward.minQuantity !== undefined && (!Number.isFinite(reward.minQuantity) || reward.minQuantity < 0))
        || (reward.maxQuantity !== undefined && (!Number.isFinite(reward.maxQuantity) || reward.maxQuantity < 0))
        || (reward.minQuantity !== undefined && reward.maxQuantity !== undefined && reward.minQuantity > reward.maxQuantity)) throw new Error("Invalid quest path reward range");
    }
  }
  if (layer.coverage.unresolvedGateCount !== layer.gates.filter(gate => !gate.resolved).length) throw new Error("Quest gate coverage differs");
  return { ...map, features: layer };
}
