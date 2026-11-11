import raw from "./checked-defender-previews.json";
import type { QuestSummary } from "../../domain/game-quests";

type BoundQuest = Pick<QuestSummary, "id" | "mapId" | "containerSetId" | "summarySetId" | "mapSourceHash">;

/** A fresh preview result applies only to the exact map that was compared. */
export function getCheckedDefenderPreview(quest: BoundQuest, definitionRowCount: number) {
  const record = raw.records.find(row => row.binding.questId === quest.id);
  if (!record || record.definitionRowCount !== definitionRowCount || !quest.mapSourceHash ||
      record.binding.mapId !== quest.mapId || record.binding.containerSetId !== quest.containerSetId ||
      record.binding.summarySetId !== quest.summarySetId || record.binding.mapSourceHash !== quest.mapSourceHash) return undefined;
  return { observedAt: record.observedAt, notice: record.notice };
}
