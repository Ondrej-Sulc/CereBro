import { PostHog } from "posthog-node";
import { getRequestContext } from "@/lib/request-context";
import { ObservabilityEvents, type ObservabilityEventName, type ProductEventName } from "./events";
import {
  normalizeProperties,
  sanitizeError,
  type ObservabilityProperties,
} from "./sanitize";

type ServerOperationKind = "api_route" | "server_action" | "next_request";
type ServerOperationOutcome = "success" | "client_error" | "server_error" | "exception" | "slow";

type CaptureOptions = {
  distinctId?: string;
  groups?: Record<string, string>;
};

type ServerOperationInput = {
  kind: ServerOperationKind;
  name: string;
  durationMs: number;
  outcome: ServerOperationOutcome;
  method?: string;
  status?: number;
  error?: unknown;
};

declare global {
  var __POSTHOG_SERVER__: PostHog | null | undefined;
}

function getPostHogServer(): PostHog | null {
  if (globalThis.__POSTHOG_SERVER__ !== undefined) {
    return globalThis.__POSTHOG_SERVER__;
  }

  const token = process.env.POSTHOG_API_KEY || process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.POSTHOG_HOST || process.env.NEXT_PUBLIC_POSTHOG_HOST;

  if (!token || !host) {
    globalThis.__POSTHOG_SERVER__ = null;
    return null;
  }

  globalThis.__POSTHOG_SERVER__ = new PostHog(token, {
    host,
    flushAt: 1,
    flushInterval: 0,
  });

  return globalThis.__POSTHOG_SERVER__;
}

function getDistinctId(fallback = "anonymous"): string {
  const ctx = getRequestContext();
  return ctx?.userId || ctx?.discordId || fallback;
}

function getBaseProperties(): ObservabilityProperties {
  const ctx = getRequestContext();

  return {
    app_version: process.env.APP_VERSION || "dev",
    component: "web-server",
    env: process.env.NODE_ENV,
    correlation_id: ctx?.correlationId,
    path: ctx?.path,
    action: ctx?.action,
  };
}

function getSlowThresholdMs(kind: ServerOperationKind): number {
  const envValue =
    kind === "server_action"
      ? process.env.OBSERVABILITY_SLOW_ACTION_MS
      : process.env.OBSERVABILITY_SLOW_ROUTE_MS;
  const parsed = envValue ? Number.parseInt(envValue, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3000;
}

function getSuccessSampleRate(): number {
  const parsed = Number.parseFloat(process.env.OBSERVABILITY_SUCCESS_SAMPLE_RATE || "0");
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(Math.max(parsed, 0), 1);
}

function shouldCaptureOperation(operation: ServerOperationInput): boolean {
  if (operation.outcome === "exception" || operation.outcome === "server_error") {
    return true;
  }
  if (operation.durationMs >= getSlowThresholdMs(operation.kind)) return true;
  return Math.random() < getSuccessSampleRate();
}

export function captureServerEvent(
  event: ObservabilityEventName | ProductEventName,
  properties: Record<string, unknown> = {},
  options: CaptureOptions = {}
): void {
  const client = getPostHogServer();
  if (!client) return;

  client.capture({
    distinctId: options.distinctId || getDistinctId(),
    event,
    properties: {
      ...getBaseProperties(),
      ...normalizeProperties(properties),
    },
    groups: options.groups,
  });
}

export function captureServerException(
  error: unknown,
  properties: Record<string, unknown> = {},
  options: CaptureOptions = {}
): void {
  const client = getPostHogServer();
  if (!client) return;

  client.captureException(error, options.distinctId || getDistinctId(), {
    ...getBaseProperties(),
    ...normalizeProperties(properties),
    ...sanitizeError(error),
  });
}

export function captureServerOperation(operation: ServerOperationInput): void {
  if (!shouldCaptureOperation(operation)) return;

  captureServerEvent(ObservabilityEvents.serverOperationCompleted, {
    operation_kind: operation.kind,
    operation_name: operation.name,
    method: operation.method,
    status: operation.status,
    duration_ms: operation.durationMs,
    outcome:
      operation.outcome === "success" &&
      operation.durationMs >= getSlowThresholdMs(operation.kind)
        ? "slow"
        : operation.outcome,
    ...(operation.error ? sanitizeError(operation.error) : {}),
  });
}
