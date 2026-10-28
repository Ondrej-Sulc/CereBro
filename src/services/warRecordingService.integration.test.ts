import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { appendFightRecording, detachFightRecording } from './warRecordingService';
import { randomUUID } from 'crypto';
import { fightHasRecording } from '../domain/war-recordings';

const databaseUrl = process.env.WAR_RECORDINGS_TEST_DATABASE_URL;
const suite = databaseUrl ? describe : describe.skip;

suite('fight recording persistence', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl || "postgresql://127.0.0.1:5432/recordings_test_disabled" } } });
  const prefix = `recordings-test-${randomUUID()}`;
  let warId: string;
  let playerId: string;
  let nodeId: number;
  const videos: string[] = [];
  beforeAll(async () => {
    const database = new URL(databaseUrl!);
    if (!['localhost', '127.0.0.1', 'postgres'].includes(database.hostname) || !database.pathname.includes('recordings_test')) {
      throw new Error('Recording integration tests require an isolated local recordings_test database');
    }
    await prisma.alliance.create({ data: { id: prefix, name: prefix, guildId: prefix } });
    const player = await prisma.player.create({ data: { discordId: prefix, ingameName: prefix, allianceId: prefix } });
    playerId = player.id;
    const war = await prisma.war.create({ data: { allianceId: prefix, season: 1, warNumber: 1, warTier: 1 } });
    warId = war.id;
    const node = await prisma.warNode.upsert({ where: { nodeNumber: 9999 }, update: {}, create: { nodeNumber: 9999 } });
    nodeId = node.id;
    for (let index = 0; index < 3; index++) {
      videos.push((await prisma.warVideo.create({ data: { submittedById: playerId, url: `https://example.com/${prefix}/${index}` } })).id);
    }
  });
  afterAll(async () => {
    if (!playerId) { await prisma.$disconnect(); return; }
    await prisma.warVideo.deleteMany({ where: { submittedById: playerId } });
    await prisma.war.deleteMany({ where: { allianceId: prefix } });
    await prisma.player.deleteMany({ where: { id: playerId } });
    await prisma.alliance.deleteMany({ where: { id: prefix } });
    await prisma.$disconnect();
  });
  const createFight = () => prisma.warFight.create({ data: { warId, playerId, nodeId, battlegroup: 1, death: 2 } });

  it('requires a real recording when filtering recorded fights', async () => {
    const fight = await createFight();
    expect(await prisma.warFight.count({ where: { AND: [{ id: fight.id }, fightHasRecording()] } })).toBe(0);
    await prisma.$transaction(tx => appendFightRecording(tx, [fight.id], videos[0]));
    expect(await prisma.warFight.count({ where: { AND: [{ id: fight.id }, fightHasRecording()] } })).toBe(1);
  });

  it('appends and deduplicates without changing the fight or total deaths', async () => {
    const fight = await createFight();
    for (const video of [videos[0], videos[1], videos[1]]) {
      await prisma.$transaction(tx => appendFightRecording(tx, [fight.id], video));
    }
    const saved = await prisma.warFight.findUniqueOrThrow({ where: { id: fight.id }, include: { recordings: { orderBy: { position: 'asc' } } } });
    expect(saved.death).toBe(2);
    expect(saved.attackerId).toBeNull();
    expect(saved.videoId).toBe(videos[0]);
    expect(saved.recordings.map(recording => recording.videoId)).toEqual(videos.slice(0, 2));
  });

  it('serializes concurrent additions to the same fight', async () => {
    const fight = await createFight();
    await Promise.all(videos.map(video => prisma.$transaction(tx => appendFightRecording(tx, [fight.id], video))));
    const links = await prisma.warFightVideo.findMany({ where: { fightId: fight.id }, orderBy: { position: 'asc' } });
    expect(new Set(links.map(link => link.videoId)).size).toBe(3);
    expect(links.map(link => link.position)).toEqual([0, 1, 2]);
  });

  it('detaches one recording without deleting fights or recordings shared elsewhere', async () => {
    const first = await createFight();
    const second = await createFight();
    await prisma.$transaction(tx => appendFightRecording(tx, [first.id, second.id], videos[0]));
    await prisma.$transaction(tx => appendFightRecording(tx, [first.id], videos[1]));
    await prisma.$transaction(tx => detachFightRecording(tx, [first.id], videos[0]));
    expect((await prisma.warFight.findUniqueOrThrow({ where: { id: first.id } })).videoId).toBe(videos[1]);
    expect(await prisma.warFightVideo.count({ where: { fightId: second.id, videoId: videos[0] } })).toBe(1);
    expect(await prisma.warVideo.count({ where: { id: videos[0] } })).toBe(1);
  });

  it('preserves videos written through the legacy field during rollout', async () => {
    const fight = await createFight();
    await prisma.warFight.update({ where: { id: fight.id }, data: { videoId: videos[0] } });
    await prisma.warFight.update({ where: { id: fight.id }, data: { videoId: videos[1] } });
    const links = await prisma.warFightVideo.findMany({ where: { fightId: fight.id }, orderBy: { position: 'asc' } });
    expect(links.map(link => link.videoId)).toEqual(videos.slice(0, 2));
  });
});
