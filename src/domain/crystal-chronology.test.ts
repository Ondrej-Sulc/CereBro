import { expect, it } from "vitest"
import { getCrystalChronology, compareCrystalsNewestFirst } from "./crystal-chronology"

it("reads explicit named event/login periods without inventing release dates", () => {
  expect(getCrystalChronology(["login_crystal_3_4_star_apr26"])).toMatchObject({ kind: "period", label: "Apr 2026", period: { start: { year: 2026, month: 4 }, end: { year: 2026, month: 4 } } })
  expect(getCrystalChronology(["meta_dec2025_anniversary_collector_crystal"]).label).toBe("Dec 2025")
  expect(getCrystalChronology(["nov2026_valiant_castellan_box"]).label).toBe("Nov 2026")
  expect(getCrystalChronology(["april_meta_2019_antimatter_crystal"]).label).toBe("Apr 2019")
  expect(getCrystalChronology(["banquet_crystal_dec25"]).label).toBe("Dec 2025")
  expect(getCrystalChronology(["7star_valentines_crystal_2026"]).period).toEqual({ start: { year: 2026, month: null }, end: { year: 2026, month: null } })
})

it("summarizes aliases as a recorded named-period range", () => {
  expect(getCrystalChronology(["meta_nov2025_cfh_crystal", "meta_jan2026_cfh_crystal", "meta_nov2025_cfh_crystal"])).toMatchObject({ kind: "period", label: "Nov 2025–Jan 2026", period: { start: { year: 2025, month: 11 }, end: { year: 2026, month: 1 } } })
})

it("keeps champion content-year collections and arbitrary numbers out of crystal chronology", () => {
  for (const id of ["cfh_2014_champions_provenance_crystal", "3star_2015_2018_reflective_crystal", "5star_nexus_2016_2019_crystal", "fh_featured_2020_crystal", "5star_marvelous_2021_crystal", "7star_2025_celebration_crystal", "mythic_2025_celebration_crystal", "pfh_guillotine2099_alchemax_crystal", "unrecognized_59_1_0"]) {
    expect(getCrystalChronology([id])).toMatchObject({ kind: "unknown", label: null, period: null, revision: null })
  }
})

it("treats vN as a relative series revision rather than a semantic game version", () => {
  expect(getCrystalChronology(["6fh_v48_shard_crystal", "6fh_v49_shard_crystal"])).toMatchObject({ kind: "revision", label: "Pool v48–49", period: null, revision: { seriesId: "6fh_shard_crystal", first: 48, last: 49 } })
  expect(getCrystalChronology(["paragon_crystal_v2"]).revision?.seriesId).toBe("paragon_crystal")
  expect(getCrystalChronology(["6fh_v49_shard_crystal", "5fh_v50_shard_crystal"]).revision).toBeNull()
})

it("sorts supported editions newest first, revision groups relatively, and unknowns alphabetically", () => {
  const rows = [
    { id: "unknown-z", name: "Zed", sourceIds: ["unknown_z"] },
    { id: "old", name: "Old", sourceIds: ["meta_dec2025_cfh_crystal"] },
    { id: "v48", name: "Featured", sourceIds: ["6fh_v48_shard_crystal"] },
    { id: "new", name: "New", sourceIds: ["nov2026_valiant_castellan_box"] },
    { id: "unknown-a", name: "Alpha", sourceIds: ["unknown_a"] },
    { id: "v49", name: "Featured", sourceIds: ["6fh_v49_shard_crystal"] },
  ]
  expect([...rows].sort(compareCrystalsNewestFirst).map(row => row.id)).toEqual(["new", "old", "v49", "v48", "unknown-a", "unknown-z"])
  for (const a of rows) for (const b of rows) expect(Math.sign(compareCrystalsNewestFirst(a, b))).toBe(-Math.sign(compareCrystalsNewestFirst(b, a)) || 0)
})

it("prefers higher-star pools when named editions are equal or unavailable", () => {
  const rows = [3, 6, 4, 5].map(rarity => ({ id: `${rarity}star_incursion_crystal_armor_2023`, name: `${rarity}-STAR ARMOR CRYSTAL`, sourceIds: [`${rarity}star_incursion_crystal_armor_2023`], rarities: [rarity] }))
  expect([...rows].sort(compareCrystalsNewestFirst).map(row => row.rarities[0])).toEqual([6, 5, 4, 3])
  expect([...rows.map(row => ({ ...row, sourceIds: [`undated_${row.id}`] }))].sort(compareCrystalsNewestFirst).map(row => row.rarities[0])).toEqual([6, 5, 4, 3])
})
