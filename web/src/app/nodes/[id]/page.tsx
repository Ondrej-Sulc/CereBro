import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { expandedNodeIndex, expandedNodePortraits, getExpandedNodeModifier } from "@/lib/expanded-node-modifiers"
import { ExpandedNodeDetailView } from "../expanded-detail-view"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const definition = expandedNodeIndex.records.find(d => d.id === id)
  return { title: definition ? `${definition.name} | Node modifiers | CereBro` : "Node modifier not found | CereBro" }
}
export default async function NodeDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params
  const detail = await getExpandedNodeModifier(id)
  if (!detail) notFound()
  const search = await searchParams, requested = Number(search?.usesPage)
  return <ExpandedNodeDetailView index={expandedNodeIndex} detail={detail} portraits={expandedNodePortraits} page={Number.isSafeInteger(requested) ? Math.max(1, requested) : 1} />
}
