"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, ChevronDown, Heart, Swords } from "lucide-react";
import type { TowerFloorView, TowerModifierView } from "@/lib/game-towers";
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon";
import { ModifierName } from "@/components/nodes/ModifierName";
import { gameText } from "@cerebro/core/domain/game-quests";
import { TowerImage } from "./tower-image";
import { TowerRewards } from "./tower-rewards";
import styles from "./towers.module.css";
import statStyles from "./tower-stats.module.css";

const number = (value: number | null) => value === null ? "Not recorded" : value.toLocaleString("en");

export function TowerModifiers({ modifiers, expanded = false, selected }: { modifiers: TowerModifierView[]; expanded?: boolean; selected?: string }) {
  return <ul className={styles.modifiers}>{modifiers.map((m, i) => {
    const unidentified = !m.name || m.name === "Recorded modifier";
    const name = unidentified ? `Unidentified modifier ${i + 1}` : gameText(m.name);
    const description = gameText(m.description);
    const repeated = modifiers.filter(other => other.name === m.name).length > 1;
    return <li key={`${m.id}:${i}`} data-selected-modifier={m.id === selected || undefined}><details open={expanded || m.id === selected || undefined}>
      <summary><GameNodeModifierIcon iconKey={m.iconKey} size={21}/><span><ModifierName name={name} href={m.definitionHref}/>{repeated && !unidentified && description && <small className={styles.modifierPreview}>{description}</small>}</span>{m.quantity !== null && m.quantity > 1 && <small>×{m.quantity}</small>}<ChevronDown size={15} className={styles.chevron} aria-hidden="true"/></summary>
      <div className={styles.modifierDescription}><p>{description || "Description unavailable for this modifier."}</p>{m.condition && <p className={styles.muted}>{gameText(m.condition)}</p>}{m.persistence && <p className={styles.muted}>{gameText(m.persistence)}</p>}</div>
    </details></li>;
  })}</ul>;
}

export function TowerFloors({ floors, modifier, rewardFloor }: { floors: TowerFloorView[]; modifier?: string; rewardFloor?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasModifiers = floors.some(f => f.modifiers.length || f.topModifiers.length);
  return <section className={styles.floorSection} aria-labelledby="floors-heading">
    <div className={styles.sectionHeading}><div><h2 id="floors-heading">Floor defenders <span>{floors.length}</span></h2></div>{hasModifiers && <button className={styles.descriptionToggle} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Collapse node descriptions" : "Read all floor nodes"}<ChevronDown size={15}/></button>}</div>
    <ol className={styles.floorList}>{floors.map(f => { const d = f.defender; const modifiers = [...f.topModifiers, ...f.modifiers]; return <li key={f.floorNumber} id={`floor-${f.floorNumber}`} className={styles.floor}>
      <div className={styles.floorNumber}><span>FLOOR</span><strong>{String(f.floorNumber).padStart(2, "0")}</strong></div>
      <article className={styles.floorBody} aria-labelledby={`floor-title-${f.floorNumber}`}>
        <div className={styles.defender}><TowerImage src={d?.imageUrl} className={styles.portrait}/><div className={styles.defenderCopy}><p className={styles.defenderClass}>{d?.className || "Defender"}</p><h3 id={`floor-title-${f.floorNumber}`}>{d?.href ? <Link href={d.href}>{d.name}<ArrowUpRight size={16} aria-hidden="true"/></Link> : d?.name || "Defender not recorded"}</h3>{d && <p className={styles.enemyBuild}>{d.rarity !== null && <span>{d.rarity}<span aria-hidden="true">★</span><span className={styles.srOnly}> star</span></span>}{d.rank !== null && <span>Rank {d.rank}</span>}{d.level !== null && <span>Level {d.level}</span>}{d.signature !== null && <span title="Signature level">Sig {d.signature}</span>}{d.ascensionTier !== null && d.ascensionTier > 0 && <span className={styles.ascension}>Ascension {d.ascensionTier}</span>}</p>}</div></div>
        {d && <dl className={statStyles.stats}><div className={statStyles.rating}><dt>Challenge rating</dt><dd className={d.challengeRating === null ? statStyles.unavailable : undefined}>{number(d.challengeRating)}</dd></div><div><dt><Heart size={13} aria-hidden="true"/>Max health</dt><dd>{number(d.maxHealth)}</dd></div><div><dt><Swords size={13} aria-hidden="true"/>Attack</dt><dd>{number(d.attack)}</dd></div></dl>}
        {modifiers.length > 0 && <details className={styles.floorNodes} open={expanded || modifiers.some(m => m.id === modifier) || undefined}><summary>Floor nodes <span>{modifiers.length}</span></summary><TowerModifiers modifiers={modifiers} expanded={expanded} selected={modifier}/></details>}
        {f.rewards.length > 0 && <div className={styles.floorDetails}><details open={rewardFloor === f.floorNumber || undefined}><summary>Floor rewards <span>{f.rewards.length}</span></summary><TowerRewards rewards={f.rewards} compact/></details></div>}
      </article>
    </li>; })}</ol>
  </section>;
}
