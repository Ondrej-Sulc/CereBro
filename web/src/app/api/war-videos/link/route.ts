import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@/lib/logger';
import { validateUploadToken, FightMismatchError } from '@/lib/api/submission-helpers';
import { submitWarRecording, WarRecordingAccessError } from '@/lib/api/war-recording-submission';
import { withRouteContext } from '@/lib/with-request-context';

export const POST = withRouteContext(async req => {
  try {
    const body = await req.json();
    const auth = await validateUploadToken(prisma, body.token, false);
    if (!auth.success) return NextResponse.json({ error: auth.error }, { status: auth.status });
    if (!body.videoUrl || typeof body.videoUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid videoUrl' }, { status: 400 });
    }
    const result = await submitWarRecording(prisma, auth.player, {
      url: body.videoUrl.trim(), description: body.description, visibility: body.visibility,
      fights: body.fights, fightUpdates: body.fightUpdates,
      fightIds: typeof body.fightIds === 'string' ? JSON.parse(body.fightIds) : body.fightIds,
      season: parseInt(body.season), warNumber: body.warNumber ? parseInt(body.warNumber) : null,
      warTier: parseInt(body.warTier), battlegroup: parseInt(body.battlegroup),
      mapType: body.mapType === 'BIG_THING' ? 'BIG_THING' : 'STANDARD',
      playerId: body.playerId, customPlayerName: body.customPlayerName, isGlobal: body.isGlobal === true,
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err }, 'Link error');
    return NextResponse.json({ error: err.message || 'Link failed' }, { status: error instanceof WarRecordingAccessError ? 403 : error instanceof FightMismatchError ? 409 : 500 });
  }
});
