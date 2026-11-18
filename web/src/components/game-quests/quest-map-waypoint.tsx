import type {QuestTile} from '@cerebro/core/domain/game-quests';
import styles from './quest-board.module.css';
import { QuestPortalVisual } from './quest-portal-visual';

/** Recorded transit positions; decorative effects never introduce a map connection. */
export function QuestMapWaypoint({tile,x,y,label,active,selected,portalTarget,onChoose}:{
  tile:QuestTile;x:number;y:number;label:string;active:boolean;selected:boolean;portalTarget:boolean;onChoose:()=>void;
}){
  const portal=Boolean(tile.portals.length||tile.randomPortal||portalTarget);
  const interactive=tile.start||portal;
  const destinationOnly=portalTarget&&!tile.portals.length&&!tile.randomPortal;
  const portalLabel=destinationOnly?'Portal destination':'Portal';
  const startLabel=tile.start?(label==='Start'?'Quest start':`${label} · Quest start`):label;
  const name=portal?(['Map location','Portal'].includes(label)?portalLabel:`${startLabel} · ${portalLabel}`):startLabel;
  return <g data-coordinate={tile.coordinate.join(',')} data-map-waypoint={portal?'portal':tile.start?'start':'junction'}
    className={`${styles.tile} ${styles.waypoint}`} role={interactive?'button':undefined} tabIndex={interactive?0:undefined}
    aria-label={interactive?name:undefined} aria-pressed={interactive?selected:undefined} onClick={onChoose}
    onKeyDown={event=>{if(interactive&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();onChoose();}}}>
    <title>{name}</title>
    {interactive&&<circle cx={x} cy={y} r={portal?26:20} fill="transparent" pointerEvents="all"/>}
    <g aria-hidden="true" pointerEvents="none" opacity={active||selected?1:.55}>
      {selected&&!portal&&<><circle cx={x} cy={y} r={interactive?24:12} fill="#97e9ff" fillOpacity=".06" stroke="#a3edff" strokeOpacity=".7" strokeWidth="1" vectorEffect="non-scaling-stroke"/><circle cx={x} cy={y} r={interactive?29:17} fill="none" stroke="#a3edff" strokeOpacity=".22" strokeWidth="1" strokeDasharray="2 5" vectorEffect="non-scaling-stroke"/></>}
      {portal?<QuestPortalVisual x={x} y={y} selected={selected}/>:tile.start?<>
        <circle cx={x} cy={y} r="20" fill="#68e5c0" fillOpacity=".07"/>
        <circle cx={x} cy={y} r="14" fill="#072a2a" stroke="#72e9c5" strokeWidth="1.4" className={styles.waypointRing} vectorEffect="non-scaling-stroke"/>
        <path d={`M${x-3} ${y-6}l9 6-9 6z`} fill="#c4ffe9"/>
        <path d={`M${x} ${y-20}v3M${x} ${y+17}v3M${x-20} ${y}h3M${x+17} ${y}h3`} stroke="#72e9c5" strokeWidth="1" vectorEffect="non-scaling-stroke"/>
      </>:<>
        <circle cx={x} cy={y} r={selected?5:active?3.3:2.7} fill="#071625" stroke={active?'#b9e4f3':'#7092ab'} strokeWidth=".7" vectorEffect="non-scaling-stroke"/>
        <circle cx={x} cy={y} r={selected?2.5:active?1.8:1.3} fill={selected?'#effcff':active?'#d5f3ff':'#8dacc0'}/>
      </>}
    </g>
  </g>;
}
