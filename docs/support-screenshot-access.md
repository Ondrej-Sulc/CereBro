# Supporter screenshot access investigation

Investigated on 5 November 2026 against production and the latest `main`.
Database inspection ran inside a read-only transaction. Stripe access used GET
requests only. No production payment records or webhook settings were changed.

## Confirmed causes

The reported supporter has an active EUR 5/month subscription. Stripe confirms
five successful payments, totaling EUR 25. CereBro contains the initial July
payment but is missing the four paid renewal invoices from August through November.

The production endpoint is enabled for checkout events only. It is missing the
renewal and subscription lifecycle events already handled by the application.
The subscription status audit also confirmed stale cached active statuses, so
refreshing those records is a prerequisite to deploying the quota change.

The quota's personal-support check only considered this calendar month's payment
or the lifetime threshold. It did not recognize an active personal subscription.
The Support page and alliance support logic already recognize active subscriptions.
Consequently, the reported 14-image batch was rejected with a free allowance.

## Prepared code correction

Personal support now qualifies through a successful payment this calendar month
or a stored subscription in the existing active/grace status set (`active`,
`trialing`, `past_due`). Identity matching remains restricted to the uploader's
player, BotUser or Discord identity. Uploading on behalf of another player still
uses the uploader's allowance. The free allowance, lifetime threshold and alliance
threshold are unchanged.

The actual supporter record was evaluated with the corrected function in a
read-only production transaction. It permits the 14-image batch with
`personal_supporter` as its reason, without changing records or processing images.

Regression coverage includes active/inactive subscriptions, unsuccessful payments,
missing subscription IDs, another account's subscription, profile switching and
the existing one-time/lifetime/alliance rules. Webhook route tests cover renewal
identity, legacy invoice metadata fallback, stable invoice persistence keys,
initial-invoice exclusion, cancellation updates and invalid signatures.

## Production repair required

1. Preserve the endpoint URL, signing secret and existing checkout events. Add
   `invoice.payment_succeeded`, `customer.subscription.updated` and
   `customer.subscription.deleted` to its enabled events.
2. Refresh cached statuses for the existing subscriptions from Stripe. The bounded
   read-only audit checked 31 subscription IDs and found 17 stale active statuses.
   This is a metadata reconciliation, not a cancellation or charge operation.
3. Import the reported supporter's four verified paid renewal invoices. Use each
   invoice ID as the existing unique persistence key, skip the initial subscription
   invoice already recorded by checkout, and make reprocessing idempotent. Preserve
   original paid dates and current Stripe subscription status. Keep existing
   identity links and PII suppression decisions; no additional payment is needed.
   Review paid renewal history for the other known subscriptions in the same
   reconciliation; the confirmed four-invoice count concerns this report only.
4. Deploy the code correction after status reconciliation, then verify the
   supporter's allowance and invoice totals. Confirm future renewals and status
   changes reach the webhook.

Some missing invoices are older than Stripe's event-retrieval window. Recovery
must use verified paid invoice records, rather than assuming the entire history
can be replayed as recent webhook events.

References: [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
and [Stripe event recovery](https://docs.stripe.com/events/manage-webhook-endpoints#process-undelivered-events).

## Validation

- 45 focused quota, support, webhook, upload-error and relic screenshot route
  checks passed.
- Bot TypeScript build passed.
- Production Next.js build passed.
- The before/after read-only evaluation reproduced and corrected the reported
  batch rejection. Deployment and production billing repair remain pending.
