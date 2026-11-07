import { parseCrystalReturnTo } from "@/lib/crystal-browse-return"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCrystalDetails } from "@cerebro/core/data/game-crystals"
import { getCrystalOpening } from "@cerebro/core/data/game-crystal-openings"
import { loadCrystalDetails, type CrystalSearchParams } from "@/lib/data/crystals"
import { loadCrystalOpening } from "@/lib/data/crystal-openings"
import { CrystalDetailView } from "../crystal-views"
import { CrystalOpeningDetail } from "../crystal-opening-detail"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = (await params).id
  const data = getCrystalOpening(id) ?? getCrystalDetails(id)
  return { title: data ? `${data.name} | CereBro` : "Crystal not found | CereBro" }
}
export default async function CrystalPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<CrystalSearchParams> }) {
  const [{ id }, filters] = await Promise.all([params, searchParams])
  const data = await loadCrystalDetails(id, filters)
  if (!data) {
    const opening = loadCrystalOpening(id)
    if (!opening) notFound()
    return <CrystalOpeningDetail data={opening} returnTo={parseCrystalReturnTo(filters.returnTo)} />
  }
  return <CrystalDetailView data={data} />
}
