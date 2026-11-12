import type { Metadata } from "next"
import { expandedNodeIndex } from "@/lib/expanded-node-modifiers"
import { getPublicCuratedModifiers } from "@/lib/public-node-modifiers"
import { PublicNodeCatalogView } from "./public-catalog-view"

export const metadata: Metadata = { title: "Node modifiers | CereBro", description: "Find node effects, values, conditions and quest locations." }
export const dynamic = "force-dynamic"
type SearchParams = Record<string, string | string[] | undefined>
export default async function NodesPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const value = (key: string) => typeof params[key] === "string" ? params[key] as string : undefined
  let curated: Awaited<ReturnType<typeof getPublicCuratedModifiers>> = [], curatedUnavailable = false
  try { curated = await getPublicCuratedModifiers() } catch { curatedUnavailable = true }
  return <PublicNodeCatalogView curated={curated} game={expandedNodeIndex.records} curatedUnavailable={curatedUnavailable}
    filters={{ q: value("q"), catalog: value("catalog"), page: value("page"), source: value("source"), target: value("target") }} />
}
