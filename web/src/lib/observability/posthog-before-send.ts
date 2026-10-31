import type { CaptureResult } from 'posthog-js';
import { getAppVersion } from '@/lib/app-version';
import { isIgnoredBrowserErrorMessage } from './ignored-browser-errors';

/** Filter at the SDK boundary, including automatically captured exceptions. */
export function beforeSendPostHog(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null;
  if (event.event === '$exception') {
    let exceptions: unknown = event.properties.$exception_list;
    if (typeof exceptions === 'string') {
      try { exceptions = JSON.parse(exceptions); }
      catch { exceptions = null; }
    }
    if (Array.isArray(exceptions) && exceptions.length > 0 && exceptions.every(exception =>
      typeof exception === 'object' && exception !== null &&
      isIgnoredBrowserErrorMessage((exception as { value?: unknown }).value),
    )) return null;
  }
  return {
    ...event,
    properties: {
      ...event.properties,
      // Do not let a persisted super-property or an identity reset mislabel a release.
      app_version: getAppVersion(),
      component: event.properties.component ?? 'web-client',
      env: process.env.NODE_ENV,
    },
  };
}
