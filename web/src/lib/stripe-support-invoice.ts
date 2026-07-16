import type Stripe from "stripe";

type LegacyInvoiceWithSubscriptionDetails = Stripe.Invoice & {
  subscription?: string | Stripe.Subscription | null;
  subscription_details?: {
    subscription?: string | Stripe.Subscription | null;
    metadata?: Record<string, string> | null;
  } | null;
};

function getSubscriptionId(subscription: string | Stripe.Subscription | null | undefined): string | null {
  if (!subscription) return null;
  return typeof subscription === "string" ? subscription : subscription.id;
}

export function getInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const legacyInvoice = invoice as LegacyInvoiceWithSubscriptionDetails;
  const subscription =
    invoice.parent?.subscription_details?.subscription ??
    legacyInvoice.subscription ??
    legacyInvoice.subscription_details?.subscription;
  return getSubscriptionId(subscription);
}

export function getInvoiceSubscriptionMetadata(invoice: Stripe.Invoice): Record<string, string> {
  return (
    invoice.parent?.subscription_details?.metadata ??
    (invoice as LegacyInvoiceWithSubscriptionDetails).subscription_details?.metadata ??
    {}
  );
}
