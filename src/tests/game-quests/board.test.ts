import { expect, it } from "vitest";
import { loadQuestMap, questCatalog } from "../../data/game-quests";
import { coordinateKey, type Coordinate, type QuestMap } from "../../domain/game-quests";
import { questBoardGeometry, questBoardLabels } from "../../domain/game-quests/board";

it("rotates the presentation 45 degrees clockwise and pads the rotated tile bounds", () => {
  const coordinates: Coordinate[] = [[3, 7], [7, 7], [3, 9]];
  const map: QuestMap = {
    version: 1, questId: "rotation", mapId: "rotation", sourceHash: "source", capturedAt: "", sourceFile: "",
    gridDimension: 10, adaptive: false, encounters: [], paths: [{ index: 0, coordinates }],
    rewards: { fixedChampions: [], possibleCrystals: [] },
    tiles: coordinates.map((coordinate, index) => ({
      coordinate, nodeNumber: index, start: index === 0, final: false, hidden: false,
      links: index === 0 ? [coordinates[1]] : [],
      portals: index === 1 ? [{ target: coordinates[2], label: "Portal", randomChance: 1, tags: [] }] : [],
      randomPortal: false, barrier: "", applications: [],
    })),
  };
  const before = JSON.stringify(map), board = questBoardGeometry(map);
  const diagonalPitch = board.pitch / Math.sqrt(2);
  const origin = board.point(coordinates[0]);
  const east = board.point(coordinates[1]), south = board.point(coordinates[2]);
  expect(east[0] - origin[0]).toBeCloseTo(4 * diagonalPitch);
  expect(east[1] - origin[1]).toBeCloseTo(4 * diagonalPitch);
  expect(south[0] - origin[0]).toBeCloseTo(-2 * diagonalPitch);
  expect(south[1] - origin[1]).toBeCloseTo(2 * diagonalPitch);
  const points = coordinates.map(board.point);
  expect(Math.min(...points.map(point => point[0]))).toBeCloseTo(76);
  expect(Math.min(...points.map(point => point[1]))).toBeCloseTo(76);
  expect(Math.max(...points.map(point => point[0]))).toBeCloseTo(board.width - 76);
  expect(Math.max(...points.map(point => point[1]))).toBeCloseTo(board.height - 76);
  expect(board.width).toBeCloseTo(152 + 6 * diagonalPitch);
  expect(board.height).toBeCloseTo(152 + 4 * diagonalPitch);
  expect(board.edges).toEqual([
    { from: coordinates[0], to: coordinates[1], portal: false },
    { from: coordinates[1], to: coordinates[2], portal: true },
  ]);
  expect(JSON.stringify(map)).toBe(before);
});

it("renders every placement once at its source coordinate, preserving directed links and portals", async () => {
  for (const q of questCatalog.filter(q => q.coverage === "full-map")) {
    const map = (await loadQuestMap(q.id))!;
    const board = questBoardGeometry(map);
    const sourceTiles = new Map(map.tiles.map(tile => [coordinateKey(tile.coordinate), tile]));
    // The feature overlay may widen spacing for gates and pickups while retaining the source geometry.
    const originalBoard = questBoardGeometry({ ...map, features: undefined });
    if (!q.mapSourceHash) expect(originalBoard.pitch).toBe(22);
    expect(board.pitch).toBeGreaterThanOrEqual(originalBoard.pitch);
    expect([...board.encounters.values()].flat().map(e => e.id).sort()).toEqual(map.encounters.map(e => e.id).sort());
    expect(board.edges.length).toBe(map.tiles.reduce((n, t) => n + t.links.length + t.portals.length, 0));
    for (const edge of board.edges) {
      const source = sourceTiles.get(coordinateKey(edge.from))!;
      expect((edge.portal ? source.portals.map(p => p.target) : source.links).some(c => coordinateKey(c) === coordinateKey(edge.to))).toBe(true);
      const a = board.point(edge.from), b = board.point(edge.to);
      const dx = edge.to[0] - edge.from[0], dy = edge.to[1] - edge.from[1];
      expect(b[0] - a[0]).toBeCloseTo((dx - dy) * board.pitch / Math.sqrt(2));
      expect(b[1] - a[1]).toBeCloseTo((dx + dy) * board.pitch / Math.sqrt(2));
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

it.each([.48, 1, 2])("keeps selected labels readable and collision-free at %s map zoom", async zoom => {
  const map = (await loadQuestMap('a09_ch03_q02'))!;
  const selected = map.encounters.find(e => coordinateKey(e.coordinate) === '13,19')!;
  const before = JSON.stringify(map);
  const labels = questBoardLabels(map, [selected.id], 1 / zoom);
  const selectedLabel = labels.get(selected.id)!;
  expect(selectedLabel).toBeDefined();
  expect(selectedLabel.height * zoom).toBeCloseTo(30);
  const board = questBoardGeometry(map), boxes = [...labels.values()];
  for (const [index, label] of boxes.entries()) {
    expect(label.x).toBeGreaterThanOrEqual(0); expect(label.y).toBeGreaterThanOrEqual(0);
    expect(label.x + label.width).toBeLessThanOrEqual(board.width);
    expect(label.y + label.height).toBeLessThanOrEqual(board.height);
    for (const other of boxes.slice(index + 1)) expect(label.x < other.x + other.width && label.x + label.width > other.x && label.y < other.y + other.height && label.y + label.height > other.y).toBe(false);
    for (const encounter of map.encounters) {
      const [x, y] = board.point(encounter.coordinate), radius = encounter.final ? 41 : 35;
      expect(label.x < x + radius && label.x + label.width > x - radius && label.y < y + radius && label.y + label.height > y - radius).toBe(false);
    }
  }
  expect(JSON.stringify(map)).toBe(before);
});
