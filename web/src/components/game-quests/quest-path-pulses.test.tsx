// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Coordinate } from "@cerebro/core/domain/game-quests";
import { QuestPathPulses } from "./quest-path-pulses";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let root: Root | undefined, id = 0;
const pending = new Map<number, FrameRequestCallback>();
const motion = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
const context = {
  setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), stroke: vi.fn(),
  lineWidth: 0, lineCap: "butt", strokeStyle: "", globalAlpha: 1,
};
const edges = [
  { from: [0, 50], to: [400, 50], portal: false },
  { from: [2000, 50], to: [2400, 50], portal: false },
] satisfies { from: Coordinate; to: Coordinate; portal: boolean }[];
const point = (coordinate: Coordinate) => coordinate;
beforeEach(() => {
  pending.clear(); id = 0; motion.matches = false;
  vi.clearAllMocks();
  vi.stubGlobal("devicePixelRatio", 2);
  vi.stubGlobal("CanvasRenderingContext2D", class {});
  vi.stubGlobal("matchMedia", () => motion);
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { pending.set(++id, callback); return id; });
  vi.stubGlobal("cancelAnimationFrame", (key: number) => pending.delete(key));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(80);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); root = undefined;
  document.body.innerHTML = ""; vi.restoreAllMocks(); vi.unstubAllGlobals();
});
async function render(onRendererChange?: (renderer: "canvas" | "svg") => void) {
  const host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  const viewportRef = createRef<HTMLDivElement>(), sceneRef = createRef<SVGSVGElement>();
  const renderScene = (callback = onRendererChange) => root!.render(<div ref={viewportRef}><svg ref={sceneRef} data-zoom=".5">
    <g data-route-edge><line x1="0" y1="50" x2="400" y2="50" data-route-pulse/></g>
    <QuestPathPulses edges={edges} point={point} distances={new Map()} selectedEdges={new Set()} highlightRoute={false}
      width={2500} height={400} viewportRef={viewportRef} sceneRef={sceneRef} onRendererChange={callback}/>
    <g data-defender-marker/>
  </svg></div>);
  await act(async () => renderScene());
  return { host, viewport: viewportRef.current!, scene: sceneRef.current!, rerender: async (callback = onRendererChange) => {
    await act(async () => renderScene(callback));
  } };
}
async function frame(time = 1000) {
  const callbacks = [...pending.values()]; pending.clear();
  await act(async () => callbacks.forEach(callback => callback(time)));
}

it("draws moving light in a bounded decorative surface below defenders, keeping source edges intact", async () => {
  const { host, scene } = await render();
  await frame(1000);
  const surface = host.querySelector('foreignObject')!, canvas = surface.querySelector('canvas')!;
  expect(scene.getAttribute('data-pulse-renderer')).toBe('canvas');
  expect(surface.getAttribute('aria-hidden')).toBe('true'); expect(surface.getAttribute('pointer-events')).toBe('none');
  expect(surface.nextElementSibling?.hasAttribute('data-defender-marker')).toBe(true);
  expect([canvas.width, canvas.height]).toEqual([200, 160]);
  expect(surface.getAttribute('width')).toBe('200'); expect(surface.getAttribute('height')).toBe('160');
  expect(context.stroke.mock.calls.length).toBeGreaterThan(0);
  expect(context.stroke.mock.calls.length).toBeLessThanOrEqual(12);
  expect(context.lineTo.mock.calls.every(call => Number(call[0]) < 2000)).toBe(true);
  const positions = [...context.lineTo.mock.calls]; context.lineTo.mockClear();
  scene.setAttribute('data-camera-moving', ''); await frame(1100);
  expect(context.lineTo.mock.calls).not.toEqual(positions);
  expect(host.querySelector('[data-route-pulse]')?.getAttribute('x2')).toBe('400');
  expect(pending.size).toBe(1);
});

it("repositions the viewport-sized surface in world space during zoom and pan", async () => {
  const { host, viewport, scene } = await render(); await frame();
  scene.setAttribute('data-zoom', '.75'); viewport.scrollLeft = 30; viewport.scrollTop = 15;
  await frame(1016);
  const surface = host.querySelector('foreignObject')!;
  expect(Number(surface.getAttribute('x'))).toBeCloseTo(40);
  expect(Number(surface.getAttribute('y'))).toBeCloseTo(20);
  expect(Number(surface.getAttribute('width'))).toBeCloseTo(100 / .75);
  expect(context.setTransform).toHaveBeenCalledWith(1.5, 0, 0, 1.5, -60, -30);
});

it("keeps pulse heads at their world positions when zoom changes, then advances only by elapsed time", async () => {
  const heads: number[][] = [];
  let endpoints: number[] = [];
  context.beginPath.mockImplementation(() => { endpoints = []; });
  context.lineTo.mockImplementation((x: number) => { endpoints.push(x); });
  context.stroke.mockImplementation(() => { if (context.strokeStyle === '#f4ffff') heads.push([...endpoints]); });
  const { scene } = await render(); await frame(1000);
  const before = heads.at(-1)!;
  expect(before.length).toBeGreaterThan(0);
  scene.setAttribute('data-zoom', '.75'); await frame(1000);
  expect(heads.at(-1)).toEqual(before);
  await frame(1100);
  const advanced = heads.at(-1)!;
  expect((advanced[0] - before[0]) * .75).toBeCloseTo(2.5);
  scene.setAttribute('data-zoom', '.25'); await frame(1100);
  expect(heads.at(-1)!.slice(0, advanced.length)).toEqual(advanced);
});

it("animates light without mutating the static SVG between idle frames", async () => {
  const { scene } = await render(); await frame();
  const changed = vi.fn(), observer = new MutationObserver(changed);
  observer.observe(scene, { attributes: true, subtree: true });
  context.stroke.mockClear(); await frame(1100); observer.disconnect();
  expect(context.stroke).toHaveBeenCalled(); expect(changed).not.toHaveBeenCalled();
});

it("reports canvas only after a successful draw and does not churn renderer state on idle frames or parent renders", async () => {
  const onRendererChange = vi.fn(), nextRendererChange = vi.fn();
  const { rerender } = await render(onRendererChange);
  expect(onRendererChange).not.toHaveBeenCalled();
  await frame(); await frame(1100);
  expect(onRendererChange.mock.calls).toEqual([["canvas"]]);
  await rerender(nextRendererChange); await frame(1200);
  expect(nextRendererChange).not.toHaveBeenCalled();
  await act(async () => root!.unmount()); root = undefined;
  expect(onRendererChange.mock.calls).toEqual([["canvas"]]);
  expect(nextRendererChange).not.toHaveBeenCalled();
  expect(pending.size).toBe(0);
});

it("does not schedule another frame if the renderer callback unmounts the surface", async () => {
  const onRendererChange = vi.fn(() => { root!.unmount(); root = undefined; });
  await render(onRendererChange); await frame();
  expect(onRendererChange.mock.calls).toEqual([["canvas"]]);
  expect(pending.size).toBe(0);
});

it.each(["constructor", "matchMedia", "null context", "throwing context"])("reports SVG fallback when canvas capability is unavailable: %s", async failure => {
  if (failure === "constructor") vi.stubGlobal("CanvasRenderingContext2D", undefined);
  else if (failure === "matchMedia") vi.stubGlobal("matchMedia", undefined);
  else if (failure === "null context") vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  else vi.mocked(HTMLCanvasElement.prototype.getContext).mockImplementation(() => { throw new Error("unavailable"); });
  const onRendererChange = vi.fn();
  const { host, scene } = await render(onRendererChange); await frame();
  expect(onRendererChange.mock.calls).toEqual([["svg"]]);
  expect(scene.hasAttribute("data-pulse-renderer")).toBe(false);
  expect(host.querySelector("[data-route-pulse]")).not.toBeNull();
  expect(pending.size).toBe(0);
});

it("leaves the existing SVG fallback available if a canvas context cannot be created", async () => {
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValue(null);
  const { host, scene } = await render(); await frame();
  expect(scene.hasAttribute('data-pulse-renderer')).toBe(false);
  expect(host.querySelector('[data-route-pulse]')).not.toBeNull();
  expect(pending.size).toBe(0);
});

it("respects reduced motion and resumes drawing after the preference changes", async () => {
  motion.matches = true;
  const onRendererChange = vi.fn();
  const { scene } = await render(onRendererChange);
  expect(pending.size).toBe(0); expect(context.stroke).not.toHaveBeenCalled();
  expect(onRendererChange).not.toHaveBeenCalled();
  motion.matches = false;
  const change = motion.addEventListener.mock.calls.find(call => call[0] === 'change')?.[1] as EventListener;
  await act(async () => change(new Event('change'))); await frame();
  expect(scene.getAttribute('data-pulse-renderer')).toBe('canvas'); expect(context.stroke).toHaveBeenCalled();
  motion.matches = true; await act(async () => change(new Event('change')));
  expect(pending.size).toBe(0);
  expect(onRendererChange.mock.calls).toEqual([["canvas"]]);
  motion.matches = false; await act(async () => change(new Event('change'))); await frame(1100);
  expect(onRendererChange.mock.calls).toEqual([["canvas"]]);
});

it("restores fallback after context loss and releases animation resources on unmount", async () => {
  const onRendererChange = vi.fn(), nextRendererChange = vi.fn();
  const { host, scene, rerender } = await render(onRendererChange); await frame();
  expect(onRendererChange.mock.calls).toEqual([["canvas"]]);
  await rerender(nextRendererChange);
  const canvas = host.querySelector('canvas')!;
  await act(async () => canvas.dispatchEvent(new Event('contextlost', { cancelable: true })));
  expect(scene.hasAttribute('data-pulse-renderer')).toBe(false); expect(pending.size).toBe(0);
  await act(async () => canvas.dispatchEvent(new Event('contextlost', { cancelable: true })));
  expect(nextRendererChange.mock.calls).toEqual([["svg"]]);
  await act(async () => canvas.dispatchEvent(new Event('contextrestored')));
  expect(nextRendererChange.mock.calls).toEqual([["svg"]]);
  await frame();
  expect(scene.getAttribute('data-pulse-renderer')).toBe('canvas');
  expect(nextRendererChange.mock.calls).toEqual([["svg"], ["canvas"]]);
  await act(async () => root!.unmount()); root = undefined;
  expect(pending.size).toBe(0); expect(motion.removeEventListener).toHaveBeenCalled();
  expect(nextRendererChange.mock.calls).toEqual([["svg"], ["canvas"]]);
});

it("reports paint failure once and returns to canvas only after a restored context draws successfully", async () => {
  const onRendererChange = vi.fn();
  const { host, scene } = await render(onRendererChange); await frame();
  context.stroke.mockImplementationOnce(() => { throw new Error("paint failed"); });
  await frame(1100); await frame(1200);
  expect(scene.hasAttribute("data-pulse-renderer")).toBe(false);
  expect(onRendererChange.mock.calls).toEqual([["canvas"], ["svg"]]);
  expect(pending.size).toBe(0);
  const canvas = host.querySelector("canvas")!;
  vi.mocked(HTMLCanvasElement.prototype.getContext).mockReturnValueOnce(null);
  await act(async () => canvas.dispatchEvent(new Event("contextrestored")));
  expect(onRendererChange.mock.calls).toEqual([["canvas"], ["svg"]]);
  expect(pending.size).toBe(0);
  await act(async () => canvas.dispatchEvent(new Event("contextrestored")));
  expect(onRendererChange.mock.calls).toEqual([["canvas"], ["svg"]]);
  await frame(1300);
  expect(scene.getAttribute("data-pulse-renderer")).toBe("canvas");
  expect(onRendererChange.mock.calls).toEqual([["canvas"], ["svg"], ["canvas"]]);
});

it("stops work while the document is hidden and resumes visible flow", async () => {
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  await render(); await frame();
  hidden = true; await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(pending.size).toBe(0);
  hidden = false; await act(async () => document.dispatchEvent(new Event('visibilitychange')));
  expect(pending.size).toBe(1); context.stroke.mockClear(); await frame(2000);
  expect(context.stroke).toHaveBeenCalled();
});

it("culls the animation loop when the map is outside the page viewport", async () => {
  let intersect: IntersectionObserverCallback | undefined;
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {} disconnect() {}
  });
  await render(); await frame();
  const change = (isIntersecting: boolean) => intersect!([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  await act(async () => change(false)); expect(pending.size).toBe(0);
  await act(async () => change(true)); expect(pending.size).toBe(1);
  context.stroke.mockClear(); await frame(2000); expect(context.stroke).toHaveBeenCalled();
});
