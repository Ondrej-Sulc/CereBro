import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { loadCrystalFinder, type CrystalSearchParams } from "@/lib/data/crystals"
import { CrystalChampionFinder } from "../crystal-champion-finder"

export const metadata: Metadata = { title: "Find a champion | CereBro", description: "Find MCOC champion crystal pools, ascension bonuses, champion tokens and other recorded acquisition sources at an exact star level." }
export default async function CrystalChampionFinderPage({ searchParams }: { searchParams: Promise<CrystalSearchParams> }) {
  const params = await searchParams
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value
  if (first(params.reward) === "ascension" && first(params.rarity) !== "7") {
    // Migrate the focus without changing explicit/legacy identity or return context.
    const query = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      const item = first(value)
      if (item !== undefined) query.set(key, item)
    }
    query.set("rarity", "7")
    redirect(`/crystals/champions?${query}`)
  }
  return <CrystalChampionFinder data={await loadCrystalFinder(params)} />
}
