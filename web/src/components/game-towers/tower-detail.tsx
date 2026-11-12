import Link from "next/link";
import type { CSSProperties } from "react";
import type { TowerBlockView, TowerCatalogEntry } from "@/lib/game-towers";
import { towerColor, towerTitle, towerKind, eventEndText } from "./tower-catalog";
import { TowerBlockControls } from "./tower-block-controls";
import { TowerFloors, TowerModifiers } from "./tower-floors";
import { TowerRewards } from "./tower-rewards";
import { TowerFloorJump } from "./tower-floor-jump";
import { TowerImage } from "./tower-image";
import styles from "./towers.module.css";

export function TowerDetail({ tower, view, current, from, modifier, rewardFloor }: { tower: TowerCatalogEntry; view: TowerBlockView | null; current: number; from?: string; modifier?: string; rewardFloor?: number }) {
  const restriction = view?.block.blockData.heroRestrictions;
  const hasRestriction = typeof restriction === "string" && restriction.trim().length > 0;
  const restrictionLabel = typeof restriction === "string" ? ({ skill: "Skill", trained: "Skill", mutant: "Mutant", tech: "Tech", cosmic: "Cosmic", mystic: "Mystic", science: "Science", chemical: "Science" } as Record<string, string>)[restriction] : undefined;
  const modifiers = view ? [...view.topBlockModifiers, ...view.blockModifiers] : [];
  return <div className={styles.page} style={{ "--tower-accent": towerColor(tower.classId) } as CSSProperties}>
    <nav className={styles.breadcrumb} aria-label="Quest location"><Link href="/quests">Quest explorer</Link><span aria-hidden="true">/</span><Link href={from || "/quests/towers"}>Towers</Link><span aria-hidden="true">/</span><span>{towerTitle(tower.name)}</span></nav>
    <header className={styles.detailHeader}><div className={styles.detailArtwork}><TowerImage src={tower.artwork?.url} eager/></div><div className={styles.detailCopy}><p className={styles.eyebrow}>{towerKind(tower)}</p><h1>{towerTitle(tower.name)}</h1><div className={styles.towerTotals}><span><strong>{tower.blockNumbers.length}</strong> blocks</span>{tower.floorCount !== null && <span><strong>{tower.floorCount.toLocaleString("en")}</strong> total floors</span>}{tower.section === "event" && tower.endsAt && <time dateTime={tower.endsAt}>{eventEndText(tower.endsAt)}</time>}<Link href={from || "/quests/towers"}>Change Tower ↗</Link></div></div></header>
    {!tower.blockNumbers.length ? <p className={styles.empty}>Block definitions are not available for this Tower.</p> : <div id="block-reader" className={styles.reader} tabIndex={-1}>
      <div className={styles.blockNavigation}><TowerBlockControls key={`${tower.id}:${current}`} id={tower.id} numbers={tower.blockNumbers} current={current} from={from}/>{view&&<TowerFloorJump floors={view.floors.map(f => ({ floorNumber: f.floorNumber, name: f.defender?.name || "Unknown defender" }))}/>}</div>
      {!view ? <section className={styles.empty}>{tower.section === "event" && tower.capturedBlockNumbers?.length === 0 ? <><h2>Floor details are not available yet</h2><p>Defenders, nodes and rewards for this Event Tower are not available in the explorer yet.</p></> : <><h2>Block {current} is not available</h2><p>Choose another block using the block heading above.</p></>}</section> : <>
        <details id="block-rules" className={styles.blockRules} open={Boolean(modifier && modifiers.some(m => m.id === modifier)) || undefined}><summary><strong>Block rules & entry</strong><span>{restrictionLabel ? `${restrictionLabel} attackers` : hasRestriction ? "Restrictions unresolved" : ""}{hasRestriction ? " / " : ""}{modifiers.length} nodes / {view.entryCost.length ? "Entry cost listed" : "No entry cost listed"}</span></summary><div className={styles.blockRulesBody}>{hasRestriction && <p className={styles.restriction}><strong>Attacker restriction</strong><span>{restrictionLabel || "Restriction details unresolved"}</span></p>}{modifiers.length > 0 && <TowerModifiers modifiers={modifiers} selected={modifier} expanded/>}{view.entryCost.length ? <section><h3>Entry cost</h3><TowerRewards rewards={view.entryCost}/></section> : <p className={styles.costNote}>No entry cost listed.</p>}</div></details>
        <div className={`${styles.readerGrid} ${view.floors.length <= 3 ? styles.shortBlock : ""}`}><TowerFloors key={current} floors={view.floors} modifier={modifier} rewardFloor={rewardFloor}/><aside id="block-rewards" className={styles.blockAside} aria-label="Block rewards">
          <section className={styles.rewardSection}><h2>Block rewards</h2><TowerRewards rewards={view.blockRewards}/></section>
          {view.ratingRewards.length > 0 && <section className={styles.rewardSection}><h2>Rating rewards</h2><TowerRewards rewards={view.ratingRewards}/></section>}
        </aside></div>
        <TowerBlockControls id={tower.id} numbers={tower.blockNumbers} current={current} from={from} compact/>
      </>}
    </div>}
  </div>;
}
