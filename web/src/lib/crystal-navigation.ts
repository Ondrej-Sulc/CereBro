import { withCrystalReturnTo } from "./crystal-browse-return"
import { crystalCatalogCategory } from "./crystal-catalog-state"

export function crystalHref(id: string, params: { rarity?: string | number; q?: string; championClass?: string; page?: number; returnTo?: string | null } = {}) {
  const search = new URLSearchParams()
  if (params.rarity) search.set("rarity", String(params.rarity))
  if (params.q) search.set("q", params.q)
  if (params.championClass && params.championClass !== "all") search.set("class", params.championClass)
  if (params.page && params.page > 1) search.set("page", String(params.page))
  return withCrystalReturnTo(`/crystals/${encodeURIComponent(id)}${search.size ? `?${search}` : ""}`, params.returnTo)
}

export function crystalCatalogHref(params: { scope?: string; rarity?: string; q?: string; category?: string; reward?: string; sort?: string; availability?: string; page?: number } = {}) {
  const search = new URLSearchParams()
  const category = crystalCatalogCategory(params.category, params.scope)
  if (params.rarity) search.set("rarity", params.rarity)
  if (params.q) search.set("q", params.q)
  if (category !== "all") search.set("category", category)
  if (params.reward && params.reward !== "all") search.set("reward", params.reward)
  if (params.sort === "name" || params.sort === "newest") search.set("sort", params.sort)
  if (params.availability && ["recurring", "current_event", "upcoming", "past_event", "unverified"].includes(params.availability)) search.set("availability", params.availability)
  if (params.page && params.page > 1) search.set("page", String(params.page))
  return `/crystals${search.size ? `?${search}` : ""}`
}

export function crystalComparisonHref(params: { left?: string; right?: string; rarity?: string; q?: string; section?: string } = {}) {
  const search = new URLSearchParams()
  for (const key of ["left", "right", "rarity", "q", "section"] as const) if (params[key] && !(key === "section" && params[key] === "all")) search.set(key, params[key]!)
  return `/crystals/compare${search.size ? `?${search}` : ""}`
}

export function crystalFinderHref(params: { champion?: string; rarity?: string; q?: string; category?: string; reward?: string; page?: number } = {}) {
  const search = new URLSearchParams()
  const normalized = params.reward === "ascension" ? { ...params, rarity: "7" } : params
  for (const key of ["champion", "rarity", "q", "category"] as const) if (normalized[key] && !(key === "category" && normalized[key] === "all")) search.set(key, normalized[key]!)
  if (params.reward === "ascension") search.set("reward", params.reward)
  if (params.page && params.page > 1) search.set("page", String(params.page))
  return `/crystals/champions${search.size ? `?${search}` : ""}`
}
