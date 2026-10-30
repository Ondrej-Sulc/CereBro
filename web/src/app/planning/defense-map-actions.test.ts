import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ player: vi.fn(), placement: vi.fn(), plan: vi.fn(), node: vi.fn(), upsert: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ getUserPlayerWithAlliance: mocks.player }));
vi.mock('@/lib/prisma', () => ({ prisma: { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
  warDefensePlan: { findUnique: mocks.plan }, warNode: { findUnique: mocks.node },
  warDefensePlacement: { findUnique: mocks.placement, upsert: mocks.upsert, update: mocks.update },
}) } }));
vi.mock('@/lib/with-request-context', () => ({ withActionContext: (_name: string, fn: unknown) => fn }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('@cerebro/core/services/mapImageService', () => ({ MapImageService: {} }));

import { updateDefensePlacement } from './defense-actions';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.player.mockResolvedValue({ id: 'officer', allianceId: 'alliance', isOfficer: true, isBotAdmin: false });
  mocks.placement.mockResolvedValue(null);
  mocks.plan.mockResolvedValue({ id: 'big', allianceId: 'alliance', mapType: 'BIG_THING' });
  mocks.node.mockResolvedValue({ id: 1011, nodeNumber: 11 });
  mocks.upsert.mockResolvedValue({});
});

describe('defense map boundaries', () => {
  it.each([11, 12])('rejects node %s on a Big Thing plan before saving a defender', async number => {
    mocks.node.mockResolvedValue({ id: 1000 + number, nodeNumber: number });
    await expect(updateDefensePlacement({ planId: 'big', battlegroup: 3, nodeId: 1000 + number, defenderId: 7 }))
      .rejects.toThrow(/node.*map/i);
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('uses the saved placement\'s node and map even when different coordinates are submitted', async () => {
    mocks.placement.mockResolvedValue({ id: 'saved', nodeId: 1011, playerId: null, plan: { allianceId: 'alliance', mapType: 'BIG_THING' } });
    await expect(updateDefensePlacement({ id: 'saved', planId: 'standard', nodeId: 1002, defenderId: 7 }))
      .rejects.toThrow(/node.*map/i);
    expect(mocks.node).toHaveBeenCalledWith({ where: { id: 1011 } });
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('accepts Big Thing node 10 when its database ID exceeds ten', async () => {
    mocks.node.mockResolvedValue({ id: 1010, nodeNumber: 10 });
    await updateDefensePlacement({ planId: 'big', battlegroup: 3, nodeId: 1010, defenderId: 7 });
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it('still accepts node 12 on the Standard map', async () => {
    mocks.plan.mockResolvedValue({ allianceId: 'alliance', mapType: 'STANDARD' });
    mocks.node.mockResolvedValue({ id: 1012, nodeNumber: 12 });
    await updateDefensePlacement({ planId: 'standard', battlegroup: 1, nodeId: 1012, defenderId: 7 });
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it('rejects a nonexistent database node without saving', async () => {
    mocks.node.mockResolvedValue(null);
    await expect(updateDefensePlacement({ planId: 'big', battlegroup: 1, nodeId: 9999, defenderId: 7 }))
      .rejects.toThrow(/node.*map/i);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
