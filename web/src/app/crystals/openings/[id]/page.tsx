import { notFound, permanentRedirect } from "next/navigation"
import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { crystalHref } from "@/lib/crystal-navigation"
import type { CrystalSearchParams } from "@/lib/data/crystals"

export default async function LegacyCrystalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<CrystalSearchParams> }) {
  const [{ id }, filters] = await Promise.all([params, searchParams])
  if (!getCrystalOpening(id)) notFound()
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value
  permanentRedirect(crystalHref(id, { rarity: first(filters.rarity), q: first(filters.q), championClass: first(filters.class), returnTo: first(filters.returnTo) }))
}
