import { handlers } from "@/auth";
import logger, { isAbortedResponse } from "@/lib/logger";
import { withRouteContext } from "@/lib/with-request-context";
import { getSafeAuthErrorDetails } from "@/lib/observability/auth-errors";

const { GET: _GET, POST: _POST } = handlers;

/**
 * Wrap NextAuth handlers to:
 * 1. Catch and log errors in JSON format via Pino.
 * 2. Handle 'ResponseAborted' which is common in Next.js 15/Auth.js v5 redirects.
 */
const wrapHandler = <Req extends Request, Args extends unknown[], R>(
  handler: (req: Req, ...args: Args) => Promise<R> | R
) => async (req: Req, ...args: Args): Promise<R | Response> => {
  try {
    return await handler(req, ...args);
  } catch (error: unknown) {
    const authError = typeof error === "object" && error !== null
      ? error as { message?: unknown; digest?: unknown }
      : {};
    if (
      (typeof authError.message === "string" && authError.message.includes('next_redirect')) ||
      (typeof authError.digest === "string" && authError.digest.startsWith('NEXT_REDIRECT'))
    ) {
      throw error;
    }

    if (isAbortedResponse(error)) {
      // For aborted responses (common during redirects), we log at trace/debug level
      // and return a 204 No Content to satisfy the request.
      logger.trace({ path: new URL(req.url).pathname }, "Auth handler response aborted (expected during redirect)");
      return new Response(null, { status: 204 });
    }

    // Log the error in JSON format before re-throwing
    logger.error({
      ...getSafeAuthErrorDetails(error),
      path: new URL(req.url).pathname,
    }, "Critical error in Auth handler");
    
    // withRouteContext also reports rethrown errors. Keep the raw OAuth error
    // (including its cause) out of that outer logging/exception boundary.
    throw new Error("Auth handler failed; see the correlated Auth.js error log.");
  }
};

export const GET = withRouteContext(wrapHandler(_GET));
export const POST = withRouteContext(wrapHandler(_POST));

