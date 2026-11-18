// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { coordinateKey, type Coordinate } from "@cerebro/core/domain/game-quests";
import { QuestMapPaths } from "./quest-map-paths";

const edges = [
  { from: [0, 0], to: [1, 0], portal: false },
  { from: [1, 0], to: [1, 1], portal: false },
  { from: [1, 1], to: [4, 3], portal: true },
  { from: [4, 3], to: [1, 1], portal: true },
] satisfies { from: Coordinate; to: Coordinate; portal: boolean }[];
const point = ([x, y]: Coordinate): Coordinate => [76 + x * 22, 76 + y * 22];
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function render(highlightRoute = true, renderPulses = true) {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(<svg><QuestMapPaths edges={edges} point={point}
    routeEdges={new Set(["0,0>1,0", "1,1>4,3"])} routePhases={new Map([["0,0>1,0", 13], ["1,1>4,3", 27]])}
    highlightRoute={highlightRoute} renderPulses={renderPulses}/></svg>);
  return host;
}

describe("quest map energy paths", () => {
  it("reuses unchanged static path markup across parent UI updates", async () => {
    const host = document.createElement("div"), root = createRoot(host), transform = vi.fn(point);
    const props = { edges, point: transform, routeEdges: new Set<string>(), routePhases: new Map<string, number>(), highlightRoute: false, renderPulses: false };
    try {
      await act(async () => root.render(<svg data-ui-update="0"><QuestMapPaths {...props}/></svg>));
      expect(transform).toHaveBeenCalled(); transform.mockClear();
      await act(async () => root.render(<svg data-ui-update="1"><QuestMapPaths {...props}/></svg>));
      expect(transform).not.toHaveBeenCalled();
      expect(host.querySelectorAll("[data-route-edge]")).toHaveLength(edges.length);
    } finally { await act(async () => root.unmount()); }
  });

  it("omits only pulse strokes when the canvas renderer owns the moving light", () => {
    const fallback = render(), staticOnly = render(true, false);
    expect(staticOnly.querySelectorAll("[data-route-edge]")).toHaveLength(edges.length);
    expect(staticOnly.querySelector("[data-route-pulse],[data-route-pulse-body],[data-route-pulse-trail]")).toBeNull();
    for (const selector of ["[data-route-casing]", "[data-route-glow]", "[data-route-line]"]) {
      expect(staticOnly.querySelectorAll(selector)).toHaveLength(edges.length);
    }
    fallback.querySelectorAll("[data-route-pulse],[data-route-pulse-body],[data-route-pulse-trail]").forEach(pulse => pulse.remove());
    expect(staticOnly.innerHTML).toBe(fallback.innerHTML);
    expect(staticOnly.querySelectorAll("[data-portal-beacon]")).toHaveLength(2);
  });

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

  it("flows every directed edge and emphasizes the highlighted route without removing other flow", () => {
    const host = render();
    const pulses = [...host.querySelectorAll("[data-route-pulse]")];
    expect(pulses).toHaveLength(edges.length);
    expect(pulses.map(node => node.getAttribute("style"))).toEqual(["--route-phase:17px", "--route-phase:4px", "--route-phase:31px", "--route-phase:4px"]);
    for (const edge of host.querySelectorAll("[data-route-edge]")) {
      const pulse=edge.querySelector('[data-route-pulse]')!;
      expect(pulse).not.toBeNull();
      expect(Number(pulse.getAttribute('stroke-opacity'))).toBe(edge.getAttribute('data-route-selected')==='true' ? 1 : .72);
      expect(Number(pulse.getAttribute('stroke-width'))).toBe(1.8);
      expect(pulse.getAttribute('vector-effect')).toBe('non-scaling-stroke');
    }
    expect(render(false).querySelectorAll('[data-route-selected="true"]')).toHaveLength(0);
    const all=render(false).querySelectorAll('[data-route-pulse]');
    expect(all).toHaveLength(edges.length);
    expect([...all].every(pulse=>Number(pulse.getAttribute('stroke-opacity'))===.98)).toBe(true);
    expect(host.textContent).not.toMatch(/explored|progress|completed/i);
  });

  it('keeps every pulse head, body and trail exactly on its native connection without arrow glyphs',()=>{
    const host=render(false);
    expect(host.querySelector('animateMotion,mpath,marker,[marker-end],[data-map-directions],[data-flow-arrow]')).toBeNull();
    for(const edge of host.querySelectorAll('[data-route-edge]')){
      const core=edge.querySelector('[data-route-line]')!;
      const head=edge.querySelector('[data-route-pulse]')!;
      const body=edge.querySelector('[data-route-pulse-body]')!;
      const trail=edge.querySelector('[data-route-pulse-trail]')!;
      expect(head.getAttribute('stroke-dasharray')).toBe('4 56');
      expect(body.getAttribute('stroke-dasharray')).toBe('13 47');
      expect(trail.getAttribute('stroke-dasharray')).toBe('26 34');
      for(const layer of [head,body,trail]){
        expect(layer.tagName).toBe(core.tagName);
        for(const attribute of ['d','x1','y1','x2','y2'])expect(layer.getAttribute(attribute)).toBe(core.getAttribute(attribute));
        expect(layer.getAttribute('vector-effect')).toBe('non-scaling-stroke');
      }
      // At time zero the dash's leading end is length - offset. At time t,
      // every layer advances that same end by 25px/s along the native stroke.
      const leadingEnd=(layer:Element)=>Number(layer.getAttribute('stroke-dasharray')!.split(' ')[0])-Number(layer.getAttribute('stroke-dashoffset'));
      expect(leadingEnd(trail)).toBe(leadingEnd(head));
      expect(leadingEnd(body)).toBe(leadingEnd(head));
      expect(Number(trail.getAttribute('stroke-opacity'))).toBeLessThan(Number(body.getAttribute('stroke-opacity')));
      expect(Number(body.getAttribute('stroke-opacity'))).toBeLessThan(Number(head.getAttribute('stroke-opacity')));
    }
  });

  it('aligns a single travelling pulse across consecutive source-oriented segments',()=>{
    const host=document.createElement('div');
    host.innerHTML=renderToStaticMarkup(<svg><QuestMapPaths edges={[
      {from:[0,0],to:[1,0],portal:false},{from:[1,0],to:[2,0],portal:false},
    ]} point={point} routeEdges={new Set()} highlightRoute={false} routePhases={new Map([['0,0>1,0',0],['1,0>2,0',22]])}/></svg>);
    for(const layer of host.querySelectorAll('[data-route-pulse],[data-route-pulse-body],[data-route-pulse-trail]')){
      const startDistance=Number(layer.getAttribute('x1'))-76;
      const dashLength=Number(layer.getAttribute('stroke-dasharray')!.split(' ')[0]);
      const initialOffset=Number(layer.getAttribute('stroke-dashoffset'));
      expect(startDistance+dashLength-initialOffset).toBe(0);
      // Half a period later, decreasing offset by30 moves every shared front
      // forward30screen pixels, with no detached glyph position to misalign.
      expect(startDistance+dashLength-(initialOffset-30)).toBe(30);
    }
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
