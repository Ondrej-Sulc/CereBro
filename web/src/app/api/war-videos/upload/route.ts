import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { getYouTubeService } from '@cerebro/core/services/youtubeService';
import { parseFormData } from '@/lib/parseFormData';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { validateUploadToken, FightMismatchError } from '@/lib/api/submission-helpers';
import { submitWarRecording, WarRecordingAccessError } from '@/lib/api/war-recording-submission';
import { withRouteContext } from '@/lib/with-request-context';

export const POST = withRouteContext(async (req: NextRequest) => {
  let tempFilePath: string | null = null;
  let uploadedYoutubeId: string | null = null;
  let saved = false;

  try {
    const { fields, tempFilePath: path } = await parseFormData(req);
    tempFilePath = path;

    const {
      token, playerId, visibility, title, description,
      fightIds: existingFightIdsJson,
      fightUpdates: fightUpdatesJson,
      fights: newFightsJson,
      season, warNumber, warTier, battlegroup, mapType,
      customPlayerName,
      isGlobal
    } = fields;

    const parsedSeason = parseInt(season);
    const parsedWarNumber = warNumber ? parseInt(warNumber) : null;
    const parsedWarTier = parseInt(warTier);
    const parsedBattlegroup = parseInt(battlegroup);

    logger.info({
        parsedSeason, parsedWarNumber, parsedWarTier, parsedBattlegroup, mapType,
        newFightsCount: newFightsJson ? JSON.parse(newFightsJson).length : 0
    }, "Processing upload request");

    // 1. Validation
    const auth = await validateUploadToken(prisma, token, true);
    if (!auth.success) {
       if (tempFilePath && existsSync(tempFilePath)) await fs.unlink(tempFilePath);
       return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { player } = auth;

    if (!tempFilePath || !existsSync(tempFilePath)) {
      return NextResponse.json({ error: 'No video file found' }, { status: 400 });
    }

    // 3. Upload Video
    const youTubeService = getYouTubeService();

    logger.info({ title, tempFilePath }, "YouTube upload started");
    const youtubeVideoId = await youTubeService.uploadVideo(tempFilePath, title, description, 'unlisted');

    if (!youtubeVideoId) throw new Error('YouTube upload failed');
    uploadedYoutubeId = youtubeVideoId;
    logger.info({ youtubeVideoId }, "YouTube upload completed");

    const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

    const result = await submitWarRecording(prisma, player, {
      url: youtubeUrl, description, visibility, title,
      fights: newFightsJson ? JSON.parse(newFightsJson) : undefined,
      fightUpdates: fightUpdatesJson ? JSON.parse(fightUpdatesJson) : undefined,
      fightIds: existingFightIdsJson ? JSON.parse(existingFightIdsJson) : undefined,
      season: parsedSeason, warNumber: parsedWarNumber,
      warTier: parsedWarTier, battlegroup: parsedBattlegroup,
      mapType: mapType === 'BIG_THING' ? 'BIG_THING' : 'STANDARD',
      playerId, customPlayerName, isGlobal: isGlobal === 'true',
    });
    saved = true;

    // 6. Cleanup
    await fs.unlink(tempFilePath).catch(error => logger.warn({ error }, 'Could not clean up uploaded video temporary file'));

    return NextResponse.json(result, { status: 200 });

  } catch (error: unknown) {
    interface ApiError extends Error {
        meta?: unknown;
        errors?: { reason: string; message: string }[];
        response?: {
            data?: {
                error?: {
                    errors?: { reason: string; message: string }[];
                }
            }
        };
    }
    const err = error as ApiError;
    if (uploadedYoutubeId && !saved) {
      await getYouTubeService().deleteVideo(uploadedYoutubeId).catch(error => logger.error({ error }, 'Could not clean up unlinked YouTube upload'));
    }
    logger.error({
      error: err,
      message: err.message,
      meta: err.meta,
      stack: err.stack
    }, 'Upload error detail');

    if (tempFilePath && existsSync(tempFilePath)) await fs.unlink(tempFilePath);

    if (error instanceof FightMismatchError) {
      return NextResponse.json({
        error: 'Fight details do not match this war',
        details: error.message,
      }, { status: 409 });
    }

    if (error instanceof WarRecordingAccessError) return NextResponse.json({ error: error.message }, { status: 403 });

    // Check for specific YouTube API quota error
    const errors = err.errors || err.response?.data?.error?.errors;
    if (errors && Array.isArray(errors) && errors.length > 0) {
      const youtubeError = errors[0];
      if (youtubeError.reason === 'uploadLimitExceeded' || youtubeError.reason === 'quotaExceeded') {
        return NextResponse.json({ error: 'YouTube Upload Quota Exceeded', details: youtubeError.message }, { status: 429 });
      }
    }

    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
});
