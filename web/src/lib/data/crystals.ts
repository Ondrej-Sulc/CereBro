import { unstable_cache } from "next/cache"
import { ChampionClass } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { getCrystalFamilies, getCrystalDetails, getCrystalChampions, getChampionCrystals, getCrystalPresentation, crystalCatalogSource } from "@cerebro/core/data/game-crystals"
import { getChampionImageUrlOrPlaceholder } from "@/lib/championHelper"
import { isChampionImages } from "@/lib/championHelper"
import { CRYSTAL_CATEGORIES, crystalEditionLabel, isCrystalCategoryId } from "@cerebro/core/domain/crystal-categories"
import { loadCrystalPageRewards, resolveCrystalPageOpening } from "./crystal-page-rewards"
import { crystalBrowseOpeningSummary, getCrystalBrowseEntries } from "./crystal-browse-catalog"
import { filterCrystalPool } from "../crystal-pool"
import { CRYSTAL_REWARD_FILTERS, crystalRewardFilterUsesChampionStars } from "../crystal-reward-filters"
import { crystalOpeningsSource, getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { getCrystalAvailability, getCrystalAvailabilityReview, isCrystalAcquisitionSource } from "@cerebro/core/data/game-crystals/availability"
import { compareCrystalStars, compareCrystalsNewestFirst } from "@cerebro/core/domain/crystal-chronology"
import { CRYSTAL_AVAILABILITY_FILTERS, crystalAvailabilityFilter } from "@cerebro/core/domain/crystal-availability"
import { getChampionAcquisition } from "@cerebro/core/data/champion-acquisition"
import { groupCrystalEditions } from "../crystal-browse-groups"
import logger from "../logger"
import { parseCrystalReturnTo } from "../crystal-browse-return"
import { crystalCatalogCategory } from "../crystal-catalog-state"
import { projectCrystalCatalogArtwork } from "../crystal-catalog-artwork"
import { projectCrystalFinderArtwork } from "./crystal-finder-artwork"
import { getChampionCrystalAscensionChampions, getChampionCrystalAscensionSources } from "./champion-crystal-ascension"
import { getChampionAscensionAcquisitionSources } from "./champion-ascension-acquisition"
import { ascensionCatalogSource, listChampionAscensionEligibility } from "@cerebro/core/data/game-ascension"
import { hasRecordedAscensionPath } from "@cerebro/core/domain/champion-ascension-eligibility"

export type CrystalSearchParams = {
  returnTo?: string | string[]
  q?: string | string[]
  rarity?: string | string[]
  /** Legacy scope=main links select the Main pools category. */
  scope?: string | string[]
  category?: string | string[]
  sort?: string | string[]
  reward?: string | string[]
  availability?: string | string[]
  /** Legacy exact-opening selection, validated within the displayed family. */
  variant?: string | string[]
  class?: string | string[]
  page?: string | string[]
  left?: string | string[]
  right?: string | string[]
  section?: string | string[]
  champion?: string | string[]
}
export type CrystalChampion = { gameId: string; name: string; slug: string | null; championClass: ChampionClass | null; portraitUrl: string | null; rarities: number[]; obtainable: string[]; firstEditionRarities?: number[]; firstEditionSources?: string[] }
const PAGE_SIZE = 48
const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value
const normalize = (value: string) => value.normalize("NFKD").toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "")
const queryText = (value?: string) => (value ?? "").trim().slice(0, 100)
const star = (value?: string) => value && /^[1-7]$/.test(value) ? value : ""
const paginate = <T,>(rows: T[], requested?: string, pageSize = PAGE_SIZE) => {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  const page = requested && /^\d{1,9}$/.test(requested) ? Math.max(1, Math.min(pages, Number(requested))) : 1
  return { rows: rows.slice((page - 1) * pageSize, page * pageSize), page, pages, total: rows.length, pageSize }
}

const championIndex = unstable_cache(async () => prisma.champion.findMany({
  where: { gameId: { not: null }, isPlayable: true }, select: { gameId: true, name: true, slug: true, class: true, images: true, obtainable: true },
}), ["crystal-champion-identities-v2"], { revalidate: 3600, tags: ["champion-details"] })

export async function loadCrystalCatalog(params: CrystalSearchParams) {
  const category = crystalCatalogCategory(first(params.category), first(params.scope))
  const reward = CRYSTAL_REWARD_FILTERS.find(filter => filter.id === first(params.reward))?.id ?? "all"
  const q = queryText(first(params.q)), rarity = crystalRewardFilterUsesChampionStars(reward) ? star(first(params.rarity)) : ""
  const sort = first(params.sort) === "name" ? "name" : first(params.sort) === "newest" ? "newest" : "recommended"
  const availability = crystalAvailabilityFilter(first(params.availability))
  const asOf = new Date().toISOString().slice(0, 10)
  const all = getCrystalBrowseEntries(sort)
  const heroArtwork = projectCrystalCatalogArtwork(getCrystalPresentation)
  const query = normalize(q)
  const matching = all.filter(family => (reward === "ascension" ? family.ascensionSourceIds.length > 0 : reward === "all" || family.rewardKind === reward) && (!rarity || family.rarities.includes(Number(rarity)))
    && (reward === "ascension" || !query || [family.name, ...family.variants.flatMap(variant => [variant.name, ...variant.sourceIds]), crystalEditionLabel(family.variants.flatMap(variant => variant.sourceIds), family.category) ?? ""].some(name => normalize(name).includes(query))))
  // Availability belongs to an exact opening. If a matching family contains
  // several states, link the card to the opening that actually matched.
  const decorated = matching.map(family => {
    const ids = reward === "ascension" ? family.ascensionSourceIds : [...new Set([family.id, ...family.variants.flatMap(variant => variant.sourceIds)])]
    const statuses = ids.flatMap(id => {
      const exact = reward === "ascension" ? getCrystalOpening(id) : null
      const variant = family.variants.find(variant => variant.sourceIds.includes(id))
      const sourceCategory = exact ? getCrystalPresentation(id)?.category ?? variant?.category ?? family.category : family.category
      if (exact && query && ![exact.name, id, crystalEditionLabel([id], sourceCategory) ?? ""].some(name => normalize(name).includes(query))) return []
      return [{ id, category: sourceCategory, availability: getCrystalAvailability(id, asOf) }]
    })
    return { family, statuses }
  })
  const availabilityFilters = CRYSTAL_AVAILABILITY_FILTERS.map(filter => ({ ...filter, count: decorated.filter(item => item.statuses.some(source => (category === "all" || source.category === category) && (filter.id === "all" || source.availability.status === filter.id))).length }))
  const available = decorated.flatMap(({ family, statuses }) => {
    const candidates = statuses.filter(source => availability === "all" || source.availability.status === availability)
    const inCategory = candidates.filter(source => category === "all" || source.category === category)
    const selected = inCategory.find(source => source.id === family.id) ?? inCategory[0] ?? candidates.find(source => source.id === family.id) ?? candidates[0]
    if (!selected) return []
    const exact = reward === "ascension" ? getCrystalOpening(selected.id) : null
    const summary = exact ? crystalBrowseOpeningSummary(exact) : null
    const variant = family.variants.find(variant => variant.sourceIds.includes(selected.id))
    return [{ ...family, ...(exact && summary ? { ...summary, name: exact.name, category: selected.category,
      artworkUrl: getCrystalPresentation(exact.id)?.artworkUrl ?? null, availabilityReview: getCrystalAvailabilityReview([exact.id]),
      ascensionSourceIds: [exact.id], variants: variant ? [{ ...variant, id: exact.id, name: exact.name, category: selected.category,
        sourceIds: [exact.id], selection: exact.selection ?? null, rarities: summary.rarities }] : [] } : {}),
      availability: selected.availability, availabilitySourceId: selected.id }]
  })
  // The seven-star card represents its matched opening, so ordering must use
  // that opening's name, star range and edition too.
  if (reward === "ascension") available.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en")
    : (sort === "recommended" ? compareCrystalStars(a, b) : 0) || compareCrystalsNewestFirst(
      { ...a, sourceIds: [a.availabilitySourceId] }, { ...b, sourceIds: [b.availabilitySourceId] }))
  const browseEntries = groupCrystalEditions(available)
  const categories = CRYSTAL_CATEGORIES.map(group => ({ ...group, count: reward === "ascension"
    ? decorated.filter(item => item.statuses.some(source => source.category === group.id && (availability === "all" || source.availability.status === availability))).length
    : browseEntries.filter(family => family.category === group.id).length }))
  const filtered = browseEntries.filter(family => category === "all" || family.category === category)
  if (sort === "recommended" && category === "all" && reward === "all") filtered.sort((a, b) => Number(b.isMainPool) - Number(a.isMainPool))
  const crystalCount = available.filter(family => category === "all" || family.category === category).length
  const result = paginate(filtered, first(params.page))
  const previewSources = result.rows.map(family => family.editionGroup ? family.editionGroup.singleChampion : family.singleChampion)
  const previewRecords = new Map((previewSources.some(Boolean) ? await championIndex().catch(() => {
    logger.warn("Champion portrait metadata unavailable for crystal previews")
    return []
  }) : []).flatMap(champion => champion.gameId ? [[champion.gameId, champion] as const] : []))
  const families = result.rows.map((family, index) => {
    const source = previewSources[index]
    const record = source ? previewRecords.get(source.gameId) : null
    const championPreview = source ? { gameId: source.gameId, name: record?.name ?? source.name,
      portraitUrl: record && isChampionImages(record.images) ? getChampionImageUrlOrPlaceholder(record.images, "64") : null } : null
    return { ...family, championPreview }
  })
  const groups = categories.flatMap(group => {
    const members = families.filter(family => family.category === group.id)
    return members.length ? [{ ...group, families: members }] : []
  })
  return { ...result, rows: families, families, groups, categories, category, crystalCount, matchingCount: browseEntries.length, q, rarity, sort, reward, availability, availabilityFilters, availabilityAsOf: asOf, observedAt: crystalOpeningsSource.observedAt, heroArtwork }
}

export async function loadCrystalDetails(id: string, params: CrystalSearchParams) {
  const details = getCrystalDetails(id)
  if (!details) return null
  const selectedOpeningId = resolveCrystalPageOpening(details, id, first(params.variant))
  const opening = selectedOpeningId ? loadCrystalPageRewards(selectedOpeningId) : null
  const contents = opening?.champions ?? details.contents.map(reward => ({ ...reward, firstEditionRarities: reward.cosmeticRewards?.filter(item => item.cosmeticId === "first_edition").map(item => item.rarity) ?? [] }))
  const counts: Record<string, number> = {}
  for (const champion of contents) for (const rarity of champion.rarities) counts[rarity] = (counts[rarity] ?? 0) + 1
  const rarities = Object.keys(counts).map(Number).sort((a, b) => b - a)
  const artworkVariant = details.variants.find(v => v.sourceIds.includes(details.id)) ?? details.variants[0]
  const requested = star(first(params.rarity))
  const rarity = requested && rarities.includes(Number(requested)) ? requested : rarities.length === 1 ? String(rarities[0]) : ""
  const q = queryText(first(params.q))
  const championClass = Object.values(ChampionClass).find(value => value === first(params.class)) ?? "all"
  const records = new Map((await championIndex()).flatMap(champion => champion.gameId ? [[champion.gameId, champion] as const] : []))
  const all: CrystalChampion[] = contents.map(reward => {
    const champion = records.get(reward.championId)
    const firstEditionRarities = [...new Set(reward.firstEditionRarities)].sort((a, b) => b - a)
    return { gameId: reward.championId, name: champion?.name ?? reward.sourceName ?? reward.championId,
      slug: champion?.slug ?? null, championClass: champion?.class ?? null,
      portraitUrl: champion && isChampionImages(champion.images) ? getChampionImageUrlOrPlaceholder(champion.images, "64") : null,
      rarities: reward.rarities, obtainable: champion?.obtainable ?? [], ...(firstEditionRarities.length ? { firstEditionRarities } : {}) }
  }).sort((a, b) => a.name.localeCompare(b.name, "en") || a.gameId.localeCompare(b.gameId, "en"))
  const projection = filterCrystalPool(all, { rarity, q, championClass })
  const filtered = projection.champions
  // Portraits let the entire pool fit in one view. Legacy page links still show the full pool.
  const result = { rows: filtered, page: 1, pages: 1, total: filtered.length, pageSize: Math.max(1, filtered.length) }
  return { ...details, returnTo: parseCrystalReturnTo(params.returnTo), availability: getCrystalAvailability(selectedOpeningId ?? id), contents: undefined, ...result, champions: result.rows, opening, rarities, championCount: contents.length, championCountsByRarity: counts, bannerArtworkUrl: artworkVariant.bannerArtworkUrl ?? null, rarity, championClass, q,
    observedAt: opening?.observedAt ?? crystalCatalogSource.observedAt, classes: [...new Set(all.flatMap(c => c.championClass ? [c.championClass] : []))].sort(),
    poolChampions: all, classCounts: projection.classCounts, matchingBeforeClass: projection.matchingBeforeClass }
}

export function searchCrystalOptions(params: CrystalSearchParams) {
  const q = queryText(first(params.q)), rarity = star(first(params.rarity))
  const matching = getCrystalFamilies().filter(family => family.variants.some(variant => variant.sourceIds.some(isCrystalAcquisitionSource)) && (q || family.isMainPool)
    && (!rarity || family.rarities.includes(Number(rarity)))
    && [family.name, ...family.variants.map(variant => variant.name), crystalEditionLabel(family.variants.flatMap(variant => variant.sourceIds), family.category) ?? ""].some(name => normalize(name).includes(normalize(q))))
  return { total: matching.length, options: matching.slice(0, 20).map(({ id, name, artworkUrl, rarities, isMainPool, championCount, championCountsByRarity }) => ({ id, name, artworkUrl, rarities, isMainPool, championCount, championCountsByRarity })) }
}

export async function loadCrystalComparison(params: CrystalSearchParams) {
  const leftId = (first(params.left) ?? "7_star_hero_shard_crystal").trim().slice(0, 512)
  const defaultRight = getCrystalDetails(leftId)?.id === "7_star_titan_hero_shard_crystal" ? "7_star_hero_shard_crystal" : "7_star_titan_hero_shard_crystal"
  const rightId = (first(params.right) ?? defaultRight).trim().slice(0, 512)
  const [leftData, rightData] = await Promise.all([loadCrystalDetails(leftId, {}), loadCrystalDetails(rightId, {})])
  const rarities = [...new Set([...(leftData?.rarities ?? []), ...(rightData?.rarities ?? [])])].sort((a, b) => b - a)
  const common = leftData?.rarities.filter(value => rightData?.rarities.includes(value)) ?? []
  const requested = star(first(params.rarity))
  const rarity = requested && rarities.includes(Number(requested)) ? requested : String(Math.max(...(common.length ? common : rarities.length ? rarities : [7])))
  const atStar = (champions: CrystalChampion[]) => champions.filter(champion => champion.rarities.includes(Number(rarity))).map(champion => ({ ...champion, firstEditionRarities: champion.firstEditionRarities?.filter(value => value === Number(rarity)) }))
  const leftChampions = atStar(leftData?.champions ?? []), rightChampions = atStar(rightData?.champions ?? [])
  const leftIds = new Set(leftChampions.map(champion => champion.gameId)), rightById = new Map(rightChampions.map(champion => [champion.gameId, champion]))
  const ready = !!leftData && !!rightData
  const groups = [
    { id: "left" as const, champions: ready ? leftChampions.filter(champion => !rightById.has(champion.gameId)) : [] },
    { id: "shared" as const, champions: ready ? leftChampions.filter(champion => rightById.has(champion.gameId)).map(champion => ({ ...champion, firstEditionRarities: [...new Set([...(champion.firstEditionRarities ?? []), ...(rightById.get(champion.gameId)?.firstEditionRarities ?? [])])], firstEditionSources: [...new Set([...(champion.firstEditionRarities?.length ? [leftData!.name] : []), ...(rightById.get(champion.gameId)?.firstEditionRarities?.length ? [rightData!.name] : [])])] })) : [] },
    { id: "right" as const, champions: ready ? rightChampions.filter(champion => !leftIds.has(champion.gameId)) : [] },
  ]
  const q = queryText(first(params.q)), section = groups.some(group => group.id === first(params.section)) ? first(params.section)! : "all"
  const summary = (data: typeof leftData, championCount: number) => data ? { id: data.id, name: data.name, artworkUrl: data.artworkUrl, bannerArtworkUrl: data.bannerArtworkUrl, rarities: data.rarities, isMainPool: data.isMainPool, championCount, availabilityReview: data.availabilityReview, observedAt: data.observedAt } : null
  const observedDates = [...new Set([leftData?.observedAt, rightData?.observedAt].filter((value): value is string => Boolean(value)))]
  return { left: summary(leftData, leftChampions.length), right: summary(rightData, rightChampions.length), leftId: leftData?.id ?? leftId, rightId: rightData?.id ?? rightId,
    rarity, rarities, q, section, page: 1, ready, observedAt: observedDates.length === 1 ? observedDates[0] : null,
    counts: { left: groups[0].champions.length, shared: groups[1].champions.length, right: groups[2].champions.length },
    groups: groups.map(group => ({ ...group, champions: group.champions.filter(champion => normalize(champion.name).includes(normalize(q))) })) }
}

export async function loadCrystalFinder(params: CrystalSearchParams) {
  const reward = first(params.reward) === "ascension" ? "ascension" : "all"
  const q = queryText(first(params.q)), rarity = reward === "ascension" ? "7" : star(first(params.rarity)), requestedId = queryText(first(params.champion))
  const records = new Map((await championIndex()).flatMap(champion => champion.gameId ? [[champion.gameId, champion] as const] : []))
  const crystalChampions = new Map(getCrystalChampions().map(champion => [champion.gameId, champion]))
  for (const champion of getChampionCrystalAscensionChampions()) {
    const previous = crystalChampions.get(champion.gameId)
    crystalChampions.set(champion.gameId, { ...champion, name: previous?.name ?? champion.name,
      rarities: [...new Set([...(previous?.rarities ?? []), ...champion.rarities])] })
  }
  const eligibility = new Map(listChampionAscensionEligibility().map(champion => [champion.gameId, champion]))
  const ids = new Set([...crystalChampions.keys(), ...records.keys(), ...eligibility.keys()])
  const champions = [...ids].map(gameId => {
    const recorded = eligibility.get(gameId)
    const source = crystalChampions.get(gameId) ?? { gameId, name: records.get(gameId)?.name ?? recorded!.name, rarities: [] }
    const record = records.get(source.gameId)
    const rarities = [...new Set([...source.rarities, ...(record?.obtainable ?? []).filter(value => /^[1-7]$/.test(value)).map(Number)])].sort((a, b) => b - a)
    return { ...source, rarities, ascendableRarities: recorded?.ascendableRarities ?? [], recordedRarities: recorded?.recordedRarities ?? [], sourceName: source.name, name: record?.name ?? source.name, slug: record?.slug ?? null, championClass: record?.class ?? null,
      profileHref: record?.slug ? `/champions/${encodeURIComponent(record.slug)}${rarity && record.obtainable.includes(rarity) ? `?rarity=${rarity}` : ""}` : null,
      portraitUrl: record && isChampionImages(record.images) ? getChampionImageUrlOrPlaceholder(record.images, "64") : null }
  }).sort((a, b) => a.name.localeCompare(b.name, "en") || a.gameId.localeCompare(b.gameId, "en"))
  const nameMatches = q ? champions.filter(champion => [champion.name, champion.sourceName, champion.gameId].some(name => normalize(name).includes(normalize(q)))) : []
  // Preserve a unique legacy identity even outside the filter; never silently substitute it.
  const selected = requestedId ? champions.find(champion => champion.gameId === requestedId) ?? null : nameMatches.length === 1 ? nameMatches[0] : null
  const matching = nameMatches.filter(champion => reward !== "ascension" || hasRecordedAscensionPath(champion, rarity ? Number(rarity) : undefined))
  const heroArtwork = projectCrystalFinderArtwork(records, selected?.gameId, rarity)
  const acquisition = selected ? getChampionAcquisition(selected.gameId) : null
  if (acquisition && rarity) acquisition.methods = acquisition.methods.filter(method => method.rarities.includes(Number(rarity)))
  const families = getCrystalFamilies().map(family => ({ ...family, availability: getCrystalAvailability(family.id) }))
  const bySource = new Map(families.flatMap(family => family.variants.flatMap(variant => variant.sourceIds.map(id => [id, family] as const))))
  const matched = new Map<string, Set<number>>()
  for (const crystal of selected ? getChampionCrystals(selected.gameId).crystals : []) {
    const stars = crystal.rarities.filter(value => !rarity || value === Number(rarity))
    if (!stars.length) continue
    for (const sourceId of crystal.sourceIds) {
      const family = bySource.get(sourceId)
      if (!family) continue
      const values = matched.get(family.id) ?? new Set<number>()
      for (const value of stars) values.add(value)
      matched.set(family.id, values)
    }
  }
  const matchingRarities = Object.fromEntries([...matched].map(([id, values]) => [id, [...values].sort((a, b) => b - a)]))
  const main = families.filter(family => family.isMainPool && matched.has(family.id))
  const other = families.filter(family => !family.isMainPool && matched.has(family.id))
  const categoryValue = first(params.category), category = reward !== "ascension" && isCrystalCategoryId(categoryValue) && categoryValue !== "main" ? categoryValue : "all"
  const categories = CRYSTAL_CATEGORIES.filter(group => group.id !== "main").map(group => ({ ...group, count: other.filter(family => family.category === group.id).length }))
  const order = new Map<string, number>(categories.map((group, index) => [group.id, index]))
  const filtered = other.filter(family => category === "all" || family.category === category).sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) || a.name.localeCompare(b.name, "en") || a.id.localeCompare(b.id, "en"))
  const result = paginate(filtered, first(params.page), 24)
  // Normal acquisition keeps its requested stars; discovery adds only a positive 7-star path.
  const includeAscension = selected && (reward === "ascension" || ((!rarity || rarity === "7") && hasRecordedAscensionPath(selected, 7)))
  const ascension = includeAscension ? getChampionCrystalAscensionSources(selected.gameId, 7) : null
  const ascensionAcquisition = includeAscension ? getChampionAscensionAcquisitionSources(selected.gameId, 7) : null
  const ascensionResult = paginate(ascension?.crystals ?? [], first(params.page), 24)
  // All modes/stars share this small server-derived projection so pending navigation
  // can filter immediately against the latest draft without another catalog read.
  const championOptions = champions.map(champion => ({ id: champion.gameId, name: champion.name, class: champion.championClass ?? undefined, portraitUrl: champion.portraitUrl,
    ascendableRarities: champion.ascendableRarities, recordedRarities: champion.recordedRarities }))
  return { ...(reward === "ascension" ? ascensionResult : result), q, rarity, reward, championId: requestedId, selected, unresolvedChampion: !!requestedId && !selected,
    ascensionSources: reward === "ascension" ? ascensionResult.rows : ascension?.crystals ?? [], ascensionObservedAt: crystalOpeningsSource.observedAt, ascensionCount: ascension?.crystals.length ?? 0, ascensionAcquisition,
    championOptions, ascensionEligibilityObservedAt: ascensionCatalogSource.observedAt, heroArtwork, acquisition, matches: matching.slice(0, 20), totalMatches: matching.length, category, categories, main, mainCount: main.length, other: result.rows, otherCount: other.length, matchingRarities,
    groups: categories.flatMap(group => { const rows = result.rows.filter(family => family.category === group.id); return rows.length ? [{ ...group, families: rows }] : [] }),
    observedAt: reward === "ascension" ? crystalOpeningsSource.observedAt : crystalCatalogSource.observedAt }
}
