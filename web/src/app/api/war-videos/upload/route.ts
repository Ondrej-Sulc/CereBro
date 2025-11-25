import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getYouTubeService } from '@cerebro/core/services/youtubeService';
import { parseFormData } from '@/lib/parseFormData';
import { existsSync } from 'fs';
import fs from 'fs/promises';

export async function POST(req: NextRequest) {
  const { fields, tempFilePath } = await parseFormData(req);

  try {
    const {
      token, playerId, visibility, title, description, mode,
      fightIds: existingFightIdsJson, // For linking to existing fights
      fightUpdates: fightUpdatesJson, // For updating existing fights
      fights: newFightsJson,         // For creating new fights
      season, warNumber, warTier, battlegroup
    } = fields;

    // --- 1. Authentication & Authorization ---
    if (!token) {
      return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
    }
    const uploadToken = await prisma.uploadToken.findUnique({
      where: { token },
      include: { player: true },
    });
    if (!uploadToken || uploadToken.expiresAt < new Date()) {
      if (uploadToken) await prisma.uploadToken.delete({ where: { id: uploadToken.id } });
      return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 401 });
    }
    const { player } = uploadToken;
    const isTrusted = player.isTrustedUploader;

    // --- 2. File Validation ---
    if (!tempFilePath || !existsSync(tempFilePath)) {
      return NextResponse.json({ error: 'No video file uploaded or file not found' }, { status: 400 });
    }

    // --- 3. Determine fight processing strategy ---
    let fightIdsToLink: string[];

    if (newFightsJson) {
      // Logic for new fight creation (manual upload without pre-filled fights)
      // 3.1. Parse new fights data
      const newFights = JSON.parse(newFightsJson);
      if (!Array.isArray(newFights) || newFights.length === 0) {
        return NextResponse.json({ error: 'Invalid or empty fights data for new creation.' }, { status: 400 });
      }

      // 3.2. Validate war details
      if (!season || !warTier || !battlegroup) {
        return NextResponse.json({ error: 'Missing war details for new fight creation.' }, { status: 400 });
      }

      // 3.3. Find/Create Alliance War
      const allianceId = uploadToken.player.allianceId;
      if (!allianceId) {
        return NextResponse.json({ error: 'Player submitting new fights is not in an alliance.' }, { status: 400 });
      }

      const parsedWarNumber = warNumber ? parseInt(warNumber) : null;
      const parsedSeason = parseInt(season);
      const parsedWarTier = parseInt(warTier);
      const parsedBattlegroup = parseInt(battlegroup); // this battlegroup is for all fights in this submission

      // For offseason wars (warNumber is null), we need to find or create differently
      let war;
      if (parsedWarNumber === null) {
        // For offseason, find the most recent offseason war or create a new one
        war = await prisma.war.findFirst({
          where: {
            allianceId: allianceId,
            season: parsedSeason,
            warNumber: null,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (!war) {
          war = await prisma.war.create({
            data: {
              season: parsedSeason,
              warTier: parsedWarTier,
              warNumber: null,
              allianceId: allianceId,
            },
          });
        } else {
          // Update the tier if needed
          war = await prisma.war.update({
            where: { id: war.id },
            data: { warTier: parsedWarTier },
          });
        }
      } else {
        // For regular wars, use upsert with the unique constraint
        war = await prisma.war.upsert({
          where: {
            allianceId_season_warNumber: {
              allianceId: allianceId,
              season: parsedSeason,
              warNumber: parsedWarNumber,
            },
          },
          update: { warTier: parsedWarTier },
          create: {
            season: parsedSeason,
            warTier: parsedWarTier,
            warNumber: parsedWarNumber,
            allianceId: allianceId,
          },
        });
      }

      // 3.4. Create WarFights
      const createdFights = await Promise.all(newFights.map(async (fight: any) => {
        return prisma.warFight.create({
          data: {
            warId: war.id,
            playerId: uploadToken.playerId, // Submitting player
            nodeId: parseInt(fight.nodeId),
            attackerId: parseInt(fight.attackerId),
            defenderId: parseInt(fight.defenderId),
            death: fight.death,
            battlegroup: parsedBattlegroup,
            prefightChampions: fight.prefightChampionIds && fight.prefightChampionIds.length > 0 ? {
              connect: fight.prefightChampionIds.map((id: string) => ({ id: parseInt(id) }))
            } : undefined,
          }
        });
      }));
      fightIdsToLink = createdFights.map(f => f.id);

    } else if (fightUpdatesJson) {
      // Logic for updating existing fights (from pre-filled plans with edits)
      const updates = JSON.parse(fightUpdatesJson);
      if (!Array.isArray(updates) || updates.length === 0) {
        return NextResponse.json({ error: 'fightUpdates must be a non-empty array.' }, { status: 400 });
      }

      fightIdsToLink = [];
      await Promise.all(updates.map(async (update: any) => {
          await prisma.warFight.update({
            where: { id: update.id },
            data: {
              nodeId: parseInt(update.nodeId),
              attackerId: parseInt(update.attackerId),
              defenderId: parseInt(update.defenderId),
              death: update.death,
              battlegroup: update.battlegroup ? parseInt(update.battlegroup) : undefined,
              prefightChampions: {
                set: update.prefightChampionIds ? update.prefightChampionIds.map((id: string) => ({ id: parseInt(id) })) : []
              }
            }
          });
          fightIdsToLink.push(update.id);
      }));

    } else if (existingFightIdsJson) {
      // Logic for linking to existing fights (from pre-filled plans)
      try {
        fightIdsToLink = JSON.parse(existingFightIdsJson);
      } catch (e) {
        return NextResponse.json({ error: 'Invalid existingFightIds data format.' }, { status: 400 });
      }
      if (!Array.isArray(fightIdsToLink) || fightIdsToLink.length === 0) {
        return NextResponse.json({ error: 'existingFightIds must be a non-empty array.' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'No fight data provided.' }, { status: 400 });
    }

    // --- 4. Upload to YouTube ---
    const youTubeService = getYouTubeService();
    const youtubeVideoId = await youTubeService.uploadVideo(tempFilePath, title, description, 'unlisted');
    if (!youtubeVideoId) throw new Error('YouTube upload failed to return an ID.');
    const youtubeUrl = youTubeService.getVideoUrl(youtubeVideoId);

    const createdVideoIds: string[] = [];

    // --- 5. Create WarVideo and link to WarFights ---
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
      where: {
        id: { in: fightIdsToLink },
      },
      data: {
        videoId: newWarVideo.id,
      },
    });
    createdVideoIds.push(newWarVideo.id);

    // --- 6. Cleanup ---
    await fs.unlink(tempFilePath);

    return NextResponse.json({ message: 'Videos uploaded successfully', videoIds: createdVideoIds }, { status: 200 });
  } catch (error: any) {
    console.error('War video upload error:', error);
    // Ensure the temporary file is deleted even if an error occurs
    if (tempFilePath && existsSync(tempFilePath)) {
      await fs.unlink(tempFilePath);
    }

    // Check for specific YouTube API quota error
    if (error.errors && Array.isArray(error.errors) && error.errors.length > 0) {
      const youtubeError = error.errors[0];
      if (youtubeError.reason === 'uploadLimitExceeded' || youtubeError.reason === 'quotaExceeded') {
        return NextResponse.json({ error: 'YouTube Upload Quota Exceeded', details: youtubeError.message }, { status: 429 }); // 429 Too Many Requests
      }
    }

    return NextResponse.json({ error: 'Failed to upload war video', details: error.message }, { status: 500 });
  }
}