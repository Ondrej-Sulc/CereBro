import { handlers } from "@/auth";
import logger from "@/lib/logger";

const { GET: _GET, POST: _POST } = handlers;

/**
 * Wrap NextAuth handlers to:
 * 1. Catch and log errors in JSON format via Pino.
 * 2. Handle 'ResponseAborted' which is common in Next.js 15/Auth.js v5 redirects.
 */
const wrapHandler = (handler: any) => async (req: Request, ...args: any[]) => {
  try {
    return await handler(req, ...args);
  } catch (error: any) {
    if (error?.message?.includes('next_redirect') || error?.name?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }

    const isAborted = 
      error?.name === 'ResponseAborted' || 
      error?.message?.includes('ResponseAborted');

    if (isAborted) {
      // For aborted responses (common during redirects), we log at trace/debug level
      // and return a 204 No Content to satisfy the request.
      logger.trace({ url: req.url }, "Auth handler response aborted (expected during redirect)");
      return new Response(null, { status: 204 });
    }

    // Log the error in JSON format before re-throwing
    logger.error({ 
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      }, 
      url: req.url 
    }, "Critical error in Auth handler");
    
    throw error;
  }
};

export const GET = wrapHandler(_GET);
export const POST = wrapHandler(_POST);
