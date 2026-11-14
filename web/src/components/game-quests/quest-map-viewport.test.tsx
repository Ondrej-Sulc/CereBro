// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadQuestMap } from "@cerebro/core/data/game-quests";
import type { Coordinate, QuestMap } from "@cerebro/core/domain/game-quests";
import { questBoardGeometry } from "@cerebro/core/domain/game-quests/board";
import { QuestBoard } from "./quest-board";

let map: QuestMap;
let root: Root | undefined;
let size = { width: 390, height: 560 };
let resize: (() => void) | undefined;
const originals = new Map<string, PropertyDescriptor | undefined>();

function define(target: object, key: string, descriptor: PropertyDescriptor) {
  const owner = target === document ? "document" : "element";
  originals.set(`${owner}:${key}`, Object.getOwnPropertyDescriptor(target, key));
  Object.defineProperty(target, key, { configurable: true, ...descriptor });
}

beforeAll(async () => { map = (await loadQuestMap("a04_ch04_q06"))!; });
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  size = { width: 390, height: 560 };
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("aria-label") === "Scrollable quest map" ? size.width : 0;
  });
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.getAttribute("aria-label") === "Scrollable quest map" ? size.height : 0;
  });
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { resize = () => callback([], this as unknown as ResizeObserver); }
    observe() {} disconnect() {} unobserve() {}
  });
  HTMLElement.prototype.scrollTo = vi.fn(function (this: HTMLElement, x?: number | ScrollToOptions, y?: number) {
    this.scrollLeft = typeof x === "number" ? x : x?.left ?? 0;
    this.scrollTop = typeof x === "number" ? y ?? 0 : x?.top ?? 0;
  });
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  for (const [entry, descriptor] of originals) {
    const [owner, key] = entry.split(":");
    const target = owner === "document" ? document : Element.prototype;
    if (descriptor) Object.defineProperty(target, key, descriptor);
    else Reflect.deleteProperty(target, key);
  }
  originals.clear();
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

async function renderBoard(onChoose: (coordinate: Coordinate) => void = () => {}) {
  const host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
  const selected = map.encounters[0].coordinate.join(",");
  await act(async () => root!.render(<QuestBoard map={map} portraits={{}} selected={selected} pathIndex={0}
    onChoose={onChoose} viewportRef={createRef<HTMLDivElement>()} />));
  return host;
}
const scale = (host: HTMLElement) => Number(host.querySelector("[data-zoom]")?.getAttribute("data-zoom"));
async function zoomToDetail(host: HTMLElement) {
  while (scale(host) < 1) await act(async () => button(host, "Zoom in").click());
}
function button(host: HTMLElement, label: string) {
  const found = [...host.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") || b.textContent) === label);
  expect(found, label).toBeDefined(); return found!;
}
const fit = () => { const b = questBoardGeometry(map); return Math.min(size.width / b.width, size.height / b.height); };
function touchPointer(target: Element, type: string, x: number, y: number, pointerId = 1) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, buttons: 1, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: pointerId }, pointerType: { value: "touch" } });
  target.dispatchEvent(event);
}

describe("quest map viewport controls", () => {
  it("keeps a one-finger drag active when capture transfers from an SVG child to the viewport", async () => {
    const capture = vi.fn();
    define(Element.prototype, "setPointerCapture", { value: capture });
    const host = await renderBoard();
    await zoomToDetail(host);
    const viewport = host.querySelector<HTMLElement>('[aria-label="Scrollable quest map"]')!;
    const scene = host.querySelector("svg[data-zoom]")!;
    viewport.scrollTo({ left: 200, top: 200 });
    await act(async () => {
      touchPointer(scene, "pointerdown", 300, 300);
      touchPointer(scene, "pointermove", 280, 280);
    });
    expect(capture).toHaveBeenCalledWith(1);
    expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([220, 220]);
    // Touch implicitly captures the SVG target. Transferring capture to the
    // viewport emits a bubbling lostpointercapture from that original target.
    await act(async () => {
      touchPointer(scene, "lostpointercapture", 280, 280);
      touchPointer(viewport, "pointermove", 220, 210);
    });
    expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([280, 290]);
  });
  it.each(["pointercancel", "lostpointercapture"])("ends the drag on viewport %s and accepts a fresh touch", async type => {
    define(Element.prototype, "setPointerCapture", { value: vi.fn() });
    const host = await renderBoard();
    await zoomToDetail(host);
    const viewport = host.querySelector<HTMLElement>('[aria-label="Scrollable quest map"]')!;
    const scene = host.querySelector("svg[data-zoom]")!;
    viewport.scrollTo({ left: 200, top: 200 });
    await act(async () => {
      touchPointer(scene, "pointerdown", 300, 300);
      touchPointer(scene, "pointermove", 280, 280);
      touchPointer(viewport, type, 280, 280);
      touchPointer(viewport, "pointermove", 220, 210);
    });
    expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([220, 220]);
    await act(async () => {
      touchPointer(scene, "pointerdown", 280, 280, 2);
      touchPointer(scene, "pointermove", 250, 240, 2);
    });
    expect([viewport.scrollLeft, viewport.scrollTop]).toEqual([250, 260]);
  });
  it("pinches through capture handoff and continues panning with the remaining finger", async () => {
    define(Element.prototype, "setPointerCapture", { value: vi.fn() });
    const host = await renderBoard();
    await zoomToDetail(host);
    const viewport = host.querySelector<HTMLElement>('[aria-label="Scrollable quest map"]')!;
    const scene = host.querySelector("svg[data-zoom]")!;
    viewport.scrollTo({ left: 200, top: 200 });
    const before = scale(host);
    await act(async () => {
      touchPointer(scene, "pointerdown", 200, 300);
      touchPointer(scene, "pointerdown", 300, 300, 2);
      touchPointer(scene, "lostpointercapture", 300, 300, 2);
      touchPointer(viewport, "pointermove", 320, 300, 2);
    });
    expect(scale(host)).toBeCloseTo(before * 1.2);
    await act(async () => {
      touchPointer(scene, "pointerup", 200, 300);
      touchPointer(scene, "lostpointercapture", 200, 300);
    });
    const left = viewport.scrollLeft, top = viewport.scrollTop;
    await act(async () => touchPointer(viewport, "pointermove", 300, 280, 2));
    expect(viewport.scrollLeft).toBeCloseTo(left + 20);
    expect(viewport.scrollTop).toBeCloseTo(top + 20);
  });
  it("keeps encounter taps working and suppresses selection after a touch drag", async () => {
    define(Element.prototype, "setPointerCapture", { value: vi.fn() });
    const choose = vi.fn();
    const host = await renderBoard(choose);
    const encounter = host.querySelector("[data-map-encounter]")!;
    await act(async () => {
      touchPointer(encounter, "pointerdown", 200, 200);
      touchPointer(encounter, "pointerup", 200, 200);
      encounter.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(choose).toHaveBeenCalledOnce();
    await act(async () => {
      touchPointer(encounter, "pointerdown", 200, 200);
      touchPointer(encounter, "pointermove", 180, 170);
      touchPointer(encounter, "lostpointercapture", 180, 170);
      touchPointer(encounter, "pointerup", 180, 170);
      encounter.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(choose).toHaveBeenCalledOnce();
    await act(async () => {
      touchPointer(encounter, "pointerdown", 200, 200);
      touchPointer(encounter, "pointerup", 200, 200);
      encounter.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    });
    expect(choose).toHaveBeenCalledTimes(2);
  });
  it.each([{ width: 390, height: 560 }, { width: 980, height: 640 }])("starts with the whole map fitted at $width pixels", async viewport => {
    size = viewport;
    const host = await renderBoard();
    expect(scale(host)).toBeCloseTo(fit());
    expect(button(host, "Fit map").getAttribute("aria-pressed")).toBe("true");
    const element = host.querySelector<HTMLElement>('[aria-label="Scrollable quest map"]')!;
    expect([element.scrollLeft, element.scrollTop]).toEqual([0, 0]);
  });

  it("waits for measurable layout and keeps fitted views fitted on resize", async () => {
    size = { width: 0, height: 0 };
    const host = await renderBoard();
    expect(host.querySelector("[data-board-ready]")?.getAttribute("data-board-ready")).toBe("false");
    size = { width: 390, height: 560 };
    await act(async () => resize!());
    expect(scale(host)).toBeCloseTo(fit());
    size = { width: 760, height: 700 };
    await act(async () => resize!());
    expect(scale(host)).toBeCloseTo(fit());
  });

  it("preserves manual zoom across resize and restores responsive fitting with Fit map", async () => {
    const host = await renderBoard();
    await act(async () => button(host, "Zoom in").click());
    const manual = scale(host);
    size = { width: 320, height: 500 };
    await act(async () => resize!());
    expect(scale(host)).toBe(manual);
    await act(async () => button(host, "Fit map").click());
    expect(scale(host)).toBeCloseTo(fit());
    size = { width: 700, height: 700 };
    await act(async () => resize!());
    expect(scale(host)).toBeCloseTo(fit());
  });

  it("keeps readable nameplates and contrasting route layers without changing native endpoints", async () => {
    const host = await renderBoard();
    const board = questBoardGeometry(map);
    const edges = [...host.querySelectorAll('[data-route-edge]')];
    expect(edges).toHaveLength(board.edges.length);
    for (const edge of edges) {
      const casing = edge.querySelector('[data-route-casing]')!;
      const line = edge.querySelector('[data-route-line]')!;
      expect(edge.querySelector('[data-route-glow]')).not.toBeNull();
      expect(Number(line.getAttribute('stroke-width'))).toBeLessThanOrEqual(1.5);
      expect(line.hasAttribute('stroke-dasharray')).toBe(false);
      const pulse = edge.querySelector('[data-route-pulse]');
      expect(Boolean(pulse)).toBe(edge.getAttribute('data-route-selected') === 'true');
      if (pulse) {
        expect(pulse.getAttribute('vector-effect')).toBe('non-scaling-stroke');
        expect(pulse.getAttribute('style')).toContain('--route-phase:');
      }
      expect(casing.getAttribute('vector-effect')).toBe('non-scaling-stroke');
      expect(line.getAttribute('vector-effect')).toBe('non-scaling-stroke');
      expect(Number(casing.getAttribute('stroke-width'))).toBeGreaterThan(Number(line.getAttribute('stroke-width')));
      const native = board.edges.find(row => row.from.join(',') === edge.getAttribute('data-from') && row.to.join(',') === edge.getAttribute('data-to'))!;
      expect(native).toBeDefined();
      if (!native.portal) {
        expect([Number(line.getAttribute('x1')), Number(line.getAttribute('y1'))]).toEqual(board.point(native.from));
        expect([Number(line.getAttribute('x2')), Number(line.getAttribute('y2'))]).toEqual(board.point(native.to));
      }
    }
    const textSize = () => Number(host.querySelector('[data-map-nameplate] text')?.getAttribute('font-size')) * scale(host);
    expect(textSize()).toBeCloseTo(12);
    await zoomToDetail(host);
    expect(textSize()).toBeCloseTo(12);
    expect(host.textContent).not.toMatch(/unexplored|explored/i);
  });

  it("requests real browser fullscreen and exits through the browser API", async () => {
    let active: Element | null = null;
    define(document, "fullscreenElement", { get: () => active });
    const request = vi.fn(async () => { active = host.querySelector("[data-quest-board]"); document.dispatchEvent(new Event("fullscreenchange")); });
    const exit = vi.fn(async () => { active = null; document.dispatchEvent(new Event("fullscreenchange")); });
    define(Element.prototype, "requestFullscreen", { value: request });
    define(document, "exitFullscreen", { value: exit });
    const host = await renderBoard();
    await act(async () => button(host, "Enter full screen").click());
    expect(request).toHaveBeenCalledOnce();
    expect(request.mock.contexts[0]).toBe(host.querySelector("[data-quest-board]"));
    expect(active).toBe(host.querySelector("[data-quest-board]"));
    await act(async () => button(host, "Exit full screen").click());
    expect(exit).toHaveBeenCalledOnce(); expect(active).toBeNull();
    expect(button(host, "Enter full screen")).toBeDefined();
  });

  it("updates the fullscreen control after the browser exits with Escape", async () => {
    let active: Element | null = null;
    define(document, "fullscreenElement", { get: () => active });
    define(Element.prototype, "requestFullscreen", { value: vi.fn(async () => {
      active = host.querySelector("[data-quest-board]"); document.dispatchEvent(new Event("fullscreenchange"));
    }) });
    const host = await renderBoard();
    await act(async () => button(host, "Enter full screen").click());
    expect(button(host, "Exit full screen")).toBeDefined();
    await act(async () => { active = null; document.dispatchEvent(new Event("fullscreenchange")); });
    expect(button(host, "Enter full screen")).toBeDefined();
  });

  it("exits the owned native fullscreen view when Escape reaches the page", async () => {
    let active: Element | null = null;
    define(document, "fullscreenElement", { get: () => active });
    const request = vi.fn(async () => { active = host.querySelector("[data-quest-board]"); document.dispatchEvent(new Event("fullscreenchange")); });
    const exit = vi.fn(async () => { active = null; document.dispatchEvent(new Event("fullscreenchange")); });
    define(Element.prototype, "requestFullscreen", { value: request });
    define(document, "exitFullscreen", { value: exit });
    const host = await renderBoard();
    await act(async () => button(host, "Enter full screen").click());
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(exit).toHaveBeenCalledOnce();
    expect(active).toBeNull();
    expect(button(host, "Enter full screen")).toBeDefined();
  });

  it("provides an Escape-closeable full-window fallback and restores page scrolling", async () => {
    define(Element.prototype, "requestFullscreen", { value: vi.fn().mockRejectedValue(new Error("unsupported")) });
    document.body.style.overflow = "clip";
    const host = await renderBoard();
    const opener = button(host, "Enter full screen"); opener.focus();
    await act(async () => opener.click());
    expect(host.querySelector('[role="dialog"][aria-modal="true"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
    expect(host.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe("clip");
    expect(document.activeElement).toBe(opener);
  });

  it("automatically shows a synchronized overview only above fit zoom without Focus or Overview buttons", async () => {
    const host = await renderBoard();
    expect(host.querySelector('[aria-label="Toggle map overview"]')).toBeNull();
    expect(host.querySelector('[aria-label="Focus selected location"]')).toBeNull();
    expect(host.querySelector('svg[aria-label="Map overview"]')).toBeNull();
    await act(async () => button(host, 'Zoom in').click());
    const mini = host.querySelector<SVGSVGElement>('svg[aria-label="Map overview"]')!;
    expect(mini).not.toBeNull();
    const viewport = host.querySelector<HTMLElement>('[aria-label="Scrollable quest map"]')!;
    await act(async () => { viewport.scrollTo({ left: 20, top: 25 }); viewport.dispatchEvent(new Event('scroll')); });
    const camera = mini.querySelector('[data-overview-viewport]')!;
    expect(Number(camera.getAttribute('x'))).toBeCloseTo(20 / scale(host));
    expect(Number(camera.getAttribute('y'))).toBeCloseTo(25 / scale(host));
    expect(Number(camera.getAttribute('width'))).toBeCloseTo(Math.min(questBoardGeometry(map).width, size.width / scale(host)));
    vi.spyOn(mini, 'getBoundingClientRect').mockReturnValue({ x:0,y:0,left:0,top:0,width:140,height:150,right:140,bottom:150,toJSON:()=>({}) });
    await act(async () => mini.dispatchEvent(new MouseEvent('click', { clientX:70,clientY:75,bubbles:true })));
    expect(viewport.scrollLeft).toBeCloseTo(Math.max(0, (questBoardGeometry(map).width * scale(host) - size.width) / 2));
    const top = viewport.scrollTop;
    await act(async () => mini.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown',bubbles:true,cancelable:true })));
    expect(viewport.scrollTop).toBeCloseTo(Math.max(0, Math.min(questBoardGeometry(map).height * scale(host) - size.height, top + size.height / 2)));
    await act(async () => button(host, 'Fit map').click());
    expect(host.querySelector('svg[aria-label="Map overview"]')).toBeNull();
    await act(async () => button(host, 'Zoom in').click());
    expect(host.querySelector('svg[aria-label="Map overview"]')).not.toBeNull();
    await act(async () => button(host, 'Zoom out').click());
    expect(host.querySelector('svg[aria-label="Map overview"]')).toBeNull();
  });

  it("restores page scrolling when a browser without fullscreen support navigates away", async () => {
    define(Element.prototype, "requestFullscreen", { value: undefined });
    document.body.style.overflow = "clip";
    const host = await renderBoard();
    await act(async () => button(host, "Enter full screen").click());
    expect(host.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    await act(async () => root!.unmount()); root = undefined;
    expect(document.body.style.overflow).toBe("clip");
  });
});
