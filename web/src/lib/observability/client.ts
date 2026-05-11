"use client";

import posthog from "posthog-js";
import { ObservabilityEvents, type ObservabilityEventName, type ProductEventName } from "./events";
import { normalizeProperties } from "./sanitize";

const isPostHogConfigured = Boolean(
  process.env.NEXT_PUBLIC_POSTHOG_KEY && process.env.NEXT_PUBLIC_POSTHOG_HOST
);

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

export function captureDeploymentMismatchReload(properties: Record<string, unknown> = {}): void {
  captureClientEvent(ObservabilityEvents.deploymentMismatchReloaded, properties);
}
