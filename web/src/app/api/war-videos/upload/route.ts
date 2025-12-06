import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getYouTubeService } from '@cerebro/core/services/youtubeService';
import { parseFormData } from '@/lib/parseFormData';
import { existsSync } from 'fs';
import fs from 'fs/promises';
import { validateUploadToken, processNewFights, processFightUpdates, queueVideoNotification } from '@/lib/api/submission-helpers';

export async function POST(req: NextRequest) {
  const { fields, tempFilePath } = await parseFormData(req);

  try {
    const {
      token, playerId, visibility, title, description,
      fightIds: existingFightIdsJson,
      fightUpdates: fightUpdatesJson,
      fights: newFightsJson,
      season, warNumber, warTier, battlegroup, mapType
    } = fields;

    const parsedSeason = parseInt(season);
    const parsedWarNumber = warNumber ? parseInt(warNumber) : null;

    // 1. Validation
    const auth = await validateUploadToken(prisma, token, true);
    if (!auth.success) {
       if (tempFilePath && existsSync(tempFilePath)) await fs.unlink(tempFilePath);
       return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { player, uploadToken } = auth;
    const isTrusted = player.isTrustedUploader;

    if (!tempFilePath || !existsSync(tempFilePath)) {
      return NextResponse.json({ error: 'No video file found' }, { status: 400 });
    }

    // 2. Process Fights
    let fightIdsToLink: string[] = [];

    if (newFightsJson) {
        const newFights = JSON.parse(newFightsJson);
        if (!Array.isArray(newFights) || newFights.length === 0) throw new Error("Invalid new fights data");
        
        fightIdsToLink = await processNewFights(prisma, {
            allianceId: player.allianceId!,
            season: parsedSeason,
            warNumber: parsedWarNumber,
            warTier: parseInt(warTier),
            battlegroup: parseInt(battlegroup),
            mapType: mapType === 'BIG_THING' ? 'BIG_THING' : 'STANDARD',
            fights: newFights,
            playerId: playerId || player.id
        });
    } else if (fightUpdatesJson) {
        const updates = JSON.parse(fightUpdatesJson);
        if (!Array.isArray(updates) || updates.length === 0) throw new Error("Invalid fight updates data");
        fightIdsToLink = await processFightUpdates(prisma, updates);
    } else if (existingFightIdsJson) {
        try {
            fightIdsToLink = JSON.parse(existingFightIdsJson);
        } catch (e) { throw new Error("Invalid existing fight IDs"); }
        if (!Array.isArray(fightIdsToLink) || fightIdsToLink.length === 0) throw new Error("Existing fight IDs must be an array");
    } else {
        if (tempFilePath && existsSync(tempFilePath)) await fs.unlink(tempFilePath);
        return NextResponse.json({ error: "No fight data provided" }, { status: 400 });
    }

    // 3. Upload Video
    const youTubeService = getYouTubeService();
    const youtubeVideoId = await youTubeService.uploadVideo(tempFilePath, title, description, 'unlisted');
    if (!youtubeVideoId) throw new Error('YouTube upload failed');
    const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

    // 4. Create WarVideo & Link
    const newWarVideo = await prisma.warVideo.create({
      data: {
        url: youtubeUrl,
        description,
        status: isTrusted ? 'PUBLISHED' : 'UPLOADED',
        visibility: visibility || 'public',
        submittedBy: { connect: { id: uploadToken.playerId } },
      },
    });

    await prisma.warFight.updateMany({
      where: { id: { in: fightIdsToLink } },
      data: { videoId: newWarVideo.id },
    });

    // 5. Notification
    await queueVideoNotification(prisma, {
        alliance: player.alliance!,
        uploaderName: player.ingameName,
        videoId: newWarVideo.id,
        title,
        description,
        season: parsedSeason,
        warNumber: parsedWarNumber
    });

    // 6. Cleanup
    await fs.unlink(tempFilePath);

    return NextResponse.json({ message: 'Videos uploaded successfully', videoIds: [newWarVideo.id] }, { status: 200 });

  } catch (error: any) {
    console.error('Upload error:', error);
    if (tempFilePath && existsSync(tempFilePath)) await fs.unlink(tempFilePath);
    
    // Check for specific YouTube API quota error
    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      const youtubeError = error.errors[0];
      if (youtubeError.reason === 'uploadLimitExceeded' || youtubeError.reason === 'quotaExceeded') {
        return NextResponse.json({ error: 'YouTube Upload Quota Exceeded', details: youtubeError.message }, { status: 429 });
      }
    }

    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}