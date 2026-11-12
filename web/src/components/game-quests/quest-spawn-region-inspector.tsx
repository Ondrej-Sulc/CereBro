import { coordinateKey, gameText, type QuestApplication, type QuestMap } from "@cerebro/core/domain/game-quests";
import type { QuestSpawnRegion } from "@cerebro/core/domain/game-quests/spawn-regions";
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon";
import Link from "next/link";
import { Link2 } from "lucide-react";
import { QuestEncounterSummary } from "./quest-encounter-summary";
import { regionPortrait } from "./quest-spawn-region-presentation";
import styles from "./quest-map-explorer.module.css";

const applicationIdentity=(a:QuestApplication)=>JSON.stringify([a.effectId,a.target,a.amount,a.description,a.parameters,a.sourceCoordinate,a.sourceType,a.remainActive,a.extra]);
export function QuestSpawnRegionInspector({map,region,shareUrl,inspectTile}:{map:QuestMap;region:QuestSpawnRegion;shareUrl:string;inspectTile:()=>void}){
  const tiles=new Map(map.tiles.map(tile=>[coordinateKey(tile.coordinate),tile]));
  const regionTiles=region.coordinates.map(c=>tiles.get(coordinateKey(c))!);
  const effects=(regionTiles[0]?.applications??[]).filter(a=>regionTiles.every(tile=>tile.applications.some(other=>applicationIdentity(other)===applicationIdentity(a))));
  return <div data-region-inspector>
    <div className={styles.inspectorHeader}>
      <QuestEncounterSummary headingId="coordinate-heading" name={region.defender.name} portrait={regionPortrait(region)} rarity={region.defender.rarity} rank={region.defender.rank} level={region.defender.level} signature={region.defender.signature} ascension={region.defender.ascensionTier}/>
      <Link href={shareUrl} className={styles.inspectorShare} data-region-share aria-label="Link to this region" title="Link to this region"><Link2 size={18} aria-hidden="true"/></Link>
    </div>
    <p className={styles.regionExplanation}>Exact trigger tile varies</p>
    <p className={styles.muted}>{region.coordinates.length} possible map {region.coordinates.length===1?"position":"positions"}. Highlighted tiles show where this defender can appear.</p>
    <section className={styles.areaEffects}><h3>Area modifiers <span>{effects.length}</span></h3>
      {effects.length>0?<><p className={styles.muted}>Recorded on every highlighted tile.</p>{effects.map(a=><details key={a.id} open><summary><GameNodeModifierIcon iconKey={a.iconKey} size={16}/><span className={styles.areaEffectName}>{gameText(a.name)||"Area modifier"}</span></summary><p className={styles.applicationDescription}>{gameText(a.description)||"Description unavailable for this saved effect."}</p></details>)}</>:<p className={styles.muted}>Effects can vary by location. Select a highlighted tile to inspect its recorded effects.</p>}
      <button className={styles.regionTileButton} onClick={inspectTile}>Inspect representative map tile ↗</button>
    </section>
    <details className={styles.regionSource}><summary>About this encounter region</summary><p>The region boundaries are captured from the game. Defender-to-region associations use the archived reference mapping. The portrait is a representative marker, not a fixed fight tile.</p><p>Personal defender nodes are not established by the region marker.</p>{region.definitionCandidateCount>1&&<p>{region.definitionCandidateCount} saved definition rows share this identity and build.</p>}</details>
  </div>;
}
