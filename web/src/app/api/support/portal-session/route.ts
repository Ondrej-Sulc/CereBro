import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withRouteContext } from "@/lib/with-request-context";

function getBaseUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.BOT_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing BOT_BASE_URL or NEXT_PUBLIC_BASE_URL environment variable.");
  }
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export const POST = withRouteContext(async (request: NextRequest): Promise<NextResponse> => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Server payment configuration is missing." },
      { status: 500 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!session.user.discordId) {
    return NextResponse.json({ error: "Discord account not linked." }, { status: 403 });
  }

  const discordId = session.user.discordId;

  let parsedBody: { returnPath?: unknown } = {};
  try {
    parsedBody = await request.json();
  } catch {
    // returnPath is optional; ignore parse errors
  }

  const returnPath =
    typeof parsedBody.returnPath === "string" && parsedBody.returnPath.startsWith("/")
      ? parsedBody.returnPath
      : "/support";

  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch (error) {
    logger.error({ error }, "Configuration error in portal-session route");
    return NextResponse.json({ error: "Internal server configuration error." }, { status: 500 });
  }

  // Find the most recent donation with a stripeCustomerId for this user
  const donation = await prisma.supportDonation.findFirst({
    where: { discordId, stripeCustomerId: { not: null } },
    select: { stripeCustomerId: true },
    orderBy: { createdAt: "desc" },
  });

  if (!donation?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No billing account found for your Discord account." },
      { status: 404 },
    );
  }

  try {
    const stripe = new Stripe(stripeSecretKey);
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: donation.stripeCustomerId,
      return_url: `${baseUrl}${returnPath}`,
    });

    logger.info({ discordId: `${discordId.slice(0, 4)}...`, returnPath }, "Created Stripe billing portal session");

    return NextResponse.json({ url: portalSession.url });
  } catch (error) {
    logger.error({ error }, "Failed to create Stripe billing portal session");

    const message = error instanceof Error ? error.message : "Unable to open billing portal. Please try again.";

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "Unable to open billing portal. Please try again.",
      },
      { status: 500 },
    );
  }
});
