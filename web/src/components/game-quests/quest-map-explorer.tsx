"use client";

import { useEffect,useRef, useState } from "react";
import Link from "next/link";
import { coordinateKey, routeEncounters, type Coordinate, type QuestMap } from "@cerebro/core/domain/game-quests";
import { QuestApplicationDetails } from "./quest-application-details";
import { QuestBoard } from "./quest-board";
import { QuestPortrait, questEncounterPortrait } from "./quest-portrait";
import type { QuestPortrait as Portrait } from "@/lib/game-quests/presentation";
import { questPositionLabel } from "@cerebro/core/domain/game-quests/navigation";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import { entryCoordinate, mapDefenders, regionPortrait } from "./quest-spawn-region-presentation";
import { QuestSpawnRegionInspector } from "./quest-spawn-region-inspector";
import styles from "./quest-map-explorer.module.css";

export function QuestMapExplorer({ map, initialPath, initialNode, portraits = {}, artwork, initialApplication, spawnRegions, initialRegion }: { map: QuestMap; initialPath?: string; initialNode?: string; initialApplication?:string; portraits?: Record<string, Portrait>; artwork?: { url: string; theme: string } | null; spawnRegions?:QuestSpawnRegionLayer; initialRegion?:string }) {
  const layer=spawnRegions?.regions.length?spawnRegions:undefined;
  const explicitInitialRegion=layer?.regions.find(r=>r.id===initialRegion);
  const initial = map.paths.find(p => String(p.index) === initialPath) ?? map.paths.find(p=>explicitInitialRegion?.pathIndices.includes(p.index)) ?? map.paths[0];
  const firstEntry=mapDefenders(map,layer,initial.index)[0];
  const initialRegionChoice=layer?.regions.find(r=>r.id===initialRegion)??(!initialNode&&firstEntry?.kind==='region'?firstEntry.region:undefined);
  const [pathIndex, setPathIndex] = useState(initial.index);
  const [selected, setSelected] = useState(initialRegionChoice?coordinateKey(initialRegionChoice.anchor):initialNode && map.tiles.some(t => coordinateKey(t.coordinate) === initialNode) ? initialNode : coordinateKey(firstEntry?entryCoordinate(firstEntry):initial.coordinates[0]));
  const [selectedRegionId,setSelectedRegionId]=useState<string|undefined>(initialRegionChoice?.id);
  const latestSelection=useRef<{route:number;key:string;region?:string}>({route:initial.index,key:selected,region:initialRegionChoice?.id});
  const [allEncounters, setAllEncounters] = useState(false);
  const [selectedApplication,setSelectedApplication]=useState(initialApplication);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedTile = map.tiles.find(t => coordinateKey(t.coordinate) === selected)!;
  const fights = routeEncounters(map, pathIndex);
  const displayed = mapDefenders(map,layer,allEncounters?undefined:pathIndex);
  const selectedRegion=layer?.regions.find(r=>r.id===selectedRegionId);
  const selectedEncounters = map.encounters.filter(e => coordinateKey(e.coordinate) === selected);
  function commit(c:Coordinate,center:boolean,route:number,region?:string){
    const key = coordinateKey(c);
    latestSelection.current={route,key,region};
    setSelected(key);
    setSelectedRegionId(region);
    setPathIndex(route);
    setSelectedApplication(undefined);
    const url=new URL(window.location.href);url.searchParams.set("path",String(route));if(region){url.searchParams.set('region',region);url.searchParams.delete('node');}else{url.searchParams.set("node",key);url.searchParams.delete('region');}url.searchParams.delete("application");url.searchParams.delete("sourceHash");url.hash="";
    if(url.href!==window.location.href)window.history.pushState(null,"",url);
    if (center) window.requestAnimationFrame(() => {
      const viewport = scrollRef.current;
      const node = region?[...viewport?.querySelectorAll('[data-spawn-region]')??[]].find(e=>e.getAttribute('data-spawn-region')===region):viewport?.querySelector(`[data-coordinate="${key}"]`);
      if (!viewport || !node) return;
      const n = node.getBoundingClientRect(), v = viewport.getBoundingClientRect();
      viewport.scrollBy({ left: n.x + n.width / 2 - v.x - v.width / 2, top: n.y + n.height / 2 - v.y - v.height / 2, behavior: "smooth" });
    });
  }
  function choose(c:Coordinate,center=false,route=latestSelection.current.route){commit(c,center,route);}
  function chooseRegion(id:string,center=false,route=latestSelection.current.route){const region=layer?.regions.find(r=>r.id===id);if(region)commit(region.anchor,center,region.pathIndices.includes(route)?route:region.pathIndices[0]??route,id);}
  function chooseRoute(index:number){const first=mapDefenders(map,layer,index)[0];if(first?.kind==='region')chooseRegion(first.region.id,false,index);else choose(first?entryCoordinate(first):map.paths.find(p=>p.index===index)!.coordinates[0],false,index);}
  useEffect(()=>{const back=()=>{const params=new URLSearchParams(window.location.search),key=params.get("node"),explicitRegion=layer?.regions.find(r=>r.id===params.get('region'));const route=map.paths.find(p=>String(p.index)===params.get("path"))??map.paths.find(p=>explicitRegion?.pathIndices.includes(p.index))??map.paths[0];const first=mapDefenders(map,layer,route.index)[0],region=explicitRegion??(!key&&first?.kind==='region'?first.region:undefined);const chosen=region?coordinateKey(region.anchor):key&&map.tiles.some(t=>coordinateKey(t.coordinate)===key)?key:coordinateKey(first?entryCoordinate(first):route.coordinates[0]);latestSelection.current={route:route.index,key:chosen,region:region?.id};setPathIndex(route.index);setSelected(chosen);setSelectedRegionId(region?.id);setSelectedApplication(params.get("sourceHash")===map.sourceHash?params.get("application")??undefined:undefined);};window.addEventListener("popstate",back);return()=>window.removeEventListener("popstate",back);},[map,layer]);
  const shareUrl = `/quests/${encodeURIComponent(map.questId)}?${new URLSearchParams({ path: String(pathIndex), ...(selectedRegion?{region:selectedRegion.id}:{node:selected}) })}`;
  return <div className={styles.explorer}>
    <div className={styles.summary}><span><strong>{map.paths.length}</strong> recorded routes</span><span><strong>{map.encounters.length}</strong> placed {map.encounters.length===1?'opponent':'opponents'}</span>{layer&&<span className={styles.regionSummary}><strong>{layer.regions.length}</strong> {layer.regions.length===1?'encounter region':'encounter regions'}</span>}</div>
    {map.modifierCoverage && map.modifierCoverage.applications > map.modifierCoverage.resolvedDefinitions && <p className={styles.coverageNote} data-modifier-coverage>All {map.modifierCoverage.applications} recorded modifier assignments are preserved. Their complete definitions and native icons were not captured.</p>}
    {!layer&&map.encounters.length===1&&map.encounters[0].final&&map.paths.length>1&&<p className={styles.coverageNote} data-encounter-coverage>This saved preview records only the final-boss placement. Other defenders are not established by this capture.</p>}
    <div className={styles.layout}>
      <section className={styles.mapPanel} aria-labelledby="quest-map-heading">
        <div className={styles.toolbar}><h2 id="quest-map-heading">Map &amp; paths</h2><label>Route<select aria-label="Recorded routes" value={pathIndex} onChange={e=>chooseRoute(Number(e.target.value))}>{map.paths.map(p=>{const count=layer?mapDefenders(map,layer,p.index).length:routeEncounters(map,p.index).length;return <option key={p.index} value={p.index}>Route {p.index+1} · {count} {layer?(count===1?'defender':'defenders'):(count===1?'fight':'fights')}</option>;})}</select></label></div>
        <QuestBoard map={map} portraits={portraits} selected={selected} pathIndex={pathIndex} onChoose={choose} viewportRef={scrollRef} artwork={artwork} spawnRegions={layer} selectedRegion={selectedRegion?.id} onChooseRegion={chooseRegion} onChooseRoute={chooseRoute}/>
      </section>
      <section className={styles.inspector} aria-labelledby="coordinate-heading" aria-live="polite">
        <div className={styles.inspectorHeading}><p>{selectedRegion?'Encounter region':'Selected location'}</p><h2 id="coordinate-heading">{selectedRegion?selectedRegion.defender.name:questPositionLabel(map,selectedTile.coordinate)}</h2><Link href={shareUrl} className={styles.share} data-region-share={selectedRegion?true:undefined}>{selectedRegion?'Link to this region':'Link to this location'} ↗</Link></div>
        <div className={styles.inspectorBody}>
          {selectedRegion?<QuestSpawnRegionInspector map={map} region={selectedRegion} inspectTile={()=>choose(selectedRegion.anchor,true)}/>:<>
          {selectedTile.start && <p className={styles.tag}>Quest start</p>}{selectedTile.final && <p className={styles.tag}>Finish</p>}{selectedTile.hidden && <p className={styles.tag}>Source marked hidden</p>}
          {selectedEncounters.map(e => { const portrait = questEncounterPortrait(e,portraits); return <div key={e.id} className={styles.defender}>
            <div className={styles.defenderIdentity}><QuestPortrait portrait={portrait} large /><div><h3>{e.champion ? <Link href={portrait?.href ?? `/champions/${e.champion.slug}`}>{portrait?.name ?? e.champion.name} ↗</Link> : e.name}</h3>{portrait && e.champion && <p style={{ color: portrait.color }}>{portrait.className}</p>}{!e.champion && <p className={styles.unknown}>NPC / legacy defender</p>}</div></div>
            <p>{e.rarity}★ · Rank {e.rank} · Level {e.level} · Sig {e.signature}</p><small>Recorded build{map.adaptive ? " · adaptive source" : ""}</small>
            <p className={styles.muted}>{e.pathIndices.length > 1 ? `Shared by routes ${e.pathIndices.map(i => i + 1).join(", ")}` : e.pathIndices.length ? `Route ${e.pathIndices[0] + 1}` : "Outside recorded routes"}</p>
            {e.candidates.length > 1 && <p>Recorded alternatives: {e.candidates.map(c => c.name).join(", ")}</p>}
            <details className={styles.identity}><summary>Defender data</summary><p>Character: {e.gameId} · Blueprint: {e.tierId} · Placement: {e.bossKey}{!e.champion && " · No exact playable champion match"}</p></details>
          </div>; })}
          {!selectedEncounters.length && <p className={styles.muted}>No placed defender recorded here.</p>}
          <div className={styles.connections}><h3>Outgoing connections</h3>{!selectedTile.links.length && !selectedTile.portals.length && <p className={styles.muted}>No outgoing connection recorded.</p>}{selectedTile.links.map(c => <button key={`l:${coordinateKey(c)}`} onClick={() => choose(c, true)}>→ {questPositionLabel(map,c)}</button>)}{selectedTile.portals.map((p, i) => <button className={styles.portal} key={`p:${i}`} onClick={() => choose(p.target, true)}>Portal → {questPositionLabel(map,p.target)}{p.label && ` · ${p.label}`}{selectedTile.randomPortal && " · Random target"}</button>)}</div>
          <div className={styles.applications}><h3>Node applications <span>{selectedTile.applications.length}</span></h3>{!selectedTile.applications.length && <p className={styles.muted}>No assigned applications recorded here.</p>}{selectedTile.applications.map(a => <QuestApplicationDetails key={a.id} application={a} questId={map.questId} sourceHash={map.sourceHash} shareUrl={shareUrl} initialOpen={selectedApplication===a.id} positionLabel={c=>questPositionLabel(map,c)} choose={choose}/>)}</div>
          </>}
        </div>
      </section>
    </div>
    <section className={styles.encounters}>
      <div className={styles.sectionHeading}><div><h2>{allEncounters?(layer?'All opponents':'All placed opponents'):`Route ${pathIndex+1} · Encounter order`}</h2>
        <p>{layer?(allEncounters?`${map.encounters.length} fixed ${map.encounters.length===1?'position':'positions'} · ${layer.regions.length} encounter regions`:`${displayed.length} ${displayed.length===1?'defender':'defenders'} on this recorded route`):allEncounters?`${map.encounters.length} unique ${map.encounters.length===1?'placement':'placements'} across this map`:`${fights.length} ${fights.length===1?'fight':'fights'} on this recorded route`}</p>
      </div><button onClick={()=>setAllEncounters(v=>!v)}>{allEncounters?'Selected route':layer?'All opponents':'All placements'}</button></div>
      <ol className={styles.fightList}>{displayed.map((entry,i)=>{
        const region=entry.kind==='region'?entry.region:undefined,e=entry.kind==='fixed'?entry.encounter:undefined;
        const name=region?.defender.name??e?.champion?.name??e?.name,rarity=region?.defender.rarity??e!.rarity;
        const paths=region?.pathIndices??e!.pathIndices,portrait=region?regionPortrait(region):questEncounterPortrait(e!,portraits);
        const pressed=region?selectedRegion?.id===region.id:!selectedRegion&&selected===coordinateKey(e!.coordinate);
        return <li key={region?`region:${region.id}`:e!.id} data-region-list-entry={region?.id}>
          <button aria-pressed={pressed} onClick={()=>region?chooseRegion(region.id,true):choose(e!.coordinate,true)}>
            <span className={region?`${styles.ordinal} ${styles.regionOrdinal}`:styles.ordinal}>{allEncounters?(region?'∼':'·'):i+1}</span><QuestPortrait portrait={portrait}/>
            <span className={styles.fightText}><strong>{name}</strong><small>{rarity}★{region?' · Encounter region':<>{e?.champion&&portraits[e.gameId]?` · ${portraits[e.gameId].className}`:''}{e?.final?' · Final':''}{!e?.champion?' · NPC / legacy':''}</>}</small></span>
            <span className={styles.pathCount}>{paths.length>1?`${paths.length} routes`:''} ↗</span>
          </button>
        </li>;
      })}</ol>
    </section>

  </div>;
}
