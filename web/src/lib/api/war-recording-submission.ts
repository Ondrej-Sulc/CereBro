import { PrismaClient, Player, Alliance } from '@prisma/client';
import { appendFightRecording } from '@cerebro/core/services/warRecordingService';
import { fightHasRecording } from '@cerebro/core/domain/war-recordings';
import { processNewFights, processFightUpdates, queueVideoNotification, FightInput, FightUpdate } from './submission-helpers';

export type RecordingSubmission = {
  url: string;
  description?: string;
  visibility?: string;
  fightIds?: string[];
  fightUpdates?: FightUpdate[];
  fights?: FightInput[];
  season: number;
  warNumber: number | null;
  warTier: number;
  battlegroup: number;
  mapType: 'STANDARD' | 'BIG_THING';
  playerId?: string;
  customPlayerName?: string;
  isGlobal?: boolean;
  title?: string;
};

export class WarRecordingAccessError extends Error {}

/** Fight resolution, video creation and the append either all commit or all roll back. */
export async function submitWarRecording(prisma: PrismaClient, player: Player & { alliance: Alliance | null }, input: RecordingSubmission) {
  return prisma.$transaction(async tx => {
    const existingVideo = await tx.warVideo.findUnique({ where: { url: input.url } });
    const admin = player.botUserId ? await tx.botUser.findUnique({ where: { id: player.botUserId }, select: { isBotAdmin: true } }) : null;
    if (existingVideo && existingVideo.submittedById !== player.id && !admin?.isBotAdmin &&
      !(existingVideo.status === 'PUBLISHED' && existingVideo.visibility === 'public')) {
      const sameAlliance = existingVideo.status === 'PUBLISHED' && existingVideo.visibility === 'alliance' && player.allianceId && player.allianceId !== 'GLOBAL'
        ? await tx.warFight.count({ where: { AND: [fightHasRecording({ id: existingVideo.id }), { war: { allianceId: player.allianceId } }] } }) : 0;
      if (!sameAlliance) throw new WarRecordingAccessError('You do not have permission to link this recording');
    }
    let fightIds: string[];
    if (input.fights?.length) {
      fightIds = await processNewFights(tx, {
        ...input,
        allianceId: player.allianceId,
        fights: input.fights,
        playerId: input.customPlayerName ? input.playerId || '' : input.playerId || player.id,
      });
    } else {
      const ids = input.fightUpdates?.map(fight => fight.id) || input.fightIds || [];
      if (!ids.length || ids.some(id => typeof id !== 'string' || !id)) throw new Error('No fight data provided');
      const fights = await tx.warFight.findMany({
        where: { id: { in: ids } },
        select: { id: true, playerId: true, war: { select: { allianceId: true } },
          recordings: { where: { video: { submittedById: player.id } }, select: { videoId: true } },
          video: { select: { submittedById: true } },
        },
      });
      if (fights.length !== new Set(ids).size || fights.some(fight => !admin?.isBotAdmin &&
        fight.playerId !== player.id &&
        !(player.allianceId && player.allianceId !== 'GLOBAL' && fight.war.allianceId === player.allianceId) &&
        !fight.recordings.length && fight.video?.submittedById !== player.id)) {
        throw new WarRecordingAccessError('You do not have permission to add recordings to these fights');
      }
      fightIds = input.fightUpdates ? await processFightUpdates(tx, input.fightUpdates) : ids;
    }
    const video = await tx.warVideo.upsert({
      where: { url: input.url },
      update: {},
      create: {
        url: input.url,
        description: input.description,
        visibility: input.visibility === 'alliance' ? 'alliance' : 'public',
        status: player.isTrustedUploader ? 'PUBLISHED' : 'UPLOADED',
        submittedById: player.id,
      },
    });
    const addedFightIds = await appendFightRecording(tx, fightIds, video.id);
    if (addedFightIds.length) await queueVideoNotification(tx, { videoId: video.id, title: input.title || 'New War Video Linked' });
    return { videoIds: [video.id], fightIds, added: addedFightIds.length > 0 };
  });
}
