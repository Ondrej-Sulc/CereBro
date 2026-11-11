/** Separate server reader. Never appends preview rows to map encounters. */
import rawIndex from "./unplaced-defenders/index.json";
import { unplacedDefenderLoaders } from "./unplaced-defenders/loaders.js";
import { getCheckedDefenderPreview } from "./checked-defender-previews";
import type { QuestSummary } from "../../domain/game-quests";
import {
  projectUnplacedDefenders,
  type UnplacedDefenderIdentity,
  type UnplacedDefenderIndex,
  type UnplacedQuestDefenders,
} from "../../domain/game-quests/unplaced-defenders";

const index = rawIndex as unknown as UnplacedDefenderIndex;
type QuestBinding = Pick<QuestSummary, "id" | "mapId" | "containerSetId" | "summarySetId" | "sourceHash" | "mapSourceHash">;

export async function loadUnplacedQuestDefenders(quest: QuestBinding): Promise<UnplacedQuestDefenders | undefined> {
  const binding = index.quests[quest.id];
  if (!binding || binding.questId !== quest.id || binding.mapId !== quest.mapId ||
      binding.containerSetId !== quest.containerSetId || binding.summarySetId !== quest.summarySetId || binding.catalogSourceHash !== quest.sourceHash ||
      (quest.mapSourceHash !== undefined && quest.mapSourceHash !== binding.definitionSourceHash) ||
      !Object.hasOwn(unplacedDefenderLoaders, quest.id)) return undefined;
  const record = (await unplacedDefenderLoaders[quest.id]()).default;
  if (record.questId !== binding.questId || record.mapId !== binding.mapId ||
      record.containerSetId !== binding.containerSetId || record.summarySetId !== binding.summarySetId || record.catalogSourceHash !== binding.catalogSourceHash ||
      record.definitionSourceHash !== binding.definitionSourceHash || record.rows.length !== binding.rowCount) return undefined;
  const identities = (await import("./unplaced-defenders/identities.json")).default as Record<string, UnplacedDefenderIdentity>;
  const projected = projectUnplacedDefenders(record, identities);
  const checkedPreview = getCheckedDefenderPreview(quest, record.rows.length);
  return checkedPreview ? { ...projected, checkedPreview } : projected;
}

/** Includes exact primary and candidate Character IDs; no playable aliases. */
export function findUnplacedDefenderReferences(gameId: string): { questId: string; sourceIndices: number[] }[] {
  if (!Object.hasOwn(index.byGameId, gameId)) return [];
  return index.byGameId[gameId].map(reference => ({ ...reference, sourceIndices: [...reference.sourceIndices] }));
}
