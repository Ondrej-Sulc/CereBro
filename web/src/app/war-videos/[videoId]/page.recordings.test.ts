import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ video: vi.fn(), fights: vi.fn(), notFound: vi.fn() }));
vi.mock('@cerebro/core/services/prismaService', () => ({ prisma: { warVideo: { findUnique: mocks.video }, warFight: { findMany: mocks.fights } } }));
vi.mock('@/lib/auth-helpers', () => ({ getUserPlayerWithAlliance: async () => null }));
vi.mock('@/lib/admin-war-video-auth', () => ({ canManageWarVideos: async () => false }));
vi.mock('@/lib/war-video-edit-auth', () => ({ getWarVideoEditAccess: async () => ({ canEdit: false, isAdmin: false, playerIds: [] }) }));
vi.mock('next/navigation', () => ({ notFound: mocks.notFound }));
vi.mock('./WarVideoDisplay', () => ({ default: () => null }));
import WarVideoPage from './page';

const published = { id: 'public', url: 'https://example.com/public', description: 'Public recording', visibility: 'public', status: 'PUBLISHED', submittedById: 'owner' };
const hidden = { id: 'private', url: 'https://example.com/private-recording', description: 'Private description', visibility: 'alliance', status: 'PUBLISHED', submittedById: 'owner' };

describe('public fight recording playback', () => {
  beforeEach(() => {
    vi.stubGlobal('React', React);
    mocks.notFound.mockImplementation(() => { throw new Error('Not found'); });
    mocks.video.mockResolvedValue({ ...published, submittedBy: { id: 'owner' } });
    mocks.fights.mockResolvedValue([{
      id: 'fight', playerId: 'owner', videoId: published.id, video: published,
      war: { allianceId: 'alliance', warTier: null },
      recordings: [{ position: 0, video: published }, { position: 1, video: hidden }],
    }]);
  });

  it('sends only visible recording metadata to the client player', async () => {
    const element = await WarVideoPage({ params: Promise.resolve({ videoId: 'public' }) });
    const payload = element.props.warVideo;
    expect(payload.fights[0].videos).toEqual([{ id: 'public', description: 'Public recording' }]);
    expect(payload.fights[0].recordings).toBeUndefined();
    expect(payload.fights[0].video).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain(hidden.url);
    expect(JSON.stringify(payload)).not.toContain(hidden.description);
  });

  it('does not grant access to a private recording through a public sibling', async () => {
    mocks.video.mockResolvedValue({ ...hidden, submittedBy: { id: 'owner' } });
    await expect(WarVideoPage({ params: Promise.resolve({ videoId: 'private' }) })).rejects.toThrow('Not found');
  });
});
