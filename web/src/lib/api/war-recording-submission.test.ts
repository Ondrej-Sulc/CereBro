import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
vi.mock('@/lib/logger', () => ({ default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { submitWarRecording, type RecordingSubmission } from './war-recording-submission';
import { syncWarVideoEditedFights } from './submission-helpers';

const suite = process.env.WAR_RECORDINGS_TEST_DATABASE_URL ? describe : describe.skip;
suite('war recording submissions and edits', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: process.env.WAR_RECORDINGS_TEST_DATABASE_URL || "postgresql://127.0.0.1:5432/recordings_test_disabled" } } });
  const prefix = `recording-submit-${randomUUID()}`;
  let player: Awaited<ReturnType<typeof prisma.player.findUniqueOrThrow>> & { alliance: Awaited<ReturnType<typeof prisma.alliance.findUniqueOrThrow>> };
  let attackerId: number;
  let defenderId: number;
  let nodeId: number;
  const source = (name: string) => `https://example.com/${prefix}/${name}`;
  beforeAll(async () => {
    const url = new URL(process.env.WAR_RECORDINGS_TEST_DATABASE_URL!);
    if (!['localhost', '127.0.0.1', 'postgres'].includes(url.hostname) || !url.pathname.includes('recordings_test')) throw new Error('Isolated recordings_test database required');
    await prisma.alliance.create({ data: { id: prefix, name: prefix, guildId: prefix } });
    player = await prisma.player.create({ data: { discordId: prefix, ingameName: prefix, allianceId: prefix, isTrustedUploader: true }, include: { alliance: true } }) as typeof player;
    [attackerId, defenderId] = await Promise.all(['attacker', 'defender'].map(async name => (await prisma.champion.create({ data: {
      name: `${prefix}-${name}`, shortName: name, class: 'COSMIC', releaseDate: new Date(), obtainable: [], images: {}, fullAbilities: {},
    } })).id));
    nodeId = (await prisma.warNode.upsert({ where: { nodeNumber: 9997 }, update: {}, create: { nodeNumber: 9997 } })).id;
  });
  afterAll(async () => {
    if (!player) { await prisma.$disconnect(); return; }
    await prisma.warVideo.deleteMany({ where: { submittedById: player.id } });
    await prisma.war.deleteMany({ where: { allianceId: prefix } });
    await prisma.player.deleteMany({ where: { id: player.id } });
    await prisma.champion.deleteMany({ where: { id: { in: [attackerId, defenderId] } } });
    await prisma.alliance.deleteMany({ where: { id: prefix } });
    await prisma.$disconnect();
  });
  const fightInput = () => ({ nodeId: String(nodeId), attackerId: String(attackerId), defenderId: String(defenderId), death: 1 });
  const input = (name: string): RecordingSubmission => ({ url: source(name), season: 61, warNumber: null, warTier: 1, battlegroup: 1, mapType: 'STANDARD', fights: [fightInput()] });

  it('attaches multiple recordings to one new offseason fight and deduplicates a retry', async () => {
    const first = await submitWarRecording(prisma, player, input('first'));
    const nextInput = { ...input('second'), fights: undefined, fightIds: first.fightIds };
    await submitWarRecording(prisma, player, nextInput);
    expect((await submitWarRecording(prisma, player, nextInput)).added).toBe(false);
    const fight = await prisma.warFight.findUniqueOrThrow({ where: { id: first.fightIds[0] }, include: { recordings: true } });
    expect(fight).toMatchObject({ death: 1, attackerId, defenderId });
    expect(fight.recordings).toHaveLength(2);
  });

  it('editing a second recording detaches only its association and keeps the other video', async () => {
    const first = await submitWarRecording(prisma, player, input('edit-first'));
    const second = await submitWarRecording(prisma, player, { ...input('edit-second'), fights: undefined, fightIds: first.fightIds });
    const result = await syncWarVideoEditedFights(prisma, {
      videoId: second.videoIds[0], allianceId: prefix, season: 61, warNumber: null, warTier: 1, battlegroup: 1, mapType: 'STANDARD',
      playerId: player.id, fights: [fightInput()], videoUpdates: { url: source('edited'), description: 'Finishing attempt', visibility: 'public' },
    });
    expect(result.fightIds[0]).not.toBe(first.fightIds[0]);
    const original = await prisma.warFight.findUniqueOrThrow({ where: { id: first.fightIds[0] }, include: { recordings: true } });
    expect(original.death).toBe(1);
    expect(original.recordings.map(recording => recording.videoId)).toEqual(first.videoIds);
    expect((await prisma.warVideo.findUniqueOrThrow({ where: { id: second.videoIds[0] } })).url).toBe(source('edited'));
  });

  it('rolls back fight edits when updating the recording fails', async () => {
    const first = await submitWarRecording(prisma, player, input('rollback-first'));
    const second = await submitWarRecording(prisma, player, input('rollback-second'));
    await expect(syncWarVideoEditedFights(prisma, {
      videoId: first.videoIds[0], allianceId: prefix, season: 61, warNumber: null, warTier: 1, battlegroup: 1, mapType: 'STANDARD',
      playerId: player.id, fights: [{ ...fightInput(), id: first.fightIds[0], death: 99 }],
      videoUpdates: { url: source('rollback-second'), description: '', visibility: 'public' },
    })).rejects.toThrow();
    expect((await prisma.warFight.findUniqueOrThrow({ where: { id: first.fightIds[0] } })).death).toBe(1);
    expect(await prisma.warVideo.count({ where: { id: second.videoIds[0] } })).toBe(1);
  });

  it('rejects an unrelated uploader without creating a recording or changing the fight', async () => {
    const first = await submitWarRecording(prisma, player, input('access-first'));
    const unrelated = { ...player, id: `${prefix}-unrelated`, allianceId: null, alliance: null, botUserId: null };
    await expect(submitWarRecording(prisma, unrelated, {
      ...input('denied'), fights: undefined, fightIds: first.fightIds,
    })).rejects.toThrow('permission');
    expect(await prisma.warVideo.count({ where: { url: source('denied') } })).toBe(0);
  });
});
