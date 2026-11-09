"use client"

import { Fragment } from "react"
import { ArrowUpRight, Hand, MoveUpRight, Swords, Zap } from "lucide-react"
import type { ChampionDetailsPayload, ChampionDetailsView } from "./champion-details-types"
import { championAbilityPanelMatchesChapter, type PreparedChampionAbilityTextPanel } from "@/lib/champion-ability-text"
import { groupChampionAttackHits } from "@/lib/champion-attack-profile"
import styles from "./champion-attack-profile.module.css"

const ATTACK_ORDER = ["L1", "L2", "L3", "L4", "M1", "M2", "H", "S1", "S2"] as const
type Attack = ChampionDetailsPayload["attacks"][number]
type HitRun = ReturnType<typeof groupChampionAttackHits>[number]
type AttackNavigation = { panels: PreparedChampionAbilityTextPanel[]; onViewAbility?: (chapter: string) => void }

export function ChampionAttackProfile({ view, onViewAbility }: { view: ChampionDetailsView; onViewAbility?: (chapter: string) => void }) {
  const attacks = [...view.champion.attacks].sort((a, b) => ATTACK_ORDER.indexOf(a.type) - ATTACK_ORDER.indexOf(b.type))
  const basics = attacks.filter(attack => !attack.type.startsWith("S"))
  const specials = attacks.filter(attack => attack.type.startsWith("S"))
  return (
    <section id="champion-attacks" aria-labelledby="champion-attacks-heading" className={styles.section}>
      <header className={styles.header}>
        <div><h3 id="champion-attacks-heading">Attack breakdown</h3><p>Recorded hit order and properties.</p></div>
        {attacks.length > 0 && <p className={styles.moveCount}>{attacks.length} recorded moves</p>}
      </header>
      {!attacks.length ? <p className={styles.empty}>No attack hit data has been recorded for this champion yet.</p> : <>
        <div className={styles.layout} data-paired={basics.length > 0 && specials.length > 0}>
          {basics.length > 0 && <section aria-labelledby="champion-basic-attacks">
            <h4 id="champion-basic-attacks" className={styles.groupHeading}><Swords aria-hidden="true" />Basic attacks</h4>
            <div className={styles.basicLedger}>
              <table className={`${styles.table} ${styles.basics}`}>
                <caption className={styles.srOnly}>Basic attack variants and their hit order</caption>
                <colgroup><col className={styles.moveColumn} /><col className={styles.hitColumn} /><col /><col /></colgroup>
                <thead><tr><th scope="col">Move</th><th scope="col">Hit</th><th scope="col">Damage</th><th scope="col">Delivery</th></tr></thead>
                {basics.map(attack => <BasicMove key={attack.id} attack={attack} />)}
              </table>
            </div>
            <p className={styles.basicNote}>Light and Medium numbers identify move variants, not a prescribed combo.</p>
          </section>}
          {specials.length > 0 && <section aria-labelledby="champion-special-attacks">
            <h4 id="champion-special-attacks" className={styles.groupHeading}><Zap aria-hidden="true" />Special attacks</h4>
            <div className={styles.specials}>{specials.map(attack => <SpecialMove key={attack.id} attack={attack} panels={view.descriptionView.descriptionPanels} onViewAbility={onViewAbility} />)}</div>
          </section>}
        </div>
        <p className={styles.sourceNote}>Consecutive hits with identical properties share a numbered range. Damage amounts are not available in this record.</p>
      </>}
    </section>
  )
}

function BasicMove({ attack }: { attack: Attack }) {
  const runs = groupChampionAttackHits(attack.hits)
  const rows = Math.max(1, runs.reduce((sum, run) => sum + (run.other.length ? 2 : 1), 0))
  return <tbody data-attack={attack.type}>
    {runs.length ? runs.map((run, index) => <Fragment key={run.start}>
      <tr>
        {index === 0 && <th scope="rowgroup" rowSpan={rows} className={styles.moveName}>{attackLabel(attack.type)}</th>}
        <HitCells run={run} />
      </tr>
      {run.other.length > 0 && <OtherProperties run={run} />}
    </Fragment>) : <tr><th scope="row" className={styles.moveName}>{attackLabel(attack.type)}</th><td colSpan={3} className={styles.unknown}>Hits not recorded</td></tr>}
  </tbody>
}

function SpecialMove({ attack, panels, onViewAbility }: { attack: Attack } & AttackNavigation) {
  const number = Number(attack.type.slice(1))
  const panel = panels.find(panel => championAbilityPanelMatchesChapter(panel, `special${number}`))
  const title = (panel?.specialAttackIntros?.find(intro => intro.number === number)?.record ?? panel?.introRecord)?.displayTitle
  const canNavigate = panel && (panel.introRecord || panel.specialAttackIntros?.length || panel.recordGroups.length > 0) && onViewAbility
  const runs = groupChampionAttackHits(attack.hits)
  return <article className={styles.special} data-attack={attack.type} aria-labelledby={`champion-attack-${attack.type}`}>
    <header className={styles.specialHeader}>
      <div><h5 id={`champion-attack-${attack.type}`}>{attackLabel(attack.type)}</h5>{title && <p className={styles.specialTitle}>{title}</p>}</div>
      <span className={styles.hitCount}>{attack.hits.length ? `${attack.hits.length} ${attack.hits.length === 1 ? "hit" : "hits"}` : "Hits not recorded"}</span>
    </header>
    {runs.length > 0 && <table className={`${styles.table} ${styles.sequence}`}>
      <caption className={styles.srOnly}>{attackLabel(attack.type)} hit sequence</caption>
      <colgroup><col className={styles.sequenceHitColumn} /><col /><col /></colgroup>
      <thead><tr><th scope="col">Hit</th><th scope="col">Damage</th><th scope="col">Delivery</th></tr></thead>
      <tbody>{runs.map(run => <Fragment key={run.start}><tr><HitCells run={run} /></tr>{run.other.length > 0 && <OtherProperties run={run} />}</Fragment>)}</tbody>
    </table>}
    {canNavigate && <button type="button" aria-label={`Read Special ${number} ability`} className={styles.abilityLink} onClick={() => onViewAbility(panel.group)}>Read ability<ArrowUpRight aria-hidden="true" /></button>}
  </article>
}

function HitCells({ run }: { run: HitRun }) {
  return <>
    <th scope="row" className={styles.hitNumber} aria-label={run.start === run.end ? `Hit ${run.start}` : `Hits ${run.start} to ${run.end}`}><span>{run.start === run.end ? run.start : `${run.start}–${run.end}`}</span></th>
    <td><PropertyList properties={run.damage} /></td>
    <td><PropertyList properties={run.delivery} /></td>
  </>
}

function OtherProperties({ run }: { run: HitRun }) {
  return <tr className={styles.otherRow}><td /><td colSpan={2}>Other properties: {run.other.join(" · ")}</td></tr>
}

function PropertyList({ properties }: { properties: string[] }) {
  if (!properties.length) return <span className={styles.unknown}>Not recorded</span>
  return <span className={styles.properties}>{properties.map(property => {
    const Icon = property === "Energy" ? Zap : property === "Contact" ? Hand : property === "Projectile" ? MoveUpRight : null
    return <span key={property} data-property={property}>{Icon ? <Icon aria-hidden="true" /> : <span className={styles.physicalMark} aria-hidden="true" />}{property}</span>
  })}</span>
}

function attackLabel(type: Attack["type"]) {
  return type.startsWith("L") ? `Light ${type.slice(1)}` : type.startsWith("M") ? `Medium ${type.slice(1)}` : type === "H" ? "Heavy" : `Special ${type.slice(1)}`
}
