import { NextRequest, NextResponse } from "next/server";
import { requestContextStorage, type RequestContext } from "./request-context";
import { auth } from "@/auth";
import { sendErrorToDiscord } from "./discord-alert";

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
        return await fn(...args);
      } catch (error) {
        if (!isNextInternalError(error)) {
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

    const ctx: RequestContext = {
      correlationId: crypto.randomUUID(),
      path: url.pathname,
      startTime: Date.now(),
    };

    return requestContextStorage.run(ctx, async () => {
      await enrichWithSession(ctx);

      try {
        const response = await handler(...args);

        // Attach correlation ID to response headers for client-side tracing
        response.headers.set("x-correlation-id", ctx.correlationId);

        return response;
      } catch (error) {
        if (!isNextInternalError(error)) {
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
