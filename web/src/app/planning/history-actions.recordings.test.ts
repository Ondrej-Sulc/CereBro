import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'crypto';

const state = vi.hoisted(() => ({ allianceId: '' }));
vi.mock('@/auth', () => ({ auth: async () => ({ user: { id: 'recordings-test' } }) }));
vi.mock('@/lib/with-request-context', () => ({ withActionContext: (_name: string, fn: unknown) => fn }));
vi.mock('@/lib/auth-helpers', () => ({ getUserPlayerWithAlliance: async () => ({ id: 'viewer', allianceId: state.allianceId }) }));
vi.mock('@/lib/prisma', async () => {
  const { PrismaClient } = await import('@prisma/client');
  return { prisma: new PrismaClient({ datasources: { db: { url: process.env.WAR_RECORDINGS_TEST_DATABASE_URL || "postgresql://127.0.0.1:5432/recordings_test_disabled" } } }) };
});
import { prisma } from '@/lib/prisma';
import { getBatchHistoricalCounters, getHistoricalCounters } from './history-actions';

const suite = process.env.WAR_RECORDINGS_TEST_DATABASE_URL ? describe : describe.skip;
suite('historical fight recordings', () => {
  const prefix = `recording-history-${randomUUID()}`;
  let attackerId: number;
  let defenderId: number;
  let playerId: string;
  let publicVideoId: string;
  beforeAll(async () => {
    const url = new URL(process.env.WAR_RECORDINGS_TEST_DATABASE_URL!);
    if (!['localhost', '127.0.0.1', 'postgres'].includes(url.hostname) || !url.pathname.includes('recordings_test')) throw new Error('Isolated recordings_test database required');
    await prisma.alliance.create({ data: { id: prefix, name: prefix, guildId: prefix } });
    playerId = (await prisma.player.create({ data: { discordId: prefix, ingameName: prefix, allianceId: prefix } })).id;
    const champions = await Promise.all(['attacker', 'defender'].map(name => prisma.champion.create({ data: {
      name: `${prefix}-${name}`, shortName: name, class: 'COSMIC', releaseDate: new Date(), obtainable: [], images: {}, fullAbilities: {},
    } })));
    [attackerId, defenderId] = champions.map(champion => champion.id);
    const node = await prisma.warNode.upsert({ where: { nodeNumber: 9998 }, update: {}, create: { nodeNumber: 9998 } });
    const war = await prisma.war.create({ data: { allianceId: prefix, season: 61, warNumber: 1, warTier: 1, status: 'FINISHED' } });
    for (let index = 0; index < 2; index++) {
      const fight = await prisma.warFight.create({ data: { warId: war.id, nodeId: node.id, attackerId, defenderId, playerId, battlegroup: 1, death: index === 0 ? 1 : 0 } });
      for (let position = 0; position < (index === 0 ? 2 : 1); position++) {
        const video = await prisma.warVideo.create({ data: { url: `https://example.com/${prefix}/${index}/${position}`, submittedById: playerId, status: 'PUBLISHED', visibility: index === 0 ? 'public' : 'alliance' } });
        await prisma.warFightVideo.create({ data: { fightId: fight.id, videoId: video.id, position } });
        if (!position) {
          await prisma.warFight.update({ where: { id: fight.id }, data: { videoId: video.id } });
          if (!index) publicVideoId = video.id;
        }
      }
    }
  });
  afterAll(async () => {
    if (!playerId) { await prisma.$disconnect(); return; }
    await prisma.warVideo.deleteMany({ where: { submittedById: playerId } });
    await prisma.war.deleteMany({ where: { allianceId: prefix } });
    await prisma.player.deleteMany({ where: { id: playerId } });
    await prisma.champion.deleteMany({ where: { id: { in: [attackerId, defenderId] } } });
    await prisma.alliance.deleteMany({ where: { id: prefix } });
    await prisma.$disconnect();
  });

  it('counts recordings independently of fights/deaths and keeps the sampled URL with its ID', async () => {
    const stats = await getBatchHistoricalCounters([{ nodeNumber: 9998, defenderId }], { allianceId: prefix });
    expect(stats[9998][0]).toMatchObject({ totalFights: 2, deaths: 1, solos: 1, videoCount: 2, sampleVideoInternalId: publicVideoId });
    expect(stats[9998][0].sampleVideoUrl).toBe(`https://example.com/${prefix}/0/0`);
  });

  it('returns all visible recordings without multiplying player/fight records', async () => {
    const [stats] = await getHistoricalCounters(9998, defenderId, { allianceId: prefix });
    expect(stats).toMatchObject({ totalFights: 2, deaths: 1, solos: 1, videoCount: 2 });
    expect(stats.players).toHaveLength(2);
    expect(stats.players.map(player => player.videoIds?.length).sort()).toEqual([0, 2]);
    state.allianceId = prefix;
    const alliedStats = await getBatchHistoricalCounters([{ nodeNumber: 9998, defenderId }], { allianceId: prefix });
    expect(alliedStats[9998][0].videoCount).toBe(3);
  });
});
