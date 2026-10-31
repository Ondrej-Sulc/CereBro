import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PUT, DELETE } from './route';
import { captureServerException, captureServerOperation } from '@/lib/observability/server';
import { revalidatePath } from 'next/cache';

const mocks = vi.hoisted(() => ({
  player: vi.fn(), findUnique: vi.fn(), update: vi.fn(), remove: vi.fn(),
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

beforeEach(() => {
  vi.resetAllMocks();
  mocks.player.mockResolvedValue({ id: 'qa-player', allianceId: null });
  mocks.findUnique.mockResolvedValue({
    id: 'qa-roster', playerId: 'qa-player', stars: 7,
    player: { allianceId: null, ingameName: 'QA' },
  });
  mocks.update.mockResolvedValue({ id: 'qa-roster', rank: 4 });
  mocks.remove.mockResolvedValue({ id: 'qa-roster' });
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
