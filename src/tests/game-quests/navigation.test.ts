import { expect,it } from "vitest";
import { questZoom,questPositionLabel } from "../../domain/game-quests/navigation";
import { loadQuestMap } from "../../data/game-quests";
it("anchors zoom at the pointer and clamps without losing the current world point",()=>{
 const x={scale:1,next:1.4,min:.5,left:210,top:120,anchorX:137,anchorY:231,width:800,boardWidth:1200};
 const r=questZoom(x);expect((r.left+x.anchorX)/r.scale).toBeCloseTo(x.left+x.anchorX);expect((r.top+x.anchorY)/r.scale).toBeCloseTo(x.top+x.anchorY);
 expect(questZoom({...x,next:100}).scale).toBe(2.5);expect(questZoom({...x,next:0}).scale).toBe(.5);
 const fit=questZoom({...x,scale:.5,next:1,left:0,anchorX:400});expect(fit.left).toBe(200);
});
it("labels real defenders, start and portals without exposing source coordinates",async()=>{
 const m=(await loadQuestMap("a05_ch01_q01"))!;
 expect(questPositionLabel(m,[10,21])).toBe("Gambit");
 expect(questPositionLabel(m,m.tiles.find(t=>t.start)!.coordinate)).toBe("Start");
 expect(questPositionLabel(m,m.tiles.find(t=>t.portals.length)!.coordinate)).toBe("Portal");
 const empty=m.tiles.find(t=>!t.start&&!t.final&&!t.portals.length&&t.links.length===1&&!m.encounters.some(e=>e.coordinate[0]===t.coordinate[0]&&e.coordinate[1]===t.coordinate[1]))!;
 expect(questPositionLabel(m,empty.coordinate)).toBe("Map location");
 expect(m.tiles.every(t=>!questPositionLabel(m,t.coordinate).match(/\d+,\s*\d+|Route position/))).toBe(true);
});
