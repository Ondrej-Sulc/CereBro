import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { auth as youtubeAuth } from 'googleapis/build/src/apis/youtube';
import { NextRequest } from 'next/server';
import { GET as authorize } from './auth/route';
import { GET as callback } from './callback/route';

const mocks = vi.hoisted(() => ({
  admin: vi.fn(), session: vi.fn(), getCookie: vi.fn(), setCookie: vi.fn(), deleteCookie: vi.fn(),
  findConfig: vi.fn(), upsertConfig: vi.fn(), transaction: vi.fn(),
}));
vi.mock('@/lib/auth-helpers', () => ({ isUserBotAdmin: mocks.admin }));
vi.mock('@/auth', () => ({ auth: mocks.session }));
vi.mock('next/headers', () => ({ cookies: async () => ({
  get: mocks.getCookie, set: mocks.setCookie, delete: mocks.deleteCookie,
}) }));
vi.mock('@/lib/prisma', () => ({ prisma: {
  systemConfig: { findUnique: mocks.findConfig, upsert: mocks.upsertConfig }, $transaction: mocks.transaction,
} }));
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/with-request-context', () => ({ withRouteContext: (handler: unknown) => handler }));

const request = (query = '') => new NextRequest(`https://cerebro.example/api/admin/youtube/callback${query}`);

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('NEXTAUTH_URL', 'https://cerebro.example');
  vi.stubEnv('YOUTUBE_CLIENT_ID', 'test-client');
  vi.stubEnv('YOUTUBE_CLIENT_SECRET', 'test-secret');
  mocks.admin.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ user: { id: 'admin' } });
  mocks.getCookie.mockReturnValue({ value: 'expected-state' });
  mocks.findConfig.mockResolvedValue(null);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('generates the real OAuth URL with the client, callback, scope and cookie-bound state', async () => {
  const response = await authorize(request());
  const url = new URL(response.headers.get('location')!);
  expect(url.origin).toBe('https://accounts.google.com');
  expect(Object.fromEntries(url.searchParams)).toMatchObject({
    client_id: 'test-client', redirect_uri: 'https://cerebro.example/api/admin/youtube/callback',
    scope: 'https://www.googleapis.com/auth/youtube.upload', access_type: 'offline', prompt: 'consent',
  });
  expect(mocks.setCookie).toHaveBeenCalledWith('youtube_oauth_state', url.searchParams.get('state'),
    expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 300, path: '/api/admin/youtube/callback' }));
  expect(url.searchParams.get('state')).toMatch(/^[a-f0-9-]{36}$/);
});

it('rejects authorization by a non-admin before creating OAuth state', async () => {
  mocks.admin.mockResolvedValue(false);
  expect((await authorize(request())).status).toBe(403);
  expect(mocks.setCookie).not.toHaveBeenCalled();
});

it('rejects a mismatched callback state before exchanging a code or writing tokens', async () => {
  const exchange = vi.spyOn(youtubeAuth.OAuth2.prototype, 'getToken');
  expect((await callback(request('?code=test-code&state=wrong'))).status).toBe(400);
  expect(mocks.deleteCookie).toHaveBeenCalledWith('youtube_oauth_state');
  expect(exchange).not.toHaveBeenCalled();
  expect(mocks.transaction).not.toHaveBeenCalled();
});

it('exchanges an authorized callback code and stores both token records atomically', async () => {
  const tokens = { access_token: 'test-access', refresh_token: 'test-refresh' };
  const exchange = vi.spyOn(youtubeAuth.OAuth2.prototype, 'getToken').mockImplementation(async () => ({ tokens, res: null }));
  const response = await callback(request('?code=test-code&state=expected-state'));
  expect(exchange).toHaveBeenCalledWith('test-code');
  expect(response.headers.get('location')).toBe('https://cerebro.example/admin/youtube?success=true');
  expect(mocks.upsertConfig).toHaveBeenCalledWith(expect.objectContaining({
    where: { key: 'YOUTUBE_TOKENS' }, update: { value: JSON.stringify(tokens) },
  }));
  expect(mocks.upsertConfig).toHaveBeenCalledWith(expect.objectContaining({
    where: { key: 'YOUTUBE_REFRESH_TOKEN' }, update: { value: 'test-refresh' },
  }));
  expect(mocks.transaction).toHaveBeenCalledOnce();
});

it('preserves the existing refresh token when Google returns only an access token', async () => {
  vi.spyOn(youtubeAuth.OAuth2.prototype, 'getToken').mockImplementation(async () => ({ tokens: { access_token: 'new-access' }, res: null }));
  mocks.findConfig.mockResolvedValue({ value: JSON.stringify({ refresh_token: 'old-refresh' }) });
  expect((await callback(request('?code=test-code&state=expected-state'))).headers.get('location'))
    .toBe('https://cerebro.example/admin/youtube?success=true');
  expect(mocks.upsertConfig).toHaveBeenCalledWith(expect.objectContaining({
    where: { key: 'YOUTUBE_REFRESH_TOKEN' }, update: { value: 'old-refresh' },
  }));
});
