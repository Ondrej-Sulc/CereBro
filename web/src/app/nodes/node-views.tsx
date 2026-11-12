import Link from "next/link"
import { ArrowLeft, ArrowRight, Search } from "lucide-react"
import { browseModifiers, modifierSummary, type ModifierDefinition, type ModifierFilters, type NodeModifierCatalog } from "@cerebro/core/domain/node-modifiers/catalog"
import { modifierIconKey } from "@cerebro/core/data/game-node-modifiers/artwork"
import { NodeModifierIcon } from "@/components/nodes/NodeModifierIcon"
import { resolvedVariants, publicModifierText } from "./node-presentation"
import { modifierQuestSummary, WhereItAppears } from "./node-locations"
import styles from "./nodes.module.css"

function ModifierIcon({ catalog, definition }: { catalog: NodeModifierCatalog; definition: ModifierDefinition }) {
  return <NodeModifierIcon iconKey={modifierIconKey(catalog, definition)} size={28} className={styles.modifierIcon} />
}

export function NodeCatalogView({ catalog, filters }: { catalog: NodeModifierCatalog; filters: ModifierFilters }) {
  const results = browseModifiers(catalog.definitions, { ...filters, binding: undefined })
  return <div className={styles.page}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>GAME REFERENCE</span>
      <h1>Node modifiers</h1>
      <p>Find node effects, values and conditions.</p>
      <p className={styles.coverage}>{catalog.definitions.length} modifiers</p>
    </header>
    <form action="/nodes" className={styles.filters} aria-label="Filter node modifiers">
      <label className={styles.search}>Name or condition<div><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={filters.q} placeholder="Bleed, Special Attack, 20%…" /></div></label>
      <label>Source<select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option><option>Local</option><option value="Link">Linked</option><option>Global</option></select></label>
      <label>Assigned to<select name="target" defaultValue={filters.target ?? ""}><option value="">Either side</option><option value="defender">Defender</option><option value="attacker">Attacker</option><option value="unknown">Unknown</option></select></label>
      <button type="submit">Search</button>
    </form>
    <div className={styles.resultbar}><h2>{results.length} {results.length === 1 ? "modifier" : "modifiers"}</h2><Link href="/nodes">Clear filters</Link></div>
    {results.length ? <div className={styles.grid}>{results.map(definition => {
      const summary = modifierSummary(definition)
      return <Link key={definition.id} href={`/nodes/${encodeURIComponent(definition.id)}`} className={styles.card}>
        <div className={styles.cardtop}><ModifierIcon catalog={catalog} definition={definition} /><h3>{summary.name === definition.id ? "Unnamed modifier" : summary.name}</h3></div>
        <p>{publicModifierText(summary.texts[0]) || "Description unavailable."}</p>
        <div className={styles.cardfoot}><span>{modifierQuestSummary(catalog, definition)}</span><ArrowRight size={17} aria-hidden="true" /></div>
      </Link>
    })}</div> : <div className={styles.empty}><Search size={28} aria-hidden="true" /><h3>No modifiers match these filters</h3><p>Try part of a name or a condition such as Special Attack.</p><Link href="/nodes">Show all modifiers <ArrowRight size={16} aria-hidden="true" /></Link></div>}
  </div>
}

export function NodeDetailView({ catalog, definition }: { catalog: NodeModifierCatalog; definition: ModifierDefinition }) {
  const summary = modifierSummary(definition)
  const variants = resolvedVariants(definition)
  return <div className={`${styles.page} ${styles.detailpage}`}>
    <Link className={styles.back} href="/nodes"><ArrowLeft size={16} aria-hidden="true" />All node modifiers</Link>
    <header className={styles.detailhero}><span className={styles.eyebrow}>NODE MODIFIER</span><h1><ModifierIcon catalog={catalog} definition={definition} />{summary.name === definition.id ? "Unnamed modifier" : summary.name}</h1></header>
    <div className={styles.variants}>{variants.map((variant, index) => <section key={variant.text ?? "missing-text"} className={styles.variant} data-resolved-variant>
      <h2>{variants.length > 1 ? `Effect variant ${index + 1}` : "Effect"}</h2>
      <p className={styles.resolvedText}>{publicModifierText(variant.text) || "Description unavailable for this effect."}</p>
      <WhereItAppears catalog={catalog} definition={definition} variant={variant} />
    </section>)}</div>
  </div>
}
