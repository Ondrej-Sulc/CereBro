import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  event: vi.fn(), persist: vi.fn(), findDonation: vi.fn(), updateStatus: vi.fn(),
}));
vi.mock('stripe', () => ({ default: class {
  webhooks = { constructEvent: mocks.event };
} }));
vi.mock('@/lib/support-donations', () => ({ upsertSupportDonation: mocks.persist }));
vi.mock('@/lib/prisma', () => ({ prisma: { supportDonation: {
  findFirst: mocks.findDonation, updateMany: mocks.updateStatus,
} } }));
vi.mock('@/lib/with-request-context', () => ({ withRouteContext: (handler: unknown) => handler }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));

const request = () => new NextRequest('https://cerebro.example/api/support/webhook', {
  method: 'POST', body: 'signed-test-payload', headers: { 'stripe-signature': 'test-signature' },
});
function invoice(overrides: Record<string, unknown> = {}) {
  return {
    id: 'in_renewal', status: 'paid', billing_reason: 'subscription_cycle',
    amount_paid: 500, currency: 'eur', customer: 'cus_test', customer_email: null,
    parent: { subscription_details: { subscription: 'sub_test', metadata: {
      playerId: 'player-one', botUserId: 'account-one', discordId: 'discord-one',
    } } },
    ...overrides,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('STRIPE_SECRET_KEY', 'unit-test-key');
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'unit-test-signing-secret');
  mocks.persist.mockResolvedValue({ id: 'recorded-donation' });
  mocks.updateStatus.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());

describe('support subscription webhook processing', () => {
  it('records a paid renewal under a stable invoice ID with the supporter identity', async () => {
    mocks.event.mockReturnValue({ type: 'invoice.payment_succeeded', data: { object: invoice() } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.persist).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      amountMinor: 500, currency: 'eur', status: 'succeeded', stripeCheckoutSessionId: 'in_renewal',
      stripeSubscriptionId: 'sub_test', stripeSubscriptionStatus: 'active',
      playerId: 'player-one', botUserId: 'account-one', discordId: 'discord-one',
    }));
  });

  it('resolves a legacy renewal through the existing subscription when metadata is missing', async () => {
    mocks.event.mockReturnValue({ type: 'invoice.payment_succeeded', data: { object: invoice({ parent: undefined, subscription: 'sub_test' }) } });
    mocks.findDonation.mockResolvedValue({ playerId: 'linked-player', botUserId: 'linked-account', discordId: 'linked-discord' });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.findDonation).toHaveBeenCalledWith(expect.objectContaining({
      where: { stripeCustomerId: 'cus_test', stripeSubscriptionId: 'sub_test' },
    }));
    expect(mocks.persist).toHaveBeenCalledWith(expect.objectContaining({
      playerId: 'linked-player', botUserId: 'linked-account', discordId: 'linked-discord',
    }));
  });

  it('uses the same persistence key when a renewal is delivered again', async () => {
    mocks.event.mockReturnValue({ type: 'invoice.payment_succeeded', data: { object: invoice() } });
    await POST(request());
    await POST(request());
    expect(mocks.persist.mock.calls.map(([data]) => data.stripeCheckoutSessionId)).toEqual(['in_renewal', 'in_renewal']);
  });

  it('does not count the initial invoice again after checkout', async () => {
    mocks.event.mockReturnValue({ type: 'invoice.payment_succeeded', data: { object: invoice({ billing_reason: 'subscription_create' }) } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it.each(['customer.subscription.updated', 'customer.subscription.deleted'])('updates stored subscription eligibility on %s', async type => {
    mocks.event.mockReturnValue({ type, data: { object: { id: 'sub_test', status: 'canceled' } } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.updateStatus).toHaveBeenCalledExactlyOnceWith({
      where: { stripeSubscriptionId: 'sub_test' }, data: { stripeSubscriptionStatus: 'canceled' },
    });
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('does not record an unpaid invoice', async () => {
    mocks.event.mockReturnValue({ type: 'invoice.payment_succeeded', data: { object: invoice({ status: 'open' }) } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature before changing support records', async () => {
    mocks.event.mockImplementation(() => { throw new Error('Invalid signature'); });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.persist).not.toHaveBeenCalled();
    expect(mocks.updateStatus).not.toHaveBeenCalled();
  });
});
