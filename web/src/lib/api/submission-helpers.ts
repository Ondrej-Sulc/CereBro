import { PrismaClient, WarMapType } from '@prisma/client';
import logger from '@cerebro/core/services/loggerService';
import crypto from 'crypto';

export type ValidationResult = 
  | { success: true; player: any; uploadToken: any }
  | { success: false; error: string; status: number };

const GLOBAL_ALLIANCE_ID = "GLOBAL";

export async function validateUploadToken(
  prisma: PrismaClient, 
  token: string, 
  requireFileUploadPermission: boolean
): Promise<ValidationResult> {
  if (!token) {
    logger.warn("Upload token validation failed: Missing token");
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
    logger.warn({ token }, "Upload token validation failed: Invalid or expired");
    if (uploadToken) await prisma.uploadToken.delete({ where: { id: uploadToken.id } });
    return { success: false, error: 'Invalid or expired upload token', status: 401 };
  }

  const { player } = uploadToken;

  if (requireFileUploadPermission) {
    if (!player.alliance?.canUploadFiles) {
        logger.warn({ playerId: player.id, allianceId: player.allianceId }, "Upload restricted: Alliance permission denied");
        return { success: false, error: 'Direct video upload is restricted to authorized alliances only.', status: 403 };
    }
  }

  logger.info({ playerId: player.id, token }, "Upload token validated successfully");
  return { success: true, player, uploadToken };
}

export async function processNewFights(
    prisma: PrismaClient,
    params: {
        allianceId: string | null;
        season: number;
        warNumber: number | null;
        warTier: number;
        battlegroup: number;
        mapType: WarMapType;
        fights: any[];
        playerId: string;
        customPlayerName?: string;
        isGlobal?: boolean; // New param
    }
): Promise<string[]> {
    const { allianceId, season, warNumber, warTier, battlegroup, mapType, fights, playerId, customPlayerName, isGlobal } = params;

    logger.info({ allianceId, season, warNumber, warTier, battlegroup, mapType, isGlobal }, "Processing new fights");

    let targetAllianceId = allianceId;
    let targetBattlegroup = battlegroup;

    // Handle "Global/Mercenary" Uploads (No Alliance OR Forced Global)
    if (!targetAllianceId || isGlobal) {
        logger.info("No alliance ID provided or Global mode forced. Falling back to Global/Mercenary Alliance.");
        
        // Ensure the Global Alliance exists
        const globalAlliance = await prisma.alliance.upsert({
            where: { id: GLOBAL_ALLIANCE_ID },
            update: {},
            create: {
                id: GLOBAL_ALLIANCE_ID,
                guildId: "GLOBAL",
                name: "Mercenaries (Global)",
                canUploadFiles: false, // Strict default
            }
        });
        
        targetAllianceId = globalAlliance.id;
        targetBattlegroup = 0; // Force BG 0 for global uploads
    }

    // Resolve Player (Existing ID vs Custom Name)
    let finalPlayerId = playerId;
    if (customPlayerName && (!playerId || playerId === "")) {
        logger.info({ customPlayerName }, "Resolving custom player name");
        // Try to find existing player by name (case-insensitive search would be better but exact match for now)
        // Prisma default is case-sensitive usually unless configured otherwise.
        let player = await prisma.player.findFirst({
            where: { 
                ingameName: {
                    equals: customPlayerName,
                    mode: 'insensitive' 
                } 
            }
        });

        if (!player) {
            logger.info("Creating new Guest Player");
            const guestId = `guest_${crypto.randomBytes(8).toString('hex')}`;
            
            player = await prisma.player.create({
                data: {
                    ingameName: customPlayerName,
                    discordId: guestId,
                    isActive: false,
                    // If context is Global, we can link them to Global Alliance so they appear in lists?
                    // Or keep them alliance-less. Let's keep them alliance-less to avoid cluttering the Mercenaries roster excessively unless needed.
                    allianceId: null, 
                }
            });
        }
        finalPlayerId = player.id;
    }

    // 1. Find or Create War
    let war;
    if (warNumber === null) {
        // Offseason
        war = await prisma.war.findFirst({
            where: {
                allianceId: targetAllianceId,
                season,
                warNumber: null,
                mapType,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!war) {
            logger.info("Creating new Offseason war");
            war = await prisma.war.create({
                data: {
                    season,
                    warTier,
                    warNumber: null,
                    enemyAlliance: 'Offseason',
                    allianceId: targetAllianceId,
                    mapType,
                    status: 'FINISHED',
                },
            });
        } else {
            logger.info({ warId: war.id }, "Updating existing Offseason war");
            war = await prisma.war.update({
                where: { id: war.id },
                data: { warTier, status: 'FINISHED' }, // Update tier just in case
            });
        }
    } else {
        // Regular War
        logger.info("Upserting Regular War");
        war = await prisma.war.upsert({
            where: {
                allianceId_season_warNumber: {
                    allianceId: targetAllianceId,
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
                allianceId: targetAllianceId,
                mapType,
                status: 'FINISHED',
            },
        });
    }

    // 2. Create Fights
    const createdFights = await Promise.all(fights.map(async (fight: any) => {
        const fightData = {
            warId: war.id,
            playerId: finalPlayerId, // Use resolved player ID
            nodeId: parseInt(fight.nodeId),
            attackerId: parseInt(fight.attackerId),
            defenderId: parseInt(fight.defenderId),
            death: fight.death,
            battlegroup: targetBattlegroup,
            prefightChampions: fight.prefightChampionIds && fight.prefightChampionIds.length > 0 ? {
              create: fight.prefightChampionIds
                  .map((id: string) => parseInt(id))
                  .filter((id: number) => !isNaN(id))
                  .map((id: number) => ({ championId: id, playerId: finalPlayerId }))
            } : undefined,
        };
        
        logger.debug({ nodeId: fightData.nodeId, attackerId: fightData.attackerId }, "Processing fight entry");

        if (warNumber === null) {
            // Offseason: Always create
            return prisma.warFight.create({ data: fightData });
        } else {
            // Regular War: Enforce uniqueness
            const existingFight = await prisma.warFight.findFirst({
                where: {
                    warId: war.id,
                    battlegroup: targetBattlegroup,
                    nodeId: parseInt(fight.nodeId),
                }
            });

            if (existingFight) {
                logger.info({ fightId: existingFight.id }, "Updating existing fight");
                return prisma.warFight.update({
                    where: { id: existingFight.id },
                    data: {
                        playerId: finalPlayerId, // Use resolved player ID
                        attackerId: parseInt(fight.attackerId),
                        defenderId: parseInt(fight.defenderId),
                        death: fight.death,
                        prefightChampions: {
                            deleteMany: {},
                            create: fight.prefightChampionIds && fight.prefightChampionIds.length > 0 
                                ? fight.prefightChampionIds
                                    .map((id: string) => parseInt(id))
                                    .filter((id: number) => !isNaN(id))
                                    .map((id: number) => ({ championId: id, playerId: finalPlayerId })) 
                                : []
                        }
                    }
                });
            } else {
                logger.info("Creating new fight");
                return prisma.warFight.create({ data: fightData });
            }
        }
    }));

    return createdFights.map(f => f.id);
}

export async function processFightUpdates(prisma: PrismaClient, updates: any[]): Promise<string[]> {
    const ids: string[] = [];
    logger.info({ count: updates.length }, "Processing fight updates");
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
                    deleteMany: {},
                    create: update.prefightChampionIds 
                        ? update.prefightChampionIds
                            .map((id: string) => parseInt(id))
                            .filter((id: number) => !isNaN(id))
                            .map((id: number) => ({ championId: id })) 
                        : []
                }
            }
        });
        ids.push(update.id);
    }));
    return ids;
}

export async function queueVideoNotification(
    prisma: PrismaClient, 
    params: { videoId: string; title: string; }
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

    if (!video || !video.submittedBy.alliance?.warVideosChannelId) {
        logger.info({ videoId: params.videoId }, "Skipping notification: No channel ID or video not found");
        return;
    }

    const fights = video.fights;
    // Fallback for season/warNumber if no fights attached (unlikely but possible)
    const season = fights.length > 0 ? fights[0].war.season : 0;
    const warNumber = fights.length > 0 ? fights[0].war.warNumber : null;

    const payload = {
        channelId: video.submittedBy.alliance.warVideosChannelId,
        videoId: video.id,
        mediaUrl: video.url || video.gcsUrl,
        title: params.title, // Use title from parameters
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

    logger.info({ videoId: video.id, channelId: payload.channelId }, "Queuing video notification job");
    await prisma.botJob.create({
        data: {
            type: 'NOTIFY_WAR_VIDEO',
            payload
        }
    });
}
