import { describe, expect, it } from "vitest"
import { createCrystalOddsCatalog } from "./crystal-odds"
import recordedSnapshot from "../data/game-crystal-odds/catalog.json"

const hash = "a".repeat(64)
function fixture() {
  return {
    version: 1,
    source: { gachaSha256: hash, endpointHost: "example.invalid", endpointPath: "/gacha/getOdds",
      updatedAt: "2026-11-05T15:00:00+00:00", sourceCrystalCount: 2, attemptedSourceCount: 1,
      captureMethod: "authenticated-read-only-game-api" },
    counts: { captured: 1, unattempted: 1 },
    openings: {
      exact: { status: "captured", attempts: [{ observedAt: "2026-11-05T15:00:00+00:00", status: "captured",
        httpStatus: 200, responseBytes: 123, responseSha256: hash }], observedAt: "2026-11-05T15:00:00+00:00",
        serverTimestamp: 1793890800, reportedName: null, responseSha256: hash,
        individualChampionOddsInferred: false, exactUnderlyingSamplingAlgorithmKnown: false,
        groups: ["Primary", "Bonus"].map((name, sourceIndex) => ({ sourceIndex, name, isFeatured: false,
          sumValidation: "not-inferred-across-source-groups", rows: [{ sourceIndex: 0, percentValue: "100",
            rateBasis: "server-disclosed-category", label: name, rewardType: "inv", rewardData: "fixture" }] })) },
      alias: { status: "unattempted", attempts: [] },
    },
  }
}

describe("exact-source crystal odds", () => {
  it("prevents a consumer from changing the shared recorded disclosure", () => {
    const catalog = createCrystalOddsCatalog(fixture())
    const group = catalog.getCrystalOdds("exact")!.groups![0]
    expect(() => { group.rows[0].percentValue = "0" }).toThrow()
    expect(catalog.getCrystalOdds("exact")!.groups![0].rows[0].percentValue).toBe("100")
  })
  it("validates the published real snapshot and its complete source status index", () => {
    const catalog = createCrystalOddsCatalog(recordedSnapshot)
    const identities = Object.keys(recordedSnapshot.openings)
    expect(identities).toHaveLength(catalog.source.sourceCrystalCount)
    expect(identities.every(id => catalog.getCrystalOdds(id, catalog.source.gachaSha256) !== null)).toBe(true)
  })

  it("preserves independent groups and requires the matching source hash", () => {
    const catalog = createCrystalOddsCatalog(fixture())
    expect(catalog.getCrystalOdds("exact", hash)?.groups?.map(group => group.rows[0].percentValue)).toEqual(["100", "100"])
    expect(catalog.getCrystalOdds("exact", "b".repeat(64))).toBeNull()
    expect(catalog.getCrystalOdds("alias", hash)?.status).toBe("unattempted")
    expect(catalog.getCrystalOdds("missing", hash)).toBeNull()
  })

  it("rejects malformed percentages, unknown private fields and false coverage", () => {
    const invalidRate = fixture()
    invalidRate.openings.exact.groups[0].rows[0].percentValue = "101"
    expect(() => createCrystalOddsCatalog(invalidRate)).toThrow()
    expect(() => createCrystalOddsCatalog({ ...fixture(), sessionToken: "synthetic-private-field" })).toThrow()
    const invalidCount = fixture()
    invalidCount.source.attemptedSourceCount = 2
    expect(() => createCrystalOddsCatalog(invalidCount)).toThrow()
    const invalidStatus = fixture()
    invalidStatus.counts.captured = 2
    expect(() => createCrystalOddsCatalog(invalidStatus)).toThrow()
  })
})
