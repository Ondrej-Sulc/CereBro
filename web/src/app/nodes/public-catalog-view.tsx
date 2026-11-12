import Link from "next/link"
import { ArrowLeft, ArrowRight, Search } from "lucide-react"
import { browsePublicModifiers, publicModifierHref, type GameModifierRecord, type PublicCuratedModifier, type PublicModifierFilters, type CuratedAssociation } from "@cerebro/core/domain/node-modifiers/public-catalog"
import { NodeModifierIcon } from "@/components/nodes/NodeModifierIcon"
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon"
import { publicModifierText } from "./node-presentation"
import { NodeFilterForm } from "./node-filter-form"
import styles from "./nodes.module.css"

export function PublicNodeCatalogView({ curated, game, filters, curatedUnavailable = false }: {
  curated: PublicCuratedModifier[]; game: GameModifierRecord[]; filters: PublicModifierFilters; curatedUnavailable?: boolean
}) {
  const publicFilters = { ...filters, binding: undefined }
  const result = browsePublicModifiers(curated, game, publicFilters)
  return <div className={styles.page}>
    <header className={styles.hero}><span className={styles.eyebrow}>NODE REFERENCE</span><h1>Node modifiers</h1>
      <p>Find node effects, values and conditions.</p>
      <p className={styles.coverage}>{curatedUnavailable ? "CereBro catalog temporarily unavailable" : `${curated.length.toLocaleString("en")} CereBro modifier${curated.length === 1 ? "" : "s"}`} · {game.length.toLocaleString("en")} game modifiers</p>
    </header>
    <NodeFilterForm key={publicModifierHref(publicFilters)} className={styles.filters}>
      <label className={styles.search}>Name or condition<div><Search size={18} aria-hidden="true" /><input type="search" name="q" defaultValue={filters.q} placeholder="Bleed, Special Attack, 20%…" /></div></label>
      <label>Catalog<select name="catalog" defaultValue={result.catalog}><option value="all">All modifiers</option><option value="curated">CereBro modifiers</option><option value="game">Game modifiers</option></select></label>
      <button type="submit">Search</button>
      <details className={styles.moreFilters} open={!!(filters.source || filters.target)}><summary>Game filters</summary>
        <p className={styles.filterHint}>Filter game modifiers by how they apply.</p><div className={styles.gameFilters}>
          <label>Assignment source<select name="source" defaultValue={filters.source ?? ""}><option value="">Any source</option><option>Local</option><option value="Link">Linked</option><option>Global</option><option>Trap</option></select></label>
          <label>Applies to<select name="target" defaultValue={filters.target ?? ""}><option value="">Either side</option><option value="defender">Defender</option><option value="attacker">Attacker</option><option value="unknown">Unknown</option></select></label>
        </div>
      </details>
    </NodeFilterForm>
    {curatedUnavailable && <p className={styles.notice}>The CereBro catalog is temporarily unavailable. Game modifiers remain available.</p>}
    <div className={styles.resultbar}><h2>{result.total.toLocaleString("en")} {result.total === 1 ? "modifier" : "modifiers"}</h2><Link href="/nodes">Clear filters</Link></div>
    {result.total > 0 ? <><p className={styles.resultScope}>{curatedUnavailable ? "CereBro results unavailable" : `${result.counts.matchingCurated.toLocaleString("en")} CereBro`} · {result.counts.matchingGame.toLocaleString("en")} game · Page {result.page} of {result.pages}</p>
      <div className={styles.grid}>{result.items.map(item => <Link className={styles.card} key={`${item.origin}:${item.id}`} href={item.href} data-modifier-origin={item.origin}>
        <span className={styles.originLabel}>{item.origin === "curated" ? "CereBro" : "Game"}</span>
        <div className={styles.cardtop}>{item.origin === "game" ? <GameNodeModifierIcon iconKey={item.iconKey} size={25} className={styles.modifierIcon} /> : <NodeModifierIcon iconKey={item.iconKey} size={25} className={styles.modifierIcon} />}<h3>{item.origin === "game" && item.name === item.id ? "Unnamed modifier" : item.name}</h3></div>
        <p className={styles.cardDescription}>{(item.origin === "game" ? publicModifierText(item.text) : item.text) || "Description unavailable."}</p>
        <div className={styles.cardfoot}><span>View modifier</span><ArrowRight size={17} aria-hidden="true" /></div>
      </Link>)}</div>
      <nav className={styles.pagination} aria-label="Catalog pages">{result.page > 1 ? <Link rel="prev" href={publicModifierHref(publicFilters, result.page - 1)}>Previous</Link> : <span />}
        <span>Page {result.page} of {result.pages}</span>{result.page < result.pages ? <Link rel="next" href={publicModifierHref(publicFilters, result.page + 1)}>Next</Link> : <span />}</nav>
    </> : <div className={styles.empty}><Search size={28} aria-hidden="true" /><h3>No modifiers match these filters</h3><p>Try a shorter name or condition, or choose another catalog.</p><Link href="/nodes">Show all modifiers <ArrowRight size={16} aria-hidden="true" /></Link></div>}
  </div>
}

export function CuratedNodeDetailView({ modifier, verified }: { modifier: PublicCuratedModifier; verified: (CuratedAssociation & { name: string })[] }) {
  return <div className={`${styles.page} ${styles.detailpage}`}>
    <Link className={styles.back} href="/nodes?catalog=curated"><ArrowLeft size={16} aria-hidden="true" />CereBro modifiers</Link>
    <header className={styles.detailhero}><span className={styles.eyebrow}>NODE MODIFIER</span><h1>{modifier.name}</h1></header>
    <section className={styles.variant}><h2>Effect</h2><p className={styles.resolvedText}>{modifier.description || "Description unavailable."}</p></section>
    {verified.length > 0 ? <section className={styles.curatedLinks}><h2>Related game modifiers</h2>{verified.map(binding => <Link key={`${binding.effectId}:${binding.versionHash}`} href={`/nodes/${encodeURIComponent(binding.effectId)}`}>{binding.name}<ArrowRight size={15} aria-hidden="true" /></Link>)}</section> :
      <div className={styles.curatedLinks}><Link href={`/nodes?catalog=game&q=${encodeURIComponent(modifier.name)}`}>Search game modifiers<ArrowRight size={15} aria-hidden="true" /></Link></div>}
  </div>
}
