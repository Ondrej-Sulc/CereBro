"use client";
import { questEncounterPortrait } from "./quest-portrait";

import { useEffect,useLayoutEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronDown, Expand, Minus, Plus, Scan, Shrink, Signpost } from "lucide-react";
import { coordinateKey, type Coordinate, type QuestMap } from "@cerebro/core/domain/game-quests";
import { questBoardLabels } from "@cerebro/core/domain/game-quests/board";
import { questPositionLabel, questZoom } from "@cerebro/core/domain/game-quests/navigation";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import { QuestSpawnRegionAreas, QuestSpawnRegionMarkers } from "./quest-spawn-region-layer";
import { regionBoardGeometry, regionBoardLabels } from "./quest-spawn-region-presentation";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { useQuestMapFullscreen } from "./use-quest-map-fullscreen";
import { QuestMapNameplate } from "./quest-map-nameplate";
import styles from "./quest-board.module.css";

export function QuestBoard({ map, portraits, selected, pathIndex, onChoose, viewportRef, artwork, spawnRegions, selectedRegion, onChooseRegion, onChooseRoute, highlightRoute = true, routeControl }: {
  map: QuestMap; portraits: Record<string, QuestPortrait>; selected: string; pathIndex: number;
  onChoose: (c: Coordinate, center?: boolean) => void; viewportRef: RefObject<HTMLDivElement | null>;
  artwork?: { url: string; theme: string } | null;
  spawnRegions?: QuestSpawnRegionLayer; selectedRegion?: string; onChooseRegion?: (id:string) => void;
  onChooseRoute?: (index: number) => void;
  highlightRoute?: boolean; routeControl?: ReactNode;
}) {
  const board = useMemo(() => regionBoardGeometry(map,spawnRegions), [map,spawnRegions]);
  const uid = useId().replace(/:/g, "");
  const [scale, setScale] = useState(1);
  const [fitScale, setFitScale] = useState(.7);
  const [fitting, setFitting] = useState(true);
  const fittingRef = useRef(true);
  const [names, setNames] = useState(false);
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
    const result=questZoom({scale:scaleRef.current,next,min:fitRef.current,max:Math.max(2.5,fitRef.current*2.5),left:current.left,top:current.top,anchorX:anchor?.x??e.clientWidth/2,anchorY:anchor?.y??e.clientHeight/2,width:e.clientWidth,boardWidth:board.width});
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
  // Keep a travelling highlight continuous across the route's short SVG edges.
  const routePhases = useMemo(() => {
    const phases = new Map<string,number>();
    let distance = 0;
    for (let i=1;i<path.coordinates.length;i++) {
      const from=path.coordinates[i-1],to=path.coordinates[i],a=board.point(from),b=board.point(to);
      const key=`${coordinateKey(from)}>${coordinateKey(to)}`;
      if(!phases.has(key))phases.set(key,(distance*scale)%60);
      distance+=Math.hypot(b[0]-a[0],b[1]-a[1]);
    }
    return phases;
  }, [path,board,scale]);
  const labelScale = 1 / scale;
  const labels = useMemo(() => {const prioritized=[selectedRegion,hoveredRegion,...map.encounters.filter(e=>coordinateKey(e.coordinate)===selected||e.id===hover).map(e=>e.id)].filter((id):id is string=>typeof id==='string');return spawnRegions?regionBoardLabels(map,spawnRegions,board,prioritized,labelScale):questBoardLabels(map,prioritized,labelScale);}, [map,spawnRegions,board,selected,hover,selectedRegion,hoveredRegion,labelScale]);
  const portalTargets = new Set(board.edges.filter(e=>e.portal).map(e=>coordinateKey(e.to)));
  const positionNames=useMemo(()=>new Map(map.tiles.map(t=>[coordinateKey(t.coordinate),questPositionLabel(map,t.coordinate)])),[map]);
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
  const miniScale = Math.min(136/board.width,150/board.height), miniWidth=board.width*miniScale, miniHeight=board.height*miniScale;
  return <div ref={boardRef} className={styles.board} data-quest-board data-fullscreen={fullscreen.fullscreen}
    data-window-fullscreen={fullscreen.windowMode || undefined} role={fullscreen.windowMode ? "dialog" : undefined}
    aria-modal={fullscreen.windowMode || undefined} aria-label={fullscreen.windowMode ? "Quest map full screen" : undefined}
    tabIndex={fullscreen.windowMode ? -1 : undefined}>
    <div className={styles.controls}>
      {routeControl}
      <div className={styles.zoom}><button aria-label="Zoom out" title="Zoom out" disabled={scale <= fitScale + .001} onClick={() => zoom(scaleRef.current / 1.35)}><Minus size={15} /></button><output aria-label="Map zoom">{Math.round(scale * 100)}%</output><button aria-label="Zoom in" title="Zoom in" disabled={scale >= Math.max(2.5,fitScale*2.5)} onClick={() => zoom(scaleRef.current * 1.35)}><Plus size={15} /></button><button aria-pressed={fitting} disabled={!ready} title="Show the whole map" onClick={fitMap}><Scan size={15} /><span>Fit map</span></button></div>
      <button className={styles.namesToggle} aria-pressed={names} title={names ? "Hide defender names" : "Show defender names"} onClick={() => setNames(v => !v)}><Signpost size={15} /><span>Names</span></button>
      <div className={styles.controlActions}><button data-map-fullscreen-toggle aria-label={fullscreen.fullscreen ? "Exit full screen" : "Enter full screen"} title={fullscreen.fullscreen ? "Exit full screen (Esc)" : "View map in full screen"} aria-pressed={fullscreen.fullscreen} disabled={fullscreen.busy} onClick={() => void fullscreen.toggle()}>{fullscreen.fullscreen ? <Shrink size={16} /> : <Expand size={16} />}<span>{fullscreen.fullscreen ? "Exit full screen" : "Full screen"}</span></button></div>
    </div>
    {fullscreen.fullscreen && <div className={styles.fullscreenContext}>{!routeControl && onChooseRoute && <label>Route<select aria-label="Full screen recorded route" value={pathIndex} onChange={e => onChooseRoute(Number(e.target.value))}>{map.paths.map(route => <option key={route.index} value={route.index}>Route {route.index + 1}</option>)}</select></label>}<span aria-live="polite">{spawnRegions?.regions.find(region => region.id === selectedRegion)?.defender.name ?? positionNames.get(selected)}</span></div>}
    <div className={styles.canvasWrap} style={artwork ? { backgroundImage: `linear-gradient(180deg,rgba(5,12,24,.55),rgba(4,10,20,.72)),url("${artwork.url}")` } : undefined}>
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
            <marker id={`${uid}-portal`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto"><path d="M1 1 8 5 1 9" fill="none" stroke="#e0bdff" strokeWidth="2" /></marker>
            {map.encounters.map((e, i) => { const [x, y] = board.point(e.coordinate); const radius = e.final ? 31 : 25; return <clipPath key={e.id} id={`${uid}-portrait-${i}`}><circle cx={x} cy={y} r={radius} /></clipPath>; })}
          </defs>
          <g aria-hidden="true">{board.edges.filter(e => !e.portal).map((e, i) => { const [x1,y1] = board.point(e.from), [x2,y2] = board.point(e.to); const key=`${coordinateKey(e.from)}>${coordinateKey(e.to)}`,active = routeEdges.has(key); return <g key={i} data-route-edge data-from={coordinateKey(e.from)} data-to={coordinateKey(e.to)} data-route-selected={active}>
            <line data-route-casing x1={x1} y1={y1} x2={x2} y2={y2} stroke="#020b16" strokeWidth={active ? 3.6 : 2.8} strokeOpacity=".6" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
            <line data-route-glow className={styles.routeGlow} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#57baff" strokeWidth={active ? 5.2 : 3.8} strokeOpacity={active ? .28 : .17} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
            <line data-route-line x1={x1} y1={y1} x2={x2} y2={y2} stroke={active ? "#d5efff" : "#9cc8e5"} strokeOpacity={active ? 1 : .8} strokeWidth={active ? 1.3 : 1} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
            {active&&<line key={pathIndex} data-route-pulse className={styles.routePulse} style={{'--route-phase':`${routePhases.get(key)??0}px`} as CSSProperties} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f2fbff" strokeWidth="1.8" strokeDasharray="9 51" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
          </g>; })}</g>
          <g aria-hidden="true">{board.edges.filter(e => e.portal).map((e, i) => { const [x1,y1] = board.point(e.from),[x2,y2] = board.point(e.to); const key=`${coordinateKey(e.from)}>${coordinateKey(e.to)}`,active = routeEdges.has(key); const d = `M${x1},${y1} Q${(x1+x2)/2+(y2-y1)*.12},${(y1+y2)/2-(x2-x1)*.12} ${x2},${y2}`; return <g key={i} data-route-edge data-route-portal data-from={coordinateKey(e.from)} data-to={coordinateKey(e.to)} data-route-selected={active}>
            <path data-route-casing d={d} fill="none" stroke="#10091d" strokeWidth={active ? 3.8 : 3} strokeOpacity=".6" vectorEffect="non-scaling-stroke"/>
            <path data-route-glow className={styles.routeGlow} d={d} fill="none" stroke="#b181f0" strokeWidth={active ? 5.5 : 4} strokeOpacity={active ? .28 : .17} vectorEffect="non-scaling-stroke"/>
            <path data-route-line d={d} fill="none" stroke={active ? "#f0dcff" : "#c9a3e6"} strokeWidth={active ? 1.5 : 1.2} strokeOpacity={active ? 1 : .85} vectorEffect="non-scaling-stroke" markerEnd={`url(#${uid}-portal)`}/>
            {active&&<path key={pathIndex} data-route-pulse className={styles.routePulse} style={{'--route-phase':`${routePhases.get(key)??0}px`} as CSSProperties} d={d} fill="none" stroke="#fcf5ff" strokeWidth="1.9" strokeDasharray="9 51" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>}
          </g>; })}</g>
          {spawnRegions&&<QuestSpawnRegionAreas map={map} layer={spawnRegions} point={board.point} selected={selectedRegion} hovered={hoveredRegion??undefined} pathIndex={pathIndex} highlightRoute={highlightRoute}/>}
          {map.tiles.map(t => { const key = coordinateKey(t.coordinate); const [x,y] = board.point(t.coordinate); const fights = board.encounters.get(key) ?? []; const active = !highlightRoute || routeKeys.has(key); if (fights.length) return null; return <g key={key} data-coordinate={key} className={styles.tile} onClick={() => onChoose(t.coordinate)}><title>{`${positionNames.get(key)}${t.start ? " · Quest start" : t.portals.length ? " · Portal" : ""}`}</title>{t.portals.length ? <><circle cx={x} cy={y} r="14" fill="#241733" stroke="#d7aeff" strokeWidth="2" /><circle cx={x} cy={y} r="8" fill="none" stroke="#cf9dff" strokeWidth="1.5" /><text x={x} y={y+4} textAnchor="middle" fill="#f0dbff" fontSize="10" fontWeight="bold">P</text></> : t.start ? <><circle cx={x} cy={y} r="13" fill="#103f3c" stroke="#60e6bd" strokeWidth="2" /><path d={`M${x-3} ${y-5}l8 5-8 5z`} fill="#b0ffe6" /></> : <circle cx={x} cy={y} r={active ? 2.6 : 1.7} fill={active ? "#d3f6ff" : "#a0b3c5"} opacity={active ? .9 : .3} />}</g>; })}
          {map.encounters.map((e, i) => {
            const key = coordinateKey(e.coordinate), [x,y] = board.point(e.coordinate), portrait = questEncounterPortrait(e,portraits);
            const active = !highlightRoute || routeKeys.has(key), isSelected = !selectedRegion && selected === key, label = portrait?.name ?? e.champion?.name ?? e.name;
            const radius = e.final ? 33 : 27, showLabel = isSelected || hover === e.id || names, labelBox=labels.get(e.id);
            return <g key={e.id} role="button" tabIndex={0} aria-label={`${label}, ${e.rarity} stars${e.final ? ", final boss" : ""}${e.pathIndices.length>1 ? `, shared by ${e.pathIndices.length} recorded routes` : ""}`} aria-pressed={isSelected} data-coordinate={key} data-map-encounter={e.id} className={styles.encounter}
              onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(e.id)} onBlur={() => setHover(null)}
              onClick={() => onChoose(e.coordinate)} onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onChoose(e.coordinate); } }}>
              <title>{`${label} · ${e.rarity}★${e.final ? " · Final boss" : ""}`}</title>
              {isSelected && <circle cx={x} cy={y} r={radius+8} fill="none" stroke="#dbf8ff" strokeWidth="2" />}
              {portalTargets.has(key) && <circle cx={x} cy={y} r={radius+12} fill="none" stroke="#d4a7ed" strokeWidth="2" strokeDasharray="5 4" />}
              <circle cx={x} cy={y+2} r={radius+2} fill="#020812" opacity=".8" />
              <circle cx={x} cy={y} r={radius} fill="#102033" stroke={e.final ? "#f5c765" : portrait?.color ?? "#8ba0b8"} strokeWidth={e.final ? 4 : 2.5} opacity={active ? 1 : .75} />
              {portrait?.imageUrl ? <image data-map-portrait={e.gameId} href={portrait.imageUrl} x={x-(e.final?31:25)} y={y-(e.final?31:25)} width={e.final?62:50} height={e.final?62:50} clipPath={`url(#${uid}-portrait-${i})`} opacity={active || isSelected ? 1 : .75} /> : <g aria-hidden="true"><circle cx={x} cy={y-6} r="7" fill="#92a3b7" /><path d={`M${x-13} ${y+14}q0-15 13-15t13 15`} fill="#667d96" /><text x={x+15} y={y-11} fill="#e0e8f0" fontSize="12">?</text></g>}
              <rect x={x-13} y={y+radius-6} width="26" height="14" rx="5" fill={e.final ? "#e8bc63" : "#091422"} stroke={e.final ? "#ffe1a5" : "#597187"} strokeWidth="1" /><text x={x} y={y+radius+4} textAnchor="middle" fontSize="9" fontWeight="bold" fill={e.final ? "#231708" : "#e2edf5"}>{`${e.rarity}★`}</text>
              {e.final && <text x={x} y={y-radius-10} textAnchor="middle" fontSize="10" fontWeight="bold" letterSpacing="2" fill="#ffe1a5">BOSS</text>}
              {e.pathIndices.length>1 && <g><circle cx={x+radius-1} cy={y-radius+2} r="8" fill="#10293c" stroke="#87b1ca" /><text x={x+radius-1} y={y-radius+5} textAnchor="middle" fill="#dbedf8" fontSize="8">{e.pathIndices.length}</text></g>}
              {showLabel && labelBox && <QuestMapNameplate box={labelBox} name={label} accent={e.final ? '#f5c765' : portrait?.color ?? '#8bbad1'} selected={isSelected} unit={labelScale}/>}
            </g>;
          })}
          {spawnRegions&&onChooseRegion&&<QuestSpawnRegionMarkers map={map} layer={spawnRegions} point={board.point} selected={selectedRegion} hovered={hoveredRegion??undefined} pathIndex={pathIndex} highlightRoute={highlightRoute} names={names} onChoose={onChooseRegion} onHover={setHoveredRegion} uid={uid} labels={labels} labelScale={labelScale}/>}
        </svg>
      </div>
      {overviewOpen && <div id={`${uid}-overview`} className={styles.navigator}><span>Overview</span><svg role="group" tabIndex={0} aria-label="Map overview" width={miniWidth} height={miniHeight} viewBox={`0 0 ${board.width} ${board.height}`} onClick={e => { const rect=e.currentTarget.getBoundingClientRect();if(!rect.width||!rect.height)return;const x=(e.clientX-rect.left)/rect.width*board.width,y=(e.clientY-rect.top)/rect.height*board.height; viewportRef.current?.scrollTo({left:Math.max(0,Math.min(board.width*scale-viewport.width,x*scale-viewport.width/2)),top:Math.max(0,Math.min(board.height*scale-viewport.height,y*scale-viewport.height/2)),behavior:"smooth"}); }} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const element=viewportRef.current;if(element)element.scrollTo({left:Math.max(0,Math.min(board.width*scale-viewport.width,element.scrollLeft+(e.key==='ArrowRight'?viewport.width/2:e.key==='ArrowLeft'?-viewport.width/2:0))),top:Math.max(0,Math.min(board.height*scale-viewport.height,element.scrollTop+(e.key==='ArrowDown'?viewport.height/2:e.key==='ArrowUp'?-viewport.height/2:0))),behavior:'smooth'});}}>
        <title>Click to move around the map, or use arrow keys</title>
        {board.edges.map((e,i)=>{const a=board.point(e.from),b=board.point(e.to);return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={e.portal?"#ad85d0":"#6c91a7"} strokeWidth="4"/>;})}{map.encounters.map(e=>{const [x,y]=board.point(e.coordinate);return <circle key={e.id} cx={x} cy={y} r="12" fill={e.final?"#efc772":!highlightRoute||routeKeys.has(coordinateKey(e.coordinate))?"#c5f4ff":"#677d8e"}/>;})}<rect data-overview-viewport x={viewport.x/scale} y={viewport.y/scale} width={Math.min(board.width,viewport.width/scale)} height={Math.min(board.height,viewport.height/scale)} fill="#77d8ff" fillOpacity=".12" stroke="#a6e5ff" strokeWidth="5" />
      </svg></div>}
    </div>
    <details className={styles.mapKey}><summary>Map key<ChevronDown size={13} aria-hidden="true"/></summary><div className={styles.legend}>{highlightRoute?<><span><i className={styles.selectedRoute}/>Selected route</span><span><i className={styles.alternative}/>Other routes</span></>:<span><i className={styles.alternative}/>Paths</span>}<span><i className={styles.portal}/>Portal</span><span><i className={styles.boss}/>Final boss</span>{spawnRegions&&<span><i className={styles.regionKey}/>Encounter region · ∼</span>}<span>Badge = shared routes</span><p>Drag to pan · Pinch or scroll to zoom</p></div></details>
  </div>;
}
