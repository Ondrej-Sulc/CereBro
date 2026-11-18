"use client";
import { questEncounterPortrait } from "./quest-portrait";

import { useEffect,useLayoutEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronDown, Expand, Gift, LockKeyhole, Minus, PackageOpen, Plus, Scan, Shrink } from "lucide-react";
import { coordinateKey, type Coordinate, type QuestMap } from "@cerebro/core/domain/game-quests";
import { questBoardLabels } from "@cerebro/core/domain/game-quests/board";
import { questPathFlowDistances } from "@cerebro/core/domain/game-quests/path-flow";
import { questEncounterIsBoss } from "@cerebro/core/domain/game-quests/boss-display";
import { questPositionLabel, questZoom } from "@cerebro/core/domain/game-quests/navigation";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import { QuestSpawnRegionAreas, QuestSpawnRegionMarkers } from "./quest-spawn-region-layer";
import { regionBoardGeometry, regionBoardLabels } from "./quest-spawn-region-presentation";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { useQuestMapFullscreen } from "./use-quest-map-fullscreen";
import { QuestMapPaths } from "./quest-map-paths";
import { QuestMapEncounterMarker } from "./quest-map-encounter-marker";
import { QuestMapWaypoint } from "./quest-map-waypoint";
import styles from "./quest-board.module.css";
import type { QuestMapFeatureLocation } from "@/lib/game-quests/map-features";
import { questFeatureLocationLabel } from "@/lib/game-quests/feature-label";
import { QuestMapFeatureMarker } from "./quest-map-features";
import { getQuestPortalArtwork } from "@cerebro/core/data/game-quests/portal-artwork";

const portalSymbol = getQuestPortalArtwork("small");

export function QuestBoard({ map, portraits, selected, pathIndex, onChoose, viewportRef, artwork, spawnRegions, selectedRegion, onChooseRegion, onChooseRoute, highlightRoute = true, routeControl, featureLocations = [] }: {
  map: QuestMap; portraits: Record<string, QuestPortrait>; selected: string; pathIndex: number;
  onChoose: (c: Coordinate, center?: boolean) => void; viewportRef: RefObject<HTMLDivElement | null>;
  artwork?: { url: string; theme: string } | null;
  spawnRegions?: QuestSpawnRegionLayer; selectedRegion?: string; onChooseRegion?: (id:string) => void;
  onChooseRoute?: (index: number) => void;
  highlightRoute?: boolean; routeControl?: ReactNode;
  featureLocations?: QuestMapFeatureLocation[];
}) {
  const board = useMemo(() => regionBoardGeometry(map,spawnRegions), [map,spawnRegions]);
  const featuresByKey = useMemo(() => new Map(featureLocations.map(location => [coordinateKey(location.coordinate), location])), [featureLocations]);
  const uid = useId().replace(/:/g, "");
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(.7);
  const [fitting, setFitting] = useState(true);
  const fittingRef = useRef(true);
  const [hover, setHover] = useState<string | null>(null);
  const [hoveredRegion,setHoveredRegion]=useState<string|null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const fullscreen = useQuestMapFullscreen(boardRef);
  const [ready, setReady] = useState(false);
  const overviewOpen = ready && scale > fitScale * 1.02;
  const [viewport, setViewport] = useState({ x: 0, y: 0, width: 1, height: 1 });
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null);
  const scaleRef=useRef(scale);scaleRef.current=scale;
  const fitRef=useRef(fitScale);fitRef.current=fitScale;
  const pointers=useRef(new Map<number,{x:number;y:number}>());
  const pinch=useRef<{distance:number;x:number;y:number}|null>(null);
  const suppressClick=useRef(false);
  const pendingPan=useRef<{left:number;top:number}|null>(null);
  function applyZoom(next:number,anchor?:{x:number;y:number;nextX?:number;nextY?:number}) {
    const e=viewportRef.current;if(!e)return;
    const current=pendingPan.current??{left:e.scrollLeft,top:e.scrollTop};
    const result=questZoom({scale:scaleRef.current,next,min:fitRef.current,max:Math.max(2.5,fitRef.current*2.5),left:current.left,top:current.top,anchorX:anchor?.x??e.clientWidth/2,anchorY:anchor?.y??e.clientHeight/2,width:e.clientWidth,boardWidth:board.width,height:e.clientHeight,boardHeight:board.height});
    fittingRef.current = Math.abs(result.scale - fitRef.current) < .0001;
    setFitting(fittingRef.current);
    const pan={left:Math.max(0,Math.min(board.width*result.scale-e.clientWidth,result.left+(anchor?.x??0)-(anchor?.nextX??anchor?.x??0))),top:Math.max(0,Math.min(board.height*result.scale-e.clientHeight,result.top+(anchor?.y??0)-(anchor?.nextY??anchor?.y??0)))};pendingPan.current=pan;
    scaleRef.current=result.scale;setScale(result.scale);
    if(Number(e.querySelector('[data-zoom]')?.getAttribute('data-zoom'))===result.scale){e.scrollTo(pan);pendingPan.current=null;}
  }
  // Scroll bounds must belong to the newly committed SVG, especially on small phone maps.
  useLayoutEffect(()=>{
    const e=viewportRef.current;if(!e)return;
    if(pendingPan.current){e.scrollTo(pendingPan.current);pendingPan.current=null;}
    setViewport({x:e.scrollLeft,y:e.scrollTop,width:e.clientWidth,height:e.clientHeight});
  },[scale,viewportRef,board]);
  useEffect(()=>{
    const e=viewportRef.current;if(!e)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();const r=e.getBoundingClientRect();const delta=event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?e.clientHeight:1);applyZoom(scaleRef.current*Math.exp(-delta*.002),{x:event.clientX-r.left,y:event.clientY-r.top});};
    e.addEventListener("wheel",wheel,{passive:false});return()=>e.removeEventListener("wheel",wheel);
    // Geometry is stable for this source; live scale/fit are held in refs for rapid trackpad events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[board.width,board.height,viewportRef]);
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => {
      const fit = Math.min(element.clientWidth / board.width, element.clientHeight / board.height);
      if (!Number.isFinite(fit) || fit <= 0) return;
      setFitScale(fit);fitRef.current=fit;
      setViewport({ x: element.scrollLeft, y: element.scrollTop, width: element.clientWidth, height: element.clientHeight });
      if (fittingRef.current || scaleRef.current < fit) {
        fittingRef.current = true; setFitting(true);
        pendingPan.current = { left: 0, top: 0 };
        scaleRef.current = fit; setScale(fit);
        element.scrollTo(0, 0);
      }
      setReady(true);
    };
    const resize = new ResizeObserver(update); resize.observe(element); update();
    return () => resize.disconnect();
  // Fit follows viewport/fullscreen changes until the user chooses a closer view.
  }, [board.width, board.height, viewportRef]);
  const path = map.paths.find(p => p.index === pathIndex)!;
  const routeKeys = new Set(highlightRoute ? path.coordinates.map(coordinateKey) : []);
  const routeEdges = new Set(highlightRoute ? path.coordinates.slice(1).map((c, i) => `${coordinateKey(path.coordinates[i])}>${coordinateKey(c)}`) : []);
  const flowDistances=useMemo(()=>questPathFlowDistances({edges:board.edges,point:board.point,starts:map.tiles.filter(tile=>tile.start).map(tile=>tile.coordinate),selectedPath:highlightRoute?path.coordinates:[]}),[board,map,highlightRoute,path]);
  const routePhases=useMemo(()=>new Map([...flowDistances].map(([key,distance])=>[key,(distance*scale)%60])),[flowDistances,scale]);
  const labelScale = 1 / scale;
  const labels = useMemo(() => {const prioritized=[selectedRegion,hoveredRegion,...map.encounters.filter(e=>coordinateKey(e.coordinate)===selected||e.id===hover).map(e=>e.id)].filter((id):id is string=>typeof id==='string');return spawnRegions?regionBoardLabels(map,spawnRegions,board,prioritized,labelScale):questBoardLabels(map,prioritized,labelScale);}, [map,spawnRegions,board,selected,hover,selectedRegion,hoveredRegion,labelScale]);
  const portalTargets = new Set(board.edges.filter(e=>e.portal).map(e=>coordinateKey(e.to)));
  const positionNames=useMemo(()=>new Map(map.tiles.map(t=>{const feature=featuresByKey.get(coordinateKey(t.coordinate));return [coordinateKey(t.coordinate),feature?questFeatureLocationLabel(feature):questPositionLabel(map,t.coordinate)];})),[map,featuresByKey]);
  const zoom = (next: number) => {
    applyZoom(next);
  };
  const fitMap = () => {
    fittingRef.current = true; setFitting(true);
    pendingPan.current = { left: 0, top: 0 };
    scaleRef.current = fitRef.current; setScale(fitRef.current);
    viewportRef.current?.scrollTo(0, 0);
  };
  const endPointer=(id:number,cancel=false)=>{if(!pointers.current.has(id))return;pointers.current.delete(id);pinch.current=null;if(cancel){pointers.current.clear();suppressClick.current=true;}const remaining=[...pointers.current.values()][0],e=viewportRef.current;drag.current=remaining&&e?{x:remaining.x,y:remaining.y,left:e.scrollLeft,top:e.scrollTop,moved:false}:null;};
  const selectedPosition=spawnRegions?.regions.find(region=>region.id===selectedRegion)?.anchor??map.tiles.find(tile=>coordinateKey(tile.coordinate)===selected)?.coordinate;
  const miniSelected=selectedPosition?board.point(selectedPosition):undefined;
  const miniScale = Math.min(136/board.width,150/board.height), miniWidth=board.width*miniScale, miniHeight=board.height*miniScale;
  const miniPortalSize = Math.max(18,Math.min(80,6/miniScale));
  return <div ref={boardRef} className={styles.board} style={{'--map-aspect':board.height/board.width} as CSSProperties} data-quest-board data-fullscreen={fullscreen.fullscreen}
    data-window-fullscreen={fullscreen.windowMode || undefined} role={fullscreen.windowMode ? "dialog" : undefined}
    aria-modal={fullscreen.windowMode || undefined} aria-label={fullscreen.windowMode ? "Quest map full screen" : undefined}
    tabIndex={fullscreen.windowMode ? -1 : undefined}>
    <div className={styles.controls}>
      {routeControl}
      <div className={styles.viewTools} role="group" aria-label="Map view controls">
        <div className={styles.zoom}><button aria-label="Zoom out" title="Zoom out" disabled={scale <= fitScale + .001} onClick={() => zoom(scaleRef.current / 1.35)}><Minus size={15} /></button><output aria-label="Map zoom">{Math.round(scale * 100)}%</output><button aria-label="Zoom in" title="Zoom in" disabled={scale >= Math.max(2.5,fitScale*2.5)} onClick={() => zoom(scaleRef.current * 1.35)}><Plus size={15} /></button><button aria-pressed={fitting} disabled={!ready} title="Show the whole map" onClick={fitMap}><Scan size={15} /><span>Fit map</span></button></div>
        <div className={styles.controlActions}><button data-map-fullscreen-toggle aria-label={fullscreen.fullscreen ? "Exit full screen" : "Enter full screen"} title={fullscreen.fullscreen ? "Exit full screen (Esc)" : "View map in full screen"} aria-pressed={fullscreen.fullscreen} disabled={fullscreen.busy} onClick={() => void fullscreen.toggle()}>{fullscreen.fullscreen ? <Shrink size={16} /> : <Expand size={16} />}<span>{fullscreen.fullscreen ? "Exit full screen" : "Full screen"}</span></button></div>
      </div>
    </div>
    {fullscreen.fullscreen && <div className={styles.fullscreenContext}>{!routeControl && onChooseRoute && <label>Route<select aria-label="Full screen recorded route" value={pathIndex} onChange={e => onChooseRoute(Number(e.target.value))}>{map.paths.map(route => <option key={route.index} value={route.index}>Route {route.index + 1}</option>)}</select></label>}<span aria-live="polite">{spawnRegions?.regions.find(region => region.id === selectedRegion)?.defender.name ?? positionNames.get(selected)}</span></div>}
    <div className={styles.canvasWrap} style={artwork ? { backgroundImage: `linear-gradient(180deg,rgba(5,12,24,.76),rgba(4,10,20,.86)),url("${artwork.url}")` } : undefined}>
      <div ref={viewportRef} className={styles.viewport} role="region" aria-label="Scrollable quest map" aria-busy={!ready} tabIndex={0}
        onScroll={e=>{if(overviewOpen)setViewport({x:e.currentTarget.scrollLeft,y:e.currentTarget.scrollTop,width:e.currentTarget.clientWidth,height:e.currentTarget.clientHeight});}}
        onPointerDown={e => { if(e.button!==0)return;suppressClick.current=false;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const el=e.currentTarget;if(pointers.current.size===1)drag.current={x:e.clientX,y:e.clientY,left:el.scrollLeft,top:el.scrollTop,moved:false};if(pointers.current.size===2){const [a,b]=[...pointers.current.values()];pinch.current={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};el.setPointerCapture(e.pointerId);} }}
        onPointerMove={e => { if(!pointers.current.has(e.pointerId))return;pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const el=e.currentTarget;
          if(pointers.current.size===2){const [a,b]=[...pointers.current.values()],distance=Math.hypot(a.x-b.x,a.y-b.y),x=(a.x+b.x)/2,y=(a.y+b.y)/2,old=pinch.current;if(old&&old.distance>0){const r=el.getBoundingClientRect();applyZoom(scaleRef.current*distance/old.distance,{x:old.x-r.left,y:old.y-r.top,nextX:x-r.left,nextY:y-r.top});suppressClick.current=true;}pinch.current={distance,x,y};return;}
          const d=drag.current;if(d&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>5){d.moved=true;suppressClick.current=true;el.setPointerCapture(e.pointerId);el.scrollTo({left:d.left-e.clientX+d.x,top:d.top-e.clientY+d.y});}
        }}
        onPointerUp={e=>endPointer(e.pointerId)}
        onPointerCancel={e=>endPointer(e.pointerId,true)}
        // A touch starts with implicit capture on its SVG target. Losing that
        // child capture while the viewport takes over must not end the gesture.
        onLostPointerCapture={e=>{if(e.target===e.currentTarget)endPointer(e.pointerId);}}
        onClickCapture={e => { if (suppressClick.current) { e.preventDefault(); e.stopPropagation();suppressClick.current=false; } }}
        onKeyDown={e => { if (e.target !== e.currentTarget) return; const amount = 100; if (e.key.startsWith("Arrow")) { e.preventDefault(); e.currentTarget.scrollBy({ left: e.key === "ArrowRight" ? amount : e.key === "ArrowLeft" ? -amount : 0, top: e.key === "ArrowDown" ? amount : e.key === "ArrowUp" ? -amount : 0 }); } }}>
        <svg className={styles.scene} data-zoom={scale} data-board-ready={ready} role="group" aria-label={highlightRoute ? `Quest map, recorded route ${pathIndex + 1} highlighted` : "Quest map, all paths"} width={board.width * scale} height={board.height * scale} viewBox={`0 0 ${board.width} ${board.height}`}>
          <title>{`Defender map. ${highlightRoute?"Flowing blue-white connections highlight a recorded route.":"Blue-white connections show all paths."} Violet connections are portals. Dashed teal portraits represent encounter regions.`}</title>
          <defs>
            {map.encounters.map((e, i) => { const [x, y] = board.point(e.coordinate); const radius = e.final ? 31 : 25; return <clipPath key={e.id} id={`${uid}-portrait-${i}`}><circle cx={x} cy={y} r={radius} /></clipPath>; })}
          </defs>
          <QuestMapPaths edges={board.edges} point={board.point} routeEdges={routeEdges} routePhases={routePhases} highlightRoute={highlightRoute}/>
          {spawnRegions&&<QuestSpawnRegionAreas map={map} layer={spawnRegions} point={board.point} selected={selectedRegion} hovered={hoveredRegion??undefined} pathIndex={pathIndex} highlightRoute={highlightRoute}/>}
          {map.tiles.map(tile=>{
            const key=coordinateKey(tile.coordinate),[x,y]=board.point(tile.coordinate);
            if(board.encounters.get(key)?.length||featuresByKey.has(key))return null;
            return <QuestMapWaypoint key={key} tile={tile} x={x} y={y} label={positionNames.get(key)!} active={!highlightRoute||routeKeys.has(key)} selected={!selectedRegion&&selected===key} portalTarget={portalTargets.has(key)} onChoose={()=>onChoose(tile.coordinate)}/>;
          })}
          {map.encounters.map((encounter,index)=>{
            const key=coordinateKey(encounter.coordinate),[x,y]=board.point(encounter.coordinate),isSelected=!selectedRegion&&selected===key;
            return <QuestMapEncounterMarker key={encounter.id} encounter={encounter} portrait={questEncounterPortrait(encounter,portraits)} x={x} y={y} uid={uid} index={index}
              boss={questEncounterIsBoss(map,encounter)}
              selected={isSelected} active={!highlightRoute||routeKeys.has(key)} showLabel={isSelected||hover===encounter.id}
              labelBox={labels.get(encounter.id)} labelUnit={labelScale} portalTarget={portalTargets.has(key)} onChoose={()=>onChoose(encounter.coordinate)} onHover={hovered=>setHover(hovered?encounter.id:null)}
              featureBadge={featuresByKey.has(key)?<QuestMapFeatureMarker location={featuresByKey.get(key)!} x={x} y={y} compact selected={isSelected} active={!highlightRoute||routeKeys.has(key)} onChoose={()=>onChoose(encounter.coordinate)}/>:undefined}
              featureLabel={featuresByKey.has(key)?questFeatureLocationLabel(featuresByKey.get(key)!):undefined}/>;
          })}
          {featureLocations.filter(location=>!board.encounters.get(coordinateKey(location.coordinate))?.length&&!spawnRegions?.regions.some(region=>coordinateKey(region.anchor)===coordinateKey(location.coordinate))).map(location=>{const key=coordinateKey(location.coordinate),[x,y]=board.point(location.coordinate);return <QuestMapFeatureMarker key={key} location={location} x={x} y={y} selected={!selectedRegion&&selected===key} active={!highlightRoute||routeKeys.has(key)} onChoose={()=>onChoose(location.coordinate)}/>;})}
          {spawnRegions&&onChooseRegion&&<QuestSpawnRegionMarkers map={map} layer={spawnRegions} point={board.point} selected={selectedRegion} hovered={hoveredRegion??undefined} pathIndex={pathIndex} highlightRoute={highlightRoute} onChoose={onChooseRegion} onHover={setHoveredRegion} uid={uid} labels={labels} labelScale={labelScale}
            featureLabel={coordinate=>{const feature=featuresByKey.get(coordinateKey(coordinate));return feature?questFeatureLocationLabel(feature):undefined;}}
            featureBadge={(coordinate,x,y,isSelected,active)=>{const feature=featuresByKey.get(coordinateKey(coordinate));return feature?<QuestMapFeatureMarker location={feature} x={x} y={y} compact selected={isSelected} active={active} onChoose={()=>onChoose(coordinate)}/>:null;}}/>}
        </svg>
      </div>
      {overviewOpen && <div id={`${uid}-overview`} className={styles.navigator}><span>Overview</span><svg role="group" tabIndex={0} aria-label="Map overview" width={miniWidth} height={miniHeight} viewBox={`0 0 ${board.width} ${board.height}`} onClick={e => { const rect=e.currentTarget.getBoundingClientRect();if(!rect.width||!rect.height)return;const x=(e.clientX-rect.left)/rect.width*board.width,y=(e.clientY-rect.top)/rect.height*board.height; viewportRef.current?.scrollTo({left:Math.max(0,Math.min(board.width*scale-viewport.width,x*scale-viewport.width/2)),top:Math.max(0,Math.min(board.height*scale-viewport.height,y*scale-viewport.height/2)),behavior:"smooth"}); }} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const element=viewportRef.current;if(element)element.scrollTo({left:Math.max(0,Math.min(board.width*scale-viewport.width,element.scrollLeft+(e.key==='ArrowRight'?viewport.width/2:e.key==='ArrowLeft'?-viewport.width/2:0))),top:Math.max(0,Math.min(board.height*scale-viewport.height,element.scrollTop+(e.key==='ArrowDown'?viewport.height/2:e.key==='ArrowUp'?-viewport.height/2:0))),behavior:'smooth'});}}>
        <title>Click to move around the map, or use arrow keys</title>
        {board.edges.map((e,i)=>{const a=board.point(e.from),b=board.point(e.to);return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={e.portal?"#ad85d0":"#6c91a7"} strokeWidth="4"/>;})}{map.encounters.map(e=>{const [x,y]=board.point(e.coordinate);return <circle key={e.id} cx={x} cy={y} r="12" fill={questEncounterIsBoss(map,e)?"#efc772":!highlightRoute||routeKeys.has(coordinateKey(e.coordinate))?"#c5f4ff":"#677d8e"}/>;})}{featureLocations.map(location=>{const [x,y]=board.point(location.coordinate);return <rect key={coordinateKey(location.coordinate)} data-overview-feature x={x-7} y={y-7} width="14" height="14" rx={location.gates.length?2:5} fill={location.gates.length?"#e7b362":location.chests?.length?"#dfbf7e":"#89e3c7"}/>;})}{spawnRegions?.regions.map(region=>{const [x,y]=board.point(region.anchor);return <circle key={region.id} data-overview-region={region.id} cx={x} cy={y} r="11" fill="#6ddfc7" fillOpacity=".7"/>;})}{portalSymbol&&map.tiles.filter(tile=>tile.portals.length||tile.randomPortal||portalTargets.has(coordinateKey(tile.coordinate))).map(tile=>{const [x,y]=board.point(tile.coordinate);return <image key={`portal:${coordinateKey(tile.coordinate)}`} data-overview-portal href={portalSymbol.url} x={x-miniPortalSize/2} y={y-miniPortalSize/2} width={miniPortalSize} height={miniPortalSize} preserveAspectRatio="xMidYMid meet" pointerEvents="none"/>;})}{miniSelected&&<circle data-overview-selection cx={miniSelected[0]} cy={miniSelected[1]} r="19" fill="none" stroke="#f1fbff" strokeWidth="4"/>}<rect data-overview-viewport x={viewport.x/scale} y={viewport.y/scale} width={Math.min(board.width,viewport.width/scale)} height={Math.min(board.height,viewport.height/scale)} fill="#77d8ff" fillOpacity=".12" stroke="#a6e5ff" strokeWidth="5" />
      </svg></div>}
    </div>
    <details className={styles.mapKey}><summary>Map key<ChevronDown size={13} aria-hidden="true"/></summary><div className={styles.legend}>{highlightRoute?<><span><i className={styles.selectedRoute}/>Selected route</span><span><i className={styles.alternative}/>Other routes</span></>:<span><i className={styles.alternative}/>Paths</span>}<span><i className={styles.portal}/>Portal link</span>{portalSymbol&&<span><svg className={styles.portalLegend} width="14" height="14" aria-hidden="true"><image href={portalSymbol.url} width="14" height="14"/></svg>Portal</span>}<span><i className={styles.boss}/>Boss</span>{featureLocations.some(location=>location.gates.length>0)&&<span><LockKeyhole size={12} aria-hidden="true"/>Gate</span>}{featureLocations.some(location=>location.pickups.length>0)&&<span><Gift size={12} aria-hidden="true"/>Path reward</span>}{featureLocations.some(location=>Boolean(location.chests?.length))&&<span><PackageOpen size={12} aria-hidden="true"/>Chest</span>}{spawnRegions&&<span><i className={styles.regionKey}/>Encounter region · ∼</span>}<span>Badge = shared routes</span><p>Drag to pan · Pinch or scroll to zoom</p></div></details>
  </div>;
}
