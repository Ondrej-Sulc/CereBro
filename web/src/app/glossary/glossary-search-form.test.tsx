// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(window.location.search) }));
import { GlossarySearchForm } from './glossary-search-form';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  window.history.replaceState(null, '', '/glossary?category=52');
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = () => act(() => root.render(<GlossarySearchForm className="search"><input name="category" type="hidden" value="52" /><input type="search" name="q" defaultValue="" /></GlossarySearchForm>));

it('restores search text from the URL after browser pageshow and Back events', () => {
  render();
  const search = container.querySelector<HTMLInputElement>('input[name=q]')!;
  search.value = 'immort';
  act(() => window.dispatchEvent(new Event('pageshow')));
  expect(search.value).toBe('');
  window.history.replaceState(null, '', '/glossary?category=52&q=immort');
  act(() => window.dispatchEvent(new PopStateEvent('popstate')));
  expect(search.value).toBe('immort');
  expect(new FormData(container.querySelector('form')!).get('category')).toBe('52');
});
it('updates the search field after in-app navigation and keeps native GET behavior', () => {
  render();
  window.history.replaceState(null, '', '/glossary?category=52&q=death');
  render();
  expect(container.querySelector<HTMLInputElement>('input[name=q]')?.value).toBe('death');
  expect(container.querySelector('form')?.method).toBe('get');
  expect(container.querySelector('form')?.getAttribute('action')).toBe('/glossary#effects-results');
});
