// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { GlossaryCategoryPicker } from './glossary-category-picker';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = (selected: boolean, key = 'one') => act(() => root.render(
  <GlossaryCategoryPicker key={key} selected={selected} summary={<h2>Choose a category</h2>}>
    <a data-category-choice href="#effects-results" onClick={event => event.preventDefault()}>Damage over time</a>
  </GlossaryCategoryPicker>,
));

it('opens the initial category grid and collapses it on selection, including the current category', async () => {
  render(false);
  const details = container.querySelector('details')!;
  expect(details.open).toBe(true);
  await act(async () => container.querySelector('a')!.click());
  expect(details.open).toBe(false);
  await act(async () => { container.querySelector('summary')!.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(details.open).toBe(true);
  await act(async () => container.querySelector('a')!.click());
  expect(details.open).toBe(false);
});

it('starts selected routes collapsed and keeps the picker closed when choosing all categories', async () => {
  render(true);
  expect(container.querySelector('details')!.open).toBe(false);
  render(false);
  expect(container.querySelector('details')!.open).toBe(false);
  await act(async () => { container.querySelector('summary')!.click(); await new Promise(resolve => setTimeout(resolve, 0)); });
  expect(container.querySelector('details')!.open).toBe(true);
});

it('keeps the current picker open when a choice is opened in another tab', async () => {
  render(false);
  await act(async () => container.querySelector('a')!.dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true })));
  expect(container.querySelector('details')!.open).toBe(true);
});
