import { crystalCatalogCategory } from "./crystal-catalog-state"

const base = "https://cerebro.invalid"
const fields = new Set(["q", "rarity", "category", "reward", "sort", "availability", "page", "champion", "left", "right", "section", "tab", "class"])
const storageKey = "cerebro:crystal-browse-return:v1"
type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">

/** Only public browsing destinations; never an external redirect or an account/API URL. */
export function parseCrystalReturnTo(input?: string | string[] | null): string | null {
  const value = Array.isArray(input) ? input[0] : input
  if (!value || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f]/.test(value)) return null
  try {
    const url = new URL(value, base)
    if (url.origin !== base || !/^\/(?:crystals(?:\/(?:champions|compare))?|champions\/[a-z0-9-]+)$/i.test(url.pathname)) return null
    const query = new URLSearchParams()
    for (const key of [...fields].sort()) {
      const item = key === "category" && url.pathname === "/crystals"
        ? crystalCatalogCategory(url.searchParams.get("category"), url.searchParams.get("scope")) : url.searchParams.get(key)?.trim()
      if (!item || item === "all" && ["category", "reward", "availability", "section", "class"].includes(key) ||
        key === "sort" && item === "recommended" || key === "page" && Number(item) === 1) continue
      query.set(key, item)
    }
    if (url.pathname === "/crystals/champions" && query.get("reward") === "ascension") query.set("rarity", "7")
    query.sort()
    return `${url.pathname}${query.size ? `?${query}` : ""}`
  } catch { return null }
}

export function withCrystalReturnTo(href: string, returnTo?: string | null): string {
  const origin = parseCrystalReturnTo(returnTo)
  if (!origin) return href
  try {
    const target = new URL(href, base)
    if (target.origin !== base || !/^\/crystals\/[^/]+$/.test(target.pathname) || ["/crystals/champions", "/crystals/compare", "/crystals/openings"].includes(target.pathname)) return href
    target.searchParams.set("returnTo", origin)
    return `${target.pathname}${target.search}${target.hash}`
  } catch { return href }
}

export function crystalBrowseReturnLabel(returnTo?: string | null): string {
  const path = parseCrystalReturnTo(returnTo)?.split("?")[0]
  return path === "/crystals/champions" ? "Back to champion search" : path === "/crystals/compare" ? "Back to comparison"
    : path?.startsWith("/champions/") ? "Back to champion" : "Browse crystals"
}

export function saveCrystalBrowseScroll(returnTo: string, y: number, storage: Storage, now = Date.now()) {
  const url = parseCrystalReturnTo(returnTo)
  if (!url || !Number.isFinite(y) || y < 0 || y > 10000000) return
  try { storage.setItem(storageKey, JSON.stringify({ url, y: Math.round(y), savedAt: now })) } catch { /* Optional when browser storage is unavailable. */ }
}

export function consumeCrystalBrowseScroll(returnTo: string, storage: Storage, now = Date.now()): number | null {
  try {
    const value: unknown = JSON.parse(storage.getItem(storageKey) ?? "null")
    if (!value || typeof value !== "object" || !("url" in value) || !("y" in value) || !("savedAt" in value)) return null
    if (typeof value.savedAt !== "number" || now - value.savedAt < 0 || now - value.savedAt > 1800000) { storage.removeItem(storageKey); return null }
    const expected = parseCrystalReturnTo(returnTo)
    if (!expected || typeof value.url !== "string" || parseCrystalReturnTo(value.url) !== expected || typeof value.y !== "number" || !Number.isFinite(value.y) || value.y < 0 || value.y > 10000000) return null
    storage.removeItem(storageKey)
    return value.y
  } catch { return null }
}
