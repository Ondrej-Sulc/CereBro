import { notFound, redirect } from "next/navigation"
import { loadChampionDetails } from "../../champion-details-loader"
import { ChampionPrototype } from "./prototype-client"

const CONCEPTS = ["dossier", "war-room", "field-guide", "matrix", "vault"] as const

type PageProps = {
  params: Promise<{ slug: string; concept: string }>
}

export default async function ChampionPrototypePage({ params }: PageProps) {
  if (process.env.NODE_ENV !== "development") notFound()
  const { slug, concept } = await params
  if (!CONCEPTS.includes(concept as (typeof CONCEPTS)[number])) notFound()
  if (concept === "dossier") redirect(`/champions/${slug}`)

  const data = await loadChampionDetails(slug)
  if (!data) notFound()

  return (
    <ChampionPrototype
      concept={concept as (typeof CONCEPTS)[number]}
      champion={data.champion}
      glossaryTerms={data.glossaryTerms}
      maxStatsByTier={data.maxStatsByTier}
    />
  )
}
