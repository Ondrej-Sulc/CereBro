import { expect, it } from "vitest";
import { loadQuestMap, questCatalog } from "../../data/game-quests";
import { coordinateKey } from "../../domain/game-quests";
import { questBoardGeometry, questBoardLabels } from "../../domain/game-quests/board";

it("renders every placement once at its source coordinate, preserving directed links and portals", async () => {
  for (const q of questCatalog.filter(q => q.coverage === "full-map")) {
    const map = (await loadQuestMap(q.id))!;
    const board = questBoardGeometry(map);
    const sourceTiles = new Map(map.tiles.map(tile => [coordinateKey(tile.coordinate), tile]));
    if (!q.mapSourceHash) expect(board.pitch).toBe(22); // Reviewed original maps keep their transform.
    expect([...board.encounters.values()].flat().map(e => e.id).sort()).toEqual(map.encounters.map(e => e.id).sort());
    expect(board.edges.length).toBe(map.tiles.reduce((n, t) => n + t.links.length + t.portals.length, 0));
    for (const edge of board.edges) {
      const source = sourceTiles.get(coordinateKey(edge.from))!;
      expect((edge.portal ? source.portals.map(p => p.target) : source.links).some(c => coordinateKey(c) === coordinateKey(edge.to))).toBe(true);
      const a = board.point(edge.from), b = board.point(edge.to);
      expect(b[0] - a[0]).toBe((edge.to[0] - edge.from[0]) * board.pitch);
      expect(b[1] - a[1]).toBe((edge.to[1] - edge.from[1]) * board.pitch);
    }
    for (let i=0;i<map.encounters.length;i++)for(const other of map.encounters.slice(i+1)){
      const encounter=map.encounters[i],a=board.point(encounter.coordinate),b=board.point(other.coordinate);
      expect(Math.hypot(a[0]-b[0],a[1]-b[1])).toBeGreaterThan((encounter.final?33:27)+(other.final?33:27));
    }
  }
}, 60000); // Exhaustively loads all 234 layouts, rather than one small fixture.

it("avoids overlapping dense-map labels while leaving the source positions unchanged", async () => {
  const map=(await loadQuestMap("a04_ch02_q06"))!;
  const labels=[...questBoardLabels(map).values()];
  expect(labels.length).toBeGreaterThan(0);
  for(let i=0;i<labels.length;i++)for(const b of labels.slice(i+1)){
    const a=labels[i];expect(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y).toBe(false);
  }
  const board=questBoardGeometry(map);
  for(const label of labels)for(const encounter of map.encounters){
    const [x,y]=board.point(encounter.coordinate),radius=encounter.final?41:35;
    expect(label.x<x+radius&&label.x+label.width>x-radius&&label.y<y+radius&&label.y+label.height>y-radius).toBe(false);
  }
});
