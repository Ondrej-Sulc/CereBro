import { act, createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../actions', () => ({ createProfile: vi.fn(), deleteProfile: vi.fn(), renameProfile: vi.fn(), switchProfile: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children }: { children: React.ReactNode }) => children }));
import { ProfileManager } from './profile-manager';

let dom: JSDOM;
let root: Root | undefined;
let locale: string;
let zone: string;
beforeEach(() => {
  locale = 'en-US';
  zone = 'UTC';
  vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function(this: Date, _locales, options) {
    return new Intl.DateTimeFormat(locale, { timeZone: zone, ...options }).format(this);
  });
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://cerebro.test/profile' });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('navigator', dom.window.navigator);
});
afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = undefined;
  dom.window.close();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it('hydrates the real profile list across different server and browser locales/timezones', async () => {
  const props = { profiles: [{ id: 'qa', ingameName: 'QA', alliance: null, roster: [{ updatedAt: new Date('2026-10-31T23:30:00Z') }] }], activeProfileId: 'qa' } as unknown as Parameters<typeof ProfileManager>[0];
  const container = document.getElementById('root')!;
  container.innerHTML = renderToString(createElement(ProfileManager, props));
  locale = 'cs-CZ';
  zone = 'Europe/Prague';
  const recoveries: unknown[] = [];
  await act(async () => {
    root = hydrateRoot(container, createElement(ProfileManager, props), { onRecoverableError: error => recoveries.push(error) });
  });
  expect(recoveries).toEqual([]);
  expect(container.querySelector('time')?.textContent).toBe('1. 11. 2026');
});
