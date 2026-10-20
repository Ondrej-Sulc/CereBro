import { notFound } from "next/navigation"
import { Metadata } from "next"
import { Suspense } from "react"
import { ChampionDetailsClient } from "./champion-details-client"
import { getChampionMetadata, loadChampionDetails } from "./champion-details-loader"

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const champion = await getChampionMetadata(slug)

  if (!champion) return { title: "Champion Not Found | CereBro" }

  return {
    title: `${champion.name} | CereBro`,
    description: `Champion details, abilities, tags, and game stats for ${champion.name}.`,
  }
}

export default async function ChampionDetailsPage({ params }: PageProps) {
  const { slug } = await params
  const data = await loadChampionDetails(slug)

  if (!data) notFound()
  const { champion, glossaryTerms, maxStatsByTier } = data
  return (
    <Suspense><ChampionDetailsClient
      key={champion.id}
      champion={champion}
      glossaryTerms={glossaryTerms}
      maxStatsByTier={maxStatsByTier}
    /></Suspense>
  )
}
