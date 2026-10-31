import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from 'next/constants';
import config from './next.config';

const integration = vi.hoisted(() => ({ configure: vi.fn(), resolve: vi.fn() }));
vi.mock('@posthog/nextjs-config', () => ({
  withPostHogConfig: (base: NextConfig, options: unknown) => {
    integration.configure(options);
    return async (phase: string) => {
      integration.resolve(phase);
      return { ...base, env: { ...base.env, POSTHOG_RELEASE_ID: 'unit-test-release' } };
    };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('POSTHOG_UPLOAD_SOURCEMAPS', 'true');
  vi.stubEnv('POSTHOG_PROJECT_ID', '97072');
  vi.stubEnv('POSTHOG_SOURCEMAPS_API_KEY', '');
});
afterEach(() => vi.unstubAllEnvs());

it.each([PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER])('starts without the private build key: %s', async phase => {
  const result = await config(phase, { defaultConfig: {} });
  expect(result.env?.APP_VERSION).toBeTruthy();
  expect(integration.configure).not.toHaveBeenCalled();
});

it('invokes the official phase-aware integration during an enabled production build', async () => {
  vi.stubEnv('POSTHOG_SOURCEMAPS_API_KEY', 'unit-test-upload-key');
  const result = await config(PHASE_PRODUCTION_BUILD, { defaultConfig: {} });
  expect(integration.configure).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
    projectId: '97072', sourcemaps: expect.objectContaining({ releaseVersion: result.env?.APP_VERSION }),
  }));
  expect(integration.resolve).toHaveBeenCalledExactlyOnceWith(PHASE_PRODUCTION_BUILD);
  expect(result.env?.POSTHOG_RELEASE_ID).toBe('unit-test-release');
});

it('builds normally with upload disabled and no private credential', async () => {
  vi.stubEnv('POSTHOG_UPLOAD_SOURCEMAPS', 'false');
  const result = await config(PHASE_PRODUCTION_BUILD, { defaultConfig: {} });
  expect(result.env?.APP_VERSION).toBeTruthy();
  expect(integration.configure).not.toHaveBeenCalled();
});
