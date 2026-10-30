import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Prisma } from '@prisma/client';

const mocks = vi.hoisted(() => ({ player: vi.fn(), plan: vi.fn(), war: vi.fn(), nodes: vi.fn() }));
vi.mock('@/lib/auth-helpers', () => ({ getUserPlayerWithAlliance: mocks.player }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  warDefensePlan: { findUnique: mocks.plan }, war: { findUnique: mocks.war }, warNode: { findMany: mocks.nodes },
} }));
vi.mock('@/lib/with-request-context', () => ({ withRouteContext: (fn: unknown) => fn }));
vi.mock('@/lib/cache', () => ({ getFromCache: (_key: string, _ttl: number, load: () => Promise<unknown>) => load() }));
vi.mock('@/lib/logger', () => ({ default: { error: vi.fn() } }));

import { GET } from './route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.player.mockResolvedValue({ id: 'officer', allianceId: 'alliance', isBotAdmin: false });
  mocks.plan.mockResolvedValue({ allianceId: 'alliance', mapType: 'BIG_THING' });
  mocks.war.mockResolvedValue({ allianceId: 'alliance', mapType: 'BIG_THING' });
  mocks.nodes.mockImplementation(async (args: Prisma.WarNodeFindManyArgs) => {
    const numbers = args.where?.nodeNumber;
    const allowed = typeof numbers === 'object' && Array.isArray(numbers.in) ? numbers.in : undefined;
    return Array.from({ length: 50 }, (_, i) => ({ id: 1000 + i + 1, nodeNumber: i + 1, allocations: [] }))
      .filter(node => !allowed || allowed.includes(node.nodeNumber));
  });
});

describe('war map nodes', () => {
  it.each(['planId', 'warId'])('returns only the ten Big Thing nodes for %s', async key => {
    const response = await GET(new NextRequest(`https://cerebro.test/api/war-planning/nodes?${key}=big`));
    expect(response.status).toBe(200);
    const nodes: { id: number; nodeNumber: number }[] = await response.json();
    expect(nodes.map(node => node.nodeNumber)).toEqual(Array.from({ length: 10 }, (_, i) => i + 1));
    expect(nodes.map(node => node.id)).toEqual(Array.from({ length: 10 }, (_, i) => 1001 + i));
  });

  it('retains all fifty Standard nodes', async () => {
    mocks.plan.mockResolvedValue({ allianceId: 'alliance', mapType: 'STANDARD' });
    const response = await GET(new NextRequest('https://cerebro.test/api/war-planning/nodes?planId=standard'));
    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(50);
  });

  it('does not expose another alliance\'s map configuration', async () => {
    mocks.plan.mockResolvedValue({ allianceId: 'other', mapType: 'BIG_THING' });
    const response = await GET(new NextRequest('https://cerebro.test/api/war-planning/nodes?planId=other'));
    expect(response.status).toBe(404);
    expect(mocks.nodes).not.toHaveBeenCalled();
  });
});
