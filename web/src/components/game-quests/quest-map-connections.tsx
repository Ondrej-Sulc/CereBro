"use client";

import { ArrowUpRight, ChevronDown, GitBranch } from "lucide-react";
import { coordinateKey, type Coordinate, type QuestMap, type QuestTile } from "@cerebro/core/domain/game-quests";
import { questPositionLabel } from "@cerebro/core/domain/game-quests/navigation";
import styles from "./quest-map-explorer.module.css";

function destination(map:QuestMap,from:Coordinate,to:Coordinate) {
  const label=questPositionLabel(map,to);
  if(label!=="Map location")return label;
  const vertical=to[1]<from[1]?"north":to[1]>from[1]?"south":"";
  const horizontal=to[0]<from[0]?"west":to[0]>from[0]?"east":"";
  const direction=[vertical,horizontal].filter(Boolean).join("-");
  return direction?`${direction[0].toUpperCase()+direction.slice(1)} connection`:"This map point";
}

export function QuestMapConnections({map,tile,choose}:{map:QuestMap;tile:QuestTile;choose:(coordinate:Coordinate,center?:boolean)=>void}) {
  if(!tile.links.length&&!tile.portals.length)return null;
  return <details className={styles.connectedPoints} data-map-connections>
    <summary><GitBranch size={15} aria-hidden="true"/><span>Connected points</span><small>{tile.links.length+tile.portals.length}</small><ChevronDown size={14} aria-hidden="true"/></summary>
    <p>Inspect adjacent positions on this map.</p>
    <div className={styles.connectionList}>
      {tile.links.map(to=><button type="button" key={`link:${coordinateKey(to)}`} onClick={()=>choose(to,true)}>{destination(map,tile.coordinate,to)}<ArrowUpRight size={13} aria-hidden="true"/></button>)}
      {tile.portals.map((portal,index)=><button type="button" key={`portal:${index}`} data-portal-link onClick={()=>choose(portal.target,true)}><span>Portal to {destination(map,tile.coordinate,portal.target)}{portal.label&&` · ${portal.label}`}{tile.randomPortal&&<small>Random destination</small>}</span><ArrowUpRight size={13} aria-hidden="true"/></button>)}
    </div>
  </details>;
}
