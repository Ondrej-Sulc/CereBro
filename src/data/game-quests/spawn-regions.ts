/** Separate display layer. Never appends representative markers to native encounters. */
import type { QuestMap } from "../../domain/game-quests";
import { projectQuestSpawnRegions, type QuestSpawnRegionLayer, type QuestSpawnRegionRecord } from "../../domain/game-quests/spawn-regions";
import index from "./spawn-regions/index.json";

export async function loadQuestSpawnRegions(map: QuestMap): Promise<QuestSpawnRegionLayer | undefined> {
  const id = map.questId;
  if (id !== "realm3" && id !== "eq_labyrinth") return undefined;
  const binding = index.quests[id];
  if (binding.mapId !== map.mapId || binding.mapSourceHash !== map.sourceHash) return undefined;
  const record = (id === "realm3" ? (await import("./spawn-regions/realm3.json")).default
    : (await import("./spawn-regions/eq_labyrinth.json")).default) as unknown as QuestSpawnRegionRecord;
  if (record.regions.length !== binding.regionCount || record.unmappedDefinitionCount !== binding.unmappedDefinitionCount) return undefined;
  return projectQuestSpawnRegions(map, record);
}
