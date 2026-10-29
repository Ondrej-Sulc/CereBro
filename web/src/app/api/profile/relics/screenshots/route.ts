import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import sharp from 'sharp';
import { prisma } from '@/lib/prisma';
import { getUserPlayerWithAlliance } from '@/lib/auth-helpers';
import { withRouteContext } from '@/lib/with-request-context';
import { boundedRelicBody, sameRelicOrigin } from '@/lib/relic-request';
import logger from '@/lib/logger';
import { getRosterScreenshotQuota } from '@cerebro/core/services/rosterScreenshotQuotaService';
import { loadScreenshotRelics, parseRelicScreenshot } from '@cerebro/core/services/relicScreenshotService';
import { getPlayerRelicState, importPlayerRelics, PlayerRelicError } from '@cerebro/core/services/playerRelicService';

export const maxDuration = 60;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
function failure(error: unknown) {
  if (error instanceof PlayerRelicError) return json({ error: error.message }, error.status);
  if (error instanceof RangeError) return json({ error: error.message }, 413);
  if (error instanceof z.ZodError || error instanceof SyntaxError) return json({ error: 'Check the selected relics and builds.' }, 400);
  logger.error({ error }, 'Relic screenshot request failed');
  return json({ error: 'Could not process this screenshot. Your relics have not been changed.' }, 500);
}

// OCR creates a review preview only. Reserve usage before the external request, including failed attempts.
export const POST = withRouteContext(async (req: NextRequest) => {
  let eventId: string | undefined;
  const started = Date.now();
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) return json({ error: 'Sign in and select a game profile first.' }, 401);
    if (!sameRelicOrigin(req)) return json({ error: 'Invalid request origin.' }, 403);
    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.startsWith('multipart/form-data;')) return json({ error: 'Screenshot upload required.' }, 415);
    const bytes = await boundedRelicBody(req, 8 * 1024 * 1024);
    const form = await new Response(bytes, { headers: { 'content-type': contentType } }).formData();
    if (form.get('profileId') !== player.id) return json({ error: 'Your active profile changed. Refresh before importing.' }, 409);
    const file = form.get('image');
    if (!(file instanceof File) || form.getAll('image').length !== 1 || file.size === 0)
      return json({ error: 'Choose one screenshot per scan.' }, 400);
    const image = Buffer.from(await file.arrayBuffer());
    try {
      const meta = await sharp(image, { limitInputPixels: 24_000_000 }).metadata();
      if (!['png', 'jpeg', 'webp'].includes(meta.format ?? '') || !meta.width || !meta.height || meta.width < 500 || meta.height < 250 || (meta.pages ?? 1) > 1)
        return json({ error: 'Use an original PNG, JPEG or WebP My Relics screenshot.' }, 422);
    } catch { return json({ error: 'This image could not be read or is too large.' }, 422); }
    const reservation = await prisma.$transaction(async tx => {
      const actor = player.botUserId || player.discordId || player.id;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(718264, hashtext(${actor}))`;
      const quota = await getRosterScreenshotQuota({ playerId: player.id, botUserId: player.botUserId, discordId: player.discordId, allianceId: player.allianceId }, 1, { prisma: tx });
      if (!quota.allowed) return { quota, id: null };
      const event = await tx.rosterUploadEvent.create({ data: {
        source: 'web', mode: 'relics', status: 'processing', fileCount: 1, visionRequestCount: 1,
        actorPlayerId: player.id, targetPlayerId: player.id, actorBotUserId: player.botUserId, discordUserId: player.discordId, allianceId: player.allianceId,
      }, select: { id: true } });
      return { quota, id: event.id };
    });
    if (!reservation.id) return json({ error: `You have used ${reservation.quota.used}/${reservation.quota.limit} screenshots this month.`, ...reservation.quota }, 403);
    eventId = reservation.id;
    const catalog = await loadScreenshotRelics(prisma);
    let rows;
    try { rows = await parseRelicScreenshot(image, catalog); }
    catch (cause) { throw new PlayerRelicError(cause instanceof Error ? cause.message : 'Could not read the relic cards.', 422); }
    await prisma.rosterUploadEvent.update({ where: { id: eventId }, data: { status: 'success', successCount: 1, durationMs: Date.now()-started, metadata: { detectedRelics: rows.length } } });
    return json({ profileId: player.id, rows, inventory: { profile: { id: player.id, name: player.ingameName }, ...await getPlayerRelicState(prisma, player.id) } });
  } catch (error) {
    if (eventId) await prisma.rosterUploadEvent.update({ where: { id: eventId }, data: { status: 'failed', errorCount: 1, durationMs: Date.now()-started } }).catch(cause => logger.error({ cause }, 'Could not finalize relic screenshot usage'));
    return failure(error);
  }
});

export const PUT = withRouteContext(async (req: NextRequest) => {
  try {
    const player = await getUserPlayerWithAlliance();
    if (!player) return json({ error: 'Sign in and select a game profile first.' }, 401);
    if (!sameRelicOrigin(req)) return json({ error: 'Invalid request origin.' }, 403);
    if (!req.headers.get('content-type')?.includes('application/json')) return json({ error: 'JSON request required.' }, 415);
    const { profileId, ...data } = z.object({ profileId: z.string() }).passthrough().parse(JSON.parse(new TextDecoder().decode(await boundedRelicBody(req, 64 * 1024))));
    if (profileId !== player.id) return json({ error: 'Your active profile changed. Refresh before importing.' }, 409);
    const inventory = { profile: { id: player.id, name: player.ingameName }, ...await importPlayerRelics(prisma, player.id, data) };
    revalidatePath('/relics', 'layout'); revalidatePath('/profile/relics'); revalidatePath('/profile'); revalidatePath(`/player/${player.id}`);
    return json({ inventory });
  } catch (error) { return failure(error); }
});
