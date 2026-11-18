"use client";

import { useEffect,useRef, useState } from "react";
import Link from "next/link";
import { Link2, Route } from "lucide-react";
import { coordinateKey, routeEncounters, type Coordinate, type QuestMap } from "@cerebro/core/domain/game-quests";
import { QuestModifierGroups } from "./quest-modifier-groups";
import { QuestBoard } from "./quest-board";
import { questEncounterPortrait } from "./quest-portrait";
import type { QuestPortrait as Portrait } from "@/lib/game-quests/presentation";
import { questPositionLabel } from "@cerebro/core/domain/game-quests/navigation";
import { questEncounterIsBoss } from "@cerebro/core/domain/game-quests/boss-display";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import { entryCoordinate, mapDefenders } from "./quest-spawn-region-presentation";
import { QuestSpawnRegionInspector } from "./quest-spawn-region-inspector";
import { QuestEncounterSummary } from "./quest-encounter-summary";
import styles from "./quest-map-explorer.module.css";
import type { QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import { QuestMapFeatureDetails } from "./quest-map-features";
import { QuestPortalDetails } from "./quest-portal-details";

export function QuestMapExplorer({ map, initialPath, initialNode, portraits = {}, artwork, initialApplication, spawnRegions, initialRegion, featureLocations = [] }: { map: QuestMap; initialPath?: string; initialNode?: string; initialApplication?:string; portraits?: Record<string, Portrait>; artwork?: { url: string; theme: string } | null; spawnRegions?:QuestSpawnRegionLayer; initialRegion?:string; featureLocations?:QuestMapFeatureLocation[] }) {
  const layer=spawnRegions?.regions.length?spawnRegions:undefined;
  const explicitInitialRegion=layer?.regions.find(r=>r.id===initialRegion);
  const explicitInitialPath = map.paths.find(p => String(p.index) === initialPath);
  const initial = explicitInitialPath ?? map.paths.find(p=>explicitInitialRegion?.pathIndices.includes(p.index)) ?? map.paths[0];
  const firstEntry=mapDefenders(map,layer,initial.index)[0];
  const initialRegionChoice=layer?.regions.find(r=>r.id===initialRegion)??(!initialNode&&firstEntry?.kind==='region'?firstEntry.region:undefined);
  const [pathIndex, setPathIndex] = useState(initial.index);
  const [highlightRoute,setHighlightRoute] = useState(Boolean(explicitInitialPath));
  const [selected, setSelected] = useState(initialRegionChoice?coordinateKey(initialRegionChoice.anchor):initialNode && map.tiles.some(t => coordinateKey(t.coordinate) === initialNode) ? initialNode : coordinateKey(firstEntry?entryCoordinate(firstEntry):initial.coordinates[0]));
  const [selectedRegionId,setSelectedRegionId]=useState<string|undefined>(initialRegionChoice?.id);
  const latestSelection=useRef<{route:number;key:string;region?:string;highlight:boolean}>({route:initial.index,key:selected,region:initialRegionChoice?.id,highlight:Boolean(explicitInitialPath)});
  const [selectedApplication,setSelectedApplication]=useState(initialApplication);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (inspectorRef.current) inspectorRef.current.scrollTop = 0;
  }, [selected, selectedRegionId]);
  const selectedTile = map.tiles.find(t => coordinateKey(t.coordinate) === selected)!;
  const selectedRegion=layer?.regions.find(r=>r.id===selectedRegionId);
  const selectedEncounters = map.encounters.filter(e => coordinateKey(e.coordinate) === selected);
  const selectedBoss = selectedEncounters.some(encounter=>questEncounterIsBoss(map,encounter));
  const selectedFeatures = featureLocations.find(location => coordinateKey(location.coordinate) === selected);
  const selectedRegionTile = layer?.regions.some(region => region.coordinates.some(coordinate => coordinateKey(coordinate) === selected)) ?? false;
  const featureHeading = selectedFeatures?.swaps?.length ? selectedFeatures.gates.length || selectedFeatures.pickups.length || selectedFeatures.chests?.length ? "Path features" : "Champion swap" : selectedFeatures?.chests?.length ? selectedFeatures.gates.length || selectedFeatures.pickups.length ? "Path features" : "Chest" : selectedFeatures?.gates.length ? selectedFeatures.pickups.length ? "Gate & path reward" : "Gate" : "Path reward";
  const otherGates = [...new Map((map.features?.unplacedGateDefinitions ?? []).map(gate => [JSON.stringify([gate.kind,gate.label,gate.requirements]),gate])).values()];
  function commit(c:Coordinate,center:boolean,route:number,region?:string,highlight=latestSelection.current.highlight){
    const key = coordinateKey(c);
    latestSelection.current={route,key,region,highlight};
    setSelected(key);
    setSelectedRegionId(region);
    setPathIndex(route);
    setHighlightRoute(highlight);
    setSelectedApplication(undefined);
    const url=new URL(window.location.href);if(highlight)url.searchParams.set("path",String(route));else url.searchParams.delete('path');if(region){url.searchParams.set('region',region);url.searchParams.delete('node');}else{url.searchParams.set("node",key);url.searchParams.delete('region');}url.searchParams.delete("application");url.searchParams.delete("sourceHash");url.hash="";
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
  function chooseRoute(index:number|null){
    if(index!==null&&!map.paths.some(path=>path.index===index))return;
    if(index===null){const current=latestSelection.current;const tile=map.tiles.find(t=>coordinateKey(t.coordinate)===current.key)!;commit(tile.coordinate,false,current.route,current.region,false);return;}
    const first=mapDefenders(map,layer,index)[0];
    commit(first?entryCoordinate(first):map.paths.find(path=>path.index===index)!.coordinates[0],false,index,first?.kind==='region'?first.region.id:undefined,true);
  }
  useEffect(()=>{
    const back=()=>{
      const params=new URLSearchParams(window.location.search),key=params.get('node');
      const explicitRegion=layer?.regions.find(r=>r.id===params.get('region'));
      const explicitRoute=map.paths.find(path=>String(path.index)===params.get('path'));
      const route=explicitRoute??map.paths.find(path=>explicitRegion?.pathIndices.includes(path.index))??map.paths[0];
      const first=mapDefenders(map,layer,route.index)[0],region=explicitRegion??(!key&&first?.kind==='region'?first.region:undefined);
      const chosen=region?coordinateKey(region.anchor):key&&map.tiles.some(t=>coordinateKey(t.coordinate)===key)?key:coordinateKey(first?entryCoordinate(first):route.coordinates[0]);
      latestSelection.current={route:route.index,key:chosen,region:region?.id,highlight:Boolean(explicitRoute)};
      setHighlightRoute(Boolean(explicitRoute));setPathIndex(route.index);setSelected(chosen);setSelectedRegionId(region?.id);
      setSelectedApplication(params.get('sourceHash')===map.sourceHash?params.get('application')??undefined:undefined);
    };
    window.addEventListener('popstate',back);return()=>window.removeEventListener('popstate',back);
  },[map,layer]);
  const shareUrl = `/quests/${encodeURIComponent(map.questId)}?${new URLSearchParams({ ...(highlightRoute?{path:String(pathIndex)}:{}), ...(selectedRegion?{region:selectedRegion.id}:{node:selected}) })}`;
  return <div className={styles.explorer}>
    {map.modifierCoverage && map.modifierCoverage.applications > map.modifierCoverage.resolvedDefinitions && <p className={styles.coverageNote} data-modifier-coverage>All {map.modifierCoverage.applications} recorded modifier assignments are preserved. Their complete definitions and native icons were not captured.</p>}
    {!layer&&map.encounters.length===1&&map.encounters[0].final&&map.paths.length>1&&<p className={styles.coverageNote} data-encounter-coverage>This saved preview records only the final-boss placement. Other defenders are not established by this capture.</p>}
    <QuestBoard className={styles.layout} mapClassName={styles.mapPanel} map={map} portraits={portraits} selected={selected} pathIndex={pathIndex} highlightRoute={highlightRoute} onChoose={choose} viewportRef={scrollRef} artwork={artwork} spawnRegions={layer} selectedRegion={selectedRegion?.id} onChooseRegion={chooseRegion} featureLocations={featureLocations} routeControl={
          <label className={styles.routeControl} title="Highlight a recorded route"><Route size={16} aria-hidden="true"/><span className={styles.routeLabel}>Highlight route</span><select aria-label="Recorded routes" value={highlightRoute?pathIndex:""} onChange={e=>chooseRoute(e.target.value===""?null:Number(e.target.value))}><option value="">All paths</option>{map.paths.map(p=>{const count=layer?mapDefenders(map,layer,p.index).length:routeEncounters(map,p.index).length;return <option key={p.index} value={p.index}>Route {p.index+1} · {count} {layer?(count===1?'defender':'defenders'):(count===1?'fight':'fights')}</option>;})}</select></label>
    } inspector={
      <section ref={inspectorRef} className={styles.inspector} aria-labelledby="coordinate-heading" aria-live="polite">
        <div className={styles.inspectorBody}>
          <p className={styles.inspectorEyebrow}>{selectedRegion ? "Encounter region" : selectedEncounters.length ? "Encounter details" : "Map location"}</p>
          {selectedRegion?<><QuestSpawnRegionInspector map={map} region={selectedRegion} shareUrl={shareUrl} inspectTile={()=>choose(selectedRegion.anchor,true)}/>{selectedFeatures&&<QuestMapFeatureDetails location={selectedFeatures}/>}</>:<>
          <div className={styles.inspectorHeader}>
            {selectedEncounters.length===1 ? (()=>{const e=selectedEncounters[0],portrait=questEncounterPortrait(e,portraits);return <QuestEncounterSummary headingId="coordinate-heading" name={portrait?.name??e.champion?.name??e.name} portrait={portrait} href={portrait?.href??(e.champion?`/champions/${e.champion.slug}`:null)} rarity={e.rarity} rank={e.rank} level={e.level} signature={e.signature} ascension={e.ascension} npc={!e.champion}/>;})() : <h2 id="coordinate-heading">{selectedFeatures?featureHeading:questPositionLabel(map,selectedTile.coordinate)}</h2>}
            <Link href={shareUrl} className={styles.inspectorShare} aria-label="Link to this location" title="Link to this location"><Link2 size={15} aria-hidden="true"/><span>Link</span></Link>
          </div>
          {selectedTile.start && <p className={styles.tag}>Quest start</p>}{(selectedBoss||selectedTile.final) && <p className={styles.tag}>{selectedBoss?selectedTile.final?"Final boss":"Boss":"Quest finish"}</p>}
          {selectedEncounters.map(e => { const portrait = questEncounterPortrait(e,portraits); return <div key={e.id} className={styles.encounterNotes}>
            {selectedEncounters.length>1&&<QuestEncounterSummary name={portrait?.name??e.champion?.name??e.name} portrait={portrait} href={portrait?.href??(e.champion?`/champions/${e.champion.slug}`:null)} rarity={e.rarity} rank={e.rank} level={e.level} signature={e.signature} ascension={e.ascension} npc={!e.champion}/>}
            {map.adaptive&&<p className={styles.muted}>Adaptive build</p>}
            {e.candidates.length > 1 && <p>Recorded alternatives: {e.candidates.map(c => c.name).join(", ")}</p>}
          </div>; })}
          {!selectedEncounters.length&&!selectedFeatures && <p className={styles.muted}>No placed defender recorded here.</p>}
          {selectedFeatures&&<QuestMapFeatureDetails location={selectedFeatures}/>}
          <QuestPortalDetails tile={selectedTile} choose={choose} positionLabel={c=>questPositionLabel(map,c)}/>
          {(selectedEncounters.length > 0 || (!selectedFeatures && selectedRegionTile)) && <div className={styles.modifierSection}><h3>Node modifiers <span>{selectedTile.applications.length}</span></h3>{!selectedTile.applications.length && <p className={styles.muted}>No node modifiers recorded here.</p>}<QuestModifierGroups key={`${selected}:${map.sourceHash}:${selectedApplication??""}`} applications={selectedTile.applications} questId={map.questId} sourceHash={map.sourceHash} shareUrl={shareUrl} selectedApplication={selectedApplication} positionLabel={c=>questPositionLabel(map,c)} choose={choose}/></div>}
          </>}
        </div>
      </section>
    }/>
    {otherGates.length>0&&<details className={styles.additionalGates}><summary>Additional gate requirements <span>{otherGates.length}</span></summary><p>These gates are defined for this quest; their map locations were not recorded.</p><ul>{otherGates.map(gate=><li key={gate.barrierId}><h3>{gate.label}</h3>{gate.requirements.filter(line=>line!==gate.label).map((line,index)=><p key={index}>{line}</p>)}{!gate.resolved&&<p>Full gate requirements were not captured.</p>}</li>)}</ul></details>}
    <details className={styles.mapAbout}><summary>About this map</summary><div className={styles.summary}><span><strong>{map.paths.length}</strong> recorded routes</span><span><strong>{map.encounters.length}</strong> placed {map.encounters.length===1?'opponent':'opponents'}</span>{layer&&<span className={styles.regionSummary}><strong>{layer.regions.length}</strong> {layer.regions.length===1?'encounter region':'encounter regions'}</span>}{map.details?.chestCoverage==="uncaptured"&&<span>Chest locations not recorded</span>}{map.swapPoints&&map.swapPoints.coverage!=="captured"&&<span>Champion swap locations not fully recorded</span>}{map.modifierCoverage?.definitionCapturedAt&&<span data-modifier-definition-date>Modifier descriptions recorded <time dateTime={map.modifierCoverage.definitionCapturedAt}>{new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeZone:'UTC'}).format(new Date(map.modifierCoverage.definitionCapturedAt))}</time></span>}</div></details>
  </div>;
}
