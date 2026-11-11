import Link from "next/link"
import { UserRound } from "lucide-react"
import { modifierUseProjection } from "@cerebro/core/data/game-node-modifiers/uses"
import { defenderArtwork, type DefenderArtwork } from "@cerebro/core/data/game-node-modifiers/artwork"
import { modifierLocations, type ModifierPlacement, type ModifierQuestLabel, type ModifierUseProjection } from "@cerebro/core/domain/node-modifiers/uses"
import type { ModifierDefinition, NodeModifierCatalog } from "@cerebro/core/domain/node-modifiers/catalog"
import type { ResolvedVariant } from "./node-presentation"
import { questHierarchy } from "./node-hierarchy"
import styles from "./nodes.module.css"

export function modifierQuestSummary(catalog: NodeModifierCatalog, definition: ModifierDefinition) {
  const references = definition.versions.flatMap(version => version.applications.map(application => ({ version, application })))
  const { quests } = modifierLocations(catalog, definition, references, modifierUseProjection)
  if (!quests.length) return "Quest location not resolved"
  const hierarchy = questHierarchy(quests[0].quest)
  return `${hierarchy.path.slice(0, 2).join(" · ")}${hierarchy.number ? ` · ${hierarchy.number}` : ""}${quests.length > 1 ? ` +${quests.length - 1} quest${quests.length > 2 ? "s" : ""}` : ""}`
}

export function DefenderList({ nodes, catalog, portraitBindings }: { nodes: ModifierPlacement[]; catalog: NodeModifierCatalog; portraitBindings?: Record<string, DefenderArtwork> }) {
  // Repeated defenders at different exact placements remain separate entries.
  return <ul className={styles.defenders}>{nodes.flatMap(node => node.defenders.length ? node.defenders.map(defender => {
    const binding = portraitBindings ? defender.gameId ? portraitBindings[defender.gameId] : undefined : defenderArtwork(catalog, defender.gameId)
    const name = binding?.public?.name || defender.name || "Unresolved defender"
    const face = <>{binding?.status === "verified" && binding.src
      // Native, content-hashed local export; no remote image optimizer required.
      // eslint-disable-next-line @next/next/no-img-element
      ? <img src={binding.src} width={56} height={56} alt="" />
      : <span className={styles.neutralPortrait}><UserRound size={26} aria-hidden="true" /></span>}
      <span className={styles.defenderName}>{name}</span></>
    return <li key={`${node.x}:${node.y}:${defender.bossId}`} data-defender-placement>
      {binding?.public?.href ? <Link href={binding.public.href} aria-label={name} className={styles.defender}>{face}</Link> : <span className={styles.defender} aria-label={name}>{face}</span>}
    </li>
  }) : [<li key={`${node.x}:${node.y}`} data-defender-placement><span className={styles.defender} aria-label="Unresolved defender"><span className={styles.neutralPortrait}><UserRound size={26} aria-hidden="true" /></span><span className={styles.defenderName}>Defender not recorded</span></span></li>])}</ul>
}
function Placements({ nodes, catalog, portraitBindings }: { nodes: ModifierPlacement[]; catalog: NodeModifierCatalog; portraitBindings?: Record<string, DefenderArtwork> }) {
  const visible = nodes.slice(0, 6), remaining = nodes.slice(6)
  return <><DefenderList nodes={visible} catalog={catalog} portraitBindings={portraitBindings} />{remaining.length > 0 && <details className={styles.morePlacements}><summary>{remaining.length} more recorded placements</summary><DefenderList nodes={remaining} catalog={catalog} portraitBindings={portraitBindings} /></details>}</>
}
function QuestHeading({ quest }: { quest: ModifierQuestLabel }) {
  const hierarchy = questHierarchy(quest)
  return <header className={styles.questHeading}>
    <h4>{hierarchy.path.map((part, index) => <span key={index}>{index > 0 && <span className={styles.hierarchyDivider} aria-hidden="true"> / </span>}{part}</span>)}</h4>
    {hierarchy.chapterName && <p className={styles.nativeChapter}>{hierarchy.chapterName}</p>}
    <p className={styles.questSubtitle}>{hierarchy.number && <strong>{hierarchy.number}</strong>}<span>{hierarchy.title}</span>{quest.difficulty && <span className={styles.difficulty}>{quest.difficulty}</span>}</p>
  </header>
}
export function WhereItAppears({ catalog, definition, variant, projection = modifierUseProjection, portraitBindings, page = 1, pageSize, baseHref }: {
  catalog: NodeModifierCatalog; definition: ModifierDefinition; variant: ResolvedVariant; projection?: ModifierUseProjection
  portraitBindings?: Record<string, DefenderArtwork>; page?: number; pageSize?: number; baseHref?: string
}) {
  const locations = modifierLocations(catalog, definition, variant.applications, projection)
  const pages = pageSize ? Math.max(1, Math.ceil(locations.quests.length / pageSize)) : 1
  const current = Math.min(pages, Math.max(1, page)), visible = pageSize ? locations.quests.slice((current - 1) * pageSize, current * pageSize) : locations.quests
  return <section className={styles.locations} aria-label="Where it appears">
    <h3>Where it appears</h3>
    {visible.map(({ quest, contexts }) => <article className={styles.questUse} data-quest-use key={quest.key}>
      <QuestHeading quest={quest} />
      {contexts.map(context => <div className={styles.locationContext} key={context.key}>
        {(context.role !== "Local" || context.side !== "defender") && <div className={styles.locationRole}>
          {context.role !== "Local" && <span>{context.role === "Link" ? "Linked source" : context.role === "Global" ? "Global source" : context.role === "Trap" ? "Trap source" : "Source type not recorded"}</span>}
          {context.side !== "defender" && <span>{context.side === "attacker" ? "Applies to attackers" : "Assignment side not recorded"}</span>}
        </div>}
        {context.role !== "Local" && <div className={styles.origin}><span>Source</span>{context.sourceNodes.some(node => node.defenders.length) ? <Placements nodes={context.sourceNodes.filter(node => node.defenders.length)} catalog={catalog} portraitBindings={portraitBindings} /> : <p>{context.sourceNodes.length ? "Map effect source" : "Source placement not recorded"}</p>}</div>}
        {context.affectedNodes.length > 0 ? <div className={styles.affected}>{context.role !== "Local" && <span>Affected fights</span>}<Placements nodes={context.affectedNodes} catalog={catalog} portraitBindings={portraitBindings} /></div> : <p className={styles.locationUnknown}>Effect source recorded; affected fight not recorded.</p>}
        {context.amounts.some(amount => amount !== undefined && amount !== 1) && <p className={styles.locationUnknown}>Recorded amount: {context.amounts.map(String).join(", ")}</p>}
      </div>)}
    </article>)}
    {pages > 1 && baseHref && <nav className={styles.pagination} aria-label="Recorded quest pages">{current > 1 ? <Link href={`${baseHref}?usesPage=${current - 1}`}>Previous quests</Link> : <span />}<span>{locations.quests.length} recorded quests · {current}/{pages}</span>{current < pages ? <Link href={`${baseHref}?usesPage=${current + 1}`}>More quests</Link> : <span />}</nav>}
    {locations.unresolvedApplications > 0 && <p className={styles.locationUnknown}>{locations.quests.length ? "Some quest locations could not be verified for this effect." : "Quest location could not be verified for this effect."} Original evidence is available in Source data.</p>}
    {locations.quests.some(q => q.contexts.some(c => c.role === "Link" || c.role === "Global")) && <p className={styles.assignmentNote}>Recorded assignments. Linked and global effects may depend on their source remaining active.</p>}
  </section>
}
