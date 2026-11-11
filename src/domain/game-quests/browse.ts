import type { QuestSummary } from "./index";

export function storyActs(quests: QuestSummary[]) {
  const acts = new Map<string, { id: string; label: string; index: number; quests: QuestSummary[] }>();
  for (const q of quests.filter(q => q.category === "Story")) for (const h of q.hierarchy) {
    const act = acts.get(h.actId) ?? { id: h.actId, label: h.actName && h.actName !== "-" ? h.actName : `Act ${q.actIndex}`, index: q.actIndex, quests: [] };
    if (!act.quests.some(row => row.id === q.id)) act.quests.push(q);
    acts.set(h.actId, act);
  }
  return [...acts.values()].sort((a, b) => a.index - b.index);
}
export function storyChapters(quests: QuestSummary[], actId: string) {
  const chapters = new Map<string, { id: string; label: string; index: number; quests: QuestSummary[] }>();
  for (const q of quests) for (const h of q.hierarchy.filter(h => h.actId === actId)) {
    const chapter = chapters.get(h.chapterId) ?? { id: h.chapterId, label: h.chapterName, index: q.chapterIndex, quests: [] };
    if (!chapter.quests.some(row => row.id === q.id)) chapter.quests.push(q);
    chapters.set(h.chapterId, chapter);
  }
  return [...chapters.values()].sort((a, b) => a.index - b.index);
}
export function questDifficulty(q: QuestSummary) {
  if (q.difficulty) return q.difficulty;
  if (q.minProgressionRank !== null) return `Progression rank ${q.minProgressionRank}${q.maxProgressionRank !== q.minProgressionRank ? `–${q.maxProgressionRank}` : ""}`;
  return "";
}
/** Group display rows only. Every source variant keeps its own link and coverage. */
export function groupQuestRows(quests: QuestSummary[]) {
  const groups = new Map<string, QuestSummary[]>();
  for (const q of quests) {
    const key = JSON.stringify([q.category, q.name, q.actIndex, q.chapterIndex, q.questIndex, q.hierarchy.map(h => [h.actId, h.chapterId])]);
    groups.set(key, [...(groups.get(key) ?? []), q]);
  }
  return [...groups.values()];
}
