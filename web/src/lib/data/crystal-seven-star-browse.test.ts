import { beforeEach, expect, it, vi } from "vitest"
import type { CrystalBrowseEntry } from "./crystal-browse-catalog"

const fixture = vi.hoisted(() => ({ entries: [] as CrystalBrowseEntry[], statuses: new Map<string, string>() }))
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany: async () => [] } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
vi.mock("./crystal-browse-catalog", async importOriginal => ({
  ...await importOriginal<typeof import("./crystal-browse-catalog")>(),
  getCrystalBrowseEntries: () => fixture.entries,
}))
vi.mock("@cerebro/core/data/game-crystals/availability", async importOriginal => {
  const actual = await importOriginal<typeof import("@cerebro/core/data/game-crystals/availability")>()
  return { ...actual, getCrystalAvailability: (id: string, asOf?: string) => ({
    ...actual.getCrystalAvailability(id, asOf), ...(fixture.statuses.has(id) ? { status: fixture.statuses.get(id) } : {}),
  }) }
})

import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { getCrystalPresentation } from "@cerebro/core/data/game-crystals"
import { loadCrystalCatalog, loadCrystalDetails } from "./crystals"
import { crystalHref } from "../crystal-navigation"
import { crystalBrowseOpeningSummary } from "./crystal-browse-catalog"

const anchor = "7_star_hero_shard_crystal"
const dust = "prg_6_silver_bty_bx"
const nexus = "greater_empowered_nexus_crystal"
const bonus = "valiant_metamorphosis_crystal"
const token = "t7_class_ascension_token_crystal"

beforeEach(async () => {
  const actual = await vi.importActual<typeof import("./crystal-browse-catalog")>("./crystal-browse-catalog")
  const entries = actual.getCrystalBrowseEntries()
  const source = (id: string) => entries.find(entry => entry.variants.some(variant => variant.sourceIds.includes(id)))!
  // Exercise a family with diverging opening contracts using unchanged shipped
  // reward fixtures. Family membership itself must confer no reward relevance.
  fixture.entries = [{ ...source(anchor), variants: [anchor, dust, nexus, bonus, token].map(id => {
    const variant = source(id).variants.find(variant => variant.sourceIds.includes(id))!
    return { ...variant, sourceIds: [id] }
  }), ascensionSourceIds: [nexus, bonus, token] }]
  fixture.statuses = new Map([[anchor, "recurring"], [dust, "recurring"], [nexus, "unverified"], [bonus, "past_event"], [token, "current_event"]])
})

it("uses the qualifying Nexus name, artwork, summary, selection and exact link instead of its ordinary family representative", async () => {
  const data = await loadCrystalCatalog({ reward: "ascension", q: nexus, rarity: "6" })
  expect(data.rarity).toBe("")
  expect(data.families).toHaveLength(1)
  const card = data.families[0]
  const opening = getCrystalOpening(nexus)!
  expect(card).toMatchObject({ ...crystalBrowseOpeningSummary(opening), name: opening.name,
    availabilitySourceId: nexus, artworkUrl: getCrystalPresentation(nexus)?.artworkUrl ?? null, ascensionSourceIds: [nexus] })
  expect(card.variants.map(variant => variant.sourceIds)).toEqual([[nexus]])
  expect(card.variants[0].selection).toEqual({ draw: 3, pick: 1 })
  expect(crystalHref(card.availabilitySourceId)).toBe(`/crystals/${nexus}`)
  const details = await loadCrystalDetails(card.availabilitySourceId, {})
  expect(details?.opening?.id).toBe(nexus)
  expect(details?.opening?.selection).toEqual(opening.selection)
  expect(details?.opening?.conditionalBonuses.map(binding => [binding.categoryId, binding.trigger.sourceIndex]))
    .toEqual(opening.conditionalBonuses.map(binding => [binding.categoryId, binding.rewardIndex]))
})

it("cannot borrow a name, source ID or availability state from an unrelated or dust-only family variant", async () => {
  for (const q of [anchor, dust]) expect((await loadCrystalCatalog({ reward: "ascension", q })).families).toEqual([])
  expect((await loadCrystalCatalog({ reward: "ascension", availability: "recurring" })).total).toBe(0)
  const all = await loadCrystalCatalog({ reward: "ascension", q: nexus })
  expect(all.availabilityFilters.find(filter => filter.id === "recurring")?.count).toBe(0)
  expect((await loadCrystalCatalog({ q: anchor })).families[0].availabilitySourceId).toBe(anchor)
})

it("requires category and availability to match the same qualifying source and counts their intersection", async () => {
  const excluded = await loadCrystalCatalog({ reward: "ascension", category: "events", availability: "current_event" })
  expect(excluded.total).toBe(0)
  expect(excluded.availabilityFilters.find(filter => filter.id === "current_event")?.count).toBe(0)
  expect(excluded.availabilityFilters.find(filter => filter.id === "past_event")?.count).toBe(1)
  const matching = await loadCrystalCatalog({ reward: "ascension", category: "events", availability: "past_event" })
  expect(matching.families[0]).toMatchObject({ category: "events", availabilitySourceId: bonus, name: getCrystalOpening(bonus)!.name })
  expect((await loadCrystalCatalog({ reward: "ascension", category: "main" })).total).toBe(0)
})

it("sorts using matched opening names rather than an unrelated representative", async () => {
  const tokenEntry = fixture.entries[0]
  fixture.entries = [{ ...tokenEntry, id: "second-family", name: "AAA", ascensionSourceIds: [bonus],
    variants: tokenEntry.variants.filter(variant => variant.sourceIds.includes(bonus)) }, tokenEntry]
  const data = await loadCrystalCatalog({ reward: "ascension", q: "crystal", sort: "name" })
  expect(data.families.map(card => card.name)).toEqual([...data.families.map(card => card.name)].sort((a, b) => a.localeCompare(b, "en")))
})
