import type { Metadata } from "next"
import { loadCrystalComparison, type CrystalSearchParams } from "@/lib/data/crystals"
import { CrystalComparisonView } from "../crystal-comparison"

export const metadata: Metadata = { title: "Compare crystal pools | CereBro", description: "Compare recorded MCOC crystal pools by exact champion star level." }
export default async function CrystalComparisonPage({ searchParams }: { searchParams: Promise<CrystalSearchParams> }) {
  return <CrystalComparisonView data={await loadCrystalComparison(await searchParams)} />
}
