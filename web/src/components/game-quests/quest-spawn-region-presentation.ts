import { coordinateKey, type Coordinate, type QuestEncounter, type QuestMap } from "@cerebro/core/domain/game-quests";
import type { QuestSpawnRegion, QuestSpawnRegionLayer } from "@cerebro/core/domain/game-quests/spawn-regions";
import type { QuestPortrait } from "@/lib/game-quests/presentation";
import { questBoardGeometry } from "@cerebro/core/domain/game-quests/board";

export type MapDefenderEntry = { kind: "fixed"; encounter: QuestEncounter } | { kind: "region"; region: QuestSpawnRegion };
export function regionPortrait(region: QuestSpawnRegion): QuestPortrait {
  return { name: region.defender.name, imageUrl: region.defender.imageUrl, href: null,
    className: "Encounter region", color: "#65d6c1", nativeGameId: region.defender.gameId };
}
export function mapDefenders(map: QuestMap, layer?: QuestSpawnRegionLayer, pathIndex?: number): MapDefenderEntry[] {
  const path=map.paths.find(p=>p.index===pathIndex);
  const entries:MapDefenderEntry[]=[
    ...map.encounters.filter(e=>pathIndex===undefined||e.pathIndices.includes(pathIndex)).map(encounter=>({kind:"fixed" as const,encounter})),
    ...(layer?.regions??[]).filter(r=>pathIndex===undefined||r.pathIndices.includes(pathIndex)).map(region=>({kind:"region" as const,region})),
  ];
  if (!path) return entries;
  const positions=new Map(path.coordinates.map((c,i)=>[coordinateKey(c),i]));
  const position=(entry:MapDefenderEntry)=>entry.kind==="fixed" ? positions.get(coordinateKey(entry.encounter.coordinate))??Infinity
    : Math.min(...entry.region.coordinates.map(c=>positions.get(coordinateKey(c))??Infinity));
  return entries.sort((a,b)=>position(a)-position(b));
}
export function entryCoordinate(entry:MapDefenderEntry):Coordinate {
  return entry.kind==="region"?entry.region.anchor:entry.encounter.coordinate;
}
/** Expand the presentation pitch without creating synthetic native encounters. */
export function regionBoardGeometry(map:QuestMap,layer?:QuestSpawnRegionLayer){
  const base=questBoardGeometry(map);if(!layer?.regions.length)return base;
  const anchors=[...map.encounters.map(e=>({coordinate:e.coordinate,radius:e.final?33:27})),...layer.regions.map(r=>({coordinate:r.anchor,radius:28}))];
  let pitch=base.pitch;
  for(let i=0;i<anchors.length;i++)for(const other of anchors.slice(i+1)){
    const own=anchors[i],distance=Math.hypot(own.coordinate[0]-other.coordinate[0],own.coordinate[1]-other.coordinate[1]);
    if(distance>0)pitch=Math.max(pitch,Math.ceil((own.radius+other.radius+10)/distance));
  }
  const ratio=pitch/base.pitch;
  return {...base,pitch,width:base.width*ratio,height:base.height*ratio,point:(c:Coordinate):Coordinate=>{const p=base.point(c);return[p[0]*ratio,p[1]*ratio];}};
}
export type RegionLabelBox={x:number;y:number;width:number;height:number};
export function regionBoardLabels(map:QuestMap,layer:QuestSpawnRegionLayer,board:ReturnType<typeof regionBoardGeometry>,prioritized:string[]){
  const overlaps=(a:RegionLabelBox,b:RegionLabelBox)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
  const anchors=[...map.encounters.map(e=>({id:e.id,coordinate:e.coordinate,radius:e.final?33:27})),...layer.regions.map(r=>({id:r.id,coordinate:r.anchor,radius:28}))];
  const portraits=anchors.map(a=>{const [x,y]=board.point(a.coordinate),r=a.radius+8;return{x:x-r,y:y-r,width:r*2,height:r*2};});
  const result=new Map<string,RegionLabelBox>();
  for(const a of anchors.sort((a,b)=>{const x=prioritized.indexOf(a.id),y=prioritized.indexOf(b.id);return(x<0?999:x)-(y<0?999:y);})){const [x,y]=board.point(a.coordinate);
    const options=[{x:x-80,y:y+a.radius+14,width:160,height:25},{x:x-80,y:y-a.radius-40,width:160,height:25},{x:x+a.radius+12,y:y-12,width:160,height:25},{x:x-a.radius-172,y:y-12,width:160,height:25}];
    const box=options.find(o=>o.x>=0&&o.y>=0&&o.x+o.width<=board.width&&o.y+o.height<=board.height&&!portraits.some(p=>overlaps(o,p))&&![...result.values()].some(p=>overlaps(o,p)));
    if(box)result.set(a.id,box);
  }
  return result;
}
/** Follow actual hidden connector tiles; never connect across other visible map positions. */
export function regionCorridors(map:QuestMap,region:QuestSpawnRegion):[Coordinate,Coordinate][] {
  const members=new Set(region.coordinates.map(coordinateKey)),tiles=new Map(map.tiles.map(t=>[coordinateKey(t.coordinate),t]));
  const result=new Map<string,[Coordinate,Coordinate]>();
  for(const start of region.coordinates){
    const queue:{point:Coordinate;segments:[Coordinate,Coordinate][]}[]=[{point:start,segments:[]}];
    const seen=new Set([coordinateKey(start)]);
    while(queue.length){
      const current=queue.shift()!,tile=tiles.get(coordinateKey(current.point));
      for(const next of tile?.links??[]){
        const key=coordinateKey(next);if(seen.has(key))continue;seen.add(key);
        const segments:[Coordinate,Coordinate][]=[...current.segments,[current.point,next]];
        if(members.has(key)){
          for(const edge of segments)result.set(`${coordinateKey(edge[0])}>${coordinateKey(edge[1])}`,edge);
        } else if(tiles.get(key)?.hidden)queue.push({point:next,segments});
      }
    }
  }
  return [...result.values()];
}
