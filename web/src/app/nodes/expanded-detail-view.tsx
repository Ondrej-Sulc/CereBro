import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { NodeModifierCatalog } from "@cerebro/core/domain/node-modifiers/catalog"
import type { ExpandedModifierDetail, ExpandedModifierIndex } from "@cerebro/core/domain/node-modifiers/expansion"
import type { DefenderArtwork } from "@cerebro/core/data/game-node-modifiers/artwork"
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon"
import { resolvedVariants, publicModifierText } from "./node-presentation"
import { WhereItAppears } from "./node-locations"
import styles from "./nodes.module.css"
import type { ReactNode } from "react"

export function ExpandedNodeDetailView({ index, detail, portraits, page = 1, locations }: {
  index: ExpandedModifierIndex; detail: ExpandedModifierDetail; portraits: Record<string, DefenderArtwork>; page?: number; locations?: ReactNode
}) {
  const definition = detail.definition, summary = index.records.find(row => row.id === definition.id)!
  const catalog: NodeModifierCatalog = { schemaVersion: 2, contract: index.contract, contentHash: index.catalogHash, profileHash: index.profileHash, profile: index.profile, definitions: [definition] }
  const variants = resolvedVariants(definition).map(variant => ({ ...variant, text: publicModifierText(variant.text) }))
  const base = `/nodes/${encodeURIComponent(definition.id)}`
  return <div className={`${styles.page} ${styles.detailpage}`}>
    <Link className={styles.back} href="/nodes?catalog=game"><ArrowLeft size={16} aria-hidden="true" />Game modifiers</Link>
    <header className={styles.detailhero}><span className={styles.eyebrow}>NODE MODIFIER</span><h1><GameNodeModifierIcon iconKey={summary.iconKey} size={28} className={styles.modifierIcon} />{summary.name === definition.id ? "Unnamed modifier" : summary.name}</h1></header>
    <div className={styles.variants}>{variants.map((variant, i) => <section className={styles.variant} key={i} data-resolved-variant>
      <h2>{variants.length > 1 ? `Effect variant ${i + 1}` : "Effect"}</h2>
      <p className={styles.resolvedText}>{variant.text || "Description unavailable for this effect."}</p>
      {!locations && <WhereItAppears catalog={catalog} definition={definition} variant={variant} projection={detail.projection} portraitBindings={portraits} page={page} pageSize={6} baseHref={base} />}
    </section>)}</div>
    {locations}
  </div>
}
