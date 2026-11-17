// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { coordinateKey, type Coordinate } from "@cerebro/core/domain/game-quests";
import { QuestMapPaths } from "./quest-map-paths";

const edges = [
  { from: [0, 0], to: [1, 0], portal: false },
  { from: [1, 0], to: [1, 1], portal: false },
  { from: [1, 1], to: [4, 3], portal: true },
  { from: [4, 3], to: [1, 1], portal: true },
] satisfies { from: Coordinate; to: Coordinate; portal: boolean }[];
const point = ([x, y]: Coordinate): Coordinate => [76 + x * 22, 76 + y * 22];

function render(highlightRoute = true) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<svg><QuestMapPaths edges={edges} point={point}
    routeEdges={new Set(["0,0>1,0", "1,1>4,3"])} routePhases={new Map([["0,0>1,0", 13], ["1,1>4,3", 27]])}
    highlightRoute={highlightRoute}/></svg>);
  return host;
}

describe("quest map energy paths", () => {
  it("preserves every directed source edge and its exact transformed endpoints", () => {
    const host = render();
    const layers = [...host.querySelectorAll("[data-route-edge]")];
    expect(layers).toHaveLength(edges.length);
    layers.forEach((layer, index) => {
      const source = edges[index];
      expect(layer.getAttribute("data-from")).toBe(coordinateKey(source.from));
      expect(layer.getAttribute("data-to")).toBe(coordinateKey(source.to));
      expect(layer.hasAttribute("data-route-portal")).toBe(source.portal);
      const line = layer.querySelector("[data-route-line]")!;
      if (source.portal) {
        const coordinates = line.getAttribute("d")!.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
        expect(coordinates.slice(0, 2)).toEqual(point(source.from));
        expect(coordinates.slice(-2)).toEqual(point(source.to));
      } else {
        expect([Number(line.getAttribute("x1")), Number(line.getAttribute("y1"))]).toEqual(point(source.from));
        expect([Number(line.getAttribute("x2")), Number(line.getAttribute("y2"))]).toEqual(point(source.to));
      }
      for (const selector of ["[data-route-casing]", "[data-route-glow]", "[data-route-line]"]) {
        expect(layer.querySelector(selector)?.getAttribute("vector-effect")).toBe("non-scaling-stroke");
      }
      expect(Number(line.getAttribute("stroke-width"))).toBeLessThanOrEqual(1.5);
    });
  });

  it("flows only the highlighted route and preserves its continuous edge phases", () => {
    const host = render();
    const pulses = [...host.querySelectorAll("[data-route-pulse]")];
    expect(pulses).toHaveLength(2);
    expect(pulses.map(node => node.getAttribute("style"))).toEqual(["--route-phase:13px", "--route-phase:27px"]);
    for (const edge of host.querySelectorAll("[data-route-edge]")) {
      expect(Boolean(edge.querySelector("[data-route-pulse]"))).toBe(edge.getAttribute("data-route-selected") === "true");
    }
    expect(render(false).querySelectorAll('[data-route-selected="true"]')).toHaveLength(0);
    expect(render(false).querySelectorAll("[data-route-pulse]")).toHaveLength(0);
    expect(host.textContent).not.toMatch(/explored|progress|completed/i);
  });

  it("deduplicates portal beacons at actual endpoints without adding route edges or filters", () => {
    const host = render();
    const beacons = [...host.querySelectorAll("[data-portal-beacon]")];
    expect(beacons.map(node => node.getAttribute("data-portal-beacon")).sort()).toEqual(["1,1", "4,3"]);
    expect(host.querySelectorAll("[data-route-edge]")).toHaveLength(4);
    expect(host.querySelector("filter")).toBeNull();
    expect(host.querySelector("[filter]")).toBeNull();
  });
});
