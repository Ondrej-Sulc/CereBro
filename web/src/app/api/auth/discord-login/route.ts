import { signIn } from "@/auth";
import { NextRequest } from "next/server";
import logger, { isAbortedResponse } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const redirectTo = searchParams.get("redirectTo") || "/";

  try {
    await signIn("discord", { redirectTo });
  } catch (error: any) {
    // Check for internal Next.js redirect errors which should be allowed to bubble up
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message?.includes('next_redirect')) {       
      throw error;
    }

    // Check for ResponseAborted which is also common during redirects in some Next.js versions
    if (isAbortedResponse(error)) {
      logger.trace({ redirectTo }, "Login redirect aborted (expected behavior)");
      return new Response(null, { status: 204 }); // Return an empty response, Next.js handles the response closure
    }

    logger.error({ error: { message: error.message, stack: error.stack, name: error.name }, redirectTo }, "Error in discord-login handler");
    throw error;
  }
}
