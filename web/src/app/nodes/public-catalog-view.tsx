import Link from "next/link"
import { ArrowLeft, ArrowRight, Search } from "lucide-react"
import { browsePublicModifiers, publicModifierHref, type GameModifierRecord, type PublicCuratedModifier, type PublicModifierFilters, type CuratedAssociation } from "@cerebro/core/domain/node-modifiers/public-catalog"
import { NodeModifierIcon } from "@/components/nodes/NodeModifierIcon"
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon"
import { plainGameText } from "@cerebro/core/domain/node-modifiers/catalog"
import { NodeFilterForm } from "./node-filter-form"
import styles from "./nodes.module.css"

export function PublicNodeCatalogView({ curated, game, filters, curatedUnavailable = false, coverage }: {
  curated: PublicCuratedModifier[]; game: GameModifierRecord[]; filters: PublicModifierFilters; curatedUnavailable?: boolean
  coverage: { permanentLayouts: number; fullVersions: number; recordedTileAssignments: number }
}) {
  const result = browsePublicModifiers(curated, game, filters)
  return <div className={styles.page}>
    <header className={styles.hero}><span className={styles.eyebrow}>NODE REFERENCE</span><h1>Node modifiers</h1>
      <p>Search the curated catalog and effects recorded in game quest data.</p>
      <p className={styles.coverage}>{curatedUnavailable ? "Curated catalog temporarily unavailable" : `${curated.length.toLocaleString("en")} curated records`} · {game.length.toLocaleString("en")} game definitions</p>
    </header>
    <NodeFilterForm key={publicModifierHref(filters)} className={styles.filters}>
      <label className={styles.search}>Name or condition<div><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={filters.q} placeholder="Bleed, Special Attack, 20%…" /></div></label>
      <label>Catalog<select name="catalog" defaultValue={result.catalog}><option value="all">All catalogs</option><option value="curated">Curated catalog</option><option value="game">Recorded game data</option></select></label>
      <button type="submit">Search</button>
      <details className={styles.moreFilters} open={!!(filters.source || filters.target || filters.binding)}><summary>Game filters</summary>
        <p className={styles.filterHint}>These filters match recorded game definitions.</p><div className={styles.gameFilters}>
          <label>Assignment source<select name="source" defaultValue={filters.source ?? ""}><option value="">Any source</option><option>Local</option><option value="Link">Linked</option><option>Global</option><option>Trap</option></select></label>
          <label>Assigned to<select name="target" defaultValue={filters.target ?? ""}><option value="">Either side</option><option value="defender">Defender</option><option value="attacker">Attacker</option><option value="unknown">Not established</option></select></label>
          <label>Supporting data<select name="binding" defaultValue={filters.binding ?? ""}><option value="">Any</option><option value="missing">Some components missing</option><option value="complete">No missing components</option></select></label>
        </div>
      </details>
    </NodeFilterForm>
    {curatedUnavailable && <p className={styles.notice}>The curated catalog could not be read just now. Recorded game definitions remain available.</p>}
    <div className={styles.resultbar}><h2>{result.total.toLocaleString("en")} {result.total === 1 ? "record" : "records"}</h2><Link href="/nodes">Clear filters</Link></div>
    {result.total > 0 ? <><p className={styles.resultScope}>{curatedUnavailable ? "Curated results unavailable" : `${result.counts.matchingCurated.toLocaleString("en")} curated`} · {result.counts.matchingGame.toLocaleString("en")} game · Page {result.page} of {result.pages}</p>
      <div className={styles.grid}>{result.items.map(item => <Link className={styles.card} key={`${item.origin}:${item.id}`} href={item.href} data-modifier-origin={item.origin}>
        <span className={styles.originLabel}>{item.origin === "curated" ? "Curated catalog" : "Game data"}</span>
        <div className={styles.cardtop}>{item.origin === "game" ? <GameNodeModifierIcon iconKey={item.iconKey} size={25} className={styles.modifierIcon} /> : <NodeModifierIcon iconKey={item.iconKey} size={25} className={styles.modifierIcon} />}<h3>{item.name}</h3></div>
        <p className={styles.cardDescription}>{(item.origin === "game" ? plainGameText(item.text) : item.text) || "Description not recorded."}</p>
        <div className={styles.cardfoot}><span>{item.origin === "curated" ? "Read full modifier" : `${item.questCount} recorded quest${item.questCount === 1 ? "" : "s"}`}</span><ArrowRight size={17} aria-hidden="true" /></div>
      </Link>)}</div>
      <nav className={styles.pagination} aria-label="Catalog pages">{result.page > 1 ? <Link rel="prev" href={publicModifierHref(filters, result.page - 1)}>Previous</Link> : <span />}
        <span>Page {result.page} of {result.pages}</span>{result.page < result.pages ? <Link rel="next" href={publicModifierHref(filters, result.page + 1)}>Next</Link> : <span />}</nav>
    </> : <div className={styles.empty}><Search size={28} aria-hidden="true" /><h3>No modifiers match these filters</h3><p>Try a shorter name or condition, or choose another catalog.</p><Link href="/nodes">Show all modifiers <ArrowRight size={16} aria-hidden="true" /></Link></div>}
    <details className={styles.disclosure}><summary>About these catalogs</summary><p>Curated records retain their original IDs, names and descriptions. Game definitions are a separate recorded source, drawn from {coverage.permanentLayouts} permanent quest layouts plus the original historical samples: {coverage.fullVersions.toLocaleString("en")} full versions and {coverage.recordedTileAssignments.toLocaleString("en")} tile assignments. Equal names do not establish a match. These are recorded assignments, not live availability or active combat state.</p></details>
  </div>
}

export function CuratedNodeDetailView({ modifier, verified }: { modifier: PublicCuratedModifier; verified: (CuratedAssociation & { name: string })[] }) {
  return <div className={`${styles.page} ${styles.detailpage}`}>
    <Link className={styles.back} href="/nodes?catalog=curated"><ArrowLeft size={16} aria-hidden="true" />Curated node catalog</Link>
    <header className={styles.detailhero}><span className={styles.eyebrow}>CURATED CATALOG</span><h1>{modifier.name}</h1></header>
    <section className={styles.variant}><h2>Definition</h2><p className={styles.resolvedText}>{modifier.description || "Description not recorded."}</p></section>
    {verified.length > 0 ? <section className={styles.curatedLinks}><h2>Verified game definitions</h2>{verified.map(binding => <Link key={`${binding.effectId}:${binding.versionHash}`} href={`/nodes/${encodeURIComponent(binding.effectId)}`}>{binding.name}<ArrowRight size={15} aria-hidden="true" /></Link>)}</section> :
      <div className={styles.curatedLinks}><p>A game-data association has not been verified for this record.</p><Link href={`/nodes?catalog=game&q=${encodeURIComponent(modifier.name)}`}>Search recorded game definitions<ArrowRight size={15} aria-hidden="true" /></Link></div>}
    <details id="source-data" className={styles.sourceData}><summary>Source data</summary><dl><dt>Catalog</dt><dd>Existing curated NodeModifier record</dd><dt>Original record ID</dt><dd><code>{modifier.id}</code></dd></dl><p>Original wording and planning identity are preserved. No game locations or native icon have been inferred from this title.</p></details>
  </div>
}
