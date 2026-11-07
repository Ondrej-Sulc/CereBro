import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import snapshot from "./history.json"
import { crystalHistoryChangeScope, crystalHistoryObservations, getCrystalHistory } from "."

describe("retained crystal observations", () => {
  it("pins both normalized inputs and raw gacha identities without release dates", () => {
    const inputs = ["game-crystals/catalog.json", "game-crystal-openings/catalog.json"]
    for (const [index, file] of inputs.entries()) {
      const bytes = readFileSync(resolve(__dirname, "..", file))
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(crystalHistoryObservations[index].inputSha256)
      const source = JSON.parse(bytes.toString()) as { source: { observedAt: string; gachaSha256: string } }
      expect(crystalHistoryObservations[index]).toMatchObject({ observedAt: source.source.observedAt, gachaSha256: source.source.gachaSha256 })
    }
    expect(crystalHistoryChangeScope).toBe("champion-catalog-common-v1")
    expect(crystalHistoryObservations.map(value => value.definitionCount)).toEqual([2437, 2448])
    expect(snapshot.transitions[0].addedSourceIds).toHaveLength(11)
    expect(snapshot.transitions[0].removedSourceIds).toEqual([])
    expect(snapshot.transitions[0].changed).toHaveLength(12)
    expect(JSON.stringify(snapshot)).not.toMatch(/releasedAt|gameVersion|isAvailable/)
  })

  it("distinguishes first recorded additions from later changed existing definitions", () => {
    expect(getCrystalHistory(["nov2026_valiant_castellan_box"])).toMatchObject({ firstRecordedAt: "2026-11-05T14:05:24+00:00",
      lastRecordedAt: "2026-11-05T14:05:24+00:00", lastChangedRecordedAt: null, presentInLatest: true })
    expect(getCrystalHistory(["1star_crystal"])).toMatchObject({ firstRecordedAt: "2026-11-03T09:10:42+00:00", lastChangedRecordedAt: null })
    expect(getCrystalHistory(["6star_empire_of_doom_saga_crystal"])).toMatchObject({ firstRecordedAt: "2026-11-03T09:10:42+00:00",
      lastChangedRecordedAt: "2026-11-05T14:05:24+00:00", records: [{ changedFields: ["directChampionRewards"] }] })
    expect(getCrystalHistory(["not_a_source_crystal"])).toBeNull()
  })
})
