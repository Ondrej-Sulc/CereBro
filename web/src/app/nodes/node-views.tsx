import Link from "next/link"
import { ArrowLeft, ArrowRight, Search } from "lucide-react"
import { browseModifiers, modifierSummary, plainGameText, type ModifierDefinition, type ModifierFilters, type NodeModifierCatalog } from "@cerebro/core/domain/node-modifiers/catalog"
import { modifierUseProjection } from "@cerebro/core/data/game-node-modifiers/uses"
import { modifierIconKey, modifierArtworkEvidence } from "@cerebro/core/data/game-node-modifiers/artwork"
import { NodeModifierIcon } from "@/components/nodes/NodeModifierIcon"
import { resolvedVariants } from "./node-presentation"
import { modifierQuestSummary, WhereItAppears } from "./node-locations"
import styles from "./nodes.module.css"

function ModifierIcon({ catalog, definition }: { catalog: NodeModifierCatalog; definition: ModifierDefinition }) {
  return <NodeModifierIcon iconKey={modifierIconKey(catalog, definition)} size={28} className={styles.modifierIcon} />
}

export function NodeCatalogView({ catalog, filters }: { catalog: NodeModifierCatalog; filters: ModifierFilters }) {
  const results = browseModifiers(catalog.definitions, filters)
  const mapSamples = catalog.profile.inputs.reduce((count, source) => count + source.pointers.length, 0)
  return <div className={styles.page}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>GAME REFERENCE</span>
      <h1>Node modifiers</h1>
      <p>Find effects, values and conditions in recorded node definitions.</p>
      <p className={styles.coverage}>{catalog.definitions.length} definitions · Verified subset from {mapSamples} saved maps</p>
    </header>
    <form action="/nodes" className={styles.filters} aria-label="Filter node modifiers">
      <label className={styles.search}>Name or condition<div><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={filters.q} placeholder="Bleed, Special Attack, 20%…" /></div></label>
      <label>Source<select name="source" defaultValue={filters.source ?? ""}><option value="">All sources</option><option>Local</option><option value="Link">Linked</option><option>Global</option></select></label>
      <label>Assigned to<select name="target" defaultValue={filters.target ?? ""}><option value="">Either side</option><option value="defender">Defender</option><option value="attacker">Attacker</option><option value="unknown">Unknown</option></select></label>
      <button type="submit">Search</button>
      <details className={styles.moreFilters} open={!!filters.binding}><summary>More filters</summary><label>Supporting data<select name="binding" defaultValue={filters.binding ?? ""}><option value="">All definitions</option><option value="missing">Some data missing</option><option value="complete">No missing components</option></select></label></details>
    </form>
    <div className={styles.resultbar}><h2>{results.length} {results.length === 1 ? "modifier" : "modifiers"}</h2><Link href="/nodes">Clear filters</Link></div>
    {results.length ? <div className={styles.grid}>{results.map(definition => {
      const summary = modifierSummary(definition)
      return <Link key={definition.id} href={`/nodes/${encodeURIComponent(definition.id)}`} className={styles.card}>
        <div className={styles.cardtop}><ModifierIcon catalog={catalog} definition={definition} /><h3>{summary.name}</h3></div>
        <p>{summary.texts[0] || "Effect text was not recorded for this definition."}</p>
        {summary.missing && <span className={styles.missingLabel}>Some source data missing</span>}
        <div className={styles.cardfoot}><span>{modifierQuestSummary(catalog, definition)}</span><ArrowRight size={17} aria-hidden="true" /></div>
      </Link>
    })}</div> : <div className={styles.empty}><Search size={28} aria-hidden="true" /><h3>No modifiers match these filters</h3><p>Try part of a name or a condition such as Special Attack.</p><Link href="/nodes">Show all recorded definitions <ArrowRight size={16} aria-hidden="true" /></Link></div>}
    <SnapshotDisclosure catalog={catalog} />
    <details className={styles.sourceData}><summary>Source data</summary><CatalogSourceData catalog={catalog} /></details>
  </div>
}

function SnapshotDisclosure({ catalog }: { catalog: NodeModifierCatalog }) {
  const date = catalog.profile.inputs.map(input => input.capturedAt.slice(0, 10)).sort().at(-1)
  return <details className={styles.disclosure}><summary>About this recorded subset</summary><p>These definitions and locations come from five saved map samples captured {date}, game {catalog.profile.gameVersion}. They are a verified initial subset, not a complete or automatically refreshed catalog or evidence of current quest availability. Quest names and Story numbering follow the captured hierarchy. The placement lists show recorded assignments, not live combat state.</p></details>
}

function CatalogSourceData({ catalog }: { catalog: NodeModifierCatalog }) {
  return <dl><dt>Game build</dt><dd>{catalog.profile.gameVersion}</dd><dt>Catalog SHA-256</dt><dd><code>{catalog.contentHash}</code></dd><dt>BCG SHA-256</dt><dd><code>{catalog.profile.bcgSha256}</code></dd>{catalog.profile.inputs.map(input => <div key={input.id}><dt>{input.path}</dt><dd><code>{input.sha256}</code></dd></div>)}</dl>
}

export function NodeDetailView({ catalog, definition }: { catalog: NodeModifierCatalog; definition: ModifierDefinition }) {
  const summary = modifierSummary(definition)
  const variants = resolvedVariants(definition)
  return <div className={`${styles.page} ${styles.detailpage}`}>
    <Link className={styles.back} href="/nodes"><ArrowLeft size={16} aria-hidden="true" />All node modifiers</Link>
    <header className={styles.detailhero}><span className={styles.eyebrow}>NODE MODIFIER</span><h1><ModifierIcon catalog={catalog} definition={definition} />{summary.name}</h1></header>
    <div className={styles.variants}>{variants.map((variant, index) => <section key={variant.text ?? "missing-text"} className={styles.variant} data-resolved-variant>
      <h2>{variants.length > 1 ? `Effect variant ${index + 1}` : "Effect"}</h2>
      <p className={styles.resolvedText}>{variant.text || "Effect text was not recorded. Original fields are available in Source data."}</p>
      <WhereItAppears catalog={catalog} definition={definition} variant={variant} />
    </section>)}</div>
    {summary.missing && <p className={styles.notice}>Some source data is missing. Recorded effect text is available; see Source data for the missing reference.</p>}
    <details id="source-data" className={styles.sourceData}>
      <summary>Source data</summary>
      <dl><dt>Exact game Buff ID</dt><dd><code>{definition.id}</code></dd></dl>
      <CatalogSourceData catalog={catalog} />
      <details className={styles.raw}><summary>Native artwork bindings</summary><pre>{JSON.stringify(modifierArtworkEvidence(definition), null, 2)}</pre></details>
      <details className={styles.raw}><summary>Quest use identities & label provenance</summary><pre>{JSON.stringify({ contract: modifierUseProjection.contract, contentHash: modifierUseProjection.contentHash, modifierCatalogHash: modifierUseProjection.modifierCatalogHash, quests: modifierUseProjection.quests.filter(q => modifierUseProjection.uses.some(use => use.effectId === definition.id && use.questKey === q.key)), uses: modifierUseProjection.uses.filter(use => use.effectId === definition.id) }, null, 2)}</pre></details>
      {definition.versions.map((version, versionIndex) => <section className={styles.versionSource} key={version.hash}>
        <h2>Definition version {versionIndex + 1}</h2>
        <dl><dt>Original game label</dt><dd>{plainGameText(version.raw.localizedName) || "Not recorded"}</dd><dt>Original template</dt><dd>{String(version.raw.localizedDesc ?? "Not recorded")}</dd><dt>Definition SHA-256</dt><dd><code>{version.definitionHash}</code></dd><dt>Version SHA-256</dt><dd><code>{version.hash}</code></dd></dl>
        {version.missingComponentIds.length > 0 && <p className={styles.notice}>Missing BCG component: <code>{version.missingComponentIds.join(", ")}</code>. No parameter value has been inferred.</p>}
        <details className={styles.raw}><summary>BCG parameters · {version.components.length} exact components</summary><p>Raw stored parameters retain full precision. They are not final combat values.</p>{version.components.map(component => <div key={component.id} className={styles.component}><h3><code>{component.id}</code></h3><dl>{["Type", "Trigger", "Chance", "Modifier", "Duration", "Stackable", "DisplayFormulaId", "GrowthCurve", "GrowthTarget", "Target"].map(field => <div key={field}><dt>{field}</dt><dd>{component.raw[field] === undefined ? "Not recorded" : String(component.raw[field])}</dd></div>)}</dl><details className={styles.raw}><summary>Complete component fields</summary><pre>{JSON.stringify(component.raw, null, 2)}</pre></details><p><code>{component.hash}</code></p></div>)}</details>
        <details className={styles.raw}><summary>Original definition fields</summary><pre>{JSON.stringify(version.raw, null, 2)}</pre></details>
        <details className={styles.raw}><summary>Application identities & evidence · {version.applications.length}</summary>{version.applications.map((application, index) => {
          const source = catalog.profile.inputs.find(input => input.id === application.evidence.sourceId)
          return <section className={styles.applicationSource} key={application.hash}><h3>Application {index + 1}</h3><dl><dt>Capture</dt><dd>{source?.path ?? application.evidence.sourceId}</dd><dt>Source SHA-256</dt><dd><code>{source?.sha256 ?? "Unknown"}</code></dd><dt>JSON pointer</dt><dd><code>{application.evidence.pointer}</code></dd><dt>Source coordinate</dt><dd>{application.evidence.coordinate ? `${application.evidence.coordinate.x}, ${application.evidence.coordinate.y}` : "Not recorded"}</dd><dt>Application SHA-256</dt><dd><code>{application.hash}</code></dd></dl><pre>{JSON.stringify(application.raw, null, 2)}</pre></section>
        })}</details>
      </section>)}
    </details>
    <SnapshotDisclosure catalog={catalog} />
  </div>
}
