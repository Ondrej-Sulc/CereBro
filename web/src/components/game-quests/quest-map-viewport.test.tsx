// @vitest-environment jsdom
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { loadQuestMap } from "@cerebro/core/data/game-quests";
import type { QuestMap } from "@cerebro/core/domain/game-quests";
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

async function renderBoard() {
  const host = document.createElement("div"); document.body.append(host);
  root = createRoot(host);
  const selected = map.encounters[0].coordinate.join(",");
  await act(async () => root!.render(<QuestBoard map={map} portraits={{}} selected={selected} pathIndex={0}
    onChoose={() => {}} viewportRef={createRef<HTMLDivElement>()} />));
  return host;
}
const scale = (host: HTMLElement) => Number(host.querySelector("[data-zoom]")?.getAttribute("data-zoom"));
function button(host: HTMLElement, label: string) {
  const found = [...host.querySelectorAll("button")].find(b => (b.getAttribute("aria-label") || b.textContent) === label);
  expect(found, label).toBeDefined(); return found!;
}
const fit = () => { const b = questBoardGeometry(map); return Math.min(size.width / b.width, size.height / b.height); };

describe("quest map viewport controls", () => {
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

  it("zooms from fit to readable defender detail and centers after the SVG commits", async () => {
    const host = await renderBoard();
    await act(async () => button(host, "Focus selected location").click());
    expect(scale(host)).toBeGreaterThanOrEqual(1);
    expect(button(host, "Fit map").getAttribute("aria-pressed")).toBe("false");
    const board = questBoardGeometry(map), [x, y] = board.point(map.encounters[0].coordinate);
    const element = host.querySelector<HTMLElement>('[aria-label="Scrollable quest map"]')!;
    expect(element.scrollLeft).toBeCloseTo(Math.max(0, Math.min(board.width * scale(host) - size.width, x * scale(host) - size.width / 2)));
    expect(element.scrollTop).toBeCloseTo(Math.max(0, Math.min(board.height * scale(host) - size.height, y * scale(host) - size.height / 2)));
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

  it("labels the overview control and opens and closes the actual minimap", async () => {
    const host = await renderBoard();
    const toggle = button(host, "Toggle map overview");
    expect(toggle.textContent).toContain("Overview");
    await act(async () => toggle.click());
    expect(host.querySelector('svg[aria-label="Map overview"]')).not.toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await act(async () => toggle.click());
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
