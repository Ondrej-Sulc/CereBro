import { permanentRedirect } from "next/navigation"
import { crystalCatalogHref } from "@/lib/crystal-navigation"
import type { CrystalSearchParams } from "@/lib/data/crystals"
export default async function LegacyCatalogPage({ searchParams }: { searchParams: Promise<CrystalSearchParams> }) {
  const filters = await searchParams
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value
  const requestedPage = first(filters.page)
  permanentRedirect(crystalCatalogHref({ q: first(filters.q), sort: first(filters.sort), category: first(filters.category), rarity: first(filters.rarity), reward: first(filters.reward), availability: first(filters.availability),
    page: requestedPage && /^\d{1,9}$/.test(requestedPage) ? Number(requestedPage) : 1 }))
}
