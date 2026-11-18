// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { Coordinate, QuestMap } from "@cerebro/core/domain/game-quests";
import { QuestMapExplorer } from "./quest-map-explorer";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
HTMLElement.prototype.scrollBy = vi.fn();
HTMLElement.prototype.scrollTo = vi.fn();
let root: Root | undefined;
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  document.body.innerHTML = "";
});

function portalMap(random = false): QuestMap {
  const coordinates: Coordinate[] = [[0,0], [4,0], [8,0]];
  return {
    version: 1, questId: "portal-fixture", mapId: "portal-map", sourceHash: "a".repeat(64), sourceFile: "frozen.json", capturedAt: "2026-11-18T00:00:00Z",
    gridDimension: 12, adaptive: false, rewards: { fixedChampions: [], possibleCrystals: [] },
    tiles: coordinates.map((coordinate, index) => ({ coordinate, nodeNumber: index, start: false, final: false, hidden: false,
      links: index < 2 ? [coordinates[index + 1]] : [], barrier: "", applications: [], randomPortal: random && index === 0,
      portals: !random && index === 0 ? [{ target: coordinates[1], label: "", tags: [], randomChance: 0 }] : [] })),
    paths: [{ index: 0, coordinates }], encounters: [],
  };
}

async function inspect(map: QuestMap, coordinate: string) {
  window.history.replaceState(null, "", `/quests/${map.questId}`);
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<QuestMapExplorer map={map} initialNode={coordinate}/>));
  return host.querySelector('section[aria-labelledby="coordinate-heading"]')!;
}

it.each([
  ["source", "0,0", false],
  ["destination-only", "4,0", false],
  ["random source", "0,0", true],
] as const)("hides combat modifiers at a portal-only %s", async (_kind, coordinate, random) => {
  const map = portalMap(random), before = JSON.stringify(map);
  const inspector = await inspect(map, coordinate);
  expect(inspector.textContent).not.toContain("Node modifiers");
  expect(JSON.stringify(map)).toBe(before);
});

it.each([
  ["portal source", "0,0", false],
  ["portal destination", "4,0", false],
  ["start", "8,0", true],
  ["ordinary tile", "8,0", false],
] as const)("retains combat details for a defender on a %s", async (_kind, coordinate, start) => {
  const map = portalMap(), tile = map.tiles.find(tile => tile.coordinate.join(",") === coordinate)!;
  tile.start = start;
  map.encounters.push({ id: "defender", coordinate: tile.coordinate, bossKey: "defender", tierId: "tier", gameId: "champion", rarity: 7,
    name: "Recorded defender", champion: null, rank: 1, level: 1, signature: 0, ascension: 0, final: false, candidates: [], pathIndices: [0] });
  const inspector = await inspect(map, coordinate);
  expect(inspector.textContent).toContain("Recorded defender");
  expect(inspector.textContent).toContain("Node modifiers");
});

it.each([
  ["transit", false, false],
  ["start", true, false],
  ["finish", false, true],
] as const)("hides combat modifiers on empty %s locations", async (_kind, start, final) => {
  const map = portalMap();
  Object.assign(map.tiles[2], { start, final });
  const before = JSON.stringify(map), inspector = await inspect(map, "8,0");
  expect(inspector.textContent).not.toContain("Node modifiers");
  if (start) expect(inspector.textContent).toContain("Quest start");
  if (final) expect(inspector.textContent).toContain("Quest finish");
  expect(JSON.stringify(map)).toBe(before);
});
