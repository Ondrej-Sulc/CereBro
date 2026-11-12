import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { expandedNodeIndex, expandedNodePortraits, getExpandedNodeModifier } from "@/lib/expanded-node-modifiers"
import { ExpandedNodeDetailView } from "../expanded-detail-view"
import { getNodeLocations } from "@cerebro/core/data/game-discovery"
import { DiscoveryLocations } from "@/components/discovery/discovery-locations"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const definition = expandedNodeIndex.records.find(d => d.id === id)
  return { title: definition ? `${definition.name} | Node modifiers | CereBro` : "Node modifier not found | CereBro" }
}
export default async function NodeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  const detail = await getExpandedNodeModifier(id)
  if (!detail) notFound()
  const search = await searchParams
  const value = (key: string) => typeof search?.[key] === "string" ? search[key] : ""
  const locations = <DiscoveryLocations rows={getNodeLocations(id)} base={`/nodes/${encodeURIComponent(id)}`} filters={{ q: value("q").slice(0,180), section: value("section"), page: value("page") || value("usesPage") }}/>
  return <ExpandedNodeDetailView index={expandedNodeIndex} detail={detail} portraits={expandedNodePortraits} locations={locations} />
}
