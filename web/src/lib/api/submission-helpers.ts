import { PrismaClient, WarMapType } from '@prisma/client';

export type ValidationResult = 
  | { success: true; player: any; uploadToken: any }
  | { success: false; error: string; status: number };

export async function validateUploadToken(
  prisma: PrismaClient, 
  token: string, 
  requireFileUploadPermission: boolean
): Promise<ValidationResult> {
  if (!token) {
    return { success: false, error: 'Missing upload token', status: 400 };
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
    return { success: false, error: 'Invalid or expired upload token', status: 401 };
  }

  const { player } = uploadToken;

  if (requireFileUploadPermission) {
    if (!player.alliance?.canUploadFiles) {
        return { success: false, error: 'Direct video upload is restricted to authorized alliances only.', status: 403 };
    }
  }

  return { success: true, player, uploadToken };
}

export async function processNewFights(
    prisma: PrismaClient,
    params: {
        allianceId: string;
        season: number;
        warNumber: number | null;
        warTier: number;
        battlegroup: number;
        mapType: WarMapType;
        fights: any[];
        playerId: string;
    }
): Promise<string[]> {
    const { allianceId, season, warNumber, warTier, battlegroup, mapType, fights, playerId } = params;

    // 1. Find or Create War
    let war;
    if (warNumber === null) {
        // Offseason
        war = await prisma.war.findFirst({
            where: {
                allianceId,
                season,
                warNumber: null,
                mapType,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!war) {
            war = await prisma.war.create({
                data: {
                    season,
                    warTier,
                    warNumber: null,
                    enemyAlliance: 'Offseason',
                    allianceId,
                    mapType,
                    status: 'FINISHED',
                },
            });
        } else {
            war = await prisma.war.update({
                where: { id: war.id },
                data: { warTier, status: 'FINISHED' }, // Update tier just in case
            });
        }
    } else {
        // Regular War
        war = await prisma.war.upsert({
            where: {
                allianceId_season_warNumber: {
                    allianceId,
                    season,
                    warNumber,
                },
            },
            update: { 
                warTier,
                mapType,
                status: 'FINISHED',
            },
            create: {
                season,
                warTier,
                warNumber,
                allianceId,
                mapType,
                status: 'FINISHED',
            },
        });
    }

    // 2. Create Fights
    const createdFights = await Promise.all(fights.map(async (fight: any) => {
        const fightData = {
            warId: war.id,
            playerId: playerId,
            nodeId: parseInt(fight.nodeId),
            attackerId: parseInt(fight.attackerId),
            defenderId: parseInt(fight.defenderId),
            death: fight.death,
            battlegroup: battlegroup,
            prefightChampions: fight.prefightChampionIds && fight.prefightChampionIds.length > 0 ? {
              connect: fight.prefightChampionIds.map((id: string) => ({ id: parseInt(id) }))
            } : undefined,
        };

        if (warNumber === null) {
            // Offseason: Always create
            return prisma.warFight.create({ data: fightData });
        } else {
            // Regular War: Enforce uniqueness
            const existingFight = await prisma.warFight.findFirst({
                where: {
                    warId: war.id,
                    battlegroup: battlegroup,
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

    return createdFights.map(f => f.id);
}

export async function processFightUpdates(prisma: PrismaClient, updates: any[]): Promise<string[]> {
    const ids: string[] = [];
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
        ids.push(update.id);
    }));
    return ids;
}

export async function queueVideoNotification(
    prisma: PrismaClient, 
    params: { videoId: string }
) {
    const video = await prisma.warVideo.findUnique({
        where: { id: params.videoId },
        include: {
            submittedBy: { include: { alliance: true } },
            fights: {
                include: {
                    attacker: true,
                    defender: true,
                    node: true,
                    player: true,
                    war: true
                }
            }
        }
    });

    if (!video || !video.submittedBy.alliance?.warVideosChannelId) return;

    const fights = video.fights;
    // Fallback for season/warNumber if no fights attached (unlikely but possible)
    const season = fights.length > 0 ? fights[0].war.season : 0;
    const warNumber = fights.length > 0 ? fights[0].war.warNumber : null;

    const payload = {
        channelId: video.submittedBy.alliance.warVideosChannelId,
        videoId: video.id,
        title: 'New War Video',
        description: video.description,
        uploaderName: video.submittedBy.ingameName,
        season: season,
        warNumber: warNumber,
        fights: fights.map(f => ({
            attackerName: f.attacker?.name || 'Unknown',
            defenderName: f.defender?.name || 'Unknown',
            nodeNumber: f.node.nodeNumber,
            playerInVideo: f.player?.ingameName || 'Unknown'
        }))
    };

    await prisma.botJob.create({
        data: {
            type: 'NOTIFY_WAR_VIDEO',
            payload
        }
    });
}
