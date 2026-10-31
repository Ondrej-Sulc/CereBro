import { describe, expect, it } from 'vitest';
import { getSourceMapConfig } from './source-map-config';
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER } from 'next/constants';

describe('private production source maps', () => {
  it('does not generate or upload maps without explicit enablement', () => {
    expect(getSourceMapConfig({ POSTHOG_SOURCEMAPS_API_KEY: 'test-private-key', POSTHOG_PROJECT_ID: '97072' }, 'sha')).toBeNull();
  });
  it.each([PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_SERVER])('does not require the build credential at runtime: %s', phase => {
    expect(getSourceMapConfig({ POSTHOG_UPLOAD_SOURCEMAPS: 'true', POSTHOG_PROJECT_ID: '97072' }, 'sha', phase)).toBeNull();
  });
  it.each([undefined, 'phc_test_capture_key'])('rejects a missing or capture-only upload credential', key => {
    expect(() => getSourceMapConfig({ POSTHOG_UPLOAD_SOURCEMAPS: 'true', POSTHOG_SOURCEMAPS_API_KEY: key, POSTHOG_PROJECT_ID: '97072' }, 'sha')).toThrow('error-tracking write access');
  });
  it('binds maps to the build release and requires successful upload before deletion', () => {
    expect(getSourceMapConfig({ POSTHOG_UPLOAD_SOURCEMAPS: 'true', POSTHOG_SOURCEMAPS_API_KEY: 'test-private-key', POSTHOG_PROJECT_ID: '97072' }, 'release-sha')).toMatchObject({
      host: 'https://eu.posthog.com', projectId: '97072',
      sourcemaps: { enabled: true, deleteAfterUpload: true, failOnError: true, releaseVersion: 'release-sha' },
    });
  });
  it.each(['', '0', 'invalid'])('rejects an invalid project ID: %s', projectId => {
    expect(() => getSourceMapConfig({ POSTHOG_UPLOAD_SOURCEMAPS: 'true', POSTHOG_SOURCEMAPS_API_KEY: 'test-private-key', POSTHOG_PROJECT_ID: projectId }, 'sha')).toThrow('POSTHOG_PROJECT_ID');
  });
});
