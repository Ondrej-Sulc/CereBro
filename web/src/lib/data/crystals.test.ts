import { beforeEach, expect, it, vi } from "vitest"
const findMany = vi.hoisted(() => vi.fn())
vi.mock("@/lib/prisma", () => ({ prisma: { champion: { findMany } } }))
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }))
import { loadCrystalCatalog, loadCrystalDetails, loadCrystalComparison, loadCrystalFinder, searchCrystalOptions } from "./crystals"
import { getCrystalDetails } from "@cerebro/core/data/game-crystals"
import { parseCrystalReturnTo } from "../crystal-browse-return"
import { getRewardArtwork } from "@cerebro/core/data/game-reward-artwork"
import { getChampionAcquisition } from "@cerebro/core/data/champion-acquisition"
import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { loadCrystalPageRewards } from "./crystal-page-rewards"
import { getChampionCrystalAscensionSources } from "./champion-crystal-ascension"

it("projects crisp curated finder portraits from the existing metadata read with exact published decorative art", async () => {
  findMany.mockResolvedValue([
    { gameId: "hulk", name: "Hulk", slug: "hulk", class: "SCIENCE", images: { p_64: "/small.png", full_primary: "/full.png" }, obtainable: ["7"] },
    { gameId: "storm", name: "Storm", slug: "storm", class: "MUTANT", images: { full_secondary: "/secondary.png" }, obtainable: ["7"] },
    { gameId: "guillotine_nameless", name: "Guillotine (Deathless)", slug: "guillotine-deathless", class: "MYSTIC", images: null, obtainable: ["6", "7"] },
  ])
  const data = await loadCrystalFinder({ champion: "hulk" })
  expect(findMany).toHaveBeenCalledTimes(1)
  expect(data.heroArtwork.portraits.map(p => [p.gameId, p.url])).toEqual([["storm", "/secondary.png"], ["hulk", "/full.png"]])
  expect(data.heroArtwork.selected).toEqual({ gameId: "hulk", url: "/full.png", championClass: "SCIENCE" })
  expect(data.heroArtwork.selectedMotifs.token).toBe(getRewardArtwork("inv", "ascension_token_class_chemical")?.url)
  expect(data.heroArtwork.motifs.crystal).toBe(getCrystalDetails("7_star_hero_shard_crystal")?.artworkUrl)
  expect(data.heroArtwork.selectedMotifs.piece).toBeUndefined()
  expect(JSON.stringify(data.heroArtwork)).not.toMatch(/"(?:images|full_primary|registry|reference)":/)
  const next = await loadCrystalFinder({ rarity: "1", reward: "ascension" })
  expect(next.heroArtwork.portraits).toEqual(data.heroArtwork.portraits)
  expect(next.heroArtwork.motifs).toEqual(data.heroArtwork.motifs)
  const sourceOnly = await loadCrystalFinder({ champion: "gwenom" })
  expect(sourceOnly.heroArtwork.selected).toMatchObject({ gameId: "gwenom", url: null })
  const collection = await loadCrystalFinder({ champion: "guillotine_nameless", rarity: "6" })
  expect(collection.heroArtwork.selectedMotifs.piece).toBe(getChampionAcquisition("guillotine_nameless").methods.find(m => m.rarities.includes(6))?.pieces?.[0].artworkUrl)
})

it("finds exact newer ascension sources while preserving normal acquisition lookup", async () => {
  const data = await loadCrystalFinder({ champion: "gwenom", rarity: "7", reward: "ascension", page: "99" })
  expect(data.reward).toBe("ascension")
  expect(data.ascensionSources.map(source => source.id)).toContain("vfh_gwenom_broken_justice_crystal")
  expect(data.ascensionSources.every(source => source.rarities.includes(7))).toBe(true)
  expect(data.observedAt).toBe("2026-11-05T14:05:24+00:00")
  const unsupported = await loadCrystalFinder({ champion: "gwenom", rarity: "6", reward: "ascension" })
  expect(unsupported.rarity).toBe("7")
  expect(unsupported.ascensionSources).toEqual(data.ascensionSources)
  expect(unsupported.selected?.gameId).toBe("gwenom")
  expect(unsupported.mainCount + unsupported.otherCount).toBeGreaterThan(0)
  expect((await loadCrystalFinder({ champion: "hulk", rarity: "7" })).reward).toBe("all")
  expect((await loadCrystalFinder({ champion: "hulk", rarity: "7", reward: "ascension" })).ascensionSources).toEqual([])
})

it("opens one complete catalog by default, with all main pools first in recommended order", async () => {
  const data = await loadCrystalCatalog({})
  expect(data.category).toBe("all")
  expect(data.total).toBeGreaterThan(2000)
  expect(data.families.slice(0, 11).every(family => family.isMainPool)).toBe(true)
  expect(data.families.slice(11).every(family => !family.isMainPool)).toBe(true)
  const legacy = await loadCrystalCatalog({ scope: "all" })
  expect(legacy.families).toEqual(data.families)
  const main = await loadCrystalCatalog({ category: "main" })
  expect(main.total).toBe(11)
  expect(main.families.every(family => family.isMainPool)).toBe(true)
  expect((await loadCrystalCatalog({ scope: "main" })).families).toEqual(main.families)
  expect((await loadCrystalCatalog({ reward: "ascension" })).total).toBeGreaterThan(0)
})

it("respects alphabetical order across the whole catalog instead of pinning main pools", async () => {
  const data = await loadCrystalCatalog({ sort: "name" })
  expect(data.families.length).toBeGreaterThan(11)
  const names = data.families.map(family => family.name)
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "en")))
})

it("finds seven-star ascension crystals and token sources without a champion-pool star restriction", async () => {
  const data = await loadCrystalCatalog({ scope: "all", reward: "ascension", rarity: "7", page: "999" })
  expect(data.reward).toBe("ascension")
  expect(data.rarity).toBe("")
  const pages = await Promise.all(Array.from({ length: data.pages }, (_, index) => loadCrystalCatalog({ scope: "all", reward: "ascension", page: String(index + 1) })))
  const families = pages.flatMap(page => page.families)
  expect(families.map(family => family.id)).toContain("valiant_metamorphosis_crystal")
  expect(families.map(family => family.id)).toContain("t7_class_ascension_token_crystal")
  expect(families.map(family => family.id)).toContain("arnim_zola_ascension_box")
  expect(families.map(family => family.id)).not.toContain("7_star_hero_shard_crystal")
  expect(families.map(family => family.id)).not.toContain("prg_6_silver_bty_bx")
  expect(families.every(family => family.ascensionSourceIds.includes(family.availabilitySourceId))).toBe(true)
  const searched = await loadCrystalCatalog({ scope: "all", reward: "ascension", q: "metamorphosis", category: "events", sort: "name" })
  expect(searched.total).toBeGreaterThan(0)
  expect(searched.families.every(family => family.ascensionSourceIds.length > 0 && family.category === "events")).toBe(true)
  expect(searched).toMatchObject({ q: "metamorphosis", category: "events", sort: "name", reward: "ascension" })
})

it("retains dust-only bundles in normal materials discovery and unchanged detail rewards", async () => {
  const id = "prg_6_silver_bty_bx"
  expect((await loadCrystalCatalog({ reward: "ascension", q: id })).total).toBe(0)
  const normal = await loadCrystalCatalog({ reward: "items", q: id })
  expect(normal.families.map(family => family.id)).toEqual([id])
  const details = loadCrystalPageRewards(id)!
  const rewards = getCrystalOpening(id)!.categories.flatMap(category => category.rewards)
  expect(details.otherRewards.map(reward => [reward.type, reward.data, reward.quantity]))
    .toEqual(rewards.map(reward => [reward.type, reward.data, reward.quantity]))
  expect(details.otherRewards.some(reward => reward.data === "prg6_silver_75x_t2_primordial_dust")).toBe(true)
})

it("retains a validated browsing destination on crystal details", async () => {
  const returnTo = "/crystals?q=banquet&sort=name&page=3"
  expect((await loadCrystalDetails("paragon_crystal_v2", { returnTo }))?.returnTo).toBe(parseCrystalReturnTo(returnTo))
  expect((await loadCrystalDetails("paragon_crystal_v2", { returnTo: "https://evil.test" }))?.returnTo).toBeNull()
})

it("filters exact availability while keeping search, category and stars independent", async () => {
  const recurring = await loadCrystalCatalog({ scope: "all", availability: "recurring", rarity: "7" })
  expect(recurring.families.some(family => family.id === "7_star_hero_shard_crystal")).toBe(true)
  expect(recurring.families.every(family => family.availability.status === "recurring")).toBe(true)
  const historical = await loadCrystalCatalog({ scope: "all", q: "banquet", availability: "past_event" })
  expect(historical.families.length).toBeGreaterThan(0)
  expect(historical.families.every(family => family.availability.status === "past_event")).toBe(true)
  const unknownNexus = await loadCrystalCatalog({ scope: "all", q: "7_star_hero_shard_crystal", availability: "unverified" })
  expect(unknownNexus.families[0]).toMatchObject({ id: "7_star_hero_shard_crystal", availabilitySourceId: "7star_nexus_crystal", availability: { status: "unverified" } })
  expect((await loadCrystalCatalog({ availability: "invalid" })).availability).toBe("all")
  expect(await loadCrystalCatalog({ q: "banquet", availability: "past_event" })).toMatchObject({ category: "all", availability: "past_event" })
  expect(await loadCrystalCatalog({ scope: "main", availability: "past_event" })).toMatchObject({ category: "main", availability: "past_event", total: 0 })
})

it("excludes the unverified duplicate-name pool from acquisition lookup while keeping its catalog evidence", async () => {
  const finder = await loadCrystalFinder({ champion: "thanos_deathless_trophy", rarity: "7" })
  expect(finder.selected?.gameId).toBe("thanos_deathless_trophy")
  expect(finder.mainCount + finder.otherCount).toBe(0)
  expect(searchCrystalOptions({ q: "7-STAR HERO CRYSTAL" }).options.map(option => option.id)).not.toContain("jessies_crystal")
  const recorded = await loadCrystalCatalog({ scope: "all", q: "jessies_crystal" })
  expect(recorded.families).toEqual([expect.objectContaining({ id: "jessies_crystal", availabilityReview: expect.objectContaining({ title: "Player availability unverified" }) })])
  const details = await loadCrystalDetails("jessies_crystal", {})
  expect(details).toMatchObject({ availabilityReview: expect.objectContaining({ title: "Player availability unverified" }) })
  expect(details?.champions.some(champion => champion.gameId === "thanos_deathless_trophy")).toBe(true)
})

it("browses reward-only crystals beside champion families and searches exact source IDs", async () => {
  const banquet = await loadCrystalCatalog({ scope: "all", q: "superior_banquet_crystal_dec25" })
  expect(banquet.families).toEqual([expect.objectContaining({ id: "superior_banquet_crystal_dec25", championCount: 0, rewardKind: "items", hasRates: true })])
  expect(banquet.observedAt).toBe("2026-11-05T14:05:24+00:00")
  const catalyst = await loadCrystalCatalog({ scope: "all", q: "t7_class_cat_crystal" })
  expect(catalyst.families.map(family => family.id)).toEqual(["t7_class_cat_crystal"])
  expect((await loadCrystalCatalog({ scope: "all", q: "paragon_shards_v2" })).families.map(family => family.id)).toEqual(["paragon_crystal_v2"])
  expect(findMany).not.toHaveBeenCalled()
})

it("partitions the unified catalog by rewards and filters main pools as a category", async () => {
  const all = await loadCrystalCatalog({ scope: "all" })
  const kinds = await Promise.all(["champions", "items", "mixed"].map(reward => loadCrystalCatalog({ scope: "all", reward })))
  expect(kinds.reduce((sum, data) => sum + data.total, 0)).toBe(all.total)
  for (const data of kinds) expect(data.families.every(family => family.rewardKind === data.reward)).toBe(true)
  const items = await loadCrystalCatalog({ scope: "all", reward: "items", rarity: "7" })
  expect(items.rarity).toBe("")
  expect(items.total).toBe(336)
  expect(items.categories.reduce((sum, category) => sum + category.count, 0)).toBe(items.total)
  expect(await loadCrystalCatalog({ reward: "items" })).toMatchObject({ category: "all", reward: "items", total: items.total })
  const main = await loadCrystalCatalog({ category: "main" })
  expect(main).toMatchObject({ category: "main", reward: "all", total: 11 })
  expect(main.families.every(family => family.isMainPool)).toBe(true)
  expect((await loadCrystalCatalog({ scope: "all", reward: "invalid" })).reward).toBe("all")
})

it("combines Paragon's exact rates and extra Nexus rewards with the current champion pool", async () => {
  const data = (await loadCrystalDetails("paragon_crystal_v2", {}))!
  expect(data.opening?.id).toBe("paragon_crystal_v2")
  expect(data.opening?.odds?.groups?.[0].rows.map(row => row.percentValue)).toEqual(["1.25", "8", "33.2", "47.25", "8.3", "2"])
  expect(data.opening?.otherRewards.map(reward => [reward.data, reward.href])).toEqual([
    ["sg_5star_nexus_crystal", "/crystals/sg_5star_nexus_crystal"],
    ["sg_6star_nexus_crystal", "/crystals/sg_6star_nexus_crystal"],
  ])
  expect(data.opening?.otherRewards.every(reward => reward.imageUrl?.startsWith("https://storage.googleapis.com/champion-images/crystals/primary/"))).toBe(true)
  expect(data.observedAt).toBe("2026-11-05T14:05:24+00:00")
  const filtered = (await loadCrystalDetails("paragon_crystal_v2", { rarity: "7", class: "SCIENCE", q: "hulk" }))!
  expect(filtered.opening).toEqual(data.opening)
  expect(filtered.champions.every(champion => champion.rarities.includes(7))).toBe(true)
})

it("uses current opening membership instead of older family contents", async () => {
  const id = "valiant_empire_of_doom_saga_crystal"
  expect(getCrystalDetails(id)?.contents.some(champion => champion.championId === "gwenom")).toBe(true)
  const current = (await loadCrystalDetails(id, {}))!
  expect(current.opening?.id).toBe(id)
  expect(current.champions.some(champion => champion.gameId === "gwenom")).toBe(false)
  expect(current.observedAt).toBe("2026-11-05T14:05:24+00:00")
})

it("preserves exact opening aliases and rejects a foreign legacy opening choice", async () => {
  const legacyShards = (await loadCrystalDetails("paragon_shards", {}))!
  expect(legacyShards.opening?.id).toBe("paragon_shards")
  expect(legacyShards.opening?.odds?.status).toBe("empty_disclosure")
  const legacyStandard = (await loadCrystalDetails("paragon_crystal", {}))!
  expect(legacyStandard.opening?.odds?.groups?.[0].rows.map(row => row.percentValue)).toEqual(["1", "8", "41", "50"])
  expect(legacyStandard.opening?.otherRewards).toHaveLength(0)
  const nexus = (await loadCrystalDetails("paragon_crystal_v2", { variant: "paragon_nexus_crystal" }))!
  expect(nexus.opening?.id).toBe("paragon_nexus_crystal")
  expect(nexus.opening?.selection).toEqual({ draw: 3, pick: 1 })
  expect((await loadCrystalDetails("paragon_crystal_v2", { variant: "7_star_hero_shard_crystal" }))?.opening?.id).toBe("paragon_crystal_v2")
})

it("puts newer dated Banquet editions first and supports an explicit alphabetical order", async () => {
  const newest = await loadCrystalCatalog({ scope: "all", category: "events", q: "greater banquet", sort: "newest" })
  expect(newest.sort).toBe("newest")
  expect(newest.families[0].id).toBe("greater_banquet_crystal_dec25")
  const alphabetical = await loadCrystalCatalog({ scope: "all", category: "events", q: "greater banquet", sort: "name" })
  expect(alphabetical.sort).toBe("name")
  expect(alphabetical.families.map(family => family.id)).toEqual([...alphabetical.families].sort((a, b) => a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en")).map(family => family.id))
  expect(newest.families.map(family => family.id).sort()).toEqual(alphabetical.families.map(family => family.id).sort())
})

it("recommends higher-star Incursion pools before older low-star editions", async () => {
  const result = await loadCrystalCatalog({ scope: "all", category: "modes" })
  expect(result.sort).toBe("recommended")
  expect(result.families[0].rarities).toContain(7)
  const all = await loadCrystalCatalog({ scope: "all", category: "modes", q: "armor" })
  const stars = all.families.map(family => Math.max(...family.rarities))
  expect(stars).toEqual([...stars].sort((a, b) => b - a))
})

it("groups a month's Login star ranges without combining the individual reward pools", async () => {
  const result = await loadCrystalCatalog({ scope: "all", q: "login", category: "calendar" })
  const november = result.families.find(family => family.editionGroup?.label === "Nov 2026")!
  expect(november.editionGroup?.options.map(option => option.id)).toContain("login_crystal_7_star_nov26")
  expect(november.editionGroup?.options.map(option => option.id)).toContain("login_crystal_6_7_star_nov26")
  expect(result.crystalCount).toBe(241)
  expect(result.total).toBeLessThan(result.crystalCount)
  const filtered = await loadCrystalCatalog({ scope: "all", q: "login", category: "calendar", rarity: "7" })
  expect(filtered.families.every(family => family.editionGroup?.options.every(option => option.rarities.includes(7)) ?? family.rarities.includes(7))).toBe(true)
  const exact = await loadCrystalCatalog({ scope: "all", q: "login_crystal_3_4_star_nov26" })
  expect(exact.families).toHaveLength(1)
  expect(exact.families[0].id).toBe("login_crystal_3_4_star_nov26")
  expect(exact.families[0].editionGroup).toBeUndefined()
})

it("enriches only the visible single-champion previews with existing champion artwork", async () => {
  findMany.mockResolvedValue([{ gameId: "northstar", name: "Northstar", slug: "northstar", class: "MUTANT", images: { p_64: "https://storage.googleapis.com/champion-images/northstar.png" }, obtainable: ["6", "7"] }])
  const data = await loadCrystalCatalog({ scope: "all", q: "nov26", category: "calendar" })
  const login = data.families.find(family => family.editionGroup)!
  expect(login.championPreview).toEqual({ gameId: "northstar", name: "Northstar", portraitUrl: "https://storage.googleapis.com/champion-images/northstar.png" })
  expect(login.editionGroup?.options).toHaveLength(5)
})

it("keeps crystal browsing usable when optional portrait metadata is unavailable", async () => {
  findMany.mockRejectedValueOnce(new Error("Portrait metadata unavailable"))
  const data = await loadCrystalCatalog({ scope: "all", q: "login_crystal_7_star_nov26" })
  expect(data.families[0].championPreview).toEqual({ gameId: "northstar", name: "NORTHSTAR", portraitUrl: null })
})

it("finds Gwenom's recorded First Edition crystals by champion name at the exact star", async () => {
  const result = await loadCrystalFinder({ q: "Gwenom", rarity: "7" })
  expect(result.selected?.gameId).toBe("gwenom")
  expect(result.main).toHaveLength(0)
  expect(result.other.some(family => family.variants.some(variant => variant.sourceIds.includes("pfh_gwenom_en_pointe_crystal")))).toBe(true)
  expect(Object.values(result.matchingRarities).every(values => values.includes(7))).toBe(true)
  const one = await loadCrystalFinder({ champion: "gwenom", rarity: "1" })
  expect(one.selected?.gameId).toBe("gwenom")
  expect(one.mainCount + one.otherCount).toBe(0)
})

it("provides compact champion combo box options including source-only champions at every star filter", async () => {
  const data = await loadCrystalFinder({ rarity: "1" })
  expect(data.championOptions).toContainEqual(expect.objectContaining({ id: "hulk", name: "Hulk", class: "SCIENCE", portraitUrl: null, ascendableRarities: [6, 5, 4] }))
  expect(data.championOptions).toContainEqual(expect.objectContaining({ id: "gwenom", name: "GWENOM", class: undefined, portraitUrl: null, ascendableRarities: [7, 6, 5, 4] }))
  expect(new Set(data.championOptions.map(option => option.id)).size).toBe(data.championOptions.length)
  expect(data.championOptions).toEqual((await loadCrystalFinder({ champion: "gwenom", rarity: "7" })).championOptions)
})

it("finds champions with no direct crystal pools and reuses their star-specific acquisition records", async () => {
  findMany.mockResolvedValue([{ gameId: "phoenix_dark", name: "Dark Phoenix", slug: "dark-phoenix", class: "MUTANT", images: null, obtainable: ["6", "7"] }])
  const result = await loadCrystalFinder({ champion: "phoenix_dark", rarity: "7" })
  expect(result.selected).toMatchObject({ gameId: "phoenix_dark", profileHref: "/champions/dark-phoenix?rarity=7" })
  expect(result.championOptions.some(option => option.id === "phoenix_dark")).toBe(true)
  expect(result.mainCount + result.otherCount).toBe(0)
  expect(result.acquisition?.methods).toEqual([expect.objectContaining({ gameId: "phoenix_dark", rarities: [7], title: expect.stringContaining("Phoenix Force") })])
  const searched = await loadCrystalFinder({ q: "Dark Phoenix" })
  expect(searched.selected?.gameId).toBe("phoenix_dark")
  expect(new Set(searched.acquisition?.methods.flatMap(method => method.rarities))).toEqual(new Set([6, 7]))
  const unknownStar = await loadCrystalFinder({ champion: "phoenix_dark", rarity: "5" })
  expect(unknownStar.selected?.gameId).toBe("phoenix_dark")
  expect(unknownStar.acquisition?.methods).toEqual([])
})

it("shows non-crystal routes for one star even when lower stars have crystal rewards", async () => {
  const seven = await loadCrystalFinder({ champion: "vision", rarity: "7" })
  expect(seven.mainCount + seven.otherCount).toBe(0)
  expect(seven.acquisition?.methods.some(method => method.title.includes("Trophy Champion selector"))).toBe(true)
  const six = await loadCrystalFinder({ champion: "vision", rarity: "6" })
  expect(six.mainCount + six.otherCount).toBeGreaterThan(0)
  expect(six.acquisition?.methods).toEqual([])
  expect((await loadCrystalFinder({})).acquisition).toBeNull()
})

it("requires a choice for ambiguous champion searches and keeps archived results bounded", async () => {
  const ambiguous = await loadCrystalFinder({ q: "hulk" })
  expect(ambiguous.selected).toBeNull()
  expect(ambiguous.matches.length).toBeGreaterThan(1)
  const hulk = await loadCrystalFinder({ champion: "hulk", rarity: "7" })
  expect(hulk.selected).toMatchObject({ name: "Hulk", slug: "hulk" })
  expect(hulk.main.some(family => family.id === "7_star_hero_shard_crystal")).toBe(true)
  expect(hulk.other.length).toBeLessThanOrEqual(24)
  expect(hulk.categories.reduce((sum, category) => sum + category.count, 0)).toBe(hulk.otherCount)
  expect((await loadCrystalFinder({ champion: "unknown" })).selected).toBeNull()
})

it("compares exact stars, resolves aliases and keeps unavailable tiers empty", async () => {
  const same = await loadCrystalComparison({ left: "7star_nexus_crystal", right: "7_star_hero_shard_crystal", rarity: "7" })
  expect(same.left?.id).toBe(same.right?.id)
  expect(same.counts).toEqual({ left: 0, shared: 180, right: 0 })
  expect((await loadCrystalComparison({ left: "7_star_titan_hero_shard_crystal" })).right?.id).toBe("7_star_hero_shard_crystal")
  const differentStars = await loadCrystalComparison({ left: "7_star_hero_shard_crystal", right: "6_star_hero_shard_crystal", rarity: "7" })
  expect(differentStars.right?.championCount).toBe(0)
  expect(differentStars.counts).toEqual({ left: 180, shared: 0, right: 0 })
  const unknown = await loadCrystalComparison({ left: "unknown", right: "7_star_hero_shard_crystal", rarity: "7" })
  expect(unknown.left).toBeNull()
  expect(unknown.groups.every(group => group.champions.length === 0)).toBe(true)
})

it("attributes compared contents to the resolved opening captures", async () => {
  const left = "6star_empire_of_doom_saga_crystal", right = "6_star_hero_shard_crystal"
  const [comparison, leftDetail, rightDetail] = await Promise.all([
    loadCrystalComparison({ left, right, rarity: "6" }), loadCrystalDetails(left, {}), loadCrystalDetails(right, {}),
  ])
  expect(leftDetail?.observedAt).toBe("2026-11-05T14:05:24+00:00")
  expect(comparison.left).toMatchObject({ observedAt: leftDetail!.observedAt })
  expect(comparison.right).toMatchObject({ observedAt: rightDetail!.observedAt })
  expect(comparison.observedAt).toBe(leftDetail!.observedAt)
})

it("keeps comparison groups disjoint and search independent of full pool counts", async () => {
  const data = await loadCrystalComparison({ q: "hulk", rarity: "7" })
  const all = await loadCrystalComparison({ rarity: "7" })
  expect(data.counts).toEqual(all.counts)
  expect(data.groups.flatMap(group => group.champions).every(champion => champion.name.toLowerCase().includes("hulk"))).toBe(true)
  const ids = all.groups.flatMap(group => group.champions.map(champion => champion.gameId))
  expect(new Set(ids).size).toBe(ids.length)
  expect(all.counts.left + all.counts.shared).toBe(all.left?.championCount)
  expect(all.counts.right + all.counts.shared).toBe(all.right?.championCount)
})

it("offers bounded crystal picker results with main pools first on an empty query", async () => {
  expect(searchCrystalOptions({}).options.every(option => option.isMainPool)).toBe(true)
  const result = searchCrystalOptions({ q: "nexus", rarity: "7" })
  expect(result.options.length).toBeLessThanOrEqual(20)
  expect(result.options.every(option => option.rarities.includes(7))).toBe(true)
  expect(result.options.every(option => !('variants' in option))).toBe(true)
  expect(findMany).not.toHaveBeenCalled()
})

beforeEach(() => { findMany.mockReset(); findMany.mockResolvedValue([{ gameId: "hulk", name: "Hulk", slug: "hulk", class: "SCIENCE", images: null, obtainable: ["6", "7"] }]) })

it("returns the entire filtered champion pool, including from old paginated links", async () => {
  const pool = (await loadCrystalDetails("7_star_hero_shard_crystal", { rarity: "7" }))!
  expect(pool.total).toBeGreaterThan(48)
  expect(pool.champions).toHaveLength(pool.total)
  const oldLink = (await loadCrystalDetails("7_star_hero_shard_crystal", { rarity: "7", page: "3" }))!
  expect(oldLink.champions).toEqual(pool.champions)
  expect(oldLink).toMatchObject({ page: 1, pages: 1 })
})

it("keeps First Edition rewards tied to their exact star level", async () => {
  const seven = (await loadCrystalDetails("pfh_gwenom_en_pointe_crystal", { rarity: "7", q: "gwenom" }))!
  expect(seven.champions).toEqual([expect.objectContaining({ gameId: "gwenom", firstEditionRarities: [7] })])
  const six = (await loadCrystalDetails("pfh_gwenom_en_pointe_crystal", { rarity: "6", q: "gwenom" }))!
  expect(six.champions).toEqual([expect.objectContaining({ gameId: "gwenom" })])
  expect(six.champions[0].firstEditionRarities).toBeUndefined()
})

it("browses main families first and preserves search/star filters without an account", async () => {
  const catalog = await loadCrystalCatalog({ rarity: "7" })
  expect(catalog.families.some(f => f.id === "7_star_hero_shard_crystal")).toBe(true)
  expect(catalog.families.every(f => f.rarities.includes(7))).toBe(true)
  expect(catalog.families[0].isMainPool).toBe(true)
  expect(findMany.mock.calls.length).toBeLessThanOrEqual(1)
  const filtered = await loadCrystalCatalog({ scope: "all", q: "titan", rarity: "7", page: "999999" })
  expect(catalog.heroArtwork).toHaveLength(5)
  expect(filtered.heroArtwork).toEqual(catalog.heroArtwork)
  expect((await loadCrystalCatalog({ q: "not-a-crystal", rarity: "1" })).heroArtwork).toEqual(catalog.heroArtwork)
  expect(catalog.heroArtwork.every(artwork => artwork.url.startsWith("https://storage.googleapis.com/champion-images/crystals/primary/"))).toBe(true)
  expect(filtered.families.every(f => [f.name, ...f.variants.flatMap(variant => [variant.name, ...variant.sourceIds])].some(value => value.toLowerCase().includes("titan")))).toBe(true)
  expect(filtered.page).toBeLessThanOrEqual(filtered.pages)
})

it("loads exact contents, joins champions by gameId and retains source-only entries", async () => {
  const details = await loadCrystalDetails("7star_nexus_crystal", { rarity: "7", q: "hulk", variant: "7star_nexus_crystal" })
  expect(details?.id).toBe("7_star_hero_shard_crystal")
  expect(details?.champions.find(c => c.gameId === "hulk")).toMatchObject({ gameId: "hulk", name: "Hulk", slug: "hulk", rarities: [7] })
  const sourceOnly = await loadCrystalDetails("7_star_hero_shard_crystal", { rarity: "7", q: "abomination" })
  expect(sourceOnly?.champions.length).toBeGreaterThan(0)
  expect(sourceOnly?.champions.every(c => !!c.name && c.slug === null)).toBe(true)
})

it("does not resolve an unknown route or a foreign variant to unrelated contents", async () => {
  expect(await loadCrystalDetails("not-a-crystal", {})).toBeNull()
  expect(findMany).not.toHaveBeenCalled()
  const details = await loadCrystalDetails("7_star_hero_shard_crystal", { variant: "7_star_titan_hero_shard_crystal", rarity: "99" })
  expect(details?.id).toBe("7_star_hero_shard_crystal")
  expect(details?.rarity).toBe("7")
})

it("uses one family presentation and champion pool for standard, Nexus, Epoch and legacy variant links", async () => {
  const filters = { rarity: "7", q: "hulk", class: "SCIENCE" }
  const standard = (await loadCrystalDetails("7_star_hero_shard_crystal", filters))!
  expect(standard.bannerArtworkUrl).toMatch(/^https:\/\/storage.googleapis.com\/champion-images\/crystals\/banner\//)
  for (const id of ["7star_nexus_crystal", "7star_nexus_crystal_1_of_5"]) {
    const alias = (await loadCrystalDetails(id, filters))!
    const legacy = (await loadCrystalDetails("7_star_hero_shard_crystal", { ...filters, variant: id }))!
    for (const data of [alias, legacy]) {
      expect(data.champions).toEqual(standard.champions)
      expect(data.total).toBe(standard.total)
      expect(data.artworkUrl).toBe(standard.artworkUrl)
      expect(data.bannerArtworkUrl).toBe(standard.bannerArtworkUrl)
    }
  }
})

it("normalizes repeated query fields and invalid pagination without changing pools", async () => {
  const data = await loadCrystalCatalog({ q: [" titan ", "hero"], rarity: ["7", "6"], page: "-10" })
  expect(data).toMatchObject({ q: "titan", rarity: "7", page: 1 })
  expect(data.families).toEqual((await loadCrystalCatalog({ q: "titan", rarity: "7" })).families)
  expect(data.families.some(family => family.id === "7_star_titan_hero_shard_crystal")).toBe(true)
})

it("counts class choices within the current name and star filters, independently of the selected class", async () => {
  findMany.mockResolvedValue([
    { gameId: "hulk", name: "Fixture Hulk", slug: "hulk", class: "SCIENCE", images: null, obtainable: ["7"] },
    { gameId: "hawkeye", name: "Hawkeye", slug: "hawkeye", class: "SKILL", images: null, obtainable: ["7"] },
  ])
  const all = (await loadCrystalDetails("7_star_hero_shard_crystal", { rarity: "7" }))!
  const selected = (await loadCrystalDetails("7_star_hero_shard_crystal", { rarity: "7", class: "SCIENCE" }))!
  expect(selected.classCounts).toEqual(all.classCounts)
  expect(selected.matchingBeforeClass).toBe(all.total)
  expect(selected.classCounts.SCIENCE).toBe(1)
  expect(selected.total).toBe(1)
  const searched = (await loadCrystalDetails("7_star_hero_shard_crystal", { rarity: "7", q: "Fixture Hulk", class: "SCIENCE" }))!
  expect(searched.matchingBeforeClass).toBe(1)
  expect(searched.classCounts.SCIENCE).toBe(1)
  expect(searched.classCounts.SKILL ?? 0).toBe(0)
})

it("filters recorded crystals by category and keeps category counts consistent with name and star filters", async () => {
  const all = await loadCrystalCatalog({ scope: "all", rarity: "7" })
  expect(all.categories.reduce((sum, category) => sum + category.count, 0)).toBe(all.total)
  const modes = await loadCrystalCatalog({ scope: "all", rarity: "7", category: "modes" })
  expect(modes.families.length).toBeGreaterThan(0)
  expect(modes.families.every(family => family.category === "modes")).toBe(true)
  expect(modes.total).toBe(all.categories.find(category => category.id === "modes")?.count)
  const searched = await loadCrystalCatalog({ scope: "all", rarity: "7", q: "loyalty", category: "modes" })
  expect(searched.total).toBe(1)
  expect(searched.categories.reduce((sum, category) => sum + category.count, 0)).toBe(1)
  // Only the initial all-category page has visible single-champion previews.
  expect(findMany).toHaveBeenCalledTimes(1)
})

it("normalizes category URLs while retaining direct category links and safe fallbacks", async () => {
  expect((await loadCrystalCatalog({ category: "classes", rarity: "7" })).category).toBe("classes")
  expect((await loadCrystalCatalog({ scope: "main", category: "classes" })).category).toBe("classes")
  expect((await loadCrystalCatalog({ scope: "all", category: "not-a-category" })).category).toBe("all")
})

it("projects selected seven-star ascension content in All sources without changing normal rarity or acquisition", async () => {
  const result = await loadCrystalFinder({ champion: "magik", rarity: "7", reward: "ascension" })
  expect(result.ascensionAcquisition?.gameId).toBe("magik")
  expect(result.ascensionAcquisition?.paths.map(path => path.rarity)).toEqual([7])
  expect(result.ascensionAcquisition?.routes.every(route => route.gameId === "magik" && route.rarity === 7)).toBe(true)
  expect(result.ascensionAcquisition?.routes.length).toBeGreaterThan(0)
  for (const rarity of [undefined, "7"]) {
    const normal = await loadCrystalFinder({ champion: "magik", rarity })
    expect(normal.rarity).toBe(rarity ?? "")
    expect(normal.reward).toBe("all")
    expect(normal.ascensionAcquisition).toEqual({ ...result.ascensionAcquisition, evaluatedAsOf: expect.any(String) })
    expect(normal.ascensionObservedAt).toBe(result.ascensionObservedAt)
    expect(normal.championOptions.map(row => row.id)).toContain("hulk")
  }
  for (const rarity of ["1", "2", "3", "4", "5", "6"]) {
    const normal = await loadCrystalFinder({ champion: "magik", rarity })
    expect(normal.rarity).toBe(rarity)
    expect(normal.ascensionAcquisition).toBeNull()
    expect(normal.ascensionSources).toEqual([])
  }
  expect((await loadCrystalFinder({ reward: "ascension" })).ascensionAcquisition).toBeNull()
  expect((await loadCrystalFinder({})).ascensionAcquisition).toBeNull()
  expect((await loadCrystalFinder({ champion: "hulk" })).ascensionAcquisition).toBeNull()
})

it("keeps all exact seven-star bindings independent of normal acquisition pagination", async () => {
  const exact = getChampionCrystalAscensionSources("adamwarlock", 7)
  expect(exact.crystals.length).toBeGreaterThan(24)
  for (const page of ["1", "2"]) {
    const data = await loadCrystalFinder({ champion: "adamwarlock", page })
    expect(data.ascensionSources).toEqual(exact.crystals)
    expect(data.ascensionCount).toBe(exact.crystals.length)
    expect(data.ascensionObservedAt).toBe(exact.observedAt)
    expect(data.mainCount + data.otherCount).toBeGreaterThan(0)
  }
  const focus = await loadCrystalFinder({ champion: "adamwarlock", reward: "ascension", page: "2" })
  expect(focus.page).toBe(2)
  expect(focus.ascensionCount).toBe(exact.crystals.length)
  expect(focus.ascensionSources).toEqual(exact.crystals.slice(24))
})
