import type { withPostHogConfig } from '@posthog/nextjs-config';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';

/** Used only by next.config.ts at build time, never by the browser bundle. */
export function getSourceMapConfig(
  env: Readonly<Record<string, string | undefined>>,
  releaseVersion: string,
  phase: string = PHASE_PRODUCTION_BUILD,
): Parameters<typeof withPostHogConfig>[1] | null {
  if (phase !== PHASE_PRODUCTION_BUILD || env.POSTHOG_UPLOAD_SOURCEMAPS !== 'true') return null;
  const key = env.POSTHOG_SOURCEMAPS_API_KEY;
  if (!key || key.startsWith('phc_')) {
    throw new Error('Source-map upload requires POSTHOG_SOURCEMAPS_API_KEY with error-tracking write access; the capture key cannot upload maps.');
  }
  const projectId = env.POSTHOG_PROJECT_ID;
  if (!projectId || !/^\d+$/.test(projectId) || Number(projectId) < 1) {
    throw new Error('Source-map upload requires a valid POSTHOG_PROJECT_ID.');
  }
  return {
    personalApiKey: key,
    projectId,
    host: env.POSTHOG_SOURCEMAPS_HOST || 'https://eu.posthog.com',
    sourcemaps: {
      enabled: true, deleteAfterUpload: true, failOnError: true,
      releaseName: 'cerebro-web', releaseVersion,
    },
  };
}
