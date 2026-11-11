import type { ModifierQuestLabel } from "@cerebro/core/domain/node-modifiers/uses"

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value)
const nativeName = (value: unknown) => typeof value === "string" && value.trim() && value.trim() !== "-" ? value.trim() : null

/** Display only memberships retained by the captured source projection. */
export function questHierarchy(quest: ModifierQuestLabel) {
  const memberships = Array.isArray(quest.labelEvidence.memberships) ? quest.labelEvidence.memberships.filter(record) : []
  const unique = (key: string) => {
    const values = [...new Set(memberships.map(m => m[key]))]
    return values.length === 1 ? values[0] : undefined
  }
  const category = quest.category === "StoryEvent" ? "Event quests" : quest.category === "Unknown" ? "Quest" : quest.category
  const act = unique("act"), chapter = unique("chapter"), number = unique("quest")
  const actName = nativeName(unique("actName"))
  if (quest.category === "Story" && quest.storyNumber && typeof act === "number" && typeof chapter === "number") {
    const numberedName = actName?.match(/^act\s*(\d+)$/i)
    const title = numberedName && Number(numberedName[1]) === act ? null : actName
    return { path: ["Story", `Act ${act}${title ? ` · ${title}` : ""}`, `Chapter ${chapter}`],
      chapterName: quest.chapter, number: quest.storyNumber, title: quest.name }
  }
  return { path: [category, quest.collection || actName].filter((value): value is string => !!value),
    chapterName: quest.chapter, number: typeof number === "number" && number > 0 ? `Quest ${number}` : null, title: quest.name }
}
