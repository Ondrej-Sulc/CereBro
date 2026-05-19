'use server'

import { prisma } from "@/lib/prisma";
import { requireBotAdmin } from "@/lib/auth-helpers";
import { revalidatePath, unstable_cache, revalidateTag } from "next/cache";
import logger from "@/lib/logger";
import { ChampionClass, QuestPlanStatus } from "@prisma/client";
import { uploadToGcs, deleteFromGcs } from "@/lib/gcs";
import { QuestWithRelations, QuestSummary } from "@/types/quests";
import { withActionContext } from "@/lib/with-request-context";
import { sortQuestEncountersByRoute } from "./quest-encounters";
import {
    clearAllQuestCounters as clearAllQuestCountersAction,
    savePlayerQuestCounter as savePlayerQuestCounterAction,
    savePlayerQuestEncounterRevives as savePlayerQuestEncounterRevivesAction,
    savePlayerQuestPrefightChampion as savePlayerQuestPrefightChampionAction,
    savePlayerQuestRouteChoice as savePlayerQuestRouteChoiceAction,
    savePlayerQuestSynergy as savePlayerQuestSynergyAction,
} from "./player-quest-progress";

export async function savePlayerQuestRouteChoice(questPlanId: string, sectionId: string, pathId: string) {
    return savePlayerQuestRouteChoiceAction(questPlanId, sectionId, pathId);
}

export async function savePlayerQuestCounter(questPlanId: string, questEncounterId: string, selectedChampionId: number | null, selectedChampionStars: number | null = null) {
    return savePlayerQuestCounterAction(questPlanId, questEncounterId, selectedChampionId, selectedChampionStars);
}

export async function savePlayerQuestPrefightChampion(questPlanId: string, questEncounterId: string, prefightChampionId: number | null, prefightChampionStars: number | null = null) {
    return savePlayerQuestPrefightChampionAction(questPlanId, questEncounterId, prefightChampionId, prefightChampionStars);
}

export async function savePlayerQuestEncounterRevives(questPlanId: string, questEncounterId: string, revivesUsed: number) {
    return savePlayerQuestEncounterRevivesAction(questPlanId, questEncounterId, revivesUsed);
}

export async function clearAllQuestCounters(questPlanId: string) {
    return clearAllQuestCountersAction(questPlanId);
}

export async function savePlayerQuestSynergy(questPlanId: string, championId: number, isRemoving: boolean = false) {
    return savePlayerQuestSynergyAction(questPlanId, championId, isRemoving);
}

// --- Quest Categories ---

export const getQuestCategories = unstable_cache(
    async () => {
        return prisma.questCategory.findMany({
            orderBy: { order: 'asc' },
        });
    },
    ['quest-categories'],
    { tags: ['quest-categories'] }
);

export const createQuestCategory = withActionContext('createQuestCategory', async (name: string, order: number = 0, parentId?: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questCategory.create({
        data: {
            name,
            order,
            parentId
        }
    });

    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
});

export const updateQuestCategory = withActionContext('updateQuestCategory', async (
    id: string,
    data: { name?: string; order?: number; thumbnailUrl?: string | null; parentId?: string | null }
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    if (data.parentId != null) {
        if (data.parentId === id) {
            throw new Error("A category cannot be its own parent.");
        }
        let currentParentId: string | null = data.parentId;
        while (currentParentId !== null) {
            const ancestor: { parentId: string | null } | null = await prisma.questCategory.findUnique({
                where: { id: currentParentId },
                select: { parentId: true }
            });
            if (!ancestor) break;
            if (ancestor.parentId === id) {
                throw new Error("Setting this parent would create a circular reference.");
            }
            currentParentId = ancestor.parentId;
        }
    }

    await prisma.questCategory.update({
        where: { id },
        data: {
            name: data.name,
            order: data.order,
            thumbnailUrl: data.thumbnailUrl,
            parentId: data.parentId,
        }
    });

    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
});

export const uploadQuestCategoryThumbnail = withActionContext('uploadQuestCategoryThumbnail', async (categoryId: string, formData: FormData) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const category = await prisma.questCategory.findUnique({ where: { id: categoryId } });
    if (!category) {
        throw new Error("Category not found.");
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
        throw new Error("Invalid or missing file upload");
    }

    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only PNG, JPEG, and WebP are allowed.");
    }

    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Maximum size is 5MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const sanitizedName = file.name
        .normalize('NFC')
        .replace(/[^\w\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, 80) || 'thumbnail';
    const fileName = `quest-category-thumbnails/${categoryId}-${Date.now()}-${sanitizedName}`;
    const publicUrl = await uploadToGcs(buffer, fileName, file.type);

    try {
        await prisma.questCategory.update({
            where: { id: categoryId },
            data: { thumbnailUrl: publicUrl }
        });
    } catch (error) {
        logger.error({ err: error, categoryId, fileName }, "Failed to update quest category thumbnail URL, deleting GCS object");
        try {
            await deleteFromGcs(fileName);
        } catch (delErr) {
            logger.error({ err: delErr, fileName }, "Failed to delete GCS object during quest category thumbnail cleanup");
        }
        throw error;
    }

    // Delete the old thumbnail from GCS now that the DB is updated
    if (category.thumbnailUrl && category.thumbnailUrl !== publicUrl) {
        try {
            const gcsBase = 'https://storage.googleapis.com/';
            const withoutBase = category.thumbnailUrl.slice(gcsBase.length);
            const slashIdx = withoutBase.indexOf('/');
            if (slashIdx !== -1) {
                const oldPath = withoutBase.slice(slashIdx + 1).split('/').map(decodeURIComponent).join('/');
                await deleteFromGcs(oldPath);
            }
        } catch (delErr) {
            logger.error({ err: delErr, categoryId, thumbnailUrl: category.thumbnailUrl }, "Failed to delete old quest category thumbnail from GCS");
        }
    }

    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');

    return { success: true, url: publicUrl };
});

// --- Quest Plans ---

export const getQuestPlans = withActionContext('getQuestPlans', async (categoryId?: string, status?: QuestPlanStatus, currentPlayerId?: string): Promise<QuestSummary[]> => {
    const plans = await unstable_cache(
        async () => {
            const plans = await prisma.questPlan.findMany({
                where: {
                    categoryId: categoryId ? categoryId : undefined,
                    status: status ? status : undefined
                },
                orderBy: { createdAt: 'desc' },
                include: {
                    category: true,
                    creator: true,
                    creators: {
                        include: {
                            profiles: {
                                include: {
                                    alliance: {
                                        select: { name: true }
                                    }
                                }
                            }
                        }
                    },
                    requiredTags: true,
                    encounters: {
                        select: { id: true } // Just need count for summary
                    },
                    playerPlans: {
                        where: { isFeatured: true },
                        select: {
                            player: {
                                select: { id: true, ingameName: true, avatar: true, botUserId: true }
                            }
                        }
                    },
                    _count: {
                        select: {
                            playerPlans: true
                        }
                    }
                }
            });

            // Enrich creators with user data to avoid direct prisma calls in pages
            return Promise.all(plans.map(async (quest) => {
                const creatorsWithUsers = await Promise.all((quest.creators || []).map(async (creator) => {
                    const user = await prisma.user.findFirst({
                        where: {
                            accounts: {
                                some: {
                                    provider: "discord",
                                    providerAccountId: creator.discordId
                                }
                            }
                        }
                    });

                    // Find best name and alliance tag: User name -> Active profile -> First profile -> "Unknown"
                    const activeProfile = creator.profiles.find(p => p.isActive) || 
                                        creator.profiles.find(p => p.id === creator.activeProfileId) || 
                                        creator.profiles[0];
                    
                    const profileName = activeProfile?.ingameName;
                    const allianceTag = activeProfile?.alliance?.name;

                    return {
                        id: creator.id,
                        discordId: creator.discordId,
                        name: user?.name || profileName || "Unknown",
                        image: user?.image || null,
                        allianceTag: allianceTag || null
                    };
                }));

                const creatorBotUserIds = new Set(quest.creators.map(c => c.id));
                return {
                    ...quest,
                    creators: creatorsWithUsers,
                    featuredPlayers: quest.playerPlans
                        .filter(pp => !pp.player.botUserId || !creatorBotUserIds.has(pp.player.botUserId))
                        .map(({ player: { botUserId: _, ...p } }) => p)
                };
            }));
        },
        ['quest-plans', categoryId || 'all', status || 'all'],
        { tags: ['quest-plans'] }
    )();

    // If currentPlayerId is provided, fetch their progress for these plans
    const playerProgressMap = new Map<string, number>();
    if (currentPlayerId) {
        const playerPlans = await prisma.playerQuestPlan.findMany({
            where: {
                playerId: currentPlayerId,
                questPlanId: { in: plans.map(p => p.id) }
            },
            include: {
                _count: {
                    select: {
                        encounters: {
                            where: {
                                OR: [
                                    { selectedChampionId: { not: null } },
                                    { prefightChampionId: { not: null } }
                                ]
                            }
                        }
                    }
                }
            }
        });
        playerPlans.forEach(pp => {
            playerProgressMap.set(pp.questPlanId, pp._count.encounters);
        });
    }

    return plans.map(quest => ({
        ...quest,
        personalProgress: playerProgressMap.get(quest.id) || 0
    }));
});

export const getQuestPlanById = unstable_cache(
    async (id: string): Promise<QuestWithRelations | null> => {
        const quest = await prisma.questPlan.findUnique({
            where: { id },
            include: {
                category: true,
                requiredTags: true,
                routeSections: {
                    orderBy: { order: 'asc' },
                    include: {
                        parentPath: {
                            include: {
                                section: {
                                    select: { id: true, title: true }
                                }
                            }
                        },
                        paths: {
                            orderBy: { order: 'asc' },
                            include: {
                                encounters: {
                                    select: { id: true },
                                    orderBy: { sequence: 'asc' }
                                }
                            }
                        }
                    }
                },
                creators: {
                    include: {
                        profiles: {
                            include: {
                                alliance: {
                                    select: { name: true }
                                }
                            }
                        }
                    }
                },
                encounters: {
                    orderBy: { sequence: 'asc' },
                    include: {
                        defender: true,
                        requiredTags: true,
                        recommendedChampions: {
                            where: { isPlayable: true }
                        },
                        videos: {
                            include: {
                                player: {
                                    select: {
                                        ingameName: true,
                                        avatar: true,
                                    }
                                }
                            }
                        },
                        nodes: {
                            include: {
                                nodeModifier: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        playerPlans: true
                    }
                },
                playerPlans: {
                    where: { isFeatured: true },
                    include: { player: true }
                }
            }
        });

        if (!quest) return null;

        // Enrich creators with user data
        const creatorsWithUsers = await Promise.all((quest.creators || []).map(async (creator) => {
            const user = await prisma.user.findFirst({
                where: {
                    accounts: {
                        some: {
                            provider: "discord",
                            providerAccountId: creator.discordId
                        }
                    }
                }
            });

            // Find best name: User name -> Active profile -> First profile -> "Unknown"
            const activeProfile = creator.profiles.find(p => p.isActive) || 
                                creator.profiles.find(p => p.id === creator.activeProfileId) || 
                                creator.profiles[0];

            const profileName = activeProfile?.ingameName;
            const allianceTag = activeProfile?.alliance?.name;

            return {
                id: creator.id,
                discordId: creator.discordId,
                name: user?.name || profileName || "Unknown",
                image: user?.image || null,
                allianceTag: allianceTag || null
            };
        }));

        return {
            ...quest,
            creators: creatorsWithUsers
        };
    },
    ['quest-plan-detail'],
    { tags: ['quest-plan-detail'] }
);

export const updateFeaturedPlayers = withActionContext('updateFeaturedPlayers', async (
    questPlanId: string,
    playerIds: string[]
): Promise<{ success: boolean; error?: string }> => {
    try {
        await requireBotAdmin("MANAGE_QUESTS");
        const uniquePlayerIds = [...new Set(playerIds)];

        await prisma.$transaction([
            prisma.playerQuestPlan.updateMany({
                where: { questPlanId },
                data: { isFeatured: false }
            }),
            ...uniquePlayerIds.map(playerId => 
                prisma.playerQuestPlan.upsert({
                    where: {
                        playerId_questPlanId: {
                            playerId,
                            questPlanId
                        }
                    },
                    update: {
                        isFeatured: true
                    },
                    create: {
                        playerId,
                        questPlanId,
                        isFeatured: true
                    }
                })
            )
        ]);

        revalidatePath(`/admin/quests/${questPlanId}`);
        revalidatePath(`/planning/quests/${questPlanId}`);
        revalidateTag('quest-plan-detail', 'default');
        revalidateTag(`quest-featured-picks-${questPlanId}`, 'default');
        
        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to update featured players";
        logger.error({ err: e, questPlanId }, "Failed to update featured quest players");
        return { success: false, error: message };
    }
});

/**
 * Aggregate champion pick counts per encounter for a quest plan.
 * Returns a map: encounterId -> { championId, count, champion }[] sorted by count desc.
 */
export type PopularCounter = {
    championId: number;
    count: number;
    champion: ChampionCounterData;
};
export type PopularCountersMap = Record<string, PopularCounter[]>;
export type ChampionCounterData = {
    id: number;
    name: string;
    shortName: string;
    class: ChampionClass;
    images: unknown;
};

export const getEncounterPopularCounters = async (questPlanId: string): Promise<PopularCountersMap> => {
    return unstable_cache(
        async () => {
            // Get total player plans to determine a sensible dynamic threshold
            const totalPlayers = await prisma.playerQuestPlan.count({
                where: { questPlanId }
            });

            // Threshold: At least 3 picks, or 2% of players (capped at 50 to avoid hiding consensus)
            const threshold = Math.min(50, Math.max(3, Math.floor(totalPlayers * 0.02)));

            const results = await prisma.playerQuestEncounter.groupBy({
                by: ['questEncounterId', 'selectedChampionId'],
                where: {
                    questPlanId,
                    selectedChampionId: { not: null }
                },
                _count: { selectedChampionId: true },
                having: {
                    selectedChampionId: {
                        _count: {
                            gte: threshold
                        }
                    }
                }
            });

            // We need full champion objects for the popular counters
            const championIds = Array.from(new Set(results.map(r => r.selectedChampionId).filter((id): id is number => id !== null)));
            const champions = await prisma.champion.findMany({
                where: { id: { in: championIds } },
                select: { id: true, name: true, shortName: true, class: true, images: true }
            });

            const map: PopularCountersMap = {};
            for (const row of results) {
                if (!row.selectedChampionId) continue;
                if (!map[row.questEncounterId]) map[row.questEncounterId] = [];
                
                const champion = champions.find(c => c.id === row.selectedChampionId);
                if (!champion) continue;

                map[row.questEncounterId].push({
                    championId: row.selectedChampionId,
                    count: row._count.selectedChampionId,
                    champion
                });
            }

            // Sort each encounter's picks by count descending
            for (const encId of Object.keys(map)) {
                map[encId].sort((a, b) => b.count - a.count);
            }

            return map;
        },
        [`quest-popular-counters-${questPlanId}`],
        { tags: [`quest-popular-counters-${questPlanId}`, 'quest-popular-counters'] }
    )();
};

export type PickCounterWithChampion = {
    championId: number;
    count: number;
    champion: ChampionCounterData;
    pickedBy?: { id: string; name: string; avatar: string | null }[];
};

export type EnhancedCountersMap = Record<string, PickCounterWithChampion[]>;

export const getEncounterFeaturedPicks = async (questPlanId: string): Promise<EnhancedCountersMap> => {
    return unstable_cache(
        async () => {
            const playerPlans = await prisma.playerQuestPlan.findMany({
                where: {
                    questPlanId,
                    isFeatured: true,
                    // Only plans that have at least one encounter selection or synergy selection
                    OR: [
                        { encounters: { some: { selectedChampionId: { not: null } } } },
                        { synergyChampions: { some: {} } }
                    ]
                },
                select: {
                    player: {
                        select: { id: true, ingameName: true, avatar: true }
                    },
                    encounters: {
                        where: { selectedChampionId: { not: null } },
                        select: {
                            questEncounterId: true,
                            selectedChampionId: true,
                            selectedChampion: {
                                select: { id: true, name: true, shortName: true, class: true, images: true }
                            }
                        }
                    },
                    synergyChampions: {
                        select: {
                            championId: true,
                            champion: {
                                select: { id: true, name: true, shortName: true, class: true, images: true }
                            }
                        }
                    }
                }
            });

            const map: EnhancedCountersMap = {};

            for (const plan of playerPlans) {
                const player = {
                    id: plan.player.id,
                    name: plan.player.ingameName,
                    avatar: plan.player.avatar
                };

                // Add standard encounter picks
                for (const enc of plan.encounters) {
                    if (!enc.selectedChampionId || !enc.selectedChampion) continue;
                    if (!map[enc.questEncounterId]) map[enc.questEncounterId] = [];

                    const existing = map[enc.questEncounterId].find(c => c.championId === enc.selectedChampionId);
                    if (existing) {
                        existing.count++;
                        if (existing.pickedBy) {
                            if (!existing.pickedBy.some(p => p.id === player.id)) {
                                existing.pickedBy.push(player);
                            }
                        } else {
                            existing.pickedBy = [player];
                        }
                    } else {
                        map[enc.questEncounterId].push({
                            championId: enc.selectedChampionId,
                            count: 1,
                            champion: enc.selectedChampion,
                            pickedBy: [player]
                        });
                    }
                }

                // We also need to inject synergy champions into the map somehow so the UI can pick them up.
                // Since the `EnhancedCountersMap` is keyed by `questEncounterId`, synergy champions
                // don't have a direct slot here. However, the UI uses `playerPicksMap` derived from
                // `featuredPicks` to show the full team in the popover.
                // To fix this, we can add a special key "SYNERGY" to the map to hold these picks,
                // or we can pass the synergy picks directly to the UI component.
                // Let's use a special key "SYNERGY" that the UI can parse if it needs them globally,
                // BUT the `PlayerTeamSummary` just looks at `map[user.id].picks`. The current UI rebuilds
                // the `playerPicksMap` by iterating over `Object.entries(featuredPicks)`.
                // So adding a "SYNERGY" key will perfectly allow the UI to find them and add them to the player's team map!
                for (const syn of plan.synergyChampions) {
                    if (!map["SYNERGY"]) map["SYNERGY"] = [];
                    
                    const existingSyn = map["SYNERGY"].find(c => c.championId === syn.championId);
                    if (existingSyn) {
                        existingSyn.count++;
                        if (existingSyn.pickedBy) {
                            if (!existingSyn.pickedBy.some(p => p.id === player.id)) {
                                existingSyn.pickedBy.push(player);
                            }
                        } else {
                            existingSyn.pickedBy = [player];
                        }
                    } else {
                        map["SYNERGY"].push({
                            championId: syn.championId,
                            count: 1,
                            champion: syn.champion as ChampionCounterData,
                            pickedBy: [player]
                        });
                    }
                }
            }

            for (const encId of Object.keys(map)) {
                map[encId].sort((a, b) => b.count - a.count);
            }

            return map;
        },
        [`quest-featured-picks-${questPlanId}`],
        { tags: [`quest-featured-picks-${questPlanId}`, 'quest-featured-picks'] }
    )();
};
export const getEncounterAlliancePicks = async (questPlanId: string, allianceId: string, excludePlayerId?: string): Promise<EnhancedCountersMap> => {
    return unstable_cache(
        async () => {
            const playerPlans = await prisma.playerQuestPlan.findMany({
                where: {
                    questPlanId,
                    player: { 
                        allianceId,
                        id: excludePlayerId ? { not: excludePlayerId } : undefined
                    },
                    OR: [
                        { encounters: { some: { selectedChampionId: { not: null } } } },
                        { synergyChampions: { some: {} } }
                    ]
                },
                select: {
                    player: {
                        select: { id: true, ingameName: true, avatar: true }
                    },
                    encounters: {
                        where: { selectedChampionId: { not: null } },
                        select: {
                            questEncounterId: true,
                            selectedChampionId: true,
                            selectedChampion: {
                                select: { id: true, name: true, shortName: true, class: true, images: true }
                            }
                        }
                    },
                    synergyChampions: {
                        select: {
                            championId: true,
                            champion: {
                                select: { id: true, name: true, shortName: true, class: true, images: true }
                            }
                        }
                    }
                }
            });

            const map: EnhancedCountersMap = {};
            for (const plan of playerPlans) {
                const playerDetails = plan.player;
                const pickedByData = { id: playerDetails.id, name: playerDetails.ingameName, avatar: playerDetails.avatar };

                // Standard encounter picks
                for (const enc of plan.encounters) {
                    if (!enc.selectedChampionId || !enc.selectedChampion) continue;
                    if (!map[enc.questEncounterId]) map[enc.questEncounterId] = [];
                    
                    const existing = map[enc.questEncounterId].find(c => c.championId === enc.selectedChampionId);

                    if (existing) {
                        existing.count++;
                        if (!existing.pickedBy) existing.pickedBy = [];
                        if (!existing.pickedBy.some(p => p.id === pickedByData.id)) {
                            existing.pickedBy.push(pickedByData);
                        }
                    } else {
                        map[enc.questEncounterId].push({
                            championId: enc.selectedChampionId,
                            count: 1,
                            champion: enc.selectedChampion,
                            pickedBy: [pickedByData]
                        });
                    }
                }

                // Synergy picks
                for (const syn of plan.synergyChampions) {
                    if (!map["SYNERGY"]) map["SYNERGY"] = [];
                    
                    const existingSyn = map["SYNERGY"].find(c => c.championId === syn.championId);
                    if (existingSyn) {
                        existingSyn.count++;
                        if (!existingSyn.pickedBy) existingSyn.pickedBy = [];
                        if (!existingSyn.pickedBy.some(p => p.id === pickedByData.id)) {
                            existingSyn.pickedBy.push(pickedByData);
                        }
                    } else {
                        map["SYNERGY"].push({
                            championId: syn.championId,
                            count: 1,
                            champion: syn.champion as ChampionCounterData,
                            pickedBy: [pickedByData]
                        });
                    }
                }
            }

            for (const encId of Object.keys(map)) {
                map[encId].sort((a, b) => b.count - a.count);
            }

            return map;
        },
        [`quest-alliance-picks-${questPlanId}-${allianceId}-${excludePlayerId || 'none'}`],
        { tags: [`quest-alliance-picks-${questPlanId}-${allianceId}`, 'quest-alliance-picks'] }
    )();
};

export type QuestPlanCreateInput = {
    title: string;
    status?: QuestPlanStatus;
    videoUrl?: string | null;
    bannerUrl?: string | null;
    bannerFit?: string | null;
    bannerPosition?: string | null;
    categoryId?: string;
    minStarLevel?: number;
    maxStarLevel?: number;
    teamLimit?: number | null;
    requiredClasses?: ChampionClass[];
    requiredTagIds?: number[]; // Note: Tag.id is actually Int in the schema
    creatorIds?: string[];
};

export const createQuestPlan = withActionContext('createQuestPlan', async (data: QuestPlanCreateInput) => {
    const actingUser = await requireBotAdmin("MANAGE_QUESTS");

    const plan = await prisma.questPlan.create({
        data: {
            title: data.title,
            status: data.status,
            videoUrl: data.videoUrl,
            bannerUrl: data.bannerUrl,
            bannerFit: data.bannerFit || "cover",
            bannerPosition: data.bannerPosition || "center",
            categoryId: data.categoryId,
            creatorId: actingUser.id,
            minStarLevel: data.minStarLevel,
            maxStarLevel: data.maxStarLevel,
            teamLimit: data.teamLimit,
            requiredClasses: data.requiredClasses || [],
            requiredTags: data.requiredTagIds ? {
                connect: data.requiredTagIds.map(id => ({ id }))
            } : undefined,
            creators: data.creatorIds ? {
                connect: data.creatorIds.map(id => ({ id }))
            } : undefined
        }
    });

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true, planId: plan.id };
});

export type QuestPlanUpdateInput = {
    id: string;
    title?: string;
    status?: QuestPlanStatus;
    videoUrl?: string | null;
    bannerUrl?: string | null;
    bannerFit?: string | null;
    bannerPosition?: string | null;
    categoryId?: string | null;
    minStarLevel?: number | null;
    maxStarLevel?: number | null;
    teamLimit?: number | null;
    requiredClasses?: ChampionClass[];
    requiredTagIds?: number[];
    creatorIds?: string[];
};

export const updateQuestPlan = withActionContext('updateQuestPlan', async (data: QuestPlanUpdateInput) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questPlan.update({
        where: { id: data.id },
        data: {
            title: data.title,
            status: data.status,
            videoUrl: data.videoUrl,
            bannerUrl: data.bannerUrl,
            bannerFit: data.bannerFit,
            bannerPosition: data.bannerPosition,
            categoryId: data.categoryId,
            minStarLevel: data.minStarLevel,
            maxStarLevel: data.maxStarLevel,
            teamLimit: data.teamLimit,
            requiredClasses: data.requiredClasses,
            requiredTags: data.requiredTagIds !== undefined ? {
                set: data.requiredTagIds.map(id => ({ id }))
            } : undefined,
            creators: data.creatorIds !== undefined ? {
                set: data.creatorIds.map(id => ({ id }))
            } : undefined
        }
    });

    revalidatePath('/admin/quests');
    revalidatePath(`/admin/quests/${data.id}`);
    revalidatePath('/planning/quests');
    revalidatePath(`/planning/quests/${data.id}`);
    return { success: true };
});

export const deleteQuestPlan = withActionContext('deleteQuestPlan', async (id: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questPlan.delete({
        where: { id }
    });

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
});

export const uploadQuestBanner = withActionContext('uploadQuestBanner', async (questPlanId: string, formData: FormData) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
        throw new Error("Invalid or missing file upload");
    }

    // Validate file type
    const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Invalid file type. Only PNG, JPEG, and WebP are allowed.");
    }

    // Validate file size (e.g., 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error("File is too large. Maximum size is 5MB.");
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileName = `quest-banners/${questPlanId}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const publicUrl = await uploadToGcs(buffer, fileName, file.type);

    // Update the quest plan with the new banner URL
    try {
        await prisma.questPlan.update({
            where: { id: questPlanId },
            data: { bannerUrl: publicUrl }
        });
    } catch (error) {
        // If the DB update fails, the uploaded GCS object should not be orphaned
        await deleteFromGcs(fileName);
        logger.error({ err: error, questPlanId, fileName }, "Failed to update quest plan banner URL, deleted GCS object");
        throw error;
    }

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);

    return { success: true, url: publicUrl };
});

export const duplicateQuestPlan = withActionContext('duplicateQuestPlan', async (id: string) => {
    const actingUser = await requireBotAdmin("MANAGE_QUESTS");

    const sourcePlan = await prisma.questPlan.findUnique({
        where: { id },
        include: {
            requiredTags: true,
            encounters: {
                include: {
                    requiredTags: true,
                    recommendedChampions: true,
                    nodes: true
                }
            }
        }
    });

    if (!sourcePlan) throw new Error("Source plan not found");

    const newPlan = await prisma.questPlan.create({
        data: {
            title: `${sourcePlan.title} (Copy)`,
            status: QuestPlanStatus.DRAFT,
            videoUrl: sourcePlan.videoUrl,
            bannerUrl: sourcePlan.bannerUrl,
            bannerFit: sourcePlan.bannerFit,
            bannerPosition: sourcePlan.bannerPosition,
            categoryId: sourcePlan.categoryId,
            creatorId: actingUser.id,
            minStarLevel: sourcePlan.minStarLevel,
            maxStarLevel: sourcePlan.maxStarLevel,
            teamLimit: sourcePlan.teamLimit,
            requiredClasses: sourcePlan.requiredClasses,
            requiredTags: {
                connect: sourcePlan.requiredTags.map(t => ({ id: t.id }))
            },
            encounters: {
                create: sourcePlan.encounters.map(e => ({
                    sequence: e.sequence,
                    videoUrl: e.videoUrl,
                    tips: e.tips,
                    defenderId: e.defenderId,
                    recommendedTags: e.recommendedTags,
                    requiredClasses: e.requiredClasses,
                    minStarLevel: e.minStarLevel,
                    maxStarLevel: e.maxStarLevel,
                    recommendedChampions: {
                        connect: e.recommendedChampions.map(c => ({ id: c.id }))
                    },
                    requiredTags: {
                        connect: e.requiredTags.map(t => ({ id: t.id }))
                    },
                    nodes: {
                        create: e.nodes.map(n => ({
                            nodeModifierId: n.nodeModifierId,
                            isHighlighted: n.isHighlighted
                        }))
                    }
                }))
            }
        }
    });

    revalidatePath('/admin/quests');
    return { success: true, planId: newPlan.id };
});

export {
    exportQuestPlan,
    importQuestPlan,
} from "./quest-plan-transfer";
export const clearRecommendedChampionsInQuest = withActionContext('clearRecommendedChampionsInQuest', async (id: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const encounters = await prisma.questEncounter.findMany({
        where: { questPlanId: id },
        select: { id: true }
    });

    if (encounters.length > 0) {
        await prisma.$transaction(
            encounters.map(encounter =>
                prisma.questEncounter.update({
                    where: { id: encounter.id },
                    data: {
                        recommendedChampions: {
                            set: []
                        }
                    }
                })
            )
        );
    }

    revalidatePath(`/admin/quests/${id}`);
    revalidatePath(`/planning/quests/${id}`);
    return { success: true };
});

export {
    createQuestRoutePath,
    createQuestRouteSection,
    deleteQuestRoutePath,
    deleteQuestRouteSection,
    duplicateQuestRoutePathFights,
    reorderQuestRoutePaths,
    reorderQuestRouteSections,
    updateQuestRoutePath,
    updateQuestRouteSection,
} from "./quest-routes";

export {
    bulkAddEncounterVideos,
    bulkCreateQuestEncounters,
    bulkImportNodeModifiersFromJson,
    createQuestEncounter,
    deleteQuestEncounter,
    reorderQuestEncounters,
    reorderQuestEncountersByRoute,
    updateQuestEncounter,
} from "./quest-encounters";
export {
    getPlayerQuestPlanForViewing,
    getPlayerQuestPlansForProfile,
    getShareablePlanId,
} from "./quest-plan-sharing";
