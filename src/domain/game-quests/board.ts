import { coordinateKey, type Coordinate, type QuestMap } from "./index";
import { QUEST_TAG_GATE_PADDING, QUEST_TAG_GATE_RADIUS } from "./gate-tag-layout";

/** Presentation transform only: all endpoints retain the captured coordinate. */
export function questBoardGeometry(map: QuestMap) {
  let padding = 76;
  let pitch = 22;
  // Keep native geometry linear while leaving room for distinct map objects.
  const anchors = new Map(map.encounters.map(encounter => [coordinateKey(encounter.coordinate), { coordinate: encounter.coordinate, radius: encounter.final ? 33 : 27 }]));
  const classIds = new Set(["chemical", "trained", "mystic", "cosmic", "tech", "mutant", "superior"]);
  for (const gate of map.features?.gates ?? []) {
    const tags = gate.constraints?.tags ?? [];
    const simpleClasses = gate.kind === "tags" && tags.length > 0 && tags.every(tag => classIds.has(tag));
    const radius = gate.kind === "tags" ? simpleClasses ? 50 : QUEST_TAG_GATE_RADIUS : gate.kind === "resource" || gate.kind === "switch" || gate.kind === "unknown" ? 78 : 33;
    if (gate.kind === "tags" && !simpleClasses) padding = Math.max(padding, QUEST_TAG_GATE_PADDING);
    const key = coordinateKey(gate.coordinate), previous = anchors.get(key);
    anchors.set(key, { coordinate: gate.coordinate, radius: Math.max(radius, previous?.radius ?? 0) });
  }
  for (const feature of [...(map.features?.pathRewards ?? []), ...(map.details?.chests ?? [])]) {
    const key = coordinateKey(feature.coordinate);
    if (!anchors.has(key)) anchors.set(key, { coordinate: feature.coordinate, radius: 27 });
  }
  const markers = [...anchors.values()];
  for (let i=0;i<markers.length;i++) for (const other of markers.slice(i+1)) {
    const a=markers[i];
    const distance=Math.hypot(a.coordinate[0]-other.coordinate[0],a.coordinate[1]-other.coordinate[1]);
    const radii=a.radius+other.radius;
    if (distance>0 && distance*22<=radii) pitch=Math.max(pitch,Math.ceil((radii+10)/distance));
  }
  // Screen coordinates increase downwards, so this is a clockwise 45-degree rotation.
  const rotate = (c: Coordinate): Coordinate => [(c[0] - c[1]) * Math.SQRT1_2, (c[0] + c[1]) * Math.SQRT1_2];
  const projectedTiles = map.tiles.map(t => rotate(t.coordinate));
  const minX = Math.min(...projectedTiles.map(c => c[0]));
  const minY = Math.min(...projectedTiles.map(c => c[1]));
  const maxX = Math.max(...projectedTiles.map(c => c[0]));
  const maxY = Math.max(...projectedTiles.map(c => c[1]));
  const point = (c: Coordinate): Coordinate => {
    const [x, y] = rotate(c);
    return [padding + (x - minX) * pitch, padding + (y - minY) * pitch];
  };
  const encounters = new Map(map.tiles.map(t => [coordinateKey(t.coordinate), map.encounters.filter(e => coordinateKey(e.coordinate) === coordinateKey(t.coordinate))]));
  const edges = map.tiles.flatMap(t => [...t.links.map(target => ({ from: t.coordinate, to: target, portal: false })), ...t.portals.map(p => ({ from: t.coordinate, to: p.target, portal: true }))]);
  return { pitch, width: (maxX - minX) * pitch + padding * 2, height: (maxY - minY) * pitch + padding * 2, point, encounters, edges };
}

export type QuestMapLabelBox = { x: number; y: number; width: number; height: number };
export type QuestMapLabelObstacles = {
  radii: ReadonlyMap<string, number>;
  obstacles: readonly { x: number; y: number; radius: number }[];
};
type LabelBox = QuestMapLabelBox;
const overlaps = (a: LabelBox, b: LabelBox) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
/** Scale labels independently of the terrain so their text remains readable. */
export function questLabelCandidates(x:number,y:number,radius:number,name:string,unit=1,bounds?:{width:number;height:number}):LabelBox[] {
  const width=Math.min(200,Math.max(96,Math.min(name.length,23)*7+28))*unit,height=30*unit,gap=10*Math.max(1,unit);
  const candidates = [
    {x:x-width/2,y:y+radius+gap,width,height}, {x:x-width/2,y:y-radius-gap-height,width,height},
    {x:x+radius+gap,y:y-height/2,width,height}, {x:x-radius-gap-width,y:y-height/2,width,height},
    ...[-1,1].flatMap(dx=>[-1,1].map(dy=>({x:x+dx*(radius+gap+width/2)-width/2,y:y+dy*(radius+gap+height/2)-height/2,width,height}))),
  ];
  return bounds ? candidates.map(box=>({...box,x:Math.max(4*unit,Math.min(bounds.width-box.width-4*unit,box.x)),y:Math.max(4*unit,Math.min(bounds.height-box.height-4*unit,box.y))})) : candidates;
}
/** Place labels in spare space without moving any placement or covering another portrait. */
export function questBoardLabels(map: QuestMap, prioritized: string[] = [], unit=1, markers?: QuestMapLabelObstacles) {
  const board = questBoardGeometry(map), result = new Map<string, LabelBox>();
  const portraits = markers ? markers.obstacles.map(({x,y,radius})=>({x:x-radius,y:y-radius,width:radius*2,height:radius*2})) : map.encounters.map(e => { const [x,y] = board.point(e.coordinate); const radius=e.final?41:35; return { x:x-radius,y:y-radius,width:radius*2,height:radius*2 }; });
  const order = [...map.encounters].sort((a,b) => {
    const x=prioritized.indexOf(a.id),y=prioritized.indexOf(b.id);return (x<0?999:x)-(y<0?999:y);
  });
  for (const e of order) {
    const [x,y] = board.point(e.coordinate), radius=markers?.radii.get(coordinateKey(e.coordinate))??(e.final?33:27);
    const candidates = questLabelCandidates(x,y,radius,e.name,unit,board);
    const box = candidates.find(c => c.x>=0&&c.y>=0&&c.x+c.width<=board.width&&c.y+c.height<=board.height
      && !portraits.some(p=>overlaps(c,p)) && ![...result.values()].some(p=>overlaps(c,p)));
    if(box) result.set(e.id,box);
  }
  return result;
}
