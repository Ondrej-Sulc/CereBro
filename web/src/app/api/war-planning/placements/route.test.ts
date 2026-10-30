import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({ player: vi.fn(), plan: vi.fn(), placements: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ getUserPlayerWithAlliance: mocks.player }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  warDefensePlan: { findUnique: mocks.plan }, warDefensePlacement: { findMany: mocks.placements },
} }));
vi.mock('@/lib/with-request-context', () => ({ withRouteContext: (fn: unknown) => fn }));
vi.mock('@/lib/logger', () => ({ default: { error: vi.fn() } }));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.player.mockResolvedValue({ id: 'officer', allianceId: 'alliance', isBotAdmin: false });
  mocks.plan.mockResolvedValue({ allianceId: 'alliance', mapType: 'BIG_THING' });
  mocks.placements.mockImplementation(async ({ where }: { where: { node?: { nodeNumber: { in: number[] } } } }) => {
    return [1, 10, 11, 12].map(number => ({ id: `placement-${number}`, nodeId: 1000 + number, node: { nodeNumber: number } }))
      .filter(placement => !where.node || where.node.nodeNumber.in.includes(placement.node.nodeNumber));
  });
});

describe('defense placement map scope', () => {
  it('excludes previously saved off-map placements on Big Thing', async () => {
    const response = await GET(new NextRequest('https://cerebro.test/api/war-planning/placements?planId=big'));
    expect(response.status).toBe(200);
    const rows: { node: { nodeNumber: number } }[] = await response.json();
    expect(rows.map(p => p.node.nodeNumber)).toEqual([1, 10]);
  });

  it('keeps the same saved placements visible on Standard', async () => {
    mocks.plan.mockResolvedValue({ allianceId: 'alliance', mapType: 'STANDARD' });
    const response = await GET(new NextRequest('https://cerebro.test/api/war-planning/placements?planId=standard'));
    const rows: { node: { nodeNumber: number } }[] = await response.json();
    expect(rows.map(p => p.node.nodeNumber)).toEqual([1, 10, 11, 12]);
  });

  it('does not expose placements from another alliance', async () => {
    mocks.plan.mockResolvedValue({ allianceId: 'other', mapType: 'BIG_THING' });
    const response = await GET(new NextRequest('https://cerebro.test/api/war-planning/placements?planId=other'));
    expect(response.status).toBe(404);
    expect(mocks.placements).not.toHaveBeenCalled();
  });
});
