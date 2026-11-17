import { coordinateKey, type Coordinate, type QuestMap } from "@cerebro/core/domain/game-quests";
import { projectRewardRow, type QuestRewardView, type QuestPortrait } from "./presentation";
import rawPresentation from "@cerebro/core/data/game-quests/path-reward-presentation.json";
import { nativeRewardName, type NativeRewardPresentation } from "@cerebro/core/data/game-reward-presentation";

const presentation = rawPresentation.rewards as Record<string, NativeRewardPresentation & { imageUrl?: string; description?: string }>;

export type QuestGateView = { id: string; coordinate: Coordinate; pathIndices: number[]; label: string; kind: string; requirements: string[]; resolved: boolean };
export type QuestPathRewardView = { id: string; coordinate: Coordinate; pathIndices: number[]; rewards: QuestRewardView[] };
export type QuestMapFeatureLocation = { coordinate: Coordinate; gates: QuestGateView[]; pickups: QuestPathRewardView[] };

export function projectQuestMapFeatures(map: QuestMap, portraits: Record<string, QuestPortrait> = {}): QuestMapFeatureLocation[] {
  const locations = new Map<string, QuestMapFeatureLocation>();
  const at = (coordinate: Coordinate) => {
    const key = coordinateKey(coordinate);
    if (!locations.has(key)) locations.set(key, { coordinate, gates: [], pickups: [] });
    return locations.get(key)!;
  };
  for (const gate of map.features?.gates ?? []) at(gate.coordinate).gates.push({ id: gate.id, coordinate: gate.coordinate, pathIndices: gate.pathIndices,
    kind: gate.kind, label: gate.label, requirements: gate.requirements, resolved: gate.resolved });
  for (const pickup of map.features?.pathRewards ?? []) at(pickup.coordinate).pickups.push({ id: pickup.id, coordinate: pickup.coordinate, pathIndices: pickup.pathIndices,
    rewards: pickup.rewards.map(reward => {
      const view = projectRewardRow(reward, "pathRewards", `${map.questId}:path:${pickup.id}:${reward.sourceIndex}`, portraits);
      const supplement = presentation[JSON.stringify([reward.type,reward.data])];
      return supplement ? { ...view, name: nativeRewardName(supplement,reward.type), imageUrl: supplement.imageUrl ?? view.imageUrl,
        itemRarity: supplement.rarity ?? view.itemRarity, signaturePoints: supplement.signaturePoints ?? view.signaturePoints,
        description: supplement.description } : view;
    }) });
  return [...locations.values()];
}
