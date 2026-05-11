import { NextRequest, NextResponse } from "next/server";
import { requestContextStorage, type RequestContext } from "./request-context";
import { auth } from "@/auth";
import { sendErrorToDiscord } from "./discord-alert";
import logger from "./logger";
import {
  captureServerException,
  captureServerOperation,
} from "./observability/server";

/** Next.js redirect() and notFound() throw errors with special digest prefixes. */
function isNextInternalError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as Record<string, unknown>).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))
  );
}

async function enrichWithSession(ctx: RequestContext): Promise<void> {
  try {
    const session = await auth();
    if (session?.user) {
      ctx.userId = session.user.id;
      ctx.discordId = session.user.discordId;
    }
  } catch {
    // Auth failure should not prevent the handler from running
  }
}

/**
 * Wraps a Server Action to run inside request context.
 *
 * Every log line emitted inside the action automatically includes
 * correlationId, userId, discordId, and action name via Pino mixin.
 *
 * Usage:
 *   export const myAction = withActionContext('myAction', async (data) => { ... });
 */
export function withActionContext<TArgs extends unknown[], TReturn>(
  actionName: string,
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn> {
  const wrapped = async (...args: TArgs): Promise<TReturn> => {
    const ctx: RequestContext = {
      correlationId: crypto.randomUUID(),
      action: actionName,
      startTime: Date.now(),
    };

    return requestContextStorage.run(ctx, async () => {
      await enrichWithSession(ctx);

      try {
        const result = await fn(...args);
        const durationMs = Date.now() - ctx.startTime;

        captureServerOperation({
          kind: "server_action",
          name: actionName,
          durationMs,
          outcome: "success",
        });

        if (durationMs >= 3000) {
          logger.warn({ action: actionName, durationMs }, "Slow Server Action completed");
        } else {
          logger.debug({ action: actionName, durationMs }, "Server Action completed");
        }

        return result;
      } catch (error) {
        if (!isNextInternalError(error)) {
          const durationMs = Date.now() - ctx.startTime;
          logger.error({ err: error, action: actionName, durationMs }, "Server Action failed");
          captureServerException(error, {
            operation_kind: "server_action",
            operation_name: actionName,
            duration_ms: durationMs,
          });
          captureServerOperation({
            kind: "server_action",
            name: actionName,
            durationMs,
            outcome: "exception",
            error,
          });
          sendErrorToDiscord({
            error,
            message: `Server Action: ${actionName}`,
          });
        }
        throw error;
      }
    });
  };

  // Preserve the function name for debugging
  Object.defineProperty(wrapped, "name", { value: actionName });
  return wrapped;
}

/**
 * Wraps a Next.js API route handler to run inside request context.
 *
 * Every log line emitted inside the handler automatically includes
 * correlationId, userId, discordId, and path via Pino mixin.
 *
 * Works with all route handler signatures:
 *   export const GET = withRouteContext(async (req) => { ... });
 *   export const GET = withRouteContext(async (req, { params }) => { ... });
 */
export function withRouteContext<
  TArgs extends [NextRequest | Request, ...unknown[]],
>(
  handler: (...args: TArgs) => Promise<NextResponse | Response>
): (...args: TArgs) => Promise<NextResponse | Response> {
  return async (...args: TArgs) => {
    const req = args[0];
    const url = new URL(req.url);
    const method = req.method;

    const ctx: RequestContext = {
      correlationId: crypto.randomUUID(),
      path: url.pathname,
      startTime: Date.now(),
    };

    return requestContextStorage.run(ctx, async () => {
      await enrichWithSession(ctx);

      try {
        const response = await handler(...args);
        const durationMs = Date.now() - ctx.startTime;
        const status = response.status;
        const outcome =
          status >= 500 ? "server_error" : status >= 400 ? "client_error" : "success";

        // Attach correlation ID to response headers for client-side tracing.
        // Redirect responses (e.g. from Auth.js error handling) have immutable
        // headers — skip silently rather than throwing.
        try {
          response.headers.set("x-correlation-id", ctx.correlationId);
        } catch {
          // immutable headers — no-op
        }

        captureServerOperation({
          kind: "api_route",
          name: ctx.path ?? url.pathname,
          method,
          status,
          durationMs,
          outcome,
        });

        if (status >= 500) {
          logger.warn({ path: ctx.path, method, status, durationMs }, "API Route completed with server error");
        } else if (durationMs >= 3000) {
          logger.warn({ path: ctx.path, method, status, durationMs }, "Slow API Route completed");
        } else {
          logger.debug({ path: ctx.path, method, status, durationMs }, "API Route completed");
        }

        return response;
      } catch (error) {
        if (!isNextInternalError(error)) {
          const durationMs = Date.now() - ctx.startTime;
          logger.error({ err: error, path: ctx.path, method, durationMs }, "API Route failed");
          captureServerException(error, {
            operation_kind: "api_route",
            operation_name: ctx.path,
            method,
            duration_ms: durationMs,
          });
          captureServerOperation({
            kind: "api_route",
            name: ctx.path ?? url.pathname,
            method,
            durationMs,
            outcome: "exception",
            error,
          });
          sendErrorToDiscord({
            error,
            message: `API Route: ${ctx.path}`,
          });
        }
        throw error;
      }
    });
  };
}
