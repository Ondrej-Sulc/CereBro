import type { Metadata } from "next"
import { loadCrystalCatalog, type CrystalSearchParams } from "@/lib/data/crystals"
import { CrystalCatalogView } from "./crystal-views"

export const metadata: Metadata = { title: "Crystals | CereBro", description: "Explore recorded MCOC crystals, champion pools, materials and opening rewards." }
export default async function CrystalsPage({ searchParams }: { searchParams: Promise<CrystalSearchParams> }) {
  return <CrystalCatalogView data={await loadCrystalCatalog(await searchParams)} />
}
