import { getQuestPortalArtwork, type QuestPortalArtworkKey } from "@cerebro/core/data/game-quests/portal-artwork";
import styles from "./quest-board.module.css";

function QuarterRing({ asset, radius }: { asset: QuestPortalArtworkKey; radius: number }) {
  const artwork = getQuestPortalArtwork(asset);
  return artwork ? <>{[0,90,180,270].map(angle=><g key={angle} transform={`rotate(${angle})`}><image href={artwork.url} x="0" y={-radius} width={radius} height={radius}/></g>)}</> : null;
}

/** Native image fragments retain their own pivots; this is decorative, not portal state. */
export function QuestPortalVisual({ x, y, selected, radius = 20, showCenter = true }: { x:number; y:number; selected:boolean; radius?:number; showCenter?:boolean }) {
  const entrance = getQuestPortalArtwork("entranceHalf");
  const center = showCenter ? getQuestPortalArtwork("small") : undefined;
  return <g transform={`translate(${x} ${y})`} data-portal-artwork data-selected={selected} className={styles.portalArtwork} aria-hidden="true" pointerEvents="none">
    <circle r={radius * .82} fill="#03131d" fillOpacity=".94"/>
    <circle r={radius * .62} fill="#10647b" fillOpacity={selected ? .16 : .07}/>
    <g data-portal-layer="entrance" className={styles.portalBase}>{entrance ? [0,180].map(angle=><g key={angle} transform={`rotate(${angle})`}><image href={entrance.url} x={-radius} y={-radius} width={radius} height={radius*2}/></g>) : <circle r={radius} fill="none" stroke="#76d6ed" strokeWidth="1.5"/>}</g>
    <g data-portal-layer="summoning" className={styles.portalOrbit}><QuarterRing asset="summoningQuarter" radius={radius+4}/></g>
    <g data-portal-layer="selection" className={styles.portalSelection}><QuarterRing asset="exitQuarter" radius={radius+6}/></g>
    {center && <g data-portal-layer="center"><image href={center.url} x={-radius*.6} y={-radius*.6} width={radius*1.2} height={radius*1.2}/></g>}
  </g>;
}
