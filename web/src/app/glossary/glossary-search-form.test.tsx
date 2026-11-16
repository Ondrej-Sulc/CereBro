// @vitest-environment jsdom
import { act, type AnchorHTMLAttributes, type ImgHTMLAttributes } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GlossarySearchForm } from './glossary-search-form';
import type { GlossarySearchOption } from '@/lib/glossary-search';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock('next/image', () => ({ default: ({ unoptimized, ...props }: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) => {
  void unoptimized;
  // eslint-disable-next-line @next/next/no-img-element -- Framework image boundary.
  return <img alt="" {...props}/>;
} }));
vi.mock('next/link', () => ({ default: ({ prefetch, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { prefetch?: boolean }) => {
  void prefetch; return <a {...props}/>;
} }));
const options: GlossarySearchOption[] = [{ id: 1, name: 'Bleed', description: 'Deals damage over time.', iconUrl: '/bleed.svg', color: '#f55', secondaryColor: '#511', categories: [{ id: 52, name: 'Damage Over Time' }] },
  ...Array.from({ length: 10 }, (_, i) => ({ id: i + 2, name: `Bleed variant ${i + 1}`, description: 'A recorded effect.', iconUrl: null, color: '#f55', secondaryColor: '#511', categories: [{ id: 52, name: 'Damage Over Time' }] })),
  { id: 20, name: 'Fury', description: 'Increases attack.', iconUrl: null, color: '#ffa500', secondaryColor: '#531', categories: [{ id: 14, name: 'Attack' }] }];
const returnTo = '/glossary?q=bleed&category=52&page=2#effects-results';
let container: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  push.mockReset(); window.history.replaceState(null, '', '/glossary?category=52');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
async function render(initialQuery = '', categoryId: number | null = 52) {
  await act(async () => root.render(<GlossarySearchForm options={options} initialQuery={initialQuery} categoryId={categoryId} returnTo={returnTo} clearHref="/glossary?category=52#effects-results"/>));
}
const input = () => container.querySelector<HTMLInputElement>('input[name=q]')!;
async function type(value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function key(name: string, isComposing = false) {
  const event = new KeyboardEvent('keydown', { key: name, isComposing, bubbles: true, cancelable: true });
  await act(async () => input().dispatchEvent(event)); return event;
}

it('renders a normal scoped GET search before JavaScript runs', () => {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(<GlossarySearchForm options={options} initialQuery="bleed" categoryId={52} returnTo={returnTo} clearHref="/glossary?category=52#effects-results"/>);
  expect(host.querySelector('form')?.getAttribute('action')).toBe('/glossary#effects-results');
  expect(host.querySelector('form')?.getAttribute('method')).toBe('get');
  expect(host.querySelector('input[name=q]')?.getAttribute('value')).toBe('bleed');
  expect(host.querySelector('input[name=q]')?.getAttribute('maxlength')).toBe('100');
  expect(host.querySelector('input[name=category]')?.getAttribute('value')).toBe('52');
  expect(host.querySelector('button[type=submit]')?.getAttribute('aria-label')).toBe('Search effects');
  expect(host.querySelector('[role=listbox]')).toBeNull();
});

it('offers bounded rich suggestions and opens an explicitly selected effect with its original return state', async () => {
  await render(); await act(async () => input().focus()); await type('bleed');
  const suggestions = [...container.querySelectorAll<HTMLAnchorElement>('[role=option]')];
  expect(suggestions).toHaveLength(7); expect(suggestions[0].textContent).toContain('Bleed');
  expect(suggestions[0].textContent).toContain('Deals damage over time.'); expect(suggestions[0].querySelector('img')).not.toBeNull();
  expect((await key('Enter')).defaultPrevented).toBe(false); expect(push).not.toHaveBeenCalled();
  await key('ArrowDown'); const selected = document.getElementById(input().getAttribute('aria-activedescendant')!)!;
  expect(selected.getAttribute('aria-selected')).toBe('true');
  expect((await key('Enter')).defaultPrevented).toBe(true);
  const destination = new URL(push.mock.calls[0][0] as string, 'https://cerebro.test');
  expect(destination.pathname).toBe('/glossary/1'); expect(destination.searchParams.get('returnTo')).toBe(returnTo);
  expect(input().getAttribute('aria-expanded')).toBe('false');
});

it('keeps suggestions within the selected category and clears a stale selection when the context changes', async () => {
  await render(); await act(async () => input().focus()); await type('fury');
  expect(container.querySelector('[role=option]')).toBeNull();
  expect(container.querySelector('[role=status]')?.textContent).toContain('No matching effects');
  window.history.replaceState(null, '', '/glossary?category=14&q=fury');
  await render('fury', 14); expect(input().value).toBe('fury'); expect(input().getAttribute('aria-expanded')).toBe('false');
  await act(async () => input().click()); expect(container.querySelector('[role=option]')?.textContent).toContain('Fury');
});

it('restores controlled search text from pageshow, Back and in-app URL navigation', async () => {
  await render(); await type('edited'); await act(async () => window.dispatchEvent(new Event('pageshow')));
  expect(input().value).toBe('');
  window.history.replaceState(null, '', '/glossary?category=52&q=bleed');
  await act(async () => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(input().value).toBe('bleed'); expect(input().getAttribute('aria-expanded')).toBe('false');
  expect(new FormData(container.querySelector('form')!).get('category')).toBe('52');
  window.history.replaceState(null, '', '/glossary?category=52&q=death'); await render('death');
  expect(input().value).toBe('death'); expect(input().getAttribute('aria-activedescendant')).toBeNull();
});

it('supports pointer selection while retaining browser-owned modified clicks', async () => {
  await render(); await act(async () => input().focus()); await type('bleed');
  const suggestion = container.querySelector<HTMLAnchorElement>('[role=option]')!;
  const pointer = new Event('pointerdown', { bubbles: true, cancelable: true });
  await act(async () => suggestion.dispatchEvent(pointer)); expect(pointer.defaultPrevented).toBe(true); expect(document.activeElement).toBe(input());
  let prevented = false;
  document.addEventListener('click', event => { prevented = event.defaultPrevented; event.preventDefault(); }, { once: true });
  await act(async () => suggestion.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true })));
  expect(prevented).toBe(false); expect(push).not.toHaveBeenCalled();
  await act(async () => suggestion.click()); expect(push).toHaveBeenCalledWith(suggestion.getAttribute('href'));
});

it('dismisses suggestions and clears text without stale navigation or IME submission', async () => {
  await render(); await act(async () => input().focus()); await type('bleed'); await key('ArrowUp');
  expect((await key('Enter', true)).defaultPrevented).toBe(true); expect(push).not.toHaveBeenCalled();
  await key('Escape'); expect(container.querySelector('[role=listbox]')).toBeNull();
  await act(async () => input().click()); await key('Tab'); expect(input().getAttribute('aria-expanded')).toBe('false');
  await act(async () => input().click()); await act(async () => document.body.dispatchEvent(new Event('pointerdown', { bubbles: true })));
  expect(input().getAttribute('aria-expanded')).toBe('false');
  await act(async () => input().click()); await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Clear effect search"]')!.click());
  expect(input().value).toBe(''); expect(document.activeElement).toBe(input()); expect(input().getAttribute('aria-activedescendant')).toBeNull();
});
