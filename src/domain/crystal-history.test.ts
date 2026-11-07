import { describe, expect, it } from "vitest"
import { createCrystalHistory } from "./crystal-history"

const stamp = (day: number) => `2026-11-${String(day).padStart(2, "0")}T12:00:00+00:00`
const observation = (day: number, definitionCount: number) => ({ observedAt: stamp(day), gachaSha256: "a".repeat(64),
  inputSha256: "b".repeat(64), projectionSha256: "c".repeat(64), definitionCount, inputFormat: "all-rewards-v1" })
const fixture = () => ({ version: 1, projection: "champion-catalog-common-v1", baselineSourceIds: ["old", "removed"],
  observations: [observation(3, 2), observation(5, 2), observation(6, 3)], transitions: [
    { from: 0, to: 1, addedSourceIds: ["new"], removedSourceIds: ["removed"],
      changed: [{ sourceId: "old", fields: ["directChampionRewards"], previousProjectionSha256: "d".repeat(64), projectionSha256: "e".repeat(64) }] },
    { from: 1, to: 2, addedSourceIds: ["removed"], removedSourceIds: [], changed: [] },
  ] })

describe("crystal recorded history", () => {
  it("preserves first observation when a definition changes, disappears, or returns", () => {
    const history = createCrystalHistory(fixture())
    expect(history.getCrystalHistory(["old"])?.records).toEqual([{ sourceId: "old", firstRecordedAt: stamp(3),
      lastRecordedAt: stamp(6), lastChangedRecordedAt: stamp(5), presentInLatest: true, changedFields: ["directChampionRewards"] }])
    expect(history.getCrystalHistory(["new"])?.firstRecordedAt).toBe(stamp(5))
    expect(history.getCrystalHistory(["removed"])?.firstRecordedAt).toBe(stamp(3))
    expect(history.getCrystalHistory(["removed"])?.lastChangedRecordedAt).toBeNull()
    const removed = fixture()
    removed.transitions.pop(); removed.observations.pop()
    expect(createCrystalHistory(removed).getCrystalHistory(["removed"])?.records[0]).toMatchObject({
      lastRecordedAt: stamp(3), presentInLatest: false,
    })
  })

  it("aggregates known aliases without treating unknown IDs as observations", () => {
    const history = createCrystalHistory(fixture())
    expect(history.getCrystalHistory([])).toBeNull()
    expect(history.getCrystalHistory(["unknown"])).toBeNull()
    expect(history.getCrystalHistory(["new", "unknown", "old", "new"])).toEqual({ firstRecordedAt: stamp(3),
      lastRecordedAt: stamp(6), lastChangedRecordedAt: stamp(5), presentInLatest: true, records: [
        { sourceId: "new", firstRecordedAt: stamp(5), lastRecordedAt: stamp(6), lastChangedRecordedAt: null, presentInLatest: true, changedFields: [] },
        { sourceId: "old", firstRecordedAt: stamp(3), lastRecordedAt: stamp(6), lastChangedRecordedAt: stamp(5), presentInLatest: true, changedFields: ["directChampionRewards"] },
      ] })
    const result = history.getCrystalHistory(["old"])!
    result.records[0].changedFields.push("name")
    expect(history.getCrystalHistory(["old"])?.records[0].changedFields).toEqual(["directChampionRewards"])
  })

  it("requires timezone-aware provenance, sequential observations and exact coverage", () => {
    const missingTimezone = fixture(); missingTimezone.observations[0].observedAt = "2026-11-03T12:00:00"
    expect(() => createCrystalHistory(missingTimezone)).toThrow()
    const backwards = fixture(); backwards.observations[1].observedAt = stamp(2)
    expect(() => createCrystalHistory(backwards)).toThrow(/later/)
    const badHash = fixture(); badHash.observations[0].gachaSha256 = "not-a-hash"
    expect(() => createCrystalHistory(badHash)).toThrow()
    const coverage = fixture(); coverage.observations[1].definitionCount = 3
    expect(() => createCrystalHistory(coverage)).toThrow(/coverage/)
    const chain = fixture(); chain.transitions[0].to = 2
    expect(() => createCrystalHistory(chain)).toThrow(/sequential/)
  })

  it("rejects duplicate identities, unsupported changes and inconsistent transition references", () => {
    const duplicate = fixture(); duplicate.baselineSourceIds.push("old")
    expect(() => createCrystalHistory(duplicate)).toThrow(/Duplicate/)
    const overlap = fixture(); overlap.transitions[0].removedSourceIds.push("new")
    expect(() => createCrystalHistory(overlap)).toThrow(/overlap/)
    const unknown = fixture(); unknown.transitions[0].changed[0].sourceId = "missing"
    expect(() => createCrystalHistory(unknown)).toThrow(/Unknown/)
    const sameHash = fixture(); sameHash.transitions[0].changed[0].projectionSha256 = "d".repeat(64)
    expect(() => createCrystalHistory(sameHash)).toThrow(/differ/)
    const unsupported = fixture(); unsupported.transitions[0].changed[0].fields = ["dropRate"]
    expect(() => createCrystalHistory(unsupported)).toThrow()
  })
})
