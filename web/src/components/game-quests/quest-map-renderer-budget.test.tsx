// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Coordinate, QuestMap } from "@cerebro/core/domain/game-quests";
import { QuestBoard } from "./quest-board";

const coordinates: Coordinate[] = [[0, 0], [4, 0], [8, 0]];
const map: QuestMap = {
  version: 1, questId: 'render-budget', mapId: 'render-budget', sourceHash: 'a'.repeat(64), sourceFile: 'fixture.json', capturedAt: '2026-11-18T00:00:00Z',
  gridDimension: 12, adaptive: false, rewards: { fixedChampions: [], possibleCrystals: [] },
  tiles: coordinates.map((coordinate, index) => ({ coordinate, nodeNumber: index, start: index === 0, final: index === 2, hidden: false,
    links: index < 2 ? [coordinates[index + 1]] : [], barrier: '', applications: [], randomPortal: false, portals: [] })),
  paths: [{ index: 0, coordinates }], encounters: [],
};
const context = { setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), quadraticCurveTo: vi.fn(), stroke: vi.fn() };
let root: Root | undefined, next = 0;
const frames = new Map<number, FrameRequestCallback>();
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
beforeEach(() => {
  frames.clear(); next = 0; vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('CanvasRenderingContext2D', class {});
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++next, callback); return next; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(300);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); root = undefined;
  document.body.innerHTML = ''; vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
});
const board = () => <QuestBoard map={map} portraits={{}} selected="0,0" pathIndex={0} onChoose={()=>{}} viewportRef={createRef<HTMLDivElement>()}/>;
async function render() {
  const host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(board())); return host;
}
async function frame(time = 1000) {
  const callbacks = [...frames.values()]; frames.clear();
  await act(async () => callbacks.forEach(callback=>callback(time)));
}

it('ships static source connections without thousands of speculative fallback strokes', () => {
  const host = document.createElement('div'); host.innerHTML = renderToString(board());
  expect(host.querySelectorAll('[data-route-edge]')).toHaveLength(2);
  expect(host.querySelectorAll('[data-route-casing],[data-route-glow],[data-route-line]')).toHaveLength(6);
  expect(host.querySelector('[data-route-pulse],[data-route-pulse-body],[data-route-pulse-trail]')).toBeNull();
});

it('keeps canvas maps lean and restores the exact SVG fallback after context loss', async () => {
  const before = JSON.stringify(map), host = await render(); await frame();
  const scene = host.querySelector('[data-zoom]')!, canvas = scene.querySelector('canvas')!;
  expect(scene.getAttribute('data-pulse-renderer')).toBe('canvas');
  expect(scene.querySelectorAll('[data-route-pulse],[data-route-pulse-body],[data-route-pulse-trail]')).toHaveLength(0);
  await act(async () => canvas.dispatchEvent(new Event('contextlost', { cancelable: true })));
  expect(scene.hasAttribute('data-pulse-renderer')).toBe(false);
  expect(scene.querySelectorAll('[data-route-pulse],[data-route-pulse-body],[data-route-pulse-trail]')).toHaveLength(6);
  await act(async () => canvas.dispatchEvent(new Event('contextrestored'))); await frame(1100);
  expect(scene.getAttribute('data-pulse-renderer')).toBe('canvas');
  expect(scene.querySelector('[data-route-pulse],[data-route-pulse-body],[data-route-pulse-trail]')).toBeNull();
  expect(scene.querySelectorAll('[data-route-edge]')).toHaveLength(2);
  expect(JSON.stringify(map)).toBe(before);
});

it('enables SVG animation when canvas is unsupported', async () => {
  vi.stubGlobal('CanvasRenderingContext2D', undefined);
  const host = await render();
  expect(host.querySelectorAll('[data-route-pulse]')).toHaveLength(2);
  expect(frames.size).toBe(0);
});
