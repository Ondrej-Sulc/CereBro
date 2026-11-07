import { expect, it } from "vitest"
import { createChampionAcquisitionCatalog } from "./champion-acquisition"

const fixture = () => ({ version: 1, reviewedAt: "2026-11-06", sources: [{ id: "hof", title: "Heart of Fire", url: "https://playcontestofchampions.com/news/heart-of-fire-event/", reviewedAt: "2026-11-06", category: "official_announcement", author: "Marvel Contest of Champions" }],
  methods: [{ id: "dark-phoenix-hof-7", gameId: "phoenix_dark", rarities: [7], kind: "event", title: "Heart of Fire · Phoenix Force", description: "Earn Dark Phoenix through event milestones.", requirements: ["Thronebreaker or higher"],
    availability: "event_window", startsAt: "2025-05-07T18:00:00Z", endsAt: "2025-05-14T18:00:00Z", sourceIds: ["hof"] }] })

it("joins exact identities and stars without treating missing evidence as unobtainable", () => {
  const catalog = createChampionAcquisitionCatalog(fixture())
  expect(catalog.forChampion("phoenix_dark", "2026-11-06T00:00:00Z").methods).toEqual([expect.objectContaining({ rarities: [7], periodStatus: "past", sources: [expect.objectContaining({ id: "hof" })] })])
  expect(catalog.forChampion("phoenix", "2026-11-06T00:00:00Z").methods).toEqual([])
  expect(catalog.forChampion(null).methods).toEqual([])
})

it("distinguishes past, future and dated windows without claiming live availability", () => {
  const catalog = createChampionAcquisitionCatalog(fixture())
  expect(catalog.forChampion("phoenix_dark", "2025-05-01T00:00:00Z").methods[0].periodStatus).toBe("upcoming")
  expect(catalog.forChampion("phoenix_dark", "2025-05-10T00:00:00Z").methods[0].periodStatus).toBe("within_window")
  expect(catalog.forChampion("phoenix_dark", "2025-05-14T18:00:00Z").methods[0].periodStatus).toBe("past")
  expect(() => catalog.forChampion("phoenix_dark", "invalid")).toThrow()
})

it("requires evidence, valid unique stars and a complete ordered event window", () => {
  const missing = fixture(); missing.methods[0].sourceIds = ["unknown"]
  expect(() => createChampionAcquisitionCatalog(missing)).toThrow(/source/i)
  const reversed = fixture(); reversed.methods[0].endsAt = "2025-05-01T00:00:00Z"
  expect(() => createChampionAcquisitionCatalog(reversed)).toThrow()
  const stars = fixture(); stars.methods[0].rarities = [7, 7]
  expect(() => createChampionAcquisitionCatalog(stars)).toThrow()
  const duplicate = fixture(); duplicate.methods.push({ ...duplicate.methods[0] })
  expect(() => createChampionAcquisitionCatalog(duplicate)).toThrow(/duplicate/i)
})

it("does not let one caller change the recorded evidence for later reads", () => {
  const catalog = createChampionAcquisitionCatalog(fixture())
  const row = catalog.forChampion("phoenix_dark").methods[0]
  expect(() => row.rarities.push(6)).toThrow()
  expect(() => { row.sources[0].title = "changed" }).toThrow()
  expect(catalog.forChampion("phoenix_dark").methods[0].rarities).toEqual([7])
})

it("keeps collection pieces tied to a single star level and validates their individual evidence", () => {
  const collection = { ...fixture(), methods: [{ ...fixture().methods[0], kind: "pieces", rarities: [7], availability: "source_dependent", startsAt: undefined, endsAt: undefined,
    pieces: [{ itemId: "piece_t7", name: "Sword piece", origin: { label: "Original event", kind: "past_event", sourceId: "hof", description: "Awarded in the event." } }] }] }
  const result = createChampionAcquisitionCatalog(collection).forChampion("phoenix_dark").methods[0]
  expect(result.pieces?.[0]).toMatchObject({ itemId: "piece_t7", origin: { source: { url: fixture().sources[0].url } } })
  expect(JSON.stringify(result.pieces)).not.toContain("sourceId")
  expect(() => createChampionAcquisitionCatalog({ ...collection, methods: [{ ...collection.methods[0], rarities: [6, 7] }] })).toThrow(/piece/i)
  expect(() => createChampionAcquisitionCatalog({ ...collection, methods: [{ ...collection.methods[0], pieces: [{ ...collection.methods[0].pieces[0], origin: { ...collection.methods[0].pieces[0].origin, sourceId: "missing" } }] }] })).toThrow(/source/i)
  expect(() => createChampionAcquisitionCatalog({ ...collection, methods: [{ ...collection.methods[0], pieces: [...collection.methods[0].pieces, ...collection.methods[0].pieces] }] })).toThrow(/piece/i)
})

it("requires gameplay sources to be explicitly identified as community evidence", () => {
  const input = fixture()
  input.sources[0].url = "https://www.youtube.com/watch?v=cpZA2TljF1k"
  expect(() => createChampionAcquisitionCatalog(input)).toThrow(/community/i)
  const reviewed = { ...input, sources: [{ ...input.sources[0], category: "community_guide" }] }
  expect(createChampionAcquisitionCatalog(reviewed).forChampion("phoenix_dark").methods[0].sources[0].kind).toBe("community_guide")
})

it("never treats a player post on the official forum as a Kabam announcement", () => {
  const input = fixture()
  const discussion = { ...input, sources: [{ ...input.sources[0], url: "https://forums.playcontestofchampions.com/en/discussion/409128/stella-forged-piece-locations", category: "community_discussion", author: "Ian_daSilva" }] }
  expect(createChampionAcquisitionCatalog(discussion).forChampion("phoenix_dark").methods[0].sources[0].kind).toBe("community_discussion")
  const unreviewed = { ...input, sources: [{ id: "hof", title: "Unclassified post", url: discussion.sources[0].url, reviewedAt: "2026-11-06" }] }
  expect(() => createChampionAcquisitionCatalog(unreviewed)).toThrow(/classif/i)
  expect(() => createChampionAcquisitionCatalog({ ...input, sources: [{ ...input.sources[0], author: "" }] })).toThrow()
  expect(() => createChampionAcquisitionCatalog({ ...discussion, sources: [{ ...discussion.sources[0], category: "official_announcement" }] })).toThrow(/Kabam author/i)
})
