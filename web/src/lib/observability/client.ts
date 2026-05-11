"use client";

import posthog from "posthog-js";
import { ObservabilityEvents, type ObservabilityEventName, type ProductEventName } from "./events";
import { normalizeProperties } from "./sanitize";

const isPostHogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST
);
const lastReportedClientErrorAt = new Map<string, number>();

export function captureClientEvent(
  event: ObservabilityEventName | ProductEventName,
  properties: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  if (!isPostHogConfigured) return;
  posthog.capture(event, normalizeProperties(properties));
}

export function captureClientException(
  error: unknown,
  properties: Record<string, unknown> = {}
): void {
  if (typeof window === "undefined") return;
  if (!isPostHogConfigured) return;
  posthog.captureException(error, normalizeProperties(properties));
}

export function reportClientError(
  source: string,
  error: unknown,
  properties: Record<string, unknown> = {},
  options: { throttleMs?: number } = {}
): void {
  const throttleMs = options.throttleMs ?? 60_000;
  if (throttleMs > 0) {
    const now = Date.now();
    const lastReportedAt = lastReportedClientErrorAt.get(source) ?? 0;
    if (now - lastReportedAt < throttleMs) return;
    lastReportedClientErrorAt.set(source, now);
  }

  captureClientException(error, {
    source,
    ...properties,
  });
}

export function captureDeploymentMismatchReload(properties: Record<string, unknown> = {}): void {
  captureClientEvent(ObservabilityEvents.deploymentMismatchReloaded, properties);
}
