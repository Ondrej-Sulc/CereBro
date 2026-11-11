import { describe, expect, it } from "vitest"
import { verifiedExpandedDetail, type ExpandedModifierDetail, type ExpandedModifierIndex } from "./expansion"
import indexSource from "../../data/game-node-modifiers/v2/index.json"
import { loadExpandedModifier } from "../../data/game-node-modifiers/v2/detail-loaders.js"

const index: ExpandedModifierIndex = indexSource
describe("versioned native node expansion", () => {
  it("retains the original exact ID and guards catalog/version/source projection drift", async () => {
    const detail = (await loadExpandedModifier('pve_disarray'))!
    expect(verifiedExpandedDetail(index, 'pve_disarray', detail)).toBe(detail)
    expect(verifiedExpandedDetail(index, 'Disarray', detail)).toBeUndefined()
    expect(verifiedExpandedDetail(index, 'pve_disarray', { ...detail, catalogHash: 'old-source' })).toBeUndefined()
    expect(verifiedExpandedDetail(index, 'pve_disarray', { ...detail, definition: { ...detail.definition, versions: [{ ...detail.definition.versions[0], hash: 'old-version' }] } })).toBeUndefined()
    expect(await loadExpandedModifier('__proto__')).toBeUndefined()
  })
  it("records assignment evidence independently from source configuration and never fabricates active state", async () => {
    const summary = index.records.find(row => row.id === 'avx_hpatk_pct400')!
    const detail = await loadExpandedModifier(summary.id) as ExpandedModifierDetail
    expect(detail.projection.uses.length).toBeGreaterThan(5)
    expect(detail.projection.quests.some(q => q.storyNumber?.startsWith('5.'))).toBe(true)
    expect(index.stats.permanentLayouts).toBe(218)
    expect(index.stats.distinctBuffIds).toBe(1688)
    expect(index.stats.recordedTileAssignments).toBeGreaterThan(index.stats.sourceContexts)
  })
})
