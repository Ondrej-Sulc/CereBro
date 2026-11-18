import { memo } from 'react';
import type { Coordinate, QuestTile } from '@cerebro/core/domain/game-quests';
import styles from './quest-board.module.css';
import { QuestPortalVisual } from './quest-portal-visual';

const junctionStyles = {
  active: { outer: 3.3, inner: 1.8, stroke: '#b9e4f3', fill: '#d5f3ff', opacity: 1 },
  muted: { outer: 2.7, inner: 1.3, stroke: '#7092ab', fill: '#8dacc0', opacity: .55 },
} as const;
const junctionBackground = '#071625';

function circlePath(x: number, y: number, radius: number) {
  const diameter = radius * 2;
  return `M${x - radius},${y}a${radius},${radius} 0 1 0 ${diameter},0a${radius},${radius} 0 1 0 ${-diameter},0Z`;
}

/** Paint ordinary dots in groups, with one hit target per recorded position. */
export const QuestMapJunctions = memo(function QuestMapJunctions({ tiles, point, routeKeys, selected, onChoose }: {
  tiles: ReadonlyMap<string, QuestTile>;
  point: (coordinate: Coordinate) => Coordinate;
  routeKeys?: ReadonlySet<string>;
  selected?: string;
  onChoose: (coordinate: Coordinate) => void;
}) {
  type Junction = { key: string; coordinate: Coordinate; x: number; y: number };
  const junctions: Record<keyof typeof junctionStyles, Junction[]> = { active: [], muted: [] };
  for (const [key, tile] of tiles) {
    if (key === selected) continue;
    const kind = !routeKeys || routeKeys.has(key) ? 'active' : 'muted';
    const [x, y] = point(tile.coordinate);
    junctions[kind].push({ key, coordinate: tile.coordinate, x, y });
  }
  return (['active', 'muted'] as const).map(kind => {
    const dots = junctions[kind];
    if (!dots.length) return null;
    const appearance = junctionStyles[kind];
    return <g key={kind} data-map-junctions={kind} aria-hidden="true">
      <g pointerEvents="none" opacity={appearance.opacity}>
        <path d={dots.map(({ x, y }) => circlePath(x, y, appearance.outer)).join('')}
          fill={junctionBackground} stroke={appearance.stroke} strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
        <path d={dots.map(({ x, y }) => circlePath(x, y, appearance.inner)).join('')} fill={appearance.fill}/>
      </g>
      {dots.map(({ key, coordinate, x, y }) => <circle key={key} data-coordinate={key} data-map-junction-hit
        cx={x} cy={y} r={appearance.outer} className={styles.tile} fill="none" pointerEvents="fill"
        onClick={() => onChoose(coordinate)}/>)}
    </g>;
  });
});

/** Recorded transit positions; decorative effects never introduce a map connection. */
export function QuestMapWaypoint({tile,x,y,label,active,selected,portalTarget,onChoose,markerScale=1}:{
  tile:QuestTile;x:number;y:number;label:string;active:boolean;selected:boolean;portalTarget:boolean;onChoose:()=>void;markerScale?:number;
}){
  const portal=Boolean(tile.portals.length||tile.randomPortal||portalTarget);
  const interactive=tile.start||portal;
  const displayScale=interactive?markerScale:1;
  const destinationOnly=portalTarget&&!tile.portals.length&&!tile.randomPortal;
  const portalLabel=destinationOnly?'Portal destination':'Portal';
  const startLabel=tile.start?(label==='Start'?'Quest start':`${label} · Quest start`):label;
  const name=portal?(['Map location','Portal'].includes(label)?portalLabel:`${startLabel} · ${portalLabel}`):startLabel;
  const junction = junctionStyles[active ? 'active' : 'muted'];
  return <g data-coordinate={tile.coordinate.join(',')} data-map-waypoint={portal?'portal':tile.start?'start':'junction'}
    data-marker-scale={displayScale} className={`${styles.tile} ${styles.waypoint}`} role={interactive?'button':undefined} tabIndex={interactive?0:undefined}
    aria-label={interactive?name:undefined} aria-pressed={interactive?selected:undefined} onClick={onChoose}
    onKeyDown={event=>{if(interactive&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();onChoose();}}}>
    <title>{name}</title>
    <g transform={`translate(${x} ${y}) scale(${displayScale}) translate(${-x} ${-y})`}>
    {interactive&&<circle cx={x} cy={y} r={portal?26:20} fill="transparent" pointerEvents="all"/>}
    <g aria-hidden="true" pointerEvents="none" opacity={active||selected?1:.55}>
      {selected&&!portal&&<><circle cx={x} cy={y} r={interactive?24:12} fill="#97e9ff" fillOpacity=".06" stroke="#a3edff" strokeOpacity=".7" strokeWidth="1" vectorEffect="non-scaling-stroke"/><circle cx={x} cy={y} r={interactive?29:17} fill="none" stroke="#a3edff" strokeOpacity=".22" strokeWidth="1" strokeDasharray="2 5" vectorEffect="non-scaling-stroke"/></>}
      {portal?<QuestPortalVisual x={x} y={y} selected={selected}/>:tile.start?<>
        <circle cx={x} cy={y} r="20" fill="#68e5c0" fillOpacity=".07"/>
        <circle cx={x} cy={y} r="14" fill="#072a2a" stroke="#72e9c5" strokeWidth="1.4" className={styles.waypointRing} vectorEffect="non-scaling-stroke"/>
        <path d={`M${x-3} ${y-6}l9 6-9 6z`} fill="#c4ffe9"/>
        <path d={`M${x} ${y-20}v3M${x} ${y+17}v3M${x-20} ${y}h3M${x+17} ${y}h3`} stroke="#72e9c5" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
      </>:<>
        <circle cx={x} cy={y} r={selected ? 5 : junction.outer} fill={junctionBackground} stroke={junction.stroke} strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
        <circle cx={x} cy={y} r={selected ? 2.5 : junction.inner} fill={selected ? '#effcff' : junction.fill}/>
      </>}
    </g>
    </g>
  </g>;
}
