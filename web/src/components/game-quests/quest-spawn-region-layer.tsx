"use client";
import { useMemo, useState } from "react";
import type { Coordinate, QuestMap } from "@cerebro/core/domain/game-quests";
import type { QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import { regionCorridors, type RegionLabelBox } from "./quest-spawn-region-presentation";
import styles from "./quest-board.module.css";

type RegionProps={map:QuestMap;layer:QuestSpawnRegionLayer;point:(c:Coordinate)=>Coordinate;selected?:string;hovered?:string;pathIndex:number};
export function QuestSpawnRegionAreas({map,layer,point,selected,hovered,pathIndex}:RegionProps){
  const corridors=useMemo(()=>new Map(layer.regions.map(region=>[region.id,regionCorridors(map,region)])),[map,layer]);
  return <g aria-hidden="true" pointerEvents="none">{layer.regions.map(region=>{
    const active=selected===region.id||hovered===region.id,route=region.pathIndices.includes(pathIndex);
    return <g key={region.id} data-region-highlight={region.id} data-region-active={active} className={styles.regionArea} opacity={active?1:route?.55:.25}>
      {(corridors.get(region.id)??[]).map(([from,to],index)=>{const a=point(from),b=point(to);return <line key={index} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#50d8bf" strokeWidth={active?17:10} strokeOpacity={active?.25:.17} strokeLinecap="round"/>;})}
      {region.coordinates.map(c=>{const [x,y]=point(c);return <circle key={c.join(',')} data-region-tile={region.id} cx={x} cy={y} r={active?11:7} fill="#63e3ca" fillOpacity={active?.22:.12} stroke="#72e8d0" strokeWidth={active?1.8:.7} strokeOpacity={active?.9:.35}/>;})}
    </g>;
  })}</g>;
}

export function QuestSpawnRegionMarkers({layer,point,selected,hovered,pathIndex,names,onChoose,onHover,uid,labels}:RegionProps&{
  names:boolean;onChoose:(id:string)=>void;onHover:(id:string|null)=>void;uid:string;labels:Map<string,RegionLabelBox>;
}){
  const [failed,setFailed]=useState<Set<string>>(new Set());
  return <g>{layer.regions.map((region,index)=>{
    const [x,y]=point(region.anchor),active=region.pathIndices.includes(pathIndex),isSelected=selected===region.id,label=names||isSelected||hovered===region.id?labels.get(region.id):undefined;
    return <g key={region.id} role="button" tabIndex={0} aria-pressed={isSelected}
      aria-label={`${region.defender.name}, encounter region, ${region.coordinates.length} possible map ${region.coordinates.length===1?'position':'positions'}, ${region.defender.rarity} stars`}
      data-spawn-region={region.id} data-coordinate={region.anchor.join(',')} className={styles.regionMarker}
      onClick={()=>onChoose(region.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();onChoose(region.id);}}}
      onMouseEnter={()=>onHover(region.id)} onMouseLeave={()=>onHover(null)} onFocus={()=>onHover(region.id)} onBlur={()=>onHover(null)}>
      <title>{`${region.defender.name} · Encounter region · Exact trigger tile varies`}</title>
      <defs><clipPath id={`${uid}-region-${index}`}><circle cx={x} cy={y} r="22"/></clipPath></defs>
      {isSelected&&<circle cx={x} cy={y} r="35" fill="none" stroke="#e0fff8" strokeWidth="2"/>}
      <circle cx={x} cy={y+2} r="29" fill="#020b13" opacity=".9"/>
      <circle cx={x} cy={y} r="28" fill="#102a2d" stroke="#70e2c9" strokeWidth={isSelected?2.5:1.8} strokeDasharray="4 3" opacity={active||isSelected?1:.7}/>
      <circle cx={x} cy={y} r="23" fill="#10302e" stroke="#369b8b"/>
      <g aria-hidden="true"><circle cx={x} cy={y-5} r="7" fill="#84b7ad"/><path d={`M${x-12} ${y+14}q0-14 12-14t12 14`} fill="#537e77"/></g>
      {!failed.has(region.id)&&<image data-region-portrait={region.defender.gameId} href={region.defender.imageUrl} x={x-22} y={y-22} width="44" height="44" clipPath={`url(#${uid}-region-${index})`} opacity={active||isSelected?1:.8} onError={()=>setFailed(current=>new Set([...current,region.id]))}/>}
      <rect x={x-17} y={y+20} width="34" height="16" rx="5" fill="#092820" stroke="#64c9b2"/>
      <text x={x} y={y+31} textAnchor="middle" fill="#baf8e8" fontSize="10" fontWeight="600">{region.defender.rarity}★ ∼</text>
      {label&&<g className={styles.nameLabel}><rect {...label} rx="6" fill="#061c1d" fillOpacity=".97" stroke={isSelected?"#8debd5":"#315b55"}/><text x={label.x+label.width/2} y={label.y+17} textAnchor="middle" fill="#e6fff8" fontSize="11" fontWeight="600">{region.defender.name.length>27?region.defender.name.slice(0,25)+'…':region.defender.name}</text></g>}
    </g>;
  })}</g>;
}
