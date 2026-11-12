import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { getPublicCuratedModifiers } from "@/lib/public-node-modifiers"
import { expandedNodeIndex } from "@/lib/expanded-node-modifiers"
import { verifyCuratedAssociations } from "@cerebro/core/domain/node-modifiers/public-catalog"
import associations from "@cerebro/core/data/game-node-modifiers/curated-associations.json"
import { CuratedNodeDetailView } from "../../public-catalog-view"
import styles from "../../nodes.module.css"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Node modifier | CereBro" }
export default async function CuratedModifierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  let records: Awaited<ReturnType<typeof getPublicCuratedModifiers>>
  try { records = await getPublicCuratedModifiers() } catch {
    return <div className={styles.page}><h1>Modifier temporarily unavailable</h1><p>Please try again later.</p><Link className={styles.back} href="/nodes">Back to node modifiers</Link></div>
  }
  const modifier = records.find(row => row.id === id)
  if (!modifier) notFound()
  const verified = verifyCuratedAssociations(records, expandedNodeIndex.records, associations.bindings).filter(binding => binding.curatedId === id && binding.status === "verified").map(binding => ({ ...binding, name: expandedNodeIndex.records.find(row => row.id === binding.effectId)!.name }))
  return <CuratedNodeDetailView modifier={modifier} verified={verified} />
}
