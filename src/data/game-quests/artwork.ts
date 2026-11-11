import manifest from "./artwork.json";
import catalog from "./catalog.json";
import progressedCatalog from "./progressed-catalog.json";
import progressed from "./progressed-terrain.json";
import type { QuestSummary } from "../../domain/game-quests";
const combinedCatalog = [...catalog, ...progressedCatalog];

export function getQuestArtwork(questId: string) {
  const binding = progressed.quests[questId as keyof typeof progressed.quests] ?? manifest.quests[questId as keyof typeof manifest.quests];
  if (!binding || combinedCatalog.find(q=>q.id===questId)?.sourceHash !== binding.sourceHash) return null;
  const theme = manifest.themes[binding.theme as keyof typeof manifest.themes];
  if (!theme) return null;
  const texture = manifest.textures[theme.image as keyof typeof manifest.textures];
  return { ...texture, theme: binding.theme, sourceHash: binding.sourceHash, questId, textureName: theme.texture };
}
/** Editorial representative of this exact group, never an asserted act/event poster. */
export function getGroupArtwork(quests: QuestSummary[]) {
  for (const q of quests) { const art = getQuestArtwork(q.id); if (art) return art; }
  return null;
}
