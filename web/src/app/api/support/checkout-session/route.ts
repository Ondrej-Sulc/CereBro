import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { auth } from "@/auth";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const DEFAULT_CURRENCY = "eur";
const DEFAULT_MIN_AMOUNT = 0.5;
const DEFAULT_MAX_AMOUNT = 1000;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = Number(value.replace(",", "."));
    if (Number.isFinite(normalized)) {
      return normalized;
    }
  }

  return null;
}

function parseBound(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function toMinorUnits(amount: number, currency: string): number {
  const zeroDecimalCurrencies = [
    "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg", "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf"
  ];
  const threeDecimalCurrencies = ["bhd", "jod", "kwd", "omr", "tnd"];

  const lowerCurrency = currency.toLowerCase();
  if (zeroDecimalCurrencies.includes(lowerCurrency)) {
    return Math.round(amount);
  }
  if (threeDecimalCurrencies.includes(lowerCurrency)) {
    return Math.round(amount * 1000);
  }
  return Math.round(amount * 100);
}

function getBaseUrl(): string {
  const baseUrl = process.env.BOT_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing BOT_BASE_URL or NEXT_PUBLIC_BASE_URL environment variable.");
  }
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Server payment configuration is missing." },
      { status: 500 },
    );
  }

  const currency = (process.env.STRIPE_SUPPORT_CURRENCY || DEFAULT_CURRENCY).toLowerCase();
  const minAmount = parseBound(process.env.STRIPE_SUPPORT_MIN_AMOUNT, DEFAULT_MIN_AMOUNT);
  const maxAmount = parseBound(process.env.STRIPE_SUPPORT_MAX_AMOUNT, DEFAULT_MAX_AMOUNT);

  if (minAmount > maxAmount) {
    return NextResponse.json(
      { error: "Server payment limits are invalid." },
      { status: 500 },
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amount = parseNumber((parsedBody as { amount?: unknown })?.amount);
  if (amount === null || amount <= 0) {
    return NextResponse.json(
      { error: "Please enter a valid donation amount." },
      { status: 400 },
    );
  }

  if (amount < minAmount || amount > maxAmount) {
    return NextResponse.json(
      {
        error: `Donation amount must be between ${minAmount} and ${maxAmount} ${currency.toUpperCase()}.`,
      },
      { status: 400 },
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const amountMinor = toMinorUnits(amount, currency);
  let baseUrl: string;
  try {
    baseUrl = getBaseUrl();
  } catch (error) {
    logger.error({ error }, "Configuration error in checkout-session route");
    return NextResponse.json(
      { error: "Internal server configuration error." },
      { status: 500 },
    );
  }
  
  const session = await auth();

  let playerId: string | null = null;
  let botUserId: string | null = null;
  const discordId: string | null = session?.user?.discordId || null;
  let supporterName: string | null = session?.user?.name || null;
  const supporterEmail: string | null = session?.user?.email || null;

  if (discordId) {
    try {
      const player = await prisma.player.findFirst({
        where: { discordId, isActive: true },
        select: { id: true, ingameName: true, botUserId: true },
      });

      if (player) {
        playerId = player.id;
        supporterName = player.ingameName || supporterName;
        botUserId = player.botUserId;
      }
    } catch (error) {
      // Avoid raw discordId in logs - use surrogate or redacted value
      const safeDiscordId = discordId.length > 8 
        ? `${discordId.slice(0, 4)}...${discordId.slice(-4)}` 
        : "present";

      logger.error(
        { error, discordId: safeDiscordId },
        "Failed to resolve player during support checkout session creation",
      );
    }
  }

  try {
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "payment",
      submit_type: "donate",
      success_url: `${baseUrl}/support/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/support/cancel`,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: amountMinor,
            product_data: {
              name: "Support CereBro",
              description: "Community donation for hosting and active development.",
            },
          },
        },
      ],
      customer_email: supporterEmail ?? undefined,
      client_reference_id: playerId ?? undefined,
      metadata: {
        source: "cerebro_support_page",
        playerId: playerId ?? "",
        botUserId: botUserId ?? "",
        discordId: discordId ?? "",
        supporterName: supporterName ?? "",
      },
    });

    if (!checkoutSession.url) {
      return NextResponse.json(
        { error: "Failed to create checkout session." },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: checkoutSession.url });
  } catch (error) {
    logger.error(
      {
        error,
        amountMinor,
        currency,
        baseUrl,
        hasSupporterEmail: !!supporterEmail,
        hasPlayerId: !!playerId,
      },
      "Failed to create Stripe Checkout Session",
    );

    const message =
      error instanceof Error ? error.message : "Unable to start checkout right now. Please try again.";

    return NextResponse.json(
      {
        error:
          process.env.NODE_ENV === "development"
            ? message
            : "Unable to start checkout right now. Please try again.",
      },
      { status: 500 },
    );
  }
}
