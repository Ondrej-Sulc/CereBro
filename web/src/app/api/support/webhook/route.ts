import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import logger from "@/lib/logger";
import { upsertSupportDonation } from "@/lib/support-donations";

function getPaymentIntentId(paymentIntent: string | Stripe.PaymentIntent | null): string | null {
  if (!paymentIntent) {
    return null;
  }

  if (typeof paymentIntent === "string") {
    return paymentIntent;
  }

  return paymentIntent.id;
}

function getCustomerId(customer: string | Stripe.Customer | Stripe.DeletedCustomer | null): string | null {
  if (!customer) {
    return null;
  }

  if (typeof customer === "string") {
    return customer;
  }

  return customer.id;
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

export async function POST(request: NextRequest): Promise<NextResponse> {
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

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "checkout.session.async_payment_failed"
  ) {
    return NextResponse.json({ received: true });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const donationStatus = mapDonationStatus(event, session);
  const amountMinor = session.amount_total ?? 0;
  const currency = (session.currency || "").toLowerCase();
  const checkoutSessionId = session.id;
  const paymentIntentId = getPaymentIntentId(session.payment_intent);
  const stripeCustomerId = getCustomerId(session.customer);
  const supporterEmail = session.customer_details?.email || session.customer_email || null;
  const supporterName = session.customer_details?.name || session.metadata?.supporterName || null;
  const metadataPlayerId = session.metadata?.playerId || null;
  const playerId = metadataPlayerId || session.client_reference_id || null;

  try {
    await upsertSupportDonation({
      amountMinor,
      currency,
      status: donationStatus,
      stripeCheckoutSessionId: checkoutSessionId,
      stripePaymentIntentId: paymentIntentId,
      stripeCustomerId,
      supporterName,
      supporterEmail,
      playerId,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error({ error, checkoutSessionId, eventType: event.type }, "Failed to persist support donation webhook");
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
