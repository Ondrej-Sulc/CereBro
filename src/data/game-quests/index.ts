// Server reader. Client components import domain types only; maps are loaded individually.
import catalog from "./catalog.json";
import progressedCatalog from "./progressed-catalog.json";
import encounters from "./encounters.json";
import { mapLoaders } from "./map-loaders";
import { permanentMapLoaders } from "./permanent-map-loaders";
import { progressedMapLoaders } from "./progressed-map-loaders.js";
import { act10MapLoaders } from "./act10-map-loaders.js";
import { permanentData } from "./permanent";
import { withApplicationIcons } from "./application-icons";
import type { QuestSummary, QuestMap, EncounterOccurrence } from "../../domain/game-quests";

const publicIds = new Set(permanentData.publicQuestIds);
const combinedCatalog = [...catalog, ...progressedCatalog] as QuestSummary[];
if (new Set(combinedCatalog.map(q => q.id)).size !== combinedCatalog.length) throw new Error("Duplicate quest identity");
export const questCatalog: QuestSummary[] = combinedCatalog.filter(q => publicIds.has(q.id)).map(q => {
  const added = permanentData.maps[q.id];
  const section = permanentData.publicSections[q.id];
  return added && added.catalogSourceHash === q.sourceHash && added.mapId === q.mapId
    ? { ...q, section, coverage: "full-map", walkableNodes: added.walkableNodes, authoredPaths: added.authoredPaths, placedEncounters: added.placedEncounters, mapSourceHash: added.sourceHash }
    : { ...q, section };
});
export function isArchivedQuest(id: string) { return catalog.some(q => q.id === id) && !publicIds.has(id); }
export function findQuest(id: string) { return questCatalog.find(q => q.id === id); }
export function searchQuests({ query = "", category = "", coverage = "", difficulty = "", act = "", chapter = "" } = {}) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return questCatalog.filter(q => (!category || q.section === category) && (!coverage || q.coverage === coverage)
    && ((!act && !chapter) || q.hierarchy.some(h => (!act || h.actId === act) && (!chapter || h.chapterId === chapter)))
    && (!difficulty || q.difficultyId === difficulty) && terms.every(term =>
      [q.id, q.name, q.containerSetName, `${q.actIndex}.${q.chapterIndex}.${q.questIndex}`, ...q.hierarchy.flatMap(h => [h.actId, h.actName, h.chapterName])].join(" ").toLocaleLowerCase().includes(term)));
}
export async function loadQuestMap(id: string): Promise<QuestMap | undefined> {
  const quest = findQuest(id);
  if (!quest) return undefined;
  if (Object.hasOwn(act10MapLoaders,id)) {
    const map = (await act10MapLoaders[id]()).default as unknown as QuestMap;
    if (map.questId !== id || map.mapId !== quest.mapId || map.sourceHash !== quest.mapSourceHash) throw new Error("Act 10 source mismatch");
    return withApplicationIcons(map);
  }
  if (Object.hasOwn(progressedMapLoaders,id)) {
    const map = (await progressedMapLoaders[id as keyof typeof progressedMapLoaders]()).default as unknown as QuestMap;
    if (map.questId !== id || map.mapId !== quest.mapId || map.sourceHash !== quest.mapSourceHash) throw new Error("Quest map source mismatch");
    return withApplicationIcons(map);
  }
  if (Object.hasOwn(permanentMapLoaders,id)) return withApplicationIcons((await permanentMapLoaders[id as keyof typeof permanentMapLoaders]()).default as unknown as QuestMap);
  if (!Object.hasOwn(mapLoaders, id)) return undefined;
  return withApplicationIcons((await mapLoaders[id as keyof typeof mapLoaders]()).default as unknown as QuestMap);
}
export function findChampionEncounters(gameId: string): EncounterOccurrence[] {
  return [...encounters as EncounterOccurrence[], ...permanentData.encounters].filter(e => e.gameId === gameId && publicIds.has(e.questId));
}
