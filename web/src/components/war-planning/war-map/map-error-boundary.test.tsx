import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { captureClientException } from '@/lib/observability/client';
import { MapErrorBoundary } from './map-error-boundary';
vi.mock('@/lib/observability/client', () => ({ captureClientException: vi.fn() }));

let root: Root;
let dom: JSDOM;
let fail: boolean;
function CanvasProbe() {
  if (fail) throw new DOMException('The image argument has a width of 0', 'InvalidStateError');
  return <canvas aria-label="War map" />;
}
function PlannerProbe({ battlegroup = 1 }: { battlegroup?: number }) {
  const [draft] = useState('Unfinished fight notes');
  return <><input aria-label="Draft notes" readOnly value={draft} /><MapErrorBoundary mapType="BIG_THING" warId="qa-war" battlegroup={battlegroup}><CanvasProbe /></MapErrorBoundary></>;
}
beforeEach(() => {
  fail = true;
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>');
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  root = createRoot(document.getElementById('root')!, { onCaughtError: () => {} });
});
afterEach(async () => {
  await act(async () => root.unmount());
  dom.window.close();
  vi.unstubAllGlobals();
});

it('contains a canvas crash, records its component stack and retries without discarding planner state', async () => {
  await act(async () => root.render(createElement(PlannerProbe)));
  const input = document.querySelector('input')!;
  expect(input.value).toBe('Unfinished fight notes');
  expect(document.querySelector('[role="alert"]')).not.toBeNull();
  expect(captureClientException).toHaveBeenCalledOnce();
  expect(vi.mocked(captureClientException).mock.calls[0][1]).toMatchObject({ source: 'war_map_render', map_type: 'BIG_THING', component_stack: expect.stringContaining('CanvasProbe') });
  fail = false;
  await act(async () => document.querySelector('button')!.click());
  expect(document.querySelector('canvas')).not.toBeNull();
  expect(document.querySelector('input')).toBe(input);
  expect(input.value).toBe('Unfinished fight notes');
});

it('tries a new battlegroup without leaving it stuck behind the previous map failure', async () => {
  await act(async () => root.render(createElement(PlannerProbe)));
  fail = false;
  await act(async () => root.render(createElement(PlannerProbe, { battlegroup: 2 })));
  expect(document.querySelector('canvas')).not.toBeNull();
  expect(document.querySelector('[role="alert"]')).toBeNull();
});
