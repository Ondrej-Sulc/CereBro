import { coordinateKey, gameText, type Coordinate, type QuestMap } from "./index";

/** Human labels never create an identity for an unplaced opponent. */
export function questPositionLabel(map: QuestMap, coordinate: Coordinate): string {
  const key=coordinateKey(coordinate);
  const fights=map.encounters.filter(e=>coordinateKey(e.coordinate)===key);
  if(fights.length)return fights.map(e=>e.champion?.name??gameText(e.name)).join(" / ");
  const tile=map.tiles.find(t=>coordinateKey(t.coordinate)===key);
  if(tile?.start)return "Start";
  if(tile?.portals.length)return "Portal";
  if(tile?.final)return "Finish";
  return tile&&tile.links.length>1?"Junction":"Map location";
}

export function questZoom(input:{scale:number;next:number;min:number;max?:number;left:number;top:number;anchorX:number;anchorY:number;width:number;boardWidth:number}) {
  const scale=Math.min(Math.max(input.max??2.5,input.min),Math.max(input.min,input.next));
  const oldOffset=Math.max(0,(input.width-input.boardWidth*input.scale)/2);
  const offset=Math.max(0,(input.width-input.boardWidth*scale)/2);
  return {scale,left:(input.left+input.anchorX-oldOffset)/input.scale*scale+offset-input.anchorX,top:(input.top+input.anchorY)/input.scale*scale-input.anchorY};
}
