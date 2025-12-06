import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendDiscordMessage } from '@/lib/discord';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
        token, playerId, videoUrl, description, visibility,
        fightIds: existingFightIdsJson, // for existing fights
        fightUpdates,                   // for updating existing fights
        fights: newFightsJson,         // for creating new fights
        season, warNumber, warTier, battlegroup, mapType
    } = body;

    // --- 1. Authentication & Authorization ---
    if (!token) {
      return NextResponse.json({ error: 'Missing upload token' }, { status: 400 });
    }
    const uploadToken = await prisma.uploadToken.findUnique({
      where: { token },
      include: { 
        player: {
          include: { alliance: true }
        } 
      },
    });
    if (!uploadToken || uploadToken.expiresAt < new Date()) {
      if (uploadToken) await prisma.uploadToken.delete({ where: { id: uploadToken.id } });
      return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 401 });
    }
    const { player } = uploadToken;
    const isTrusted = player.isTrustedUploader;

    // --- 2. Input Validation (videoUrl) ---
    if (!videoUrl || typeof videoUrl !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid videoUrl' }, { status: 400 });
    }

    // --- 3. Determine fight processing strategy ---
    let fightIdsToLink: string[];

    if (newFightsJson) {
      // Logic for new fight creation (manual link without pre-filled fights)
      // 3.1. Parse new fights data
      const newFights = newFightsJson; // Already parsed from JSON body
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
      const parsedMapType = mapType === 'BIG_THING' ? 'BIG_THING' : 'STANDARD';

      let war;
      if (parsedWarNumber !== null) {
        // For regular wars, use upsert with the unique constraint
        war = await prisma.war.upsert({
          where: {
            allianceId_season_warNumber: {
              allianceId: allianceId,
              season: parsedSeason,
              warNumber: parsedWarNumber,
            },
          },
          update: {
            warTier: parsedWarTier,
            mapType: parsedMapType,
            status: 'FINISHED',
          },
          create: {
            season: parsedSeason,
            warTier: parsedWarTier,
            warNumber: parsedWarNumber,
            allianceId: allianceId,
            mapType: parsedMapType,
            status: 'FINISHED',
          },
        });
      } else {
        // For offseason wars (warNumber is null), find the most recent offseason war or create a new one
        war = await prisma.war.findFirst({
          where: {
            allianceId: allianceId,
            season: parsedSeason,
            warNumber: null,
            mapType: parsedMapType,
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
              mapType: parsedMapType,
              status: 'FINISHED',
            },
          });
        } else {
          // Update the tier and status if needed
          war = await prisma.war.update({
            where: { id: war.id },
            data: { warTier: parsedWarTier, status: 'FINISHED' },
          });
        }
      }

      // 3.4. Create WarFights
      const createdFights = await Promise.all(newFights.map(async (fight: any) => {
        const fightData = {
            warId: war.id,
            playerId: playerId,
            nodeId: parseInt(fight.nodeId),
            attackerId: parseInt(fight.attackerId),
            defenderId: parseInt(fight.defenderId),
            death: fight.death,
            battlegroup: parsedBattlegroup,
            prefightChampions: fight.prefightChampionIds && fight.prefightChampionIds.length > 0 ? {
              connect: fight.prefightChampionIds.map((id: string) => ({ id: parseInt(id) }))
            } : undefined,
        };

        if (parsedWarNumber === null) {
            // Offseason: Always create
            return prisma.warFight.create({ data: fightData });
        } else {
            // Regular War: Enforce uniqueness
            const existingFight = await prisma.warFight.findFirst({
                where: {
                    warId: war.id,
                    battlegroup: parsedBattlegroup,
                    nodeId: parseInt(fight.nodeId),
                }
            });

            if (existingFight) {
                return prisma.warFight.update({
                    where: { id: existingFight.id },
                    data: {
                        playerId: playerId,
                        attackerId: parseInt(fight.attackerId),
                        defenderId: parseInt(fight.defenderId),
                        death: fight.death,
                        prefightChampions: {
                            set: fight.prefightChampionIds && fight.prefightChampionIds.length > 0
                                ? fight.prefightChampionIds.map((id: string) => ({ id: parseInt(id) }))
                                : []
                        }
                    }
                });
            } else {
                return prisma.warFight.create({ data: fightData });
            }
        }
      }));
      fightIdsToLink = createdFights.map(f => f.id);

    } else if (fightUpdates) {
      // Logic for updating existing fights
      if (!Array.isArray(fightUpdates) || fightUpdates.length === 0) {
        return NextResponse.json({ error: 'fightUpdates must be a non-empty array.' }, { status: 400 });
      }

      fightIdsToLink = [];
      await Promise.all(fightUpdates.map(async (update: any) => {
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
      if (Array.isArray(existingFightIdsJson)) {
        fightIdsToLink = existingFightIdsJson;
      } else {
        try {
          fightIdsToLink = JSON.parse(existingFightIdsJson);
        } catch (e) {
          return NextResponse.json({ error: 'Invalid existingFightIds data format.' }, { status: 400 });
        }
      }
      if (!Array.isArray(fightIdsToLink) || fightIdsToLink.length === 0) {
        return NextResponse.json({ error: 'existingFightIds must be a non-empty array.' }, { status: 400 });
      }
    } else {
        return NextResponse.json({ error: 'No fight data provided.' }, { status: 400 });
    }

    // --- 4. Upsert WarVideo and link to WarFights ---
    const warVideo = await prisma.warVideo.upsert({
      where: { url: videoUrl },
      update: {}, // If it exists, we don't need to update anything
      create: {
        url: videoUrl,
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
        videoId: warVideo.id,
      },
    });

    // --- 5. Notification ---
    if (uploadToken.player.alliance?.warVideosChannelId) {
        const channelId = uploadToken.player.alliance.warVideosChannelId;
        const uploaderName = uploadToken.player.ingameName;
        const webUrl = process.env.BOT_BASE_URL || 'https://cerebro-bot.com';
        const videoPageUrl = `${webUrl}/war-videos/${warVideo.id}`;

        let warDisplay = `S${season}`;
        if (warNumber && warNumber !== '0') {
            warDisplay += ` W${warNumber}`;
        } else {
            warDisplay += ` (Offseason)`;
        }

        await sendDiscordMessage(channelId, {
            embeds: [{
                title: '🎥 New War Video Linked',
                description: `**[Watch Video](${videoPageUrl})**\n\n${description || ''}`,
                color: 0x0ea5e9,
                fields: [
                    { name: 'Uploader', value: uploaderName, inline: true },
                    { name: 'War', value: warDisplay, inline: true },
                ],
                footer: { text: 'Click the link to watch and view fight details.' }
            }]
        });
    }

    return NextResponse.json({ message: 'Video linked successfully', videoIds: [warVideo.id] }, { status: 200 });
  } catch (error: any) {
    console.error('War video link error:', error);
    return NextResponse.json({ error: 'Failed to link war video', details: error.message }, { status: 500 });
  }
}
