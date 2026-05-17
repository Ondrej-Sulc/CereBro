import { Prisma, PrismaClient, WarMapType, Player, UploadToken, Alliance } from '@prisma/client';
import logger from "@/lib/logger";
import crypto from 'crypto';

export class FightMismatchError extends Error {
    constructor(
        public readonly mismatches: { nodeId: number; submittedAttackerId: number; existingAttackerId: number | null; submittedDefenderId: number; existingDefenderId: number | null }[],
        public readonly warDetails: { season: number; warNumber: number; battlegroup: number }
    ) {
        const nodeList = mismatches.map(m => `node ${m.nodeId}`).join(', ');
        super(
            `The fight details you submitted don't match the existing data for Season ${warDetails.season}, War ${warDetails.warNumber}, BG${warDetails.battlegroup} ` +
            `on ${nodeList}. You may have entered the wrong war number. No data was changed.`
        );
        this.name = 'FightMismatchError';
    }
}

export type ValidationResult = 
  | { success: true; player: Player & { alliance: Alliance | null }; uploadToken: UploadToken }
  | { success: false; error: string; status: number };

const GLOBAL_ALLIANCE_ID = "GLOBAL";

interface FightInput {
    nodeId: string;
    attackerId: string;
    defenderId: string;
    death: number;
    prefightChampionIds?: string[];
}

interface FightUpdate extends FightInput {
    id: string;
    battlegroup?: string;
}

export type EditableFightInput = FightInput & {
    id?: string;
};

export type SyncWarVideoEditParams = {
    videoId: string;
    allianceId: string | null;
    season: number;
    warNumber: number | null;
    warTier: number;
    battlegroup: number;
    mapType: WarMapType;
    fights: EditableFightInput[];
    playerId: string;
    customPlayerName?: string;
    isGlobal?: boolean;
};

type PrismaLike = PrismaClient | Prisma.TransactionClient;

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
    prisma: PrismaLike,
    params: {
        allianceId: string | null;
        season: number;
        warNumber: number | null;
        warTier: number;
        battlegroup: number;
        mapType: WarMapType;
        fights: FightInput[];
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

    // 2. Resolve fight IDs — match submitted fights against existing records
    if (warNumber !== null) {
        // Regular war: fights already exist from war planning, just verify and link
        const nodeIds = fights.map(f => parseInt(f.nodeId));
        const existingFights = await prisma.warFight.findMany({
            where: {
                warId: war.id,
                battlegroup: targetBattlegroup,
                nodeId: { in: nodeIds },
            },
            select: { id: true, nodeId: true, attackerId: true, defenderId: true },
        });

        const existingByNode = new Map(existingFights.map(f => [f.nodeId, f]));

        // Check every submitted fight matches the existing record for that node
        const mismatches = fights.flatMap(fight => {
            const nodeId = parseInt(fight.nodeId);
            const existing = existingByNode.get(nodeId);
            if (!existing) return []; // fight not in DB yet — will be created below
            const attackerMatch = existing.attackerId === parseInt(fight.attackerId);
            const defenderMatch = existing.defenderId === parseInt(fight.defenderId);
            if (!attackerMatch || !defenderMatch) {
                return [{
                    nodeId,
                    submittedAttackerId: parseInt(fight.attackerId),
                    existingAttackerId: existing.attackerId,
                    submittedDefenderId: parseInt(fight.defenderId),
                    existingDefenderId: existing.defenderId,
                }];
            }
            return [];
        });

        if (mismatches.length > 0) {
            logger.warn({ warId: war.id, mismatches }, "Upload rejected: submitted fight details don't match existing war data");
            throw new FightMismatchError(mismatches, { season, warNumber: warNumber!, battlegroup: targetBattlegroup });
        }

        // All verified — return existing IDs (and create any that don't exist yet)
        const fightIds: string[] = [];
        await Promise.all(fights.map(async fight => {
            const nodeId = parseInt(fight.nodeId);
            const existing = existingByNode.get(nodeId);
            if (existing) {
                fightIds.push(existing.id);
            } else {
                logger.info({ nodeId }, "Fight not found in DB, creating");
                const created = await prisma.warFight.create({
                    data: {
                        warId: war.id,
                        playerId: finalPlayerId,
                        nodeId,
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
                    },
                });
                fightIds.push(created.id);
            }
        }));
        return fightIds;
    }

    // 3. Offseason / no war number: always create fights
    const createdFights = await Promise.all(fights.map(async (fight: FightInput) => {
        logger.debug({ nodeId: fight.nodeId, attackerId: fight.attackerId }, "Creating offseason fight entry");
        return prisma.warFight.create({
            data: {
                warId: war.id,
                playerId: finalPlayerId,
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
            },
        });
    }));

    return createdFights.map(f => f.id);
}

export async function processFightUpdates(prisma: PrismaLike, updates: FightUpdate[]): Promise<string[]> {
    const ids: string[] = [];
    logger.info({ count: updates.length }, "Processing fight updates");
    
    try {
        await Promise.all(updates.map(async (update: FightUpdate) => {
            logger.debug({ 
                fightId: update.id, 
                nodeId: update.nodeId, 
                attackerId: update.attackerId, 
                defenderId: update.defenderId 
            }, "Updating fight record");

            const existingFight = await prisma.warFight.findUnique({
                where: { id: update.id },
                include: { prefightChampions: true }
            });

            const existingPrefightsMap = new Map<number, string | null>();
            if (existingFight) {
                existingFight.prefightChampions.forEach(pf => existingPrefightsMap.set(pf.championId, pf.playerId));
            }

            const newPrefightIds = (update.prefightChampionIds || [])
                .map((id: string) => parseInt(id))
                .filter((id: number) => !isNaN(id));

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
                        create: newPrefightIds.map(id => ({
                            championId: id,
                            playerId: existingPrefightsMap.has(id) ? existingPrefightsMap.get(id) : null
                        }))
                    }
                }
            });
            ids.push(update.id);
        }));
        logger.info({ count: ids.length }, "Successfully processed all fight updates");
        return ids;
    } catch (error) {
        logger.error({ error, updates }, "Failed to process fight updates");
        throw error;
    }
}

export async function syncWarVideoEditedFights(
    prisma: PrismaClient,
    params: SyncWarVideoEditParams
): Promise<{ fightIds: string[]; fightListChanged: boolean }> {
    if (!Array.isArray(params.fights) || params.fights.length === 0) {
        throw new Error("At least one fight is required");
    }

    const currentFightIds = await prisma.warFight.findMany({
        where: { videoId: params.videoId },
        select: { id: true },
    });
    const currentIdSet = new Set(currentFightIds.map(fight => fight.id));
    const submittedExistingIds = params.fights
        .map(fight => fight.id)
        .filter((id): id is string => !!id);

    const invalidIds = submittedExistingIds.filter(id => !currentIdSet.has(id));
    if (invalidIds.length > 0) {
        throw new Error("One or more fights do not belong to this video");
    }

    const existingSubmittedSet = new Set(submittedExistingIds);
    const idsToDetach = [...currentIdSet].filter(id => !existingSubmittedSet.has(id));
    const newFights = params.fights.filter(fight => !fight.id);
    const existingUpdates = params.fights.filter((fight): fight is EditableFightInput & { id: string } => !!fight.id);

    const resolved = await resolveWarAndPlayer(prisma, params);

    if (params.warNumber !== null) {
        await assertRegularWarFightMatches(prisma, {
            warId: resolved.warId,
            season: params.season,
            warNumber: params.warNumber,
            battlegroup: resolved.battlegroup,
            fights: params.fights,
            allowedExistingIds: currentIdSet,
        });
    }

    const fightIds = await prisma.$transaction(async (tx) => {
        if (idsToDetach.length > 0) {
            await tx.warFight.updateMany({
                where: { id: { in: idsToDetach }, videoId: params.videoId },
                data: { videoId: null },
            });
        }

        for (const fight of existingUpdates) {
            await updateFightForVideoEdit(tx, {
                fight,
                warId: resolved.warId,
                playerId: resolved.playerId,
                battlegroup: resolved.battlegroup,
            });
        }

        const createdIds: string[] = [];
        for (const fight of newFights) {
            const created = await tx.warFight.create({
                data: {
                    warId: resolved.warId,
                    playerId: resolved.playerId,
                    nodeId: parseInt(fight.nodeId),
                    attackerId: parseInt(fight.attackerId),
                    defenderId: parseInt(fight.defenderId),
                    death: fight.death,
                    battlegroup: resolved.battlegroup,
                    videoId: params.videoId,
                    prefightChampions: buildPrefightCreate(fight.prefightChampionIds, resolved.playerId),
                },
            });
            createdIds.push(created.id);
        }

        return [...existingUpdates.map(fight => fight.id), ...createdIds];
    });

    return {
        fightIds,
        fightListChanged: idsToDetach.length > 0 || newFights.length > 0,
    };
}

async function resolveWarAndPlayer(
    prisma: PrismaLike,
    params: Omit<SyncWarVideoEditParams, "videoId" | "fights">
): Promise<{ warId: string; playerId: string; battlegroup: number }> {
    let targetAllianceId = params.allianceId;
    let targetBattlegroup = params.battlegroup;

    if (!targetAllianceId || params.isGlobal) {
        const globalAlliance = await prisma.alliance.upsert({
            where: { id: GLOBAL_ALLIANCE_ID },
            update: {},
            create: {
                id: GLOBAL_ALLIANCE_ID,
                guildId: "GLOBAL",
                name: "Mercenaries (Global)",
                canUploadFiles: false,
            },
        });
        targetAllianceId = globalAlliance.id;
        targetBattlegroup = 0;
    }

    let finalPlayerId = params.playerId;
    if (params.customPlayerName && (!params.playerId || params.playerId === "")) {
        let player = await prisma.player.findFirst({
            where: {
                ingameName: {
                    equals: params.customPlayerName,
                    mode: 'insensitive',
                },
            },
        });

        if (!player) {
            player = await prisma.player.create({
                data: {
                    ingameName: params.customPlayerName,
                    discordId: `guest_${crypto.randomBytes(8).toString('hex')}`,
                    isActive: false,
                    allianceId: null,
                },
            });
        }
        finalPlayerId = player.id;
    }

    if (!finalPlayerId) {
        throw new Error("Player in video is required");
    }

    let war;
    if (params.warNumber === null) {
        war = await prisma.war.findFirst({
            where: {
                allianceId: targetAllianceId,
                season: params.season,
                warNumber: null,
                mapType: params.mapType,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!war) {
            war = await prisma.war.create({
                data: {
                    season: params.season,
                    warTier: params.warTier,
                    warNumber: null,
                    enemyAlliance: 'Offseason',
                    allianceId: targetAllianceId,
                    mapType: params.mapType,
                    status: 'FINISHED',
                },
            });
        } else {
            war = await prisma.war.update({
                where: { id: war.id },
                data: { warTier: params.warTier, status: 'FINISHED' },
            });
        }
    } else {
        war = await prisma.war.upsert({
            where: {
                allianceId_season_warNumber: {
                    allianceId: targetAllianceId,
                    season: params.season,
                    warNumber: params.warNumber,
                },
            },
            update: {
                warTier: params.warTier,
                mapType: params.mapType,
                status: 'FINISHED',
            },
            create: {
                season: params.season,
                warTier: params.warTier,
                warNumber: params.warNumber,
                allianceId: targetAllianceId,
                mapType: params.mapType,
                status: 'FINISHED',
            },
        });
    }

    return {
        warId: war.id,
        playerId: finalPlayerId,
        battlegroup: targetBattlegroup,
    };
}

async function assertRegularWarFightMatches(
    prisma: PrismaLike,
    params: {
        warId: string;
        season: number;
        warNumber: number;
        battlegroup: number;
        fights: EditableFightInput[];
        allowedExistingIds: Set<string>;
    }
) {
    const nodeIds = params.fights.map(fight => parseInt(fight.nodeId));
    const existingFights = await prisma.warFight.findMany({
        where: {
            warId: params.warId,
            battlegroup: params.battlegroup,
            nodeId: { in: nodeIds },
        },
        select: { id: true, nodeId: true, attackerId: true, defenderId: true },
    });

    const submittedByNode = new Map(params.fights.map(fight => [parseInt(fight.nodeId), fight]));
    const mismatches = existingFights.flatMap(existing => {
        const submitted = submittedByNode.get(existing.nodeId);
        if (!submitted || params.allowedExistingIds.has(existing.id)) return [];
        const attackerMatch = existing.attackerId === parseInt(submitted.attackerId);
        const defenderMatch = existing.defenderId === parseInt(submitted.defenderId);
        if (attackerMatch && defenderMatch) return [];
        return [{
            nodeId: existing.nodeId,
            submittedAttackerId: parseInt(submitted.attackerId),
            existingAttackerId: existing.attackerId,
            submittedDefenderId: parseInt(submitted.defenderId),
            existingDefenderId: existing.defenderId,
        }];
    });

    if (mismatches.length > 0) {
        throw new FightMismatchError(mismatches, {
            season: params.season,
            warNumber: params.warNumber,
            battlegroup: params.battlegroup,
        });
    }
}

async function updateFightForVideoEdit(
    prisma: Prisma.TransactionClient,
    params: {
        fight: EditableFightInput & { id: string };
        warId: string;
        playerId: string;
        battlegroup: number;
    }
) {
    await prisma.warFight.update({
        where: { id: params.fight.id },
        data: {
            warId: params.warId,
            playerId: params.playerId,
            nodeId: parseInt(params.fight.nodeId),
            attackerId: parseInt(params.fight.attackerId),
            defenderId: parseInt(params.fight.defenderId),
            death: params.fight.death,
            battlegroup: params.battlegroup,
            prefightChampions: {
                deleteMany: {},
                create: parsePrefightIds(params.fight.prefightChampionIds).map(championId => ({
                    championId,
                    playerId: params.playerId,
                })),
            },
        },
    });
}

function buildPrefightCreate(prefightChampionIds: string[] | undefined, playerId: string) {
    const championIds = parsePrefightIds(prefightChampionIds);
    if (championIds.length === 0) return undefined;
    return {
        create: championIds.map(championId => ({
            championId,
            playerId,
        })),
    };
}

function parsePrefightIds(prefightChampionIds: string[] | undefined): number[] {
    return (prefightChampionIds || [])
        .map((id: string) => parseInt(id))
        .filter((id: number) => !isNaN(id));
}

export async function queueVideoNotification(
    prisma: PrismaClient, 
    params: { videoId: string; title: string; }
) {
    logger.info({ videoId: params.videoId }, "Starting notification queue process");

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

    if (!video) {
        logger.warn({ videoId: params.videoId }, "Skipping notification: Video not found");
        return;
    }

    if (!video.submittedBy.alliance) {
        logger.info({ videoId: params.videoId, uploader: video.submittedBy.ingameName }, "Skipping notification: Uploader has no alliance");
        return;
    }

    const alliance = video.submittedBy.alliance;
    const fights = video.fights;
    // Fallback for season/warNumber if no fights attached (unlikely but possible)
    const season = fights.length > 0 ? fights[0].war.season : 0;
    const warNumber = fights.length > 0 ? fights[0].war.warNumber : null;

    const basePayload = {
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
            playerInVideo: f.player?.ingameName || 'Unknown',
            death: f.death
        }))
    };

    // 1. Notify War Videos Channel
    if (alliance.warVideosChannelId) {
        logger.info({ 
            videoId: video.id, 
            channelId: alliance.warVideosChannelId, 
            allianceName: alliance.name 
        }, "Queuing NOTIFY_WAR_VIDEO job");
        
        await prisma.botJob.create({
            data: {
                type: 'NOTIFY_WAR_VIDEO',
                payload: { ...basePayload, channelId: alliance.warVideosChannelId }
            }
        });
        logger.debug("NOTIFY_WAR_VIDEO job created successfully");
    } else {
        logger.info({ allianceId: alliance.id, allianceName: alliance.name }, "No war videos channel configured for this alliance");
    }

    // 2. Notify Death Channel (if applicable)
    const totalDeaths = fights.reduce((sum, f) => sum + f.death, 0);
    if (totalDeaths > 0 && alliance.deathChannelId) {
        logger.info({ 
            videoId: video.id, 
            channelId: alliance.deathChannelId,
            deaths: totalDeaths
        }, "Queuing NOTIFY_DEATH_VIDEO job");
        
        await prisma.botJob.create({
            data: {
                type: 'NOTIFY_DEATH_VIDEO',
                payload: { ...basePayload, channelId: alliance.deathChannelId, totalDeaths }
            }
        });
        logger.debug("NOTIFY_DEATH_VIDEO job created successfully");
    }
}
