import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import logger from "@/lib/logger";
import { upsertSupportDonation } from "@/lib/support-donations";
import { prisma } from "@/lib/prisma";
import { withRouteContext } from "@/lib/with-request-context";

function getPaymentIntentId(paymentIntent: string | Stripe.PaymentIntent | null): string | null {
  if (!paymentIntent) return null;
  return typeof paymentIntent === "string" ? paymentIntent : paymentIntent.id;
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id;
}

function getSubscriptionId(subscription: string | Stripe.Subscription | null | undefined): string | null {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const sub = invoice.subscription ?? (invoice as any).subscription_details?.subscription;
  return getSubscriptionId(sub as string | Stripe.Subscription | null | undefined);
}

function mapDonationStatus(event: Stripe.Event, session: Stripe.Checkout.Session): string {
  if (event.type === "checkout.session.async_payment_failed") {
    return "failed";
  }

  if (session.payment_status === "paid" || event.type === "checkout.session.async_payment_succeeded") {
    return "succeeded";
  }

  return "pending";
}

const CHECKOUT_SESSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
]);

export const POST = withRouteContext(async (request: NextRequest): Promise<NextResponse> => {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeSecretKey || !webhookSecret) {
    return NextResponse.json(
      { error: "Stripe webhook is not configured." },
      { status: 500 },
    );
  }

  const stripe = new Stripe(stripeSecretKey);
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
  }

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  // Handle invoice payments for recurring subscriptions
  if (event.type === "invoice.payment_succeeded") {
    return handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
  }

  if (!CHECKOUT_SESSION_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true });
  }

  // Handle checkout session events (one-time and initial subscription payment)
  const session = event.data.object as Stripe.Checkout.Session;
  const donationStatus = mapDonationStatus(event, session);
  const amountMinor = session.amount_total;
  const sessionCurrency = session.currency;
  const checkoutSessionId = session.id;

  if (typeof amountMinor !== "number" || amountMinor <= 0) {
    logger.error(
      { checkoutSessionId, eventType: event.type, amountMinor },
      "Skipping support donation webhook with invalid amount_total",
    );
    return NextResponse.json({ received: true });
  }

  if (typeof sessionCurrency !== "string" || sessionCurrency.trim().length === 0) {
    logger.error(
      { checkoutSessionId, eventType: event.type, currency: sessionCurrency },
      "Skipping support donation webhook with invalid currency",
    );
    return NextResponse.json({ received: true });
  }

  const currency = sessionCurrency.toLowerCase();
  const paymentIntentId = getPaymentIntentId(session.payment_intent);
  const stripeCustomerId = getCustomerId(session.customer);
  const stripeSubscriptionId = getSubscriptionId(session.subscription);
  const supporterEmail = session.customer_details?.email || session.customer_email || null;
  const supporterName = session.customer_details?.name || session.metadata?.supporterName || null;
  const metadataPlayerId = session.metadata?.playerId || null;
  const discordId = session.metadata?.discordId || null;
  const botUserId = session.metadata?.botUserId || null;
  const playerId = metadataPlayerId || session.client_reference_id || null;

  try {
    await upsertSupportDonation({
      amountMinor,
      currency,
      status: donationStatus,
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId,
      stripeSubscriptionId,
      supporterName,
      supporterEmail,
      playerId,
      discordId,
      botUserId,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ error, checkoutSessionId, eventType: event.type }, "Failed to persist support donation webhook");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
});

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<NextResponse> {
  // Skip the initial invoice — it is already captured by checkout.session.completed
  if (invoice.billing_reason === "subscription_create") {
    return NextResponse.json({ received: true });
  }

  const stripeSubscriptionId = getInvoiceSubscriptionId(invoice);
  if (!stripeSubscriptionId) {
    // Not a subscription invoice — skip
    return NextResponse.json({ received: true });
  }

  if (invoice.status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const amountMinor = invoice.amount_paid;
  if (typeof amountMinor !== "number" || amountMinor <= 0) {
    logger.error(
      { invoiceId: invoice.id, amountMinor },
      "Skipping invoice webhook with invalid amount_paid",
    );
    return NextResponse.json({ received: true });
  }

  const sessionCurrency = invoice.currency;
  if (typeof sessionCurrency !== "string" || sessionCurrency.trim().length === 0) {
    logger.error(
      { invoiceId: invoice.id, currency: sessionCurrency },
      "Skipping invoice webhook with invalid currency",
    );
    return NextResponse.json({ received: true });
  }

  const currency = sessionCurrency.toLowerCase();
  const stripeCustomerId = getCustomerId(invoice.customer);
  // payment_intent is not available on Invoice in Stripe SDK v20+
  const paymentIntentId: string | null = null;

  // Pull metadata from subscription_details (populated from subscription_data.metadata at checkout)
  const meta = (invoice as any).subscription_details?.metadata ?? {};

  let playerId: string | null = meta.playerId || null;
  let botUserId: string | null = meta.botUserId || null;
  let discordId: string | null = meta.discordId || null;
  let supporterName: string | null = meta.supporterName || null;
  const supporterEmail: string | null = invoice.customer_email || null;

  // If metadata is missing, fall back to looking up by stripeCustomerId in existing donations
  if (!discordId && stripeCustomerId) {
    try {
      const existing = await prisma.supportDonation.findFirst({
        where: { stripeCustomerId, stripeSubscriptionId: stripeSubscriptionId ?? undefined },
        select: { playerId: true, botUserId: true, discordId: true, supporterName: true },
        orderBy: { createdAt: "desc" },
      });

      if (existing) {
        playerId = playerId || existing.playerId;
        botUserId = botUserId || existing.botUserId;
        discordId = discordId || existing.discordId;
        supporterName = supporterName || existing.supporterName;
      }
    } catch (error) {
      logger.error(
        { error, invoiceId: invoice.id },
        "Failed to look up existing donation for invoice player resolution",
      );
    }
  }

  try {
    // Use invoice.id as the unique checkout session ID for recurring payments
    await upsertSupportDonation({
      amountMinor,
      currency,
      status: "succeeded",
      stripeCheckoutSessionId: invoice.id,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId,
      stripeSubscriptionId,
      supporterName,
      supporterEmail,
      playerId,
      discordId,
      botUserId,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error(
      { error, invoiceId: invoice.id, stripeSubscriptionId },
      "Failed to persist recurring invoice payment",
    );
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
