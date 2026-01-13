import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import logger from '@cerebro/core/services/loggerService';
import { validateUploadToken, processNewFights, processFightUpdates, queueVideoNotification } from '@/lib/api/submission-helpers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
        token, playerId, videoUrl, description, visibility,
        fightIds: existingFightIdsJson,
        fightUpdates,
        fights: newFightsJson,
        season, warNumber, warTier, battlegroup, mapType,
        customPlayerName, // Extract customPlayerName
        isGlobal // Extract isGlobal
    } = body;

    const parsedSeason = parseInt(season);
    const parsedWarNumber = warNumber ? parseInt(warNumber) : null;

    // 1. Validation
    // Pass false because link submission is allowed for everyone (file upload is restricted)
    const auth = await validateUploadToken(prisma, token, false);
    if (!auth.success) {
       return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { player, uploadToken } = auth;
    const isTrusted = player.isTrustedUploader;

    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid videoUrl' }, { status: 400 });
    }

    // 2. Process Fights
    let fightIdsToLink: string[] = [];

    if (newFightsJson) {
        const newFights = newFightsJson; 
        if (!Array.isArray(newFights) || newFights.length === 0) throw new Error("Invalid new fights data");
        
        // Allowed: Users without alliance (will be routed to Global Alliance in helper)
        fightIdsToLink = await processNewFights(prisma, {
            allianceId: player.allianceId,
            season: parsedSeason,
            warNumber: parsedWarNumber,
            warTier: parseInt(warTier),
            battlegroup: parseInt(battlegroup),
            mapType: mapType === 'BIG_THING' ? 'BIG_THING' : 'STANDARD',
            fights: newFights,
            // If custom name is provided, allow playerId to be empty (it will be resolved in helper).
            // Otherwise, fallback to the uploader's ID if no specific player selected.
            playerId: customPlayerName ? (playerId || "") : (playerId || player.id),
            customPlayerName,
            isGlobal // Pass isGlobal
        });
    } else if (fightUpdates) {
        if (!Array.isArray(fightUpdates) || fightUpdates.length === 0) throw new Error("Invalid fight updates data");
        fightIdsToLink = await processFightUpdates(prisma, fightUpdates);
    } else if (existingFightIdsJson) {
        if (Array.isArray(existingFightIdsJson)) {
            fightIdsToLink = existingFightIdsJson;
        } else {
            try {
                fightIdsToLink = JSON.parse(existingFightIdsJson);
            } catch { throw new Error("Invalid existing fight IDs format"); }
        }
        if (!Array.isArray(fightIdsToLink) || fightIdsToLink.length === 0) throw new Error("Existing fight IDs must be an array");
    } else {
        return NextResponse.json({ error: "No fight data provided" }, { status: 400 });
    }

    // 3. Upsert WarVideo
    const warVideo = await prisma.warVideo.upsert({
      where: { url: videoUrl },
      update: {},
      create: {
        url: videoUrl,
        description,
        status: isTrusted ? 'PUBLISHED' : 'UPLOADED',
        visibility: visibility || 'public',
        submittedBy: { connect: { id: uploadToken.playerId } },
      },
    });

    await prisma.warFight.updateMany({
      where: { id: { in: fightIdsToLink } },
      data: { videoId: warVideo.id },
    });

    // 4. Notification
    await queueVideoNotification(prisma, { videoId: warVideo.id, title: 'New War Video Linked' });

    return NextResponse.json({ message: 'Video linked successfully', videoIds: [warVideo.id] }, { status: 200 });

  } catch (error: unknown) {
    const err = error as Error;
    logger.error({ error: err }, 'Link error');
    return NextResponse.json({ error: err.message || 'Link failed' }, { status: 500 });
  }
}