import { expect, it } from "vitest"
import { createCrystalAvailability } from "./crystal-availability"

const fixture = () => ({ version: 1, reviewedAt: "2026-11-06", sources: [
  { id: "event", title: "Kabam event announcement", kind: "official_announcement", author: "Marvel Contest of Champions", url: "https://playcontestofchampions.com/news/event/" },
  { id: "recurring", title: "Recurring pool review", kind: "catalog_review" },
], records: [
  { sourceIds: ["event_crystal"], kind: "event", sourceId: "event", description: "Original event window; progression requirements apply.", startsOn: "2026-11-02", endsOn: "2027-02-10" },
  { sourceIds: ["hero_crystal"], kind: "recurring", sourceId: "recurring", description: "Recurring shard pool, without a live-stock assertion." },
] })

it("uses reviewed event dates and lets an event become historical without a catalog refresh", () => {
  const catalog = createCrystalAvailability(fixture())
  expect(catalog.forSource("event_crystal", "2026-11-01").status).toBe("upcoming")
  expect(catalog.forSource("event_crystal", "2026-11-06").status).toBe("current_event")
  expect(catalog.forSource("event_crystal", "2027-02-10").status).toBe("current_event")
  expect(catalog.forSource("event_crystal", "2027-02-11").status).toBe("past_event")
})

it("does not inherit availability from a name, shared pool, revision or another opening", () => {
  const catalog = createCrystalAvailability(fixture())
  expect(catalog.forSource("hero_crystal").status).toBe("recurring")
  for (const id of ["hero_nexus_crystal", "hero_crystal_v2", "banquet_2022", "jessies_crystal"]) {
    expect(catalog.forSource(id).status).toBe("unverified")
    expect(catalog.forSource(id).source).toBeNull()
  }
})

it("rejects ambiguous identities, invalid windows and missing evidence", () => {
  const input = fixture()
  expect(() => createCrystalAvailability({ ...input, records: [...input.records, input.records[0]] })).toThrow(/duplicate/i)
  expect(() => createCrystalAvailability({ ...input, records: [{ ...input.records[0], endsOn: "2026-01-01" }] })).toThrow()
  expect(() => createCrystalAvailability({ ...input, records: [{ ...input.records[0], sourceId: "missing" }] })).toThrow(/source/i)
  expect(() => createCrystalAvailability(input).forSource("hero_crystal", "invalid")).toThrow()
  expect(() => createCrystalAvailability({ ...input, sources: [{ ...input.sources[0], author: "A forum player" }, input.sources[1]] })).toThrow(/Kabam/i)
})

it("does not let a caller change availability evidence shared by later reads", () => {
  const catalog = createCrystalAvailability(fixture())
  const result = catalog.forSource("event_crystal", "2026-11-06")
  expect(() => { result.status = "recurring" }).toThrow()
  expect(() => { result.source!.title = "Changed" }).toThrow()
  expect(catalog.forSource("event_crystal", "2026-11-06").status).toBe("current_event")
})
