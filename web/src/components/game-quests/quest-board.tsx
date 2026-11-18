"use client";
import { questEncounterPortrait } from "./quest-portrait";

import { useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronDown, Expand, Gift, LockKeyhole, Minus, PackageOpen, Plus, Scan, Shrink, UsersRound } from "lucide-react";
import { coordinateKey, type Coordinate, type QuestMap, type QuestTile } from "@cerebro/core/domain/game-quests";
import { questBoardLabels } from "@cerebro/core/domain/game-quests/board";
import { questPathFlowDistances } from "@cerebro/core/domain/game-quests/path-flow";
import { questEncounterIsBoss } from "@cerebro/core/domain/game-quests/boss-display";
import { questPositionLabel } from "@cerebro/core/domain/game-quests/navigation";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import { QuestSpawnRegionAreas, QuestSpawnRegionMarkers } from "./quest-spawn-region-layer";
import { regionBoardGeometry, regionBoardLabels } from "./quest-spawn-region-presentation";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { useQuestMapFullscreen } from "./use-quest-map-fullscreen";
import { useQuestMapZoom } from "./use-quest-map-zoom";
import { QuestMapPaths } from "./quest-map-paths";
import { QuestPathPulses } from "./quest-path-pulses";
import { QuestMapEncounterMarker } from "./quest-map-encounter-marker";
import { QuestMapJunctions, QuestMapWaypoint } from "./quest-map-waypoint";
import { questMapMarkerLayout } from "./quest-map-marker-layout";
import styles from "./quest-board.module.css";
import type { QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import { questFeatureLocationLabel } from "@/lib/game-quests/feature-label";
import { QuestMapFeatureMarker } from "./quest-map-features";
import { getQuestPortalArtwork } from "@cerebro/core/data/game-quests/portal-artwork";
import { questMapOverviewPaths } from "./quest-map-overview-paths";

const portalSymbol = getQuestPortalArtwork("small");
const noPulsePhases: ReadonlyMap<string, number> = new Map();
const emptyFeatureLocations: QuestMapFeatureLocation[] = [];

export function QuestBoard({ map, portraits, selected, pathIndex, onChoose, viewportRef, artwork, spawnRegions, selectedRegion, onChooseRegion, onChooseRoute, highlightRoute = true, routeControl, featureLocations = emptyFeatureLocations, className, mapClassName, inspector }: {
  map: QuestMap; portraits: Record<string, QuestPortrait>; selected: string; pathIndex: number;
  onChoose: (c: Coordinate, center?: boolean) => void; viewportRef: RefObject<HTMLDivElement | null>;
  artwork?: { url: string; theme: string } | null;
  spawnRegions?: QuestSpawnRegionLayer; selectedRegion?: string; onChooseRegion?: (id:string) => void;
  onChooseRoute?: (index: number) => void;
  highlightRoute?: boolean; routeControl?: ReactNode;
  featureLocations?: QuestMapFeatureLocation[];
  className?: string;
  mapClassName?: string;
  inspector?: ReactNode;
}) {
  const board = useMemo(() => regionBoardGeometry(map,spawnRegions), [map,spawnRegions]);
  const featuresByKey = useMemo(() => new Map(featureLocations.map(location => [coordinateKey(location.coordinate), location])), [featureLocations]);
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<string | null>(null);
  const [hoveredRegion,setHoveredRegion]=useState<string|null>(null);
  const [pulseRenderer, setPulseRenderer] = useState<'canvas' | 'svg'>('canvas');
  const boardRef = useRef<HTMLDivElement>(null);
  const fullscreen = useQuestMapFullscreen(boardRef);
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const frameRef = useRef<HTMLDivElement>(null), sceneRef = useRef<SVGSVGElement>(null), overviewRef = useRef<SVGRectElement>(null);
  const { scale, scaleRef, fitScale, fitting, ready, onScroll, zoomBy, fitMap, pinchZoom, interruptZoom, canZoomIn, canZoomOut } = useQuestMapZoom({ width: board.width, height: board.height, viewportRef, frameRef, sceneRef, overviewRef, onViewportChange: setViewport });
  const overviewOpen = ready && scale > fitScale * 1.02;
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const pinch=useRef<{distance:number;x:number;y:number}|null>(null);
  const suppressClick=useRef(false);
  const path = map.paths.find(p => p.index === pathIndex)!;
  const routeKeys = useMemo(() => new Set(highlightRoute ? path.coordinates.map(coordinateKey) : []), [highlightRoute, path]);
  const routeEdges = useMemo(() => new Set(highlightRoute ? path.coordinates.slice(1).map((c, i) => `${coordinateKey(path.coordinates[i])}>${coordinateKey(c)}`) : []), [highlightRoute, path]);
  const flowDistances=useMemo(()=>questPathFlowDistances({edges:board.edges,point:board.point,starts:map.tiles.filter(tile=>tile.start).map(tile=>tile.coordinate),selectedPath:highlightRoute?path.coordinates:[]}),[board,map,highlightRoute,path]);
  const routePhases=useMemo(()=>pulseRenderer==='svg'?new Map([...flowDistances].map(([key,distance])=>[key,(distance*scale)%60])):noPulsePhases,[flowDistances,scale,pulseRenderer]);
  const markerLayout = useMemo(() => questMapMarkerLayout(map, board, featureLocations, scale, spawnRegions), [map, board, featureLocations, scale, spawnRegions]);
  const labelScale = 1 / scale;
  const labels = useMemo(() => {const prioritized=[selectedRegion,hoveredRegion,...map.encounters.filter(e=>coordinateKey(e.coordinate)===selected||e.id===hover).map(e=>e.id)].filter((id):id is string=>typeof id==='string');return spawnRegions?regionBoardLabels(map,spawnRegions,board,prioritized,labelScale,markerLayout):questBoardLabels(map,prioritized,labelScale,markerLayout);}, [map,spawnRegions,board,selected,hover,selectedRegion,hoveredRegion,labelScale,markerLayout]);
  const portalTargets = useMemo(() => new Set(board.edges.filter(e=>e.portal).map(e=>coordinateKey(e.to))), [board]);
  const portalKeys = useMemo(() => new Set([...portalTargets, ...map.tiles.filter(tile=>tile.portals.length||tile.randomPortal).map(tile=>coordinateKey(tile.coordinate))]), [map, portalTargets]);
  const waypointTiles = useMemo(() => {
    const junctions = new Map<string, QuestTile>();
    const landmarks: QuestTile[] = [];
    for (const tile of map.tiles) {
      const key = coordinateKey(tile.coordinate);
      if (board.encounters.get(key)?.length || featuresByKey.has(key)) continue;
      if (tile.start || portalKeys.has(key)) landmarks.push(tile);
      else junctions.set(key, tile);
    }
    return { junctions, landmarks };
  }, [map, board, featuresByKey, portalKeys]);
  const selectedJunction = selectedRegion ? undefined : waypointTiles.junctions.get(selected);
  const endPointer=(id:number,cancel=false)=>{if(!pointers.current.has(id))return;if(pointers.current.size===2)interruptZoom();pointers.current.delete(id);pinch.current=null;if(cancel){pointers.current.clear();suppressClick.current=true;}const remaining=[...pointers.current.values()][0],e=viewportRef.current;drag.current=remaining&&e?{x:remaining.x,y:remaining.y,left:e.scrollLeft,top:e.scrollTop,moved:false}:null;};
  const selectedSpawn = spawnRegions?.regions.find(region => region.id === selectedRegion);
  const selectedTile = map.tiles.find(tile => coordinateKey(tile.coordinate) === selected);
  const selectedPosition = selectedSpawn?.anchor ?? selectedTile?.coordinate;
  const selectedFeature = featuresByKey.get(selected);
  const selectedLabel = fullscreen.fullscreen && !inspector
    ? selectedSpawn?.defender.name ?? (selectedTile && (selectedFeature
      ? questFeatureLocationLabel(selectedFeature)
      : questPositionLabel(map, selectedTile.coordinate)))
    : undefined;
  const miniSelected=selectedPosition?board.point(selectedPosition):undefined;
  const miniScale = Math.min(136/board.width,150/board.height), miniWidth=board.width*miniScale, miniHeight=board.height*miniScale;
  const miniPortalSize = Math.max(18,Math.min(80,6/miniScale));
  const miniPaths = useMemo(() => questMapOverviewPaths(board.edges, board.point), [board]);
  const waypoints = useMemo(() => (selectedJunction ? [...waypointTiles.landmarks, selectedJunction] : waypointTiles.landmarks).map(tile => {
    const key = coordinateKey(tile.coordinate), [x, y] = board.point(tile.coordinate);
    return <QuestMapWaypoint key={key} markerScale={markerLayout.scales.get(key)??1} tile={tile} x={x} y={y} label={questPositionLabel(map, tile.coordinate)}
      active={!highlightRoute||routeKeys.has(key)} selected={!selectedRegion&&selected===key} portalTarget={portalTargets.has(key)} onChoose={()=>onChoose(tile.coordinate)}/>;
  }), [map, board, waypointTiles, selectedJunction, markerLayout, highlightRoute, routeKeys, selectedRegion, selected, portalTargets, onChoose]);
  return <div ref={boardRef} className={`${styles.shell} ${className ?? ''}`} data-quest-board data-fullscreen={fullscreen.fullscreen}
    data-map-inspector={inspector ? true : undefined}
    data-window-fullscreen={fullscreen.windowMode || undefined} role={fullscreen.windowMode ? "dialog" : undefined}
    aria-modal={fullscreen.windowMode || undefined} aria-label={fullscreen.windowMode ? "Quest map full screen" : undefined}
    tabIndex={fullscreen.windowMode ? -1 : undefined}>
    <section id="quest-map" className={`${styles.board} ${mapClassName ?? ''}`} style={{'--map-aspect':board.height/board.width} as CSSProperties} aria-label="Map and paths">
    <div className={styles.controls}>
      {routeControl}
      <div className={styles.viewTools} role="group" aria-label="Map view controls">
        <div className={styles.zoom}><button aria-label="Zoom out" title="Zoom out" disabled={!canZoomOut} onClick={() => zoomBy(1 / 1.35)}><Minus size={15} /></button><output aria-label="Map zoom">{Math.round(scale * 100)}%</output><button aria-label="Zoom in" title="Zoom in" disabled={!canZoomIn} onClick={() => zoomBy(1.35)}><Plus size={15} /></button><button aria-pressed={fitting} disabled={!ready} title="Show the whole map" onClick={fitMap}><Scan size={15} /><span>Fit map</span></button></div>
        <div className={styles.controlActions}><button data-map-fullscreen-toggle aria-label={fullscreen.fullscreen ? "Exit full screen" : "Enter full screen"} title={fullscreen.fullscreen ? "Exit full screen (Esc)" : "View map in full screen"} aria-pressed={fullscreen.fullscreen} disabled={fullscreen.busy} onClick={() => void fullscreen.toggle()}>{fullscreen.fullscreen ? <Shrink size={16} /> : <Expand size={16} />}<span>{fullscreen.fullscreen ? "Exit full screen" : "Full screen"}</span></button></div>
      </div>
    </div>
    {fullscreen.fullscreen && !inspector && <div className={styles.fullscreenContext}>{!routeControl && onChooseRoute && <label>Route<select aria-label="Full screen recorded route" value={pathIndex} onChange={e => onChooseRoute(Number(e.target.value))}>{map.paths.map(route => <option key={route.index} value={route.index}>Route {route.index + 1}</option>)}</select></label>}<span aria-live="polite">{selectedLabel}</span></div>}
    <div className={styles.canvasWrap} style={artwork ? { backgroundImage: `linear-gradient(180deg,rgba(5,12,24,.76),rgba(4,10,20,.86)),url("${artwork.url}")` } : undefined}>
      <div ref={viewportRef} className={styles.viewport} role="region" aria-label="Scrollable quest map" aria-busy={!ready} tabIndex={0}
        onScroll={onScroll}
        onPointerDown={e => { if(e.button!==0)return;if(pointers.current.size===0)interruptZoom();suppressClick.current=false;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const el=e.currentTarget;if(pointers.current.size===1)drag.current={x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop,moved:false};if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};el.setPointerCapture(e.pointerId);} }}
        onPointerMove={e => { if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const el=e.currentTarget;
          if(pointers.current.size===2){const [a,b]=[...pointers.current.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2,old=pinch.current;if(old&&old.distance>0){const r=el.getBoundingClientRect();pinchZoom(scaleRef.current*distance/old.distance,{x:old.x-r.left,y:old.y-r.top,nextX:x-r.left,nextY:y-r.top});suppressClick.current=true;}pinch.current={distance,x,y};return;}
          const d=drag.current;if(d&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>5){d.moved=true;suppressClick.current=true;el.setPointerCapture(e.pointerId);el.scrollTo({left:d.left-e.clientX+d.x,top:d.top-e.clientY+d.y});}
        }}
        onPointerUp={e=>endPointer(e.pointerId)}
        onPointerCancel={e=>endPointer(e.pointerId,true)}
        // A touch starts with implicit capture on its SVG target. Losing that
        // child capture while the viewport takes over must not end the gesture.
        onLostPointerCapture={e=>{if(e.target===e.currentTarget)endPointer(e.pointerId);}}
        onClickCapture={e => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation();suppressClick.current=false; } }}
        onKeyDown={e => { if (e.target !== e.currentTarget) return; const amount = 100; if (e.key.startsWith("Arrow")) { e.preventDefault(); interruptZoom(); e.currentTarget.scrollBy({ left: e.key === "ArrowRight" ? amount : e.key === "ArrowLeft" ? -amount : 0, top: e.key === "ArrowDown" ? amount : e.key === "ArrowUp" ? -amount : 0 }); } }}>
        <div ref={frameRef} className={styles.sceneFrame} style={{ width: board.width * scale, height: board.height * scale }}>
        <svg ref={sceneRef} className={styles.scene} data-zoom={scale} data-board-ready={ready} role="group" aria-label={highlightRoute ? `Quest map, recorded route ${pathIndex + 1} highlighted` : "Quest map, all paths"} width={board.width * scale} height={board.height * scale} viewBox={`0 0 ${board.width} ${board.height}`}>
          <title>{`Defender map. ${highlightRoute?"Flowing blue-white connections highlight a recorded route.":"Blue-white connections show all paths."} Violet connections are portals. Dashed teal portraits represent encounter regions.`}</title>
          <defs>
            {map.encounters.map((e, i) => { const [x, y] = board.point(e.coordinate); const radius = e.final ? 31 : 25; return <clipPath key={e.id} id={`${uid}-portrait-${i}`}><circle cx={x} cy={y} r={radius} /></clipPath>; })}
          </defs>
          <QuestMapPaths edges={board.edges} point={board.point} routeEdges={routeEdges} routePhases={routePhases} highlightRoute={highlightRoute} renderPulses={pulseRenderer==='svg'}/>
          <QuestPathPulses edges={board.edges} point={board.point} distances={flowDistances} selectedEdges={routeEdges} highlightRoute={highlightRoute}
            width={board.width} height={board.height} viewportRef={viewportRef} sceneRef={sceneRef} onRendererChange={setPulseRenderer}/>
          {spawnRegions&&<QuestSpawnRegionAreas map={map} layer={spawnRegions} point={board.point} selected={selectedRegion} hovered={hoveredRegion??undefined} pathIndex={pathIndex} highlightRoute={highlightRoute}/>}
          <QuestMapJunctions tiles={waypointTiles.junctions} point={board.point} routeKeys={highlightRoute ? routeKeys : undefined}
            selected={selectedJunction ? selected : undefined} onChoose={onChoose}/>
          {waypoints}
          {map.encounters.map((encounter,index)=>{
            const key=coordinateKey(encounter.coordinate),[x,y]=board.point(encounter.coordinate),isSelected=!selectedRegion&&selected===key;
            return <QuestMapEncounterMarker key={encounter.id} encounter={encounter} portrait={questEncounterPortrait(encounter,portraits)} x={x} y={y} uid={uid} index={index}
              boss={questEncounterIsBoss(map,encounter)} markerScale={markerLayout.scales.get(key)??1}
              selected={isSelected} active={!highlightRoute||routeKeys.has(key)} showLabel={isSelected||hover===encounter.id}
              labelBox={labels.get(encounter.id)} labelUnit={labelScale} portalTarget={portalTargets.has(key)} onChoose={()=>onChoose(encounter.coordinate)} onHover={hovered=>setHover(hovered?encounter.id:null)}
              featureBadge={featuresByKey.has(key)?<QuestMapFeatureMarker location={featuresByKey.get(key)!} x={x} y={y} compact selected={isSelected} active={!highlightRoute||routeKeys.has(key)} onChoose={()=>onChoose(encounter.coordinate)}/>:undefined}
              featureLabel={featuresByKey.has(key)?questFeatureLocationLabel(featuresByKey.get(key)!):undefined}/>;
          })}
          {featureLocations.filter(location=>!board.encounters.get(coordinateKey(location.coordinate))?.length&&!spawnRegions?.regions.some(region=>coordinateKey(region.anchor)===coordinateKey(location.coordinate))).map(location=>{const key=coordinateKey(location.coordinate),[x,y]=board.point(location.coordinate);return <QuestMapFeatureMarker key={key} portal={portalKeys.has(key)} markerScale={markerLayout.scales.get(key)??1} location={location} x={x} y={y} selected={!selectedRegion&&selected===key} active={!highlightRoute||routeKeys.has(key)} onChoose={()=>onChoose(location.coordinate)}/>;})}
          {spawnRegions&&onChooseRegion&&<QuestSpawnRegionMarkers map={map} layer={spawnRegions} point={board.point} selected={selectedRegion} hovered={hoveredRegion??undefined} pathIndex={pathIndex} highlightRoute={highlightRoute} onChoose={onChooseRegion} onHover={setHoveredRegion} uid={uid} labels={labels} labelScale={labelScale} markerScales={markerLayout.scales}
            featureLabel={coordinate=>{const feature=featuresByKey.get(coordinateKey(coordinate));return feature?questFeatureLocationLabel(feature):undefined;}}
            featureBadge={(coordinate,x,y,isSelected,active)=>{const feature=featuresByKey.get(coordinateKey(coordinate));return feature?<QuestMapFeatureMarker location={feature} x={x} y={y} compact selected={isSelected} active={active} onChoose={()=>onChoose(coordinate)}/>:null;}}/>}
        </svg>
        </div>
      </div>
      {overviewOpen && <div id={`${uid}-overview`} className={styles.navigator}><span>Overview</span><svg role="group" tabIndex={0} aria-label="Map overview" width={miniWidth} height={miniHeight} viewBox={`0 0 ${board.width} ${board.height}`} onClick={e => { interruptZoom();const rect=e.currentTarget.getBoundingClientRect();if(!rect.width||!rect.height)return;const x=(e.clientX-rect.left)/rect.width*board.width,y=(e.clientY-rect.top)/rect.height*board.height; viewportRef.current?.scrollTo({left:Math.max(0,Math.min(board.width*scaleRef.current-viewport.width,x*scaleRef.current-viewport.width/2)),top:Math.max(0,Math.min(board.height*scaleRef.current-viewport.height,y*scaleRef.current-viewport.height/2)),behavior:"smooth"}); }} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();interruptZoom();const element=viewportRef.current;if(element)element.scrollTo({left:Math.max(0,Math.min(board.width*scaleRef.current-viewport.width,element.scrollLeft+(e.key==='ArrowRight'?viewport.width/2:e.key==='ArrowLeft'?-viewport.width/2:0))),top:Math.max(0,Math.min(board.height*scaleRef.current-viewport.height,element.scrollTop+(e.key==='ArrowDown'?viewport.height/2:e.key==='ArrowUp'?-viewport.height/2:0))),behavior:'smooth'});}}>
        <title>Click to move around the map, or use arrow keys</title>
        {miniPaths.map((run,index)=><path key={index} data-overview-connections={run.portal?"portal":"normal"} d={run.d} fill="none" stroke={run.portal?"#ad85d0":"#6c91a7"} strokeWidth="4"/>)}{map.encounters.map(e=>{const [x,y]=board.point(e.coordinate);return <circle key={e.id} cx={x} cy={y} r="12" fill={questEncounterIsBoss(map,e)?"#efc772":!highlightRoute||routeKeys.has(coordinateKey(e.coordinate))?"#c5f4ff":"#677d8e"}/>;})}{featureLocations.map(location=>{
          const key=coordinateKey(location.coordinate),[x,y]=board.point(location.coordinate);
          const otherFeatures=Boolean(location.gates.length||location.pickups.length||location.chests?.length);
          const portal=portalKeys.has(key);
          const coLocated=portal||otherFeatures||board.encounters.get(key)?.length||spawnRegions?.regions.some(region=>coordinateKey(region.anchor)===key);
          return <g key={key}>
            {otherFeatures&&<rect data-overview-feature x={x-7} y={y-7} width="14" height="14" rx={location.gates.length?2:5} fill={location.gates.length?"#e7b362":location.chests?.length?"#dfbf7e":"#89e3c7"}/>}
            {Boolean(location.swaps?.length)&&<g data-overview-swap={key} transform={`translate(${x+(portal?miniPortalSize*.65:coLocated?11:0)} ${y+(portal?miniPortalSize*.65:coLocated?11:0)})`}>
              <rect x="-7" y="-7" width="14" height="14" rx="4" fill="#42d5d0" stroke="#06383f" strokeWidth="1.5"/>
              <path d="M-4-2h8m-2-2 2 2-2 2M4 2h-8m2-2-2 2 2 2" fill="none" stroke="#073b43" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </g>}
          </g>;
        })}{spawnRegions?.regions.map(region=>{const [x,y]=board.point(region.anchor);return <circle key={region.id} data-overview-region={region.id} cx={x} cy={y} r="11" fill="#6ddfc7" fillOpacity=".7"/>;})}{portalSymbol&&map.tiles.filter(tile=>tile.portals.length||tile.randomPortal||portalTargets.has(coordinateKey(tile.coordinate))).map(tile=>{const [x,y]=board.point(tile.coordinate);return <image key={`portal:${coordinateKey(tile.coordinate)}`} data-overview-portal href={portalSymbol.url} x={x-miniPortalSize/2} y={y-miniPortalSize/2} width={miniPortalSize} height={miniPortalSize} preserveAspectRatio="xMidYMid meet" pointerEvents="none"/>;})}{miniSelected&&<circle data-overview-selection cx={miniSelected[0]} cy={miniSelected[1]} r="19" fill="none" stroke="#f1fbff" strokeWidth="4"/>}<rect ref={overviewRef} data-overview-viewport x={viewport.x/scale} y={viewport.y/scale} width={Math.min(board.width,viewport.width/scale)} height={Math.min(board.height,viewport.height/scale)} fill="#77d8ff" fillOpacity=".12" stroke="#a6e5ff" strokeWidth="5" />
      </svg></div>}
    </div>
    <details className={styles.mapKey}><summary>Map key<ChevronDown size={13} aria-hidden="true"/></summary><div className={styles.legend}>{highlightRoute?<><span><i className={styles.selectedRoute}/>Selected route</span><span><i className={styles.alternative}/>Other routes</span></>:<span><i className={styles.alternative}/>Paths</span>}<span><i className={styles.portal}/>Portal link</span>{portalSymbol&&<span><svg className={styles.portalLegend} width="14" height="14" aria-hidden="true"><image href={portalSymbol.url} width="14" height="14"/></svg>Portal</span>}<span><i className={styles.boss}/>Boss</span>{featureLocations.some(location=>location.gates.length>0)&&<span><LockKeyhole size={12} aria-hidden="true"/>Gate</span>}{featureLocations.some(location=>location.pickups.length>0)&&<span><Gift size={12} aria-hidden="true"/>Path reward</span>}{featureLocations.some(location=>Boolean(location.chests?.length))&&<span><PackageOpen size={12} aria-hidden="true"/>Chest</span>}{featureLocations.some(location=>Boolean(location.swaps?.length))&&<span><UsersRound size={12} color="#78ebe2" aria-hidden="true"/>Champion swap</span>}{spawnRegions&&<span><i className={styles.regionKey}/>Encounter region · ∼</span>}<span>Badge = shared routes</span><p>Drag to pan · Pinch or scroll to zoom</p></div></details>
    </section>
    {inspector}
  </div>;
}
