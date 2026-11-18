import { expect, it } from "vitest";
import type { Coordinate } from "@cerebro/core/domain/game-quests";
import { questMapOverviewPaths } from "./quest-map-overview-paths";

it("batches overview connections by type without joining disconnected edges or changing endpoints", () => {
  const edges = [
    { from: [0, 0], to: [1, 0], portal: false },
    { from: [1, 0], to: [2, 0], portal: false },
    { from: [4, 3], to: [2, 1], portal: true },
    { from: [9, 8], to: [7, 6], portal: false },
    { from: [2, 1], to: [4, 3], portal: true },
  ] satisfies { from: Coordinate; to: Coordinate; portal: boolean }[];
  const before = JSON.stringify(edges);
  const result = questMapOverviewPaths(edges, ([x, y]) => [76 + x * 22, 76 + y * 22]);
  expect(result).toEqual([
    { portal: false, d: 'M76 76L98 76M98 76L120 76' },
    { portal: true, d: 'M164 142L120 98' },
    { portal: false, d: 'M274 252L230 208' },
    { portal: true, d: 'M120 98L164 142' },
  ]);
  expect(result.map(run=>run.d).join('').match(/M/g)).toHaveLength(edges.length);
  expect(JSON.stringify(edges)).toBe(before);
});

it("keeps an empty overview empty", () => {
  expect(questMapOverviewPaths([], coordinate => coordinate)).toEqual([]);
});

it("does not let an unrenderable coordinate discard the remaining overview connections", () => {
  const result = questMapOverviewPaths([
    { from: [NaN, 0], to: [1, 1], portal: false },
    { from: [2, 3], to: [4, 5], portal: false },
  ], coordinate => coordinate);
  expect(result).toEqual([{ portal: false, d: 'M2 3L4 5' }]);
});
