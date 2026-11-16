// @vitest-environment jsdom
import { act, type ReactNode } from 'react';
import { createRoot, hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GlossaryChampionGrid } from './glossary-champion-grid';

let root: Root | undefined;
let host: HTMLDivElement;
let heights: Record<string, number>;
let width: number;
let frames: Map<number, FrameRequestCallback>;
let nextFrame: number;
const observers: MockResizeObserver[] = [];

class MockResizeObserver {
  readonly elements = new Set<Element>();
  readonly disconnect = vi.fn(() => this.elements.clear());
  constructor(private readonly callback: ResizeObserverCallback) { observers.push(this); }
  observe(element: Element) { this.elements.add(element); }
  unobserve(element: Element) { this.elements.delete(element); }
  notify(...elements: Element[]) {
    this.callback(elements.map(target => ({ target, contentRect: { width, height: target instanceof HTMLElement ? heights[target.dataset.card ?? ''] ?? 0 : 0 } }) as ResizeObserverEntry), this as unknown as ResizeObserver);
  }
}

function cards(): ReactNode {
  return ['Aegon', 'Agent Venom', 'Apocalypse', 'Arcade'].map(name => <article key={name} data-card={name}>
    <a href={`#${name}`}>{name}</a><details><summary>More sources</summary><p>Additional sources</p></details>
  </article>);
}
const grid = () => host.querySelector<HTMLElement>('[data-champion-grid]')!;
const item = (name: string) => host.querySelector<HTMLElement>(`[data-card="${name}"]`)!.parentElement!;
async function mount(children: ReactNode = cards()) {
  await act(async () => root!.render(<GlossaryChampionGrid>{children}</GlossaryChampionGrid>));
}
async function flushFrames() {
  const pending = [...frames.values()]; frames.clear();
  await act(async () => pending.forEach(callback => callback(0)));
}

beforeEach(() => {
  heights = { Aegon: 104, 'Agent Venom': 428, Apocalypse: 192, Arcade: 148 };
  width = 900; frames = new Map(); nextFrame = 0; observers.length = 0;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame));
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    return { x: 0, y: 0, left: 0, top: 0, width, height: heights[this.dataset.card ?? ''] ?? 0, right: width, bottom: heights[this.dataset.card ?? ''] ?? 0, toJSON() { return {}; } };
  });
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined; host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
});

it('gives unequal cards their own measured space while preserving source and keyboard order', async () => {
  await mount();
  expect(grid().hasAttribute('data-masonry-ready')).toBe(true);
  expect(item('Aegon').style.gridRowEnd).toBe('span 120');
  expect(item('Agent Venom').style.gridRowEnd).toBe('span 444');
  expect(item('Apocalypse').style.gridRowEnd).toBe('span 208');
  expect([...grid().querySelectorAll('a')].map(link => link.textContent)).toEqual(['Aegon', 'Agent Venom', 'Apocalypse', 'Arcade']);
  expect(observers[0].elements.has(host.querySelector('[data-card="Agent Venom"]')!)).toBe(true);
});

it('repacks when a source disclosure grows, and batches measurements after width changes', async () => {
  await mount();
  const content = host.querySelector<HTMLElement>('[data-card="Aegon"]')!;
  content.querySelector('details')!.open = true; heights.Aegon = 260;
  observers[0].notify(content); observers[0].notify(content);
  expect(frames.size).toBe(1);
  await flushFrames();
  expect(item('Aegon').style.gridRowEnd).toBe('span 276');
  width = 375; heights.Aegon = 312; grid().style.setProperty('--champion-card-gap', '14px');
  observers[0].notify(grid()); await flushFrames();
  expect(item('Aegon').style.gridRowEnd).toBe('span 326');
  expect([...grid().querySelectorAll('a')].map(link => link.textContent)).toEqual(['Aegon', 'Agent Venom', 'Apocalypse', 'Arcade']);
});

it('leaves normal grid markup available without ResizeObserver or before hydration', async () => {
  vi.stubGlobal('ResizeObserver', undefined);
  const element = <GlossaryChampionGrid>{cards()}</GlossaryChampionGrid>;
  const server = document.createElement('div'); server.innerHTML = renderToString(element);
  expect(server.querySelector('[data-masonry-ready]')).toBeNull();
  expect(server.querySelector('[data-champion-grid-item]')?.getAttribute('style')).toBeNull();
  await mount();
  expect(grid().hasAttribute('data-masonry-ready')).toBe(false);
  expect(item('Aegon').style.gridRowEnd).toBe('');
  expect(host.querySelectorAll('article')).toHaveLength(4);
});

it('hydrates the same ordered cards without markup errors', async () => {
  await act(async () => root!.unmount()); root = undefined;
  const element = <GlossaryChampionGrid>{cards()}</GlossaryChampionGrid>;
  host.innerHTML = renderToString(element);
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => { root = hydrateRoot(host, element); });
  expect(errors).not.toHaveBeenCalled();
  expect(grid().hasAttribute('data-masonry-ready')).toBe(true);
  expect(host.querySelectorAll('article')).toHaveLength(4);
});

it('disconnects previous cards and cancels queued work when filters change or the grid unmounts', async () => {
  await mount(); const previous = observers[0];
  previous.notify(grid()); expect(frames.size).toBe(1);
  await mount(<article data-card="Arcade"><a href="#Arcade">Arcade</a></article>);
  expect(previous.disconnect).toHaveBeenCalledOnce(); expect(frames.size).toBe(0);
  expect(host.querySelectorAll('article')).toHaveLength(1);
  expect(item('Arcade').style.gridRowEnd).toBe('span 164');
  const current = observers.at(-1)!; current.notify(grid()); expect(frames.size).toBe(1);
  await act(async () => root!.unmount()); root = undefined;
  expect(current.disconnect).toHaveBeenCalledOnce(); expect(frames.size).toBe(0);
});
