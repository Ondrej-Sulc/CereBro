import { coordinateKey, type Coordinate, type QuestMap } from "./index";

/** Presentation transform only: all endpoints retain the captured coordinate. */
export function questBoardGeometry(map: QuestMap) {
  const padding = 76;
  let pitch = 22;
  // A uniform presentation scale prevents new closely spaced portraits colliding.
  // The coordinate transform stays linear; existing maps retain their reviewed pitch.
  for (let i=0;i<map.encounters.length;i++) for (const other of map.encounters.slice(i+1)) {
    const a=map.encounters[i];
    const distance=Math.hypot(a.coordinate[0]-other.coordinate[0],a.coordinate[1]-other.coordinate[1]);
    const radii=(a.final?33:27)+(other.final?33:27);
    if (distance>0 && distance*22<=radii) pitch=Math.max(pitch,Math.ceil((radii+10)/distance));
  }
  const minX = Math.min(...map.tiles.map(t => t.coordinate[0]));
  const minY = Math.min(...map.tiles.map(t => t.coordinate[1]));
  const maxX = Math.max(...map.tiles.map(t => t.coordinate[0]));
  const maxY = Math.max(...map.tiles.map(t => t.coordinate[1]));
  const point = (c: Coordinate): Coordinate => [padding + (c[0] - minX) * pitch, padding + (c[1] - minY) * pitch];
  const encounters = new Map(map.tiles.map(t => [coordinateKey(t.coordinate), map.encounters.filter(e => coordinateKey(e.coordinate) === coordinateKey(t.coordinate))]));
  const edges = map.tiles.flatMap(t => [...t.links.map(target => ({ from: t.coordinate, to: target, portal: false })), ...t.portals.map(p => ({ from: t.coordinate, to: p.target, portal: true }))]);
  return { pitch, width: (maxX - minX) * pitch + padding * 2, height: (maxY - minY) * pitch + padding * 2, point, encounters, edges };
}

type LabelBox = { x: number; y: number; width: number; height: number };
const overlaps = (a: LabelBox, b: LabelBox) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
/** Place labels in spare space without moving any placement or covering another portrait. */
export function questBoardLabels(map: QuestMap, prioritized: string[] = []) {
  const board = questBoardGeometry(map), result = new Map<string, LabelBox>();
  const portraits = map.encounters.map(e => { const [x,y] = board.point(e.coordinate); const radius=e.final?41:35; return { x:x-radius,y:y-radius,width:radius*2,height:radius*2 }; });
  const order = [...map.encounters].sort((a,b) => {
    const x=prioritized.indexOf(a.id),y=prioritized.indexOf(b.id);return (x<0?999:x)-(y<0?999:y);
  });
  for (const e of order) {
    const [x,y] = board.point(e.coordinate), radius=e.final?33:27;
    const candidates = [
      {x:x-70,y:y+radius+13,width:140,height:23}, {x:x-70,y:y-radius-38,width:140,height:23},
      {x:x+radius+12,y:y-11,width:140,height:23}, {x:x-radius-152,y:y-11,width:140,height:23},
    ];
    const box = candidates.find(c => c.x>=0&&c.y>=0&&c.x+c.width<=board.width&&c.y+c.height<=board.height
      && !portraits.some(p=>overlaps(c,p)) && ![...result.values()].some(p=>overlaps(c,p)));
    if(box) result.set(e.id,box);
  }
  return result;
}
