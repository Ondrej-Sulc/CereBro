import { expect, it } from "vitest"
import { auditChampionAcquisitionCoverage } from "./coverage"

it("audits each star even when the same champion has crystal rewards at other stars", () => {
  const audit = auditChampionAcquisitionCoverage([{ name: "Vision", gameId: "vision", slug: "vision", obtainable: ["6", "7", "7"], stats: [{ rarity: 6 }, { rarity: 7 }] }])
  expect(audit.counts.selectableVariants).toBe(2)
  expect(audit.variants).toEqual([expect.objectContaining({ gameId: "vision", rarity: 7, otherCrystalStars: expect.arrayContaining([6]) })])
})

it("excludes unlisted stat templates and flags metadata-only stars for a separate visibility review", () => {
  const audit = auditChampionAcquisitionCoverage([{ name: "Vision", gameId: "vision", slug: null, obtainable: ["6", "7", "invalid", "8"], stats: [{ rarity: 6 }, { rarity: 5 }, { rarity: null }] }])
  expect(audit.counts.selectableVariants).toBe(1)
  expect(audit.counts.metadataVariants).toBe(2)
  expect(audit.variants).toEqual([expect.objectContaining({ rarity: 7, hasImportedStats: false })])
})

it("keeps an unverified star neutral instead of borrowing another star's acquisition method", () => {
  const audit = auditChampionAcquisitionCoverage([{ name: "Dark Phoenix", gameId: "phoenix_dark", slug: null, obtainable: ["5", "6", "7"], stats: [{ rarity: 5 }, { rarity: 6 }, { rarity: 7 }] }])
  expect(audit.variants.find(variant => variant.rarity === 5)).toMatchObject({ status: "evidence_missing", methodIds: [] })
  expect(audit.variants.filter(variant => variant.rarity !== 5).every(variant => variant.status === "reviewed_route")).toBe(true)
})
