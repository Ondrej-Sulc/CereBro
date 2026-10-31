import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CaptureResult, PostHogConfig } from 'posthog-js';

const sdk = vi.hoisted(() => ({ init: vi.fn(), capture: vi.fn() }));
vi.mock('posthog-js', () => ({ default: sdk }));
vi.mock('posthog-js/react', () => ({ PostHogProvider: () => null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/planning', useSearchParams: () => new URLSearchParams() }));

let beforeSend: (event: CaptureResult | null) => CaptureResult | null;
beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('window', new EventTarget());
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'unit-test-capture-key');
  vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://example.invalid');
  vi.stubEnv('APP_VERSION', 'test-release');
  await import('./PostHogProvider');
  const config = sdk.init.mock.calls[0][1] as PostHogConfig;
  expect(typeof config.before_send).toBe('function');
  beforeSend = config.before_send as typeof beforeSend;
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

function exception(values: string[], stringify = false): CaptureResult {
  const list = values.map(value => ({ type: 'Error', value }));
  return { uuid: 'test-event', event: '$exception', properties: { $exception_list: stringify ? JSON.stringify(list) : list } };
}

describe('PostHog capture boundary', () => {
  it.each([false, true])('drops known ResizeObserver-only events (serialized: %s)', stringify => {
    expect(beforeSend(exception(['ResizeObserver loop completed with undelivered notifications.'], stringify))).toBeNull();
  });
  it.each(['Failed to fetch', 'Failed to save fight', 'InvalidStateError: drawImage', 'Minified React error #310', 'Script error.', 'Failed to save fight (ResizeObserver loop limit exceeded)'])(
    'keeps actionable or unattributed errors: %s', message => {
      expect(beforeSend(exception([message]))).not.toBeNull();
    },
  );
  it('keeps a genuine error when a chained error also mentions ResizeObserver noise', () => {
    expect(beforeSend(exception(['Failed to save fight', 'ResizeObserver loop limit exceeded']))).not.toBeNull();
  });
  it('refreshes release attribution even if a stored property contains an old version', () => {
    const event = exception(['Failed to save fight']);
    event.properties.app_version = 'stale-release';
    expect(beforeSend(event)?.properties.app_version).toBe('test-release');
    expect(beforeSend(event)?.properties.component).toBe('web-client');
  });
  it('does not filter ordinary events or malformed exceptions', () => {
    const event = { uuid: 'test', event: 'war_fight_updated', properties: {} };
    expect(beforeSend(event)?.event).toBe('war_fight_updated');
    expect(beforeSend({ ...event, event: '$exception', properties: { $exception_list: 'invalid JSON' } })).not.toBeNull();
    expect(beforeSend(null)).toBeNull();
  });
});
