import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import type { NodeModifierCatalog } from "@cerebro/core/domain/node-modifiers/catalog"
import type { ExpandedModifierDetail, ExpandedModifierIndex } from "@cerebro/core/domain/node-modifiers/expansion"
import type { DefenderArtwork } from "@cerebro/core/data/game-node-modifiers/artwork"
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon"
import { resolvedVariants } from "./node-presentation"
import { WhereItAppears } from "./node-locations"
import styles from "./nodes.module.css"
import type { ReactNode } from "react"

export function ExpandedNodeDetailView({ index, detail, portraits, page = 1, locations }: {
  index: ExpandedModifierIndex; detail: ExpandedModifierDetail; portraits: Record<string, DefenderArtwork>; page?: number; locations?: ReactNode
}) {
  const definition = detail.definition, summary = index.records.find(row => row.id === definition.id)!
  const catalog: NodeModifierCatalog = { schemaVersion: 2, contract: index.contract, contentHash: index.catalogHash, profileHash: index.profileHash, profile: index.profile, definitions: [definition] }
  const variants = resolvedVariants(definition).map(variant => ({ ...variant, text: variant.text && /\{\d+\}/.test(variant.text) ? null : variant.text }))
  const base = `/nodes/${encodeURIComponent(definition.id)}`
  return <div className={`${styles.page} ${styles.detailpage}`}>
    <Link className={styles.back} href="/nodes?catalog=game"><ArrowLeft size={16} aria-hidden="true" />Recorded game definitions</Link>
    <header className={styles.detailhero}><span className={styles.eyebrow}>RECORDED GAME DATA</span><h1><GameNodeModifierIcon iconKey={summary.iconKey} size={28} className={styles.modifierIcon} />{summary.name}</h1></header>
    <div className={styles.variants}>{variants.map((variant, i) => <section className={styles.variant} key={i} data-resolved-variant>
      <h2>{variants.length > 1 ? `Effect variant ${i + 1}` : "Effect"}</h2>
      <p className={styles.resolvedText}>{variant.text || "Resolved wording was not recorded. Original values remain in Source data."}</p>
      {!locations && <WhereItAppears catalog={catalog} definition={definition} variant={variant} projection={detail.projection} portraitBindings={portraits} page={page} pageSize={6} baseHref={base} />}
    </section>)}</div>
    {locations}
    {summary.missing && <p className={styles.notice}>Some effect components were not available in the saved source. Recorded wording is shown without guessing missing values.</p>}
    <details id="source-data" className={styles.sourceData}><summary>Source data</summary>
      <dl><dt>Exact native Buff ID</dt><dd><code>{definition.id}</code></dd><dt>Catalog source revision</dt><dd><code>{index.catalogHash}</code></dd><dt>Definition versions</dt><dd>{definition.versions.length}</dd><dt>Source contexts</dt><dd>{detail.projection.uses.length}</dd></dl>
      <Link className={styles.sourceDownload} href={`${base}/source`} prefetch={false}>Download complete definition, parameters and assignment evidence (JSON)</Link>
      <details className={styles.raw}><summary>Definition templates, exact parameters and version hashes</summary><pre>{JSON.stringify(definition.versions.map(version => ({ hash: version.hash, definitionHash: version.definitionHash, raw: version.raw, componentIds: version.componentIds, components: version.components, missingComponentIds: version.missingComponentIds })), null, 2)}</pre></details>
      <details className={styles.raw}><summary>Assignment evidence preview</summary><p>First 12 source contexts. The complete download preserves every assignment, configured source-side flag, assigned-list side, coordinate and source pointer.</p><pre>{JSON.stringify(detail.projection.uses.slice(0, 12), null, 2)}</pre></details>
    </details>
    <details className={styles.disclosure}><summary>About this recorded definition</summary><p>Saved game {index.profile.gameVersion} definitions from {index.stats.permanentLayouts} permanent layouts and the original historical samples. Locations show native assignments and known defender placements, not live quest availability or activation after removing a source. Curated catalog records remain independent unless an explicit association is verified.</p></details>
  </div>
}
