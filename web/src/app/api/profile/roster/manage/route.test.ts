import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT, DELETE } from './route';
import { captureServerException, captureServerOperation } from '@/lib/observability/server';
import { revalidatePath } from 'next/cache';

const mocks = vi.hoisted(() => ({
  player: vi.fn(), findUnique: vi.fn(), update: vi.fn(), remove: vi.fn(), rule: vi.fn(),
}));
vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'qa-user' } }) }));
vi.mock('@/lib/auth-helpers', () => ({ getUserPlayerWithAlliance: mocks.player }));
vi.mock('@/lib/prisma', () => ({ prisma: { roster: {
  findUnique: mocks.findUnique, update: mocks.update, delete: mocks.remove,
} } }));
vi.mock('@/lib/logger', () => ({ default: {
  debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
} }));
vi.mock('@/lib/discord-alert', () => ({ sendErrorToDiscord: vi.fn() }));
vi.mock('@/lib/observability/server', () => ({
  captureServerException: vi.fn(), captureServerOperation: vi.fn(),
}));
vi.mock('@/lib/cache', () => ({ clearCache: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@cerebro/core/data/game-ascension', () => ({ getChampionAscension: mocks.rule, getChampionAscensionRules: () => [] }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.player.mockResolvedValue({ id: 'qa-player', allianceId: null });
  mocks.findUnique.mockResolvedValue({
    id: 'qa-roster', playerId: 'qa-player', stars: 7, isAscended: false, ascensionLevel: 0, champion: { gameId: 'gwenom' },
    player: { allianceId: null, ingameName: 'QA' },
  });
  mocks.update.mockResolvedValue({ id: 'qa-roster', rank: 4 });
  mocks.remove.mockResolvedValue({ id: 'qa-roster' });
  mocks.rule.mockReturnValue({ maxLevel: 2 });
});

describe('roster ascension writes', () => {
  it('edits a legacy ascended6-star row without clearing its observed level', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'qa-roster', playerId: 'qa-player', stars: 6, isAscended: true, ascensionLevel: 1, champion: { gameId: 'hulk' }, player: { allianceId: null } });
    mocks.rule.mockReturnValue({ maxLevel: 1 });
    const response = await PUT(request('PUT', { id: 'qa-roster', rank: 5, isAscended: true, ascensionLevel: 1 }));
    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ rank: 5, isAscended: true, ascensionLevel: 1 }) }));
  });

  it('rejects contradictory explicit writes before persistence', async () => {
    const response = await PUT(request('PUT', { id: 'qa-roster', isAscended: false, ascensionLevel: 2 }));
    expect(response.status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('synchronizes boolean-only clearing and preserves ascension when fields are omitted', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'qa-roster', playerId: 'qa-player', stars: 7, isAscended: true, ascensionLevel: 2, champion: { gameId: 'gwenom' }, player: { allianceId: null } });
    expect((await PUT(request('PUT', { id: 'qa-roster', rank: 4 }))).status).toBe(200);
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty('ascensionLevel');
    expect(mocks.update.mock.calls[0][0].data).not.toHaveProperty('isAscended');
    expect((await PUT(request('PUT', { id: 'qa-roster', isAscended: false }))).status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ isAscended: false, ascensionLevel: 0 }) }));
  });

  it('uses champion rules for increases but permits editing a historical owned level above the snapshot cap', async () => {
    expect((await PUT(request('PUT', { id: 'qa-roster', ascensionLevel: 3 }))).status).toBe(400);
    expect(mocks.rule).toHaveBeenCalledWith('gwenom', 7);
    mocks.findUnique.mockResolvedValue({ id: 'qa-roster', playerId: 'qa-player', stars: 7, isAscended: true, ascensionLevel: 5, champion: { gameId: 'gwenom' }, player: { allianceId: null } });
    expect((await PUT(request('PUT', { id: 'qa-roster', rank: 4, ascensionLevel: 5 }))).status).toBe(200);
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ ascensionLevel: 5, isAscended: true }) }));
  });

  it('allows structurally valid user observations when rules are missing', async () => {
    mocks.rule.mockReturnValue(null);
    expect((await PUT(request('PUT', { id: 'qa-roster', ascensionLevel: 3 }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ isAscended: true, ascensionLevel: 3 }) }));
  });

  it.each(['ascensionLevel', 'rank', 'sigLevel'])('rejects fractional %s values', async field => {
    expect((await PUT(request('PUT', { id: 'qa-roster', [field]: 1.5 }))).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('keeps owner/officer authorization ahead of state validation or mutation', async () => {
    mocks.player.mockResolvedValue({ id: 'other', allianceId: null });
    expect((await PUT(request('PUT', { id: 'qa-roster', ascensionLevel: 1 }))).status).toBe(403);
    expect(mocks.rule).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

const request = (method: string, body: unknown) => new Request('http://localhost/api/profile/roster/manage', {
  method, body: JSON.stringify(body), headers: { 'content-type': 'application/json' },
});

describe('roster mutation error reporting', () => {
  it.each([['PUT', PUT, 'update'], ['DELETE', DELETE, 'remove']] as const)(
    'reports a caught %s database failure exactly once', async (method, handler, mutation) => {
      const error = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
      mocks[mutation].mockRejectedValue(error);
      const response = await handler(request(method, { id: 'qa-roster', rank: 4 }));
      expect(response.status).toBe(500);
      expect(captureServerException).toHaveBeenCalledExactlyOnceWith(error, expect.objectContaining({
        source: 'profile_roster_manage', method, status: 500,
      }));
      expect(captureServerOperation).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'server_error', status: 500 }));
      expect(mocks[mutation]).toHaveBeenCalledOnce();
      expect(revalidatePath).not.toHaveBeenCalled();
      expect(response.headers.get('x-correlation-id')).toBeTruthy();
    },
  );
  it.each([['PUT', PUT], ['DELETE', DELETE]] as const)(
    'does not report %s validation failures as server exceptions', async (method, handler) => {
      const response = await handler(request(method, { id: 42 }));
      expect(response.status).toBe(400);
      expect(captureServerException).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.remove).not.toHaveBeenCalled();
    },
  );
  it('reports a failure after a committed update without repeating the mutation', async () => {
    const error = new Error('Cache invalidation failed');
    vi.mocked(revalidatePath).mockImplementation(() => { throw error; });
    const response = await PUT(request('PUT', { id: 'qa-roster', rank: 4 }));
    expect(response.status).toBe(500);
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(captureServerException).toHaveBeenCalledExactlyOnceWith(error, expect.objectContaining({ method: 'PUT' }));
  });
});
