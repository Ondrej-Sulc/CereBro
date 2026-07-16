import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import {
  getInvoiceSubscriptionId,
  getInvoiceSubscriptionMetadata,
} from "./stripe-support-invoice";

describe("Stripe support invoice parsing", () => {
  it("reads subscription identity from a current Stripe invoice", () => {
    const invoice = {
      parent: {
        type: "subscription_details",
        subscription_details: {
          subscription: "sub_current",
          metadata: {
            playerId: "player-1",
            botUserId: "bot-user-1",
            discordId: "discord-1",
          },
        },
      },
    } as unknown as Stripe.Invoice;

    expect({
      subscriptionId: getInvoiceSubscriptionId(invoice),
      metadata: getInvoiceSubscriptionMetadata(invoice),
    }).toEqual({
      subscriptionId: "sub_current",
      metadata: {
        playerId: "player-1",
        botUserId: "bot-user-1",
        discordId: "discord-1",
      },
    });
  });

  it("keeps supporting legacy Stripe invoice fields", () => {
    const invoice = {
      subscription: "sub_legacy",
      subscription_details: {
        metadata: { discordId: "discord-legacy" },
      },
    } as unknown as Stripe.Invoice;

    expect({
      subscriptionId: getInvoiceSubscriptionId(invoice),
      metadata: getInvoiceSubscriptionMetadata(invoice),
    }).toEqual({
      subscriptionId: "sub_legacy",
      metadata: { discordId: "discord-legacy" },
    });
  });
});
