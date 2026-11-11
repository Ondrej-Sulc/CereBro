import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { resolveNativeGameModifierIcon } from "@cerebro/core/domain/node-modifiers/native-game-icons"
import type { ExpandedModifierIndex } from "@cerebro/core/domain/node-modifiers/expansion"
vi.mock("server-only", () => ({}))
import { expandedNodeIndex } from "./expanded-node-modifiers"

describe("additive public game icon projection", () => {
  it("changes only 1089 icon presentation keys and preserves every frozen definition identity/value", () => {
    const original = JSON.parse(readFileSync(resolve('src/data/game-node-modifiers/v2/index.json'), 'utf8')) as ExpandedModifierIndex
    const before = new Map(original.records.map(row => [row.id, row]))
    const changed = expandedNodeIndex.records.filter(row => row.iconKey !== before.get(row.id)?.iconKey)
    expect(changed).toHaveLength(1089)
    expect(expandedNodeIndex.records).toHaveLength(1688)
    for (const row of expandedNodeIndex.records) {
      expect({ ...row, iconKey: before.get(row.id)?.iconKey }).toEqual(before.get(row.id))
      if (row.iconKey) expect(resolveNativeGameModifierIcon(row.iconKey)).toBeDefined()
    }
    expect(expandedNodeIndex.records.filter(row => !row.iconKey)).toHaveLength(3)
    expect(expandedNodeIndex.catalogHash).toBe(original.catalogHash)
  })
})
