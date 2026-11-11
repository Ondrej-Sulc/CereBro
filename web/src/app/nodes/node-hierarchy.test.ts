import { describe, expect, it } from "vitest"
import { modifierUseProjection } from "@cerebro/core/data/game-node-modifiers/uses"
import { questHierarchy } from "./node-hierarchy"

describe("verified modifier location hierarchy", () => {
  it("uses authored Story membership and retains the native chapter name", () => {
    const quest = modifierUseProjection.quests.find(q => q.storyNumber === "4.4.6")!
    expect(questHierarchy(quest)).toEqual({ path: ["Story", "Act 4", "Chapter 4"], chapterName: "Devastation", number: "4.4.6", title: "Culmination" })
  })
  it("does not reconstruct missing hierarchy from map IDs or summary indices", () => {
    const quest = modifierUseProjection.quests.find(q => q.storyNumber === "4.4.6")!
    const result = questHierarchy({ ...quest, storyNumber: null, labelEvidence: { memberships: [], indices: { actIndex: 4 } } })
    expect(result.path).toEqual(["Story"])
    expect(result.number).toBeNull()
  })
  it("does not choose between conflicting memberships", () => {
    const quest = modifierUseProjection.quests.find(q => q.storyNumber === "4.4.6")!
    const result = questHierarchy({ ...quest, labelEvidence: { memberships: [{ act: 4, chapter: 4, quest: 6 }, { act: 5, chapter: 1, quest: 1 }] } })
    expect(result.path).toEqual(["Story"])
    expect(result.number).toBeNull()
  })
  it("avoids repeating an Act number while retaining meaningful native Act titles", () => {
    const quest = modifierUseProjection.quests.find(q => q.storyNumber === "4.4.6")!
    const withName = (actName: string) => ({ ...quest, storyNumber: "7.3.6", labelEvidence: { memberships: [{ act: 7, actName, chapter: 3, quest: 6 }] } })
    expect(questHierarchy(withName("ACT 7")).path).toEqual(["Story", "Act 7", "Chapter 3"])
    expect(questHierarchy(withName("Rebirth")).path).toEqual(["Story", "Act 7 · Rebirth", "Chapter 3"])
  })
})
