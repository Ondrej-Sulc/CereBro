import { coordinateKey, gameText, type QuestApplication, type QuestMap } from "@cerebro/core/domain/game-quests";
import type { QuestSpawnRegion } from "@cerebro/core/domain/game-quests/spawn-regions";
import { GameNodeModifierIcon } from "@/components/nodes/GameNodeModifierIcon";
import { QuestPortrait } from "./quest-portrait";
import { regionPortrait } from "./quest-spawn-region-presentation";
import styles from "./quest-map-explorer.module.css";

const applicationIdentity=(a:QuestApplication)=>JSON.stringify([a.effectId,a.target,a.amount,a.description,a.parameters,a.sourceCoordinate,a.sourceType,a.remainActive,a.extra]);
export function QuestSpawnRegionInspector({map,region,inspectTile}:{map:QuestMap;region:QuestSpawnRegion;inspectTile:()=>void}){
  const tiles=new Map(map.tiles.map(tile=>[coordinateKey(tile.coordinate),tile]));
  const regionTiles=region.coordinates.map(c=>tiles.get(coordinateKey(c))!);
  const effects=(regionTiles[0]?.applications??[]).filter(a=>regionTiles.every(tile=>tile.applications.some(other=>applicationIdentity(other)===applicationIdentity(a))));
  return <div data-region-inspector>
    <div className={styles.defender}>
      <div className={styles.defenderIdentity}><QuestPortrait portrait={regionPortrait(region)} large/><div><h3>{region.defender.name}</h3><p className={styles.regionEyebrow}>Encounter region</p></div></div>
      <p className={styles.regionExplanation}>Exact trigger tile varies</p>
      <p className={styles.muted}>The portrait marks a representative location. The highlighted tiles show where this defender can appear.</p>
      <p className={styles.regionSize}>{region.coordinates.length} possible map {region.coordinates.length===1?"position":"positions"}</p>
      <p>{region.defender.rarity}★ · Rank {region.defender.rank} · Level {region.defender.level} · Sig {region.defender.signature}{region.defender.ascensionTier>0?` · A${region.defender.ascensionTier}`:""}</p>
      <small>Recorded defender build</small>
      <p className={styles.muted}>{region.pathIndices.length>1?`Shared by routes ${region.pathIndices.map(i=>i+1).join(', ')}`:region.pathIndices.length?`Route ${region.pathIndices[0]+1}`:"Outside recorded routes"}</p>
    </div>
    <section className={styles.areaEffects}><h3>Area modifiers <span>{effects.length}</span></h3>
      {effects.length>0?<><p className={styles.muted}>Recorded on every highlighted tile.</p>{effects.map(a=><details key={a.id}><summary><GameNodeModifierIcon iconKey={a.iconKey} size={16}/><span className={styles.areaEffectName}>{gameText(a.name)||a.effectId}</span></summary><p className={styles.applicationDescription}>{gameText(a.description)||"Description unavailable for this saved effect."}</p></details>)}</>:<p className={styles.muted}>Effects can vary by location. Select a highlighted tile to inspect its recorded effects.</p>}
      <button className={styles.regionTileButton} onClick={inspectTile}>Inspect representative map tile ↗</button>
    </section>
    <details className={styles.regionSource}><summary>About this encounter region</summary><p>The region boundaries are captured from the game. Defender-to-region associations use the archived reference mapping. The portrait is a representative marker, not a fixed fight tile.</p><p>Personal defender nodes are not established by the region marker.</p>{region.definitionCandidateCount>1&&<p>{region.definitionCandidateCount} saved definition rows share this identity and build.</p>}</details>
  </div>;
}
