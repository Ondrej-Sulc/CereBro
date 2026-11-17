import raw from "./map-features.json";
import { applyQuestMapFeatures, type QuestMapFeatureLayer } from "../../domain/game-quests/map-features";
import type { QuestMap } from "../../domain/game-quests";

const data = raw as unknown as { version: number; maps: Record<string, QuestMapFeatureLayer> };
if (data.version !== 1) throw new Error("Unsupported quest map features");
export function withQuestMapFeatures(map: QuestMap): QuestMap {
  const layer = data.maps[map.questId];
  return layer ? applyQuestMapFeatures(map, layer) : map;
}
