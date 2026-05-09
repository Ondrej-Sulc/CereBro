'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance, requireBotAdmin } from "@/lib/auth-helpers";
import { revalidatePath, unstable_cache, revalidateTag } from "next/cache";
import logger from "@/lib/logger";
import { ChampionClass, EncounterDifficulty, QuestPlanStatus } from "@prisma/client";
import { uploadToGcs, deleteFromGcs } from "@/lib/gcs";
import { QuestWithRelations, QuestSummary } from "@/types/quests";
import { withActionContext } from "@/lib/with-request-context";

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
        console.error("Failed to update quest category with thumbnail URL, deleted GCS object.", error);
        try {
            await deleteFromGcs(fileName);
        } catch (delErr) {
            console.error("Failed to delete GCS object during cleanup", delErr);
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
            console.error("Failed to delete old category thumbnail from GCS", delErr);
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
                            where: { selectedChampionId: { not: null } }
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
    } catch (e: any) {
        console.error(e);
        return { success: false, error: e.message || "Failed to update featured players" };
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
                            champion: syn.champion as any,
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
                            champion: syn.champion as any,
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
        console.error("Failed to update quest plan with banner URL, deleted GCS object.", error);
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
                            nodeModifierId: n.nodeModifierId
                        }))
                    }
                }))
            }
        }
    });

    revalidatePath('/admin/quests');
    return { success: true, planId: newPlan.id };
});

type QuestExportCategory = {
    name: string;
    path: string[];
};

type QuestExportChampionRef = {
    slug: string | null;
    name: string;
};

type QuestExportTagRef = {
    name: string;
    category: string;
};

type QuestExportNodeRef = {
    name: string;
    description: string;
};

type QuestExportCreatorRef = {
    discordId: string;
};

type QuestExportPlayerRef = {
    discordId: string | null;
    ingameName: string | null;
    botUserDiscordId: string | null;
};

type QuestPlanExportPayload = {
    schemaVersion: 1;
    kind: "cerebro.questPlan";
    exportedAt: string;
    quest: {
        title: string;
        videoUrl: string | null;
        bannerUrl: string | null;
        bannerFit: string | null;
        bannerPosition: string | null;
        category: QuestExportCategory | null;
        minStarLevel: number | null;
        maxStarLevel: number | null;
        teamLimit: number | null;
        requiredClasses: ChampionClass[];
        requiredTags: QuestExportTagRef[];
        creators: QuestExportCreatorRef[];
    };
    routeSections: {
        key: string;
        title: string;
        order: number;
        parentPathKey: string | null;
        paths: {
            key: string;
            title: string;
            order: number;
        }[];
    }[];
    encounters: {
        sequence: number;
        difficulty: EncounterDifficulty;
        tips: string | null;
        videoUrl: string | null;
        defender: QuestExportChampionRef | null;
        recommendedTags: string[];
        recommendedChampions: QuestExportChampionRef[];
        requiredTags: QuestExportTagRef[];
        nodes: QuestExportNodeRef[];
        routePathKey: string | null;
        videos: {
            videoUrl: string;
            player: QuestExportPlayerRef | null;
        }[];
    }[];
};

type MissingQuestImportReferences = {
    champions: string[];
    tags: string[];
    nodeModifiers: string[];
    categories: string[];
    creators: string[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function asOptionalString(value: unknown): string | null {
    return typeof value === "string" ? value : null;
}

function asNumberOrNull(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function uniqueStrings(values: string[]): string[] {
    return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function tagKey(tag: Pick<QuestExportTagRef, "name" | "category">): string {
    return `${tag.name}::${tag.category}`;
}

function formatTagRef(tag: Pick<QuestExportTagRef, "name" | "category">): string {
    return tag.category ? `${tag.name} (${tag.category})` : tag.name;
}

function formatChampionRef(champion: QuestExportChampionRef): string {
    return champion.slug ? `${champion.name} [${champion.slug}]` : champion.name;
}

function formatCategoryRef(category: QuestExportCategory): string {
    return category.path.length > 0 ? category.path.join(" / ") : category.name;
}

function makeRouteSectionKey(order: number, title: string): string {
    return `section:${order}:${title}`;
}

function makeRoutePathKey(sectionKey: string, order: number, title: string): string {
    return `${sectionKey}/path:${order}:${title}`;
}

function summarizeMissingQuestImportReferences(missing: MissingQuestImportReferences): string {
    const parts: string[] = [];
    if (missing.champions.length) parts.push(`Champions: ${missing.champions.join(", ")}`);
    if (missing.tags.length) parts.push(`Tags: ${missing.tags.join(", ")}`);
    if (missing.nodeModifiers.length) parts.push(`Node modifiers: ${missing.nodeModifiers.join(", ")}`);
    if (missing.categories.length) parts.push(`Categories: ${missing.categories.join(", ")}`);
    if (missing.creators.length) parts.push(`Creators: ${missing.creators.join(", ")}`);
    return parts.join("\n");
}

async function getQuestCategoryPath(categoryId: string): Promise<string[]> {
    const path: string[] = [];
    let currentId: string | null = categoryId;
    const seen = new Set<string>();

    while (currentId && !seen.has(currentId)) {
        seen.add(currentId);
        const category: { name: string; parentId: string | null } | null = await prisma.questCategory.findUnique({
            where: { id: currentId },
            select: { name: true, parentId: true }
        });
        if (!category) break;
        path.unshift(category.name);
        currentId = category.parentId;
    }

    return path;
}

async function resolveQuestCategoryByPath(category: QuestExportCategory | null): Promise<string | null | undefined> {
    if (!category) return null;

    const path = category.path.length > 0 ? category.path : [category.name];
    let parentId: string | null = null;
    let foundId: string | null = null;

    for (const name of path) {
        const found: { id: string } | null = await prisma.questCategory.findFirst({
            where: { name, parentId },
            select: { id: true }
        });
        if (!found) return undefined;
        foundId = found.id;
        parentId = found.id;
    }

    return foundId;
}

function parseQuestPlanExport(jsonText: string): QuestPlanExportPayload {
    let parsed: unknown;
    try {
        parsed = JSON.parse(jsonText);
    } catch {
        throw new Error("Invalid JSON format.");
    }

    if (!isPlainObject(parsed) || parsed.kind !== "cerebro.questPlan" || parsed.schemaVersion !== 1) {
        throw new Error("Unsupported quest plan export. Expected kind \"cerebro.questPlan\" with schemaVersion 1.");
    }
    if (!isPlainObject(parsed.quest)) {
        throw new Error("Invalid quest plan export: missing quest object.");
    }

    const quest = parsed.quest;
    const title = asString(quest.title)?.trim();
    if (!title) {
        throw new Error("Invalid quest plan export: quest.title is required.");
    }

    const rawCategory = isPlainObject(quest.category) ? quest.category : null;
    const category = rawCategory
        ? {
            name: asString(rawCategory.name)?.trim() || "",
            path: asStringArray(rawCategory.path).map(item => item.trim()).filter(Boolean)
        }
        : null;
    if (category && !category.name && category.path.length === 0) {
        throw new Error("Invalid quest plan export: quest.category requires a name or path.");
    }

    const routeSections = Array.isArray(parsed.routeSections) ? parsed.routeSections : [];
    const encounters = Array.isArray(parsed.encounters) ? parsed.encounters : [];

    return {
        schemaVersion: 1,
        kind: "cerebro.questPlan",
        exportedAt: asString(parsed.exportedAt) || new Date().toISOString(),
        quest: {
            title,
            videoUrl: asOptionalString(quest.videoUrl),
            bannerUrl: asOptionalString(quest.bannerUrl),
            bannerFit: asOptionalString(quest.bannerFit) || "cover",
            bannerPosition: asOptionalString(quest.bannerPosition) || "center",
            category,
            minStarLevel: asNumberOrNull(quest.minStarLevel),
            maxStarLevel: asNumberOrNull(quest.maxStarLevel),
            teamLimit: asNumberOrNull(quest.teamLimit),
            requiredClasses: asStringArray(quest.requiredClasses).filter((item): item is ChampionClass =>
                Object.values(ChampionClass).includes(item as ChampionClass)
            ),
            requiredTags: (Array.isArray(quest.requiredTags) ? quest.requiredTags : [])
                .filter(isPlainObject)
                .map(tag => ({
                    name: asString(tag.name)?.trim() || "",
                    category: asString(tag.category)?.trim() || ""
                }))
                .filter(tag => tag.name),
            creators: (Array.isArray(quest.creators) ? quest.creators : [])
                .filter(isPlainObject)
                .map(creator => ({ discordId: asString(creator.discordId)?.trim() || "" }))
                .filter(creator => creator.discordId)
        },
        routeSections: routeSections
            .filter(isPlainObject)
            .map(section => ({
                key: asString(section.key)?.trim() || "",
                title: asString(section.title)?.trim() || "Section",
                order: asNumberOrNull(section.order) ?? 0,
                parentPathKey: asOptionalString(section.parentPathKey),
                paths: (Array.isArray(section.paths) ? section.paths : [])
                    .filter(isPlainObject)
                    .map(path => ({
                        key: asString(path.key)?.trim() || "",
                        title: asString(path.title)?.trim() || "Path",
                        order: asNumberOrNull(path.order) ?? 0
                    }))
                    .filter(path => path.key)
            }))
            .filter(section => section.key),
        encounters: encounters
            .filter(isPlainObject)
            .map(encounter => {
                const rawDefender = isPlainObject(encounter.defender) ? encounter.defender : null;
                return {
                    sequence: asNumberOrNull(encounter.sequence) ?? 0,
                    difficulty: Object.values(EncounterDifficulty).includes(encounter.difficulty as EncounterDifficulty)
                        ? encounter.difficulty as EncounterDifficulty
                        : EncounterDifficulty.NORMAL,
                    tips: asOptionalString(encounter.tips),
                    videoUrl: asOptionalString(encounter.videoUrl),
                    defender: rawDefender ? {
                        slug: asOptionalString(rawDefender.slug),
                        name: asString(rawDefender.name)?.trim() || ""
                    } : null,
                    recommendedTags: asStringArray(encounter.recommendedTags),
                    recommendedChampions: (Array.isArray(encounter.recommendedChampions) ? encounter.recommendedChampions : [])
                        .filter(isPlainObject)
                        .map(champion => ({
                            slug: asOptionalString(champion.slug),
                            name: asString(champion.name)?.trim() || ""
                        }))
                        .filter(champion => champion.name),
                    requiredTags: (Array.isArray(encounter.requiredTags) ? encounter.requiredTags : [])
                        .filter(isPlainObject)
                        .map(tag => ({
                            name: asString(tag.name)?.trim() || "",
                            category: asString(tag.category)?.trim() || ""
                        }))
                        .filter(tag => tag.name),
                    nodes: (Array.isArray(encounter.nodes) ? encounter.nodes : [])
                        .filter(isPlainObject)
                        .map(node => ({
                            name: asString(node.name)?.trim() || "",
                            description: asString(node.description)?.trim() || ""
                        }))
                        .filter(node => node.name),
                    routePathKey: asOptionalString(encounter.routePathKey),
                    videos: (Array.isArray(encounter.videos) ? encounter.videos : [])
                        .filter(isPlainObject)
                        .map(video => {
                            const rawPlayer = isPlainObject(video.player) ? video.player : null;
                            return {
                                videoUrl: asString(video.videoUrl)?.trim() || "",
                                player: rawPlayer ? {
                                    discordId: asOptionalString(rawPlayer.discordId),
                                    ingameName: asOptionalString(rawPlayer.ingameName),
                                    botUserDiscordId: asOptionalString(rawPlayer.botUserDiscordId)
                                } : null
                            };
                        })
                        .filter(video => video.videoUrl)
                };
            })
    };
}

export const exportQuestPlan = withActionContext('exportQuestPlan', async (questPlanId: string): Promise<QuestPlanExportPayload> => {
    await requireBotAdmin("MANAGE_QUESTS");

    const quest = await prisma.questPlan.findUnique({
        where: { id: questPlanId },
        include: {
            category: true,
            requiredTags: true,
            creators: {
                select: { discordId: true }
            },
            routeSections: {
                orderBy: { order: 'asc' },
                include: {
                    paths: {
                        orderBy: { order: 'asc' }
                    }
                }
            },
            encounters: {
                orderBy: { sequence: 'asc' },
                include: {
                    defender: { select: { slug: true, name: true } },
                    recommendedChampions: { select: { slug: true, name: true } },
                    requiredTags: true,
                    nodes: {
                        include: {
                            nodeModifier: {
                                select: { name: true, description: true }
                            }
                        }
                    },
                    videos: {
                        include: {
                            player: {
                                select: {
                                    discordId: true,
                                    ingameName: true,
                                    botUser: {
                                        select: { discordId: true }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    if (!quest) throw new Error("Quest plan not found.");

    const sectionKeyById = new Map<string, string>();
    const pathKeyById = new Map<string, string>();

    for (const section of quest.routeSections) {
        const sectionKey = makeRouteSectionKey(section.order, section.title);
        sectionKeyById.set(section.id, sectionKey);
        for (const path of section.paths) {
            pathKeyById.set(path.id, makeRoutePathKey(sectionKey, path.order, path.title));
        }
    }

    const categoryPath = quest.categoryId ? await getQuestCategoryPath(quest.categoryId) : [];

    return {
        schemaVersion: 1,
        kind: "cerebro.questPlan",
        exportedAt: new Date().toISOString(),
        quest: {
            title: quest.title,
            videoUrl: quest.videoUrl,
            bannerUrl: quest.bannerUrl,
            bannerFit: quest.bannerFit,
            bannerPosition: quest.bannerPosition,
            category: quest.category ? { name: quest.category.name, path: categoryPath } : null,
            minStarLevel: quest.minStarLevel,
            maxStarLevel: quest.maxStarLevel,
            teamLimit: quest.teamLimit,
            requiredClasses: quest.requiredClasses,
            requiredTags: quest.requiredTags.map(tag => ({ name: tag.name, category: tag.category })),
            creators: quest.creators.map(creator => ({ discordId: creator.discordId }))
        },
        routeSections: quest.routeSections.map(section => ({
            key: sectionKeyById.get(section.id)!,
            title: section.title,
            order: section.order,
            parentPathKey: section.parentPathId ? pathKeyById.get(section.parentPathId) ?? null : null,
            paths: section.paths.map(path => ({
                key: pathKeyById.get(path.id)!,
                title: path.title,
                order: path.order
            }))
        })),
        encounters: quest.encounters.map(encounter => ({
            sequence: encounter.sequence,
            difficulty: encounter.difficulty,
            tips: encounter.tips,
            videoUrl: encounter.videoUrl,
            defender: encounter.defender ? { slug: encounter.defender.slug, name: encounter.defender.name } : null,
            recommendedTags: encounter.recommendedTags,
            recommendedChampions: encounter.recommendedChampions.map(champion => ({
                slug: champion.slug,
                name: champion.name
            })),
            requiredTags: encounter.requiredTags.map(tag => ({ name: tag.name, category: tag.category })),
            nodes: encounter.nodes.map(node => ({
                name: node.nodeModifier.name,
                description: node.nodeModifier.description
            })),
            routePathKey: encounter.routePathId ? pathKeyById.get(encounter.routePathId) ?? null : null,
            videos: encounter.videos.map(video => ({
                videoUrl: video.videoUrl,
                player: video.player ? {
                    discordId: video.player.discordId,
                    ingameName: video.player.ingameName,
                    botUserDiscordId: video.player.botUser?.discordId ?? null
                } : null
            }))
        }))
    };
});

export const importQuestPlan = withActionContext('importQuestPlan', async (jsonText: string) => {
    const actingUser = await requireBotAdmin("MANAGE_QUESTS");
    const payload = parseQuestPlanExport(jsonText);

    const missing: MissingQuestImportReferences = {
        champions: [],
        tags: [],
        nodeModifiers: [],
        categories: [],
        creators: []
    };

    const categoryId = await resolveQuestCategoryByPath(payload.quest.category);
    if (categoryId === undefined && payload.quest.category) {
        missing.categories.push(formatCategoryRef(payload.quest.category));
    }

    const championRefs = [
        ...payload.encounters.flatMap(encounter => [
            ...(encounter.defender ? [encounter.defender] : []),
            ...encounter.recommendedChampions
        ])
    ];
    const championSlugs = uniqueStrings(championRefs.map(champion => champion.slug || ""));
    const championNames = uniqueStrings(championRefs.map(champion => champion.name));

    const [championsBySlug, championsByName] = await Promise.all([
        championSlugs.length > 0
            ? prisma.champion.findMany({
                where: { slug: { in: championSlugs } },
                select: { id: true, slug: true, name: true }
            })
            : Promise.resolve([]),
        championNames.length > 0
            ? prisma.champion.findMany({
                where: { name: { in: championNames } },
                select: { id: true, slug: true, name: true }
            })
            : Promise.resolve([])
    ]);
    const championIdBySlug = new Map(championsBySlug.filter(c => c.slug).map(c => [c.slug!, c.id]));
    const championIdByName = new Map(championsByName.map(c => [c.name, c.id]));
    const resolveChampionId = (champion: QuestExportChampionRef | null): number | null => {
        if (!champion) return null;
        if (champion.slug && championIdBySlug.has(champion.slug)) return championIdBySlug.get(champion.slug)!;
        return championIdByName.get(champion.name) ?? null;
    };

    for (const champion of championRefs) {
        if (!resolveChampionId(champion)) missing.champions.push(formatChampionRef(champion));
    }

    const tagRefs = [
        ...payload.quest.requiredTags,
        ...payload.encounters.flatMap(encounter => encounter.requiredTags)
    ];
    const tagNames = uniqueStrings(tagRefs.map(tag => tag.name));
    const tags = tagNames.length > 0
        ? await prisma.tag.findMany({
            where: { name: { in: tagNames } },
            select: { id: true, name: true, category: true }
        })
        : [];
    const tagIdByKey = new Map(tags.map(tag => [tagKey(tag), tag.id]));
    const resolveTagId = (tag: QuestExportTagRef): number | null => tagIdByKey.get(tagKey(tag)) ?? null;
    for (const tag of tagRefs) {
        if (!resolveTagId(tag)) missing.tags.push(formatTagRef(tag));
    }

    const nodeNames = uniqueStrings(payload.encounters.flatMap(encounter => encounter.nodes.map(node => node.name)));
    const nodeModifiers = nodeNames.length > 0
        ? await prisma.nodeModifier.findMany({
            where: { name: { in: nodeNames } },
            select: { id: true, name: true }
        })
        : [];
    const nodeModifierIdByName = new Map(nodeModifiers.map(node => [node.name, node.id]));
    for (const nodeName of nodeNames) {
        if (!nodeModifierIdByName.has(nodeName)) missing.nodeModifiers.push(nodeName);
    }

    const creatorDiscordIds = uniqueStrings(payload.quest.creators.map(creator => creator.discordId));
    const creators = creatorDiscordIds.length > 0
        ? await prisma.botUser.findMany({
            where: { discordId: { in: creatorDiscordIds } },
            select: { id: true, discordId: true }
        })
        : [];
    const creatorIdByDiscordId = new Map(creators.map(creator => [creator.discordId, creator.id]));
    for (const discordId of creatorDiscordIds) {
        if (!creatorIdByDiscordId.has(discordId)) missing.creators.push(discordId);
    }

    missing.champions = uniqueStrings(missing.champions);
    missing.tags = uniqueStrings(missing.tags);
    missing.nodeModifiers = uniqueStrings(missing.nodeModifiers);
    missing.categories = uniqueStrings(missing.categories);
    missing.creators = uniqueStrings(missing.creators);
    const missingReport = summarizeMissingQuestImportReferences(missing);
    if (missingReport) {
        throw new Error(`Quest import is missing required references:\n${missingReport}`);
    }

    const videoPlayerRefs = payload.encounters.flatMap(encounter => encounter.videos.map(video => video.player).filter((player): player is QuestExportPlayerRef => !!player));
    const playerBotUserDiscordIds = uniqueStrings(videoPlayerRefs.map(player => player.botUserDiscordId || ""));
    const playerDiscordIds = uniqueStrings(videoPlayerRefs.map(player => player.discordId || ""));
    const playerNames = uniqueStrings(videoPlayerRefs.map(player => player.ingameName || ""));
    const playerLookupClauses = [
        ...(playerBotUserDiscordIds.length ? [{ botUser: { discordId: { in: playerBotUserDiscordIds } } }] : []),
        ...(playerDiscordIds.length ? [{ discordId: { in: playerDiscordIds } }] : []),
        ...(playerNames.length ? [{ ingameName: { in: playerNames } }] : [])
    ];
    const players = playerLookupClauses.length > 0
        ? await prisma.player.findMany({
            where: {
                OR: playerLookupClauses
            },
            select: {
                id: true,
                discordId: true,
                ingameName: true,
                botUser: { select: { discordId: true } }
            }
        })
        : [];
    const playerIdByBotUserDiscordId = new Map(players.filter(player => player.botUser?.discordId).map(player => [player.botUser!.discordId, player.id]));
    const playerIdByDiscordAndName = new Map(players.map(player => [`${player.discordId}::${player.ingameName}`, player.id]));
    const playerNameCounts = players.reduce((counts, player) => counts.set(player.ingameName, (counts.get(player.ingameName) ?? 0) + 1), new Map<string, number>());
    const playerIdByUniqueName = new Map(players.filter(player => playerNameCounts.get(player.ingameName) === 1).map(player => [player.ingameName, player.id]));
    const resolvePlayerId = (player: QuestExportPlayerRef | null): string | null => {
        if (!player) return null;
        if (player.botUserDiscordId && playerIdByBotUserDiscordId.has(player.botUserDiscordId)) {
            return playerIdByBotUserDiscordId.get(player.botUserDiscordId)!;
        }
        if (player.discordId && player.ingameName && playerIdByDiscordAndName.has(`${player.discordId}::${player.ingameName}`)) {
            return playerIdByDiscordAndName.get(`${player.discordId}::${player.ingameName}`)!;
        }
        if (player.ingameName && playerIdByUniqueName.has(player.ingameName)) {
            return playerIdByUniqueName.get(player.ingameName)!;
        }
        return null;
    };

    const newPlanId = await prisma.$transaction(async (tx) => {
        const plan = await tx.questPlan.create({
            data: {
                title: payload.quest.title,
                status: QuestPlanStatus.DRAFT,
                videoUrl: payload.quest.videoUrl,
                bannerUrl: payload.quest.bannerUrl,
                bannerFit: payload.quest.bannerFit || "cover",
                bannerPosition: payload.quest.bannerPosition || "center",
                categoryId: categoryId ?? null,
                creatorId: actingUser.id,
                minStarLevel: payload.quest.minStarLevel,
                maxStarLevel: payload.quest.maxStarLevel,
                teamLimit: payload.quest.teamLimit,
                requiredClasses: payload.quest.requiredClasses,
                requiredTags: {
                    connect: payload.quest.requiredTags.map(tag => ({ id: resolveTagId(tag)! }))
                },
                creators: {
                    connect: payload.quest.creators.map(creator => ({ id: creatorIdByDiscordId.get(creator.discordId)! }))
                }
            }
        });

        const pathIdByKey = new Map<string, string>();
        const sortedSections = [...payload.routeSections].sort((a, b) => a.order - b.order);
        for (const section of sortedSections) {
            const createdSection = await tx.questRouteSection.create({
                data: {
                    questPlanId: plan.id,
                    title: section.title,
                    order: section.order,
                    parentPathId: null
                }
            });
            for (const path of [...section.paths].sort((a, b) => a.order - b.order)) {
                const createdPath = await tx.questRoutePath.create({
                    data: {
                        sectionId: createdSection.id,
                        title: path.title,
                        order: path.order
                    }
                });
                pathIdByKey.set(path.key, createdPath.id);
            }
        }

        for (const section of sortedSections) {
            if (!section.parentPathKey) continue;
            const parentPathId = pathIdByKey.get(section.parentPathKey);
            if (!parentPathId) continue;
            const sectionPath = section.paths[0] ? pathIdByKey.get(section.paths[0].key) : null;
            if (!sectionPath) continue;
            const createdPath = await tx.questRoutePath.findUnique({
                where: { id: sectionPath },
                select: { sectionId: true }
            });
            if (createdPath) {
                await tx.questRouteSection.update({
                    where: { id: createdPath.sectionId },
                    data: { parentPathId }
                });
            }
        }

        for (const encounter of payload.encounters) {
            await tx.questEncounter.create({
                data: {
                    questPlanId: plan.id,
                    sequence: encounter.sequence,
                    difficulty: encounter.difficulty,
                    tips: encounter.tips,
                    videoUrl: encounter.videoUrl,
                    defenderId: resolveChampionId(encounter.defender),
                    routePathId: encounter.routePathKey ? pathIdByKey.get(encounter.routePathKey) ?? null : null,
                    recommendedTags: encounter.recommendedTags,
                    recommendedChampions: {
                        connect: encounter.recommendedChampions.map(champion => ({ id: resolveChampionId(champion)! }))
                    },
                    requiredTags: {
                        connect: encounter.requiredTags.map(tag => ({ id: resolveTagId(tag)! }))
                    },
                    nodes: {
                        create: encounter.nodes.map(node => ({
                            nodeModifierId: nodeModifierIdByName.get(node.name)!
                        }))
                    },
                    videos: {
                        create: encounter.videos.map(video => ({
                            videoUrl: video.videoUrl,
                            playerId: resolvePlayerId(video.player)
                        }))
                    }
                }
            });
        }

        return plan.id;
    });

    if (payload.routeSections.length > 0) {
        await sortQuestEncountersByRoute(newPlanId);
    }

    revalidatePath('/admin/quests');
    revalidatePath(`/admin/quests/${newPlanId}`);
    revalidatePath('/planning/quests');
    revalidatePath(`/planning/quests/${newPlanId}`);
    revalidateTag('quest-plans', 'default');
    revalidateTag('quest-plan-detail', 'default');

    return { success: true, planId: newPlanId };
});

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

// --- Quest Routes ---

export const createQuestRouteSection = withActionContext('createQuestRouteSection', async (
    questPlanId: string,
    title: string = "Section"
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const maxSection = await prisma.questRouteSection.aggregate({
        where: { questPlanId },
        _max: { order: true }
    });

    const section = await prisma.questRouteSection.create({
        data: {
            questPlanId,
            title: title.trim() || "Section",
            order: (maxSection._max.order ?? 0) + 1,
            paths: {
                create: {
                    title: "Path A",
                    order: 1
                }
            }
        },
        include: { paths: true }
    });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true, section };
});

export const createQuestRoutePath = withActionContext('createQuestRoutePath', async (
    questPlanId: string,
    sectionId: string,
    title: string = "Path"
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const section = await prisma.questRouteSection.findUnique({
        where: { id: sectionId },
        select: { id: true, questPlanId: true }
    });
    if (!section || section.questPlanId !== questPlanId) {
        throw new Error("Section not found or does not belong to this quest plan.");
    }

    const maxPath = await prisma.questRoutePath.aggregate({
        where: { sectionId },
        _max: { order: true }
    });

    const path = await prisma.questRoutePath.create({
        data: {
            sectionId,
            title: title.trim() || "Path",
            order: (maxPath._max.order ?? 0) + 1
        }
    });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true, path };
});

export const duplicateQuestRoutePathFights = withActionContext('duplicateQuestRoutePathFights', async (
    questPlanId: string,
    sourcePathId: string
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const sourcePath = await prisma.questRoutePath.findUnique({
        where: { id: sourcePathId },
        include: {
            section: {
                select: {
                    id: true,
                    title: true,
                    order: true,
                    questPlanId: true
                }
            },
            encounters: {
                orderBy: { sequence: 'asc' },
                include: {
                    requiredTags: true,
                    recommendedChampions: true,
                    nodes: true,
                    videos: true
                }
            }
        }
    });

    if (!sourcePath || sourcePath.section.questPlanId !== questPlanId) {
        throw new Error("Source path not found or does not belong to this quest plan.");
    }

    const { _max: sequenceMax } = await prisma.questEncounter.aggregate({
        where: { questPlanId },
        _max: { sequence: true }
    });

    const created = await prisma.$transaction(async (tx) => {
        const insertionOrder = sourcePath.section.order + 1;
        const sectionsToShift = await tx.questRouteSection.findMany({
            where: {
                questPlanId,
                order: { gte: insertionOrder }
            },
            select: { id: true, order: true },
            orderBy: { order: 'desc' }
        });

        for (const sectionToShift of sectionsToShift) {
            await tx.questRouteSection.update({
                where: { id: sectionToShift.id },
                data: { order: sectionToShift.order + 1 }
            });
        }

        const section = await tx.questRouteSection.create({
            data: {
                questPlanId,
                parentPathId: sourcePath.id,
                title: `After ${sourcePath.title}`,
                order: insertionOrder
            }
        });

        const path = await tx.questRoutePath.create({
            data: {
                sectionId: section.id,
                title: `${sourcePath.title} Copy`,
                order: 1
            }
        });

        let nextSequence = (sequenceMax.sequence ?? 0) + 1;

        for (const encounter of sourcePath.encounters) {
            await tx.questEncounter.create({
                data: {
                    questPlanId,
                    routePathId: path.id,
                    sequence: nextSequence++,
                    difficulty: encounter.difficulty,
                    videoUrl: encounter.videoUrl,
                    tips: encounter.tips,
                    minStarLevel: encounter.minStarLevel,
                    maxStarLevel: encounter.maxStarLevel,
                    requiredClasses: encounter.requiredClasses,
                    defenderId: encounter.defenderId,
                    recommendedTags: encounter.recommendedTags,
                    recommendedChampions: {
                        connect: encounter.recommendedChampions.map(champion => ({ id: champion.id }))
                    },
                    requiredTags: {
                        connect: encounter.requiredTags.map(tag => ({ id: tag.id }))
                    },
                    nodes: {
                        create: encounter.nodes.map(node => ({
                            nodeModifierId: node.nodeModifierId
                        }))
                    },
                    videos: {
                        create: encounter.videos.map(video => ({
                            videoUrl: video.videoUrl,
                            playerId: video.playerId
                        }))
                    }
                }
            });
        }

        return {
            sectionId: section.id,
            pathId: path.id,
            copiedCount: sourcePath.encounters.length
        };
    });

    const sortedCount = await sortQuestEncountersByRoute(questPlanId);

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true, ...created, sortedCount };
});

export const updateQuestRouteSection = withActionContext('updateQuestRouteSection', async (
    questPlanId: string,
    sectionId: string,
    data: { title?: string; parentPathId?: string | null }
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const section = await prisma.questRouteSection.findUnique({
        where: { id: sectionId },
        select: { questPlanId: true }
    });
    if (!section || section.questPlanId !== questPlanId) {
        throw new Error("Section not found or does not belong to this quest plan.");
    }

    if (data.parentPathId) {
        const parentPath = await prisma.questRoutePath.findUnique({
            where: { id: data.parentPathId },
            include: {
                section: {
                    include: {
                        parentPath: {
                            include: {
                                section: {
                                    select: { id: true, parentPathId: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        if (!parentPath || parentPath.section.questPlanId !== questPlanId) {
            throw new Error("Parent path not found or does not belong to this quest plan.");
        }
        if (parentPath.sectionId === sectionId) {
            throw new Error("A section cannot be scoped under one of its own paths.");
        }

        let ancestorParentPathId: string | null = parentPath.section.parentPathId;
        while (ancestorParentPathId) {
            const ancestorPath = await prisma.questRoutePath.findUnique({
                where: { id: ancestorParentPathId },
                include: { section: { select: { id: true, parentPathId: true } } }
            });
            if (!ancestorPath) break;
            if (ancestorPath.section.id === sectionId) {
                throw new Error("Setting this parent would create a circular route dependency.");
            }
            ancestorParentPathId = ancestorPath.section.parentPathId;
        }
    }

    await prisma.questRouteSection.update({
        where: { id: sectionId },
        data: {
            title: data.title !== undefined ? (data.title.trim() || "Section") : undefined,
            parentPathId: data.parentPathId === undefined ? undefined : data.parentPathId
        }
    });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true };
});

export const updateQuestRoutePath = withActionContext('updateQuestRoutePath', async (
    questPlanId: string,
    pathId: string,
    data: { title?: string }
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const path = await prisma.questRoutePath.findUnique({
        where: { id: pathId },
        include: { section: { select: { questPlanId: true } } }
    });
    if (!path || path.section.questPlanId !== questPlanId) {
        throw new Error("Path not found or does not belong to this quest plan.");
    }

    await prisma.questRoutePath.update({
        where: { id: pathId },
        data: {
            title: data.title !== undefined ? (data.title.trim() || "Path") : undefined
        }
    });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true };
});

export const reorderQuestRouteSections = withActionContext('reorderQuestRouteSections', async (
    questPlanId: string,
    sectionIds: string[]
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const sections = await prisma.questRouteSection.findMany({
        where: { id: { in: sectionIds } },
        select: { id: true, questPlanId: true }
    });
    if (sections.length !== sectionIds.length || sections.some(section => section.questPlanId !== questPlanId)) {
        throw new Error("One or more sections do not belong to this quest plan.");
    }

    const offset = sectionIds.length + 1000;
    await prisma.$transaction([
        ...sectionIds.map((id, index) => prisma.questRouteSection.update({ where: { id }, data: { order: offset + index } })),
        ...sectionIds.map((id, index) => prisma.questRouteSection.update({ where: { id }, data: { order: index + 1 } })),
    ]);

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true };
});

export const reorderQuestRoutePaths = withActionContext('reorderQuestRoutePaths', async (
    questPlanId: string,
    sectionId: string,
    pathIds: string[]
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const section = await prisma.questRouteSection.findUnique({
        where: { id: sectionId },
        select: { questPlanId: true }
    });
    if (!section || section.questPlanId !== questPlanId) {
        throw new Error("Section not found or does not belong to this quest plan.");
    }

    const paths = await prisma.questRoutePath.findMany({
        where: { id: { in: pathIds } },
        select: { id: true, sectionId: true }
    });
    if (paths.length !== pathIds.length || paths.some(path => path.sectionId !== sectionId)) {
        throw new Error("One or more paths do not belong to this section.");
    }

    const offset = pathIds.length + 1000;
    await prisma.$transaction([
        ...pathIds.map((id, index) => prisma.questRoutePath.update({ where: { id }, data: { order: offset + index } })),
        ...pathIds.map((id, index) => prisma.questRoutePath.update({ where: { id }, data: { order: index + 1 } })),
    ]);

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true };
});

export const deleteQuestRouteSection = withActionContext('deleteQuestRouteSection', async (
    questPlanId: string,
    sectionId: string
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const section = await prisma.questRouteSection.findUnique({
        where: { id: sectionId },
        select: { questPlanId: true }
    });
    if (!section || section.questPlanId !== questPlanId) {
        throw new Error("Section not found or does not belong to this quest plan.");
    }

    await prisma.questRouteSection.delete({ where: { id: sectionId } });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true };
});

export const deleteQuestRoutePath = withActionContext('deleteQuestRoutePath', async (
    questPlanId: string,
    pathId: string
) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const path = await prisma.questRoutePath.findUnique({
        where: { id: pathId },
        include: { section: { select: { questPlanId: true } } }
    });
    if (!path || path.section.questPlanId !== questPlanId) {
        throw new Error("Path not found or does not belong to this quest plan.");
    }

    await prisma.questRoutePath.delete({ where: { id: pathId } });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true };
});

export const savePlayerQuestRouteChoice = withActionContext('savePlayerQuestRouteChoice', async (
    questPlanId: string,
    sectionId: string,
    pathId: string
) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const path = await prisma.questRoutePath.findUnique({
        where: { id: pathId },
        include: { section: { select: { id: true, questPlanId: true } } }
    });
    if (!path || path.section.id !== sectionId || path.section.questPlanId !== questPlanId) {
        throw new Error("Invalid route choice for this quest plan.");
    }

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId
        },
        update: {}
    });

    await prisma.playerQuestRouteChoice.upsert({
        where: {
            playerQuestPlanId_questRouteSectionId: {
                playerQuestPlanId: playerPlan.id,
                questRouteSectionId: sectionId
            }
        },
        create: {
            playerQuestPlanId: playerPlan.id,
            questRouteSectionId: sectionId,
            questRoutePathId: pathId
        },
        update: {
            questRoutePathId: pathId
        }
    });

    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plans', 'default');
    revalidateTag('quest-plan-detail', 'default');
    return { success: true };
});

// --- User Progress / Selections ---

export const savePlayerQuestCounter = withActionContext('savePlayerQuestCounter', async (questPlanId: string, questEncounterId: string, selectedChampionId: number | null) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    // Validate that the encounter belongs to the plan
    const encounter = await prisma.questEncounter.findUnique({
        where: { id: questEncounterId },
        select: { questPlanId: true }
    });

    if (!encounter || encounter.questPlanId !== questPlanId) {
        throw new Error("Invalid quest encounter or plan mismatch.");
    }

    // Validate champion ownership if provided
    if (selectedChampionId !== null) {
        const hasChampion = await prisma.roster.findFirst({
            where: {
                playerId: actingUser.id,
                championId: selectedChampionId
            }
        });
        if (!hasChampion) throw new Error("Champion not found in your roster.");
    }

    // Ensure the PlayerQuestPlan exists first
    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId: questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId: questPlanId
        },
        update: {} // No update needed if it exists
    });

    // Upsert the specific encounter counter
    await prisma.playerQuestEncounter.upsert({
        where: {
            playerQuestPlanId_questEncounterId: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId: questEncounterId
            }
        },
        create: {
            playerQuestPlanId: playerPlan.id,
            questEncounterId: questEncounterId,
            questPlanId: questPlanId,
            selectedChampionId: selectedChampionId
        },
        update: {
            selectedChampionId: selectedChampionId
        }
    });

    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plans', 'default');
    revalidateTag('quest-plan-detail', 'default');
    revalidateTag(`quest-popular-counters-${questPlanId}`, 'default');
    revalidateTag('quest-popular-counters', 'default');

    if (actingUser.allianceId) {
        revalidateTag(`quest-alliance-picks-${questPlanId}-${actingUser.allianceId}`, 'default');
        revalidateTag('quest-alliance-picks', 'default');
    }

    return { success: true };
});

export const savePlayerQuestEncounterRevives = withActionContext('savePlayerQuestEncounterRevives', async (questPlanId: string, questEncounterId: string, revivesUsed: number) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    if (!Number.isInteger(revivesUsed) || revivesUsed < 0 || revivesUsed > 99) {
        throw new Error("Revives used must be an integer between 0 and 99.");
    }

    const encounter = await prisma.questEncounter.findUnique({
        where: { id: questEncounterId },
        select: { questPlanId: true }
    });

    if (!encounter || encounter.questPlanId !== questPlanId) {
        throw new Error("Invalid quest encounter or plan mismatch.");
    }

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId
        },
        update: {}
    });

    await prisma.playerQuestEncounter.upsert({
        where: {
            playerQuestPlanId_questEncounterId: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId
            }
        },
        create: {
            playerQuestPlanId: playerPlan.id,
            questEncounterId,
            questPlanId,
            revivesUsed
        },
        update: {
            revivesUsed
        }
    });

    if (revivesUsed === 0) {
        await prisma.playerQuestEncounter.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                questEncounterId,
                selectedChampionId: null,
                revivesUsed: 0
            }
        });
    }

    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plans', 'default');
    revalidateTag('quest-plan-detail', 'default');

    return { success: true };
});

/**
 * Clear all counter selections for a player's quest plan.
 */
export const clearAllQuestCounters = withActionContext('clearAllQuestCounters', async (questPlanId: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const playerPlan = await prisma.playerQuestPlan.findUnique({
        where: { playerId_questPlanId: { playerId: actingUser.id, questPlanId } }
    });

    if (playerPlan) {
        await prisma.playerQuestEncounter.updateMany({
            where: { playerQuestPlanId: playerPlan.id },
            data: { selectedChampionId: null }
        });
        await prisma.playerQuestEncounter.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                selectedChampionId: null,
                revivesUsed: 0
            }
        });
    }

    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plans', 'default');
    revalidateTag('quest-plan-detail', 'default');
    revalidateTag(`quest-popular-counters-${questPlanId}`, 'default');
    revalidateTag('quest-popular-counters', 'default');

    if (actingUser.allianceId) {
        revalidateTag(`quest-alliance-picks-${questPlanId}-${actingUser.allianceId}`, 'default');
        revalidateTag('quest-alliance-picks', 'default');
    }

    return { success: true };
});

/**
 * Save or remove a synergy champion for a player's quest plan.
 * Synergy champions are not assigned to any specific encounter but count towards the team limit.
 */
export const savePlayerQuestSynergy = withActionContext('savePlayerQuestSynergy', async (questPlanId: string, championId: number, isRemoving: boolean = false) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    // Ensure the PlayerQuestPlan exists first
    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId: questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId: questPlanId
        },
        update: {}
    });

    if (isRemoving) {
        await prisma.playerQuestSynergyChampion.deleteMany({
            where: {
                playerQuestPlanId: playerPlan.id,
                championId: championId,
            }
        });
    } else {
        // Validate champion ownership and get the best roster entry to check restrictions
        const rosterEntries = await prisma.roster.findMany({
            where: {
                playerId: actingUser.id,
                championId: championId
            },
            orderBy: [
                { stars: 'desc' },
                { rank: 'desc' }
            ]
        });
        const hasChampion = rosterEntries[0];
        if (!hasChampion) throw new Error("Champion not found in your roster.");

        const quest = await prisma.questPlan.findUnique({
            where: { id: questPlanId },
            include: { requiredTags: true }
        });
        if (!quest) throw new Error("Quest plan not found.");

        const champ = await prisma.champion.findUnique({
            where: { id: championId },
            include: { tags: true }
        });
        if (!champ) throw new Error("Champion not found.");

        // Check quest invariants against the BEST version of this champion they own
        if (quest.minStarLevel && hasChampion.stars < quest.minStarLevel) throw new Error(`Quest requires minimum ${quest.minStarLevel}★`);
        if (quest.maxStarLevel && hasChampion.stars > quest.maxStarLevel) throw new Error(`Quest requires maximum ${quest.maxStarLevel}★`);
        if (quest.requiredClasses.length > 0 && !quest.requiredClasses.includes(champ.class)) throw new Error(`Quest requires class: ${quest.requiredClasses.join(", ")}`);
        
        if (quest.requiredTags.length > 0) {
            const hasAllTags = quest.requiredTags.every(qt => champ.tags.some(ct => ct.id === qt.id));
            if (!hasAllTags) {
                const tagNames = quest.requiredTags.map(t => t.name).join(", ");
                throw new Error(`Quest requires champions with all of: ${tagNames}`);
            }
        }

        if (quest.teamLimit !== null) {
            const planDetails = await prisma.playerQuestPlan.findUnique({
                where: { id: playerPlan.id },
                include: {
                    encounters: { where: { selectedChampionId: { not: null } } },
                    synergyChampions: true
                }
            });
            const encounterChamps = planDetails?.encounters.map(e => e.selectedChampionId).filter(id => id !== null) || [];
            const synergyChamps = planDetails?.synergyChampions.map(s => s.championId) || [];
            const uniqueChamps = new Set([...encounterChamps, ...synergyChamps]);
            
            if (!uniqueChamps.has(championId) && uniqueChamps.size >= quest.teamLimit) {
                throw new Error(`Team limit of ${quest.teamLimit} reached.`);
            }
        }

        await prisma.playerQuestSynergyChampion.upsert({
            where: {
                playerQuestPlanId_championId: {
                    playerQuestPlanId: playerPlan.id,
                    championId: championId
                }
            },
            create: {
                playerQuestPlanId: playerPlan.id,
                championId: championId
            },
            update: {}
        });
    }

    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plans', 'default');
    revalidateTag('quest-plan-detail', 'default');

    return { success: true };
});

// --- Quest Encounters ---

export type QuestEncounterCreateInput = {
    questPlanId: string;
    sequence: number;
    difficulty?: import("@prisma/client").EncounterDifficulty;
    videoUrl?: string | null;
    videos?: { videoUrl: string; playerId?: string | null }[];
    tips?: string;
    defenderId?: number;
    recommendedTagNames?: string[];
    recommendedChampionIds?: number[];
    requiredTagIds?: number[];
    nodeModifierIds?: string[];
    routePathId?: string | null;
};

export const createQuestEncounter = withActionContext('createQuestEncounter', async (data: QuestEncounterCreateInput) => {
    await requireBotAdmin("MANAGE_QUESTS");

    if (data.defenderId) {
        const champ = await prisma.champion.findUnique({ where: { id: data.defenderId } });
        if (!champ) {
            throw new Error(`Champion with ID ${data.defenderId} not found.`);
        }
    }

    if (data.routePathId) {
        const path = await prisma.questRoutePath.findUnique({
            where: { id: data.routePathId },
            include: { section: { select: { questPlanId: true } } }
        });
        if (!path || path.section.questPlanId !== data.questPlanId) {
            throw new Error("Route path not found or does not belong to this quest plan.");
        }
    }

    const encounter = await prisma.questEncounter.create({
        data: {
            sequence: data.sequence,
            difficulty: data.difficulty,
            videoUrl: data.videoUrl,
            tips: data.tips,
            questPlanId: data.questPlanId,
            routePathId: data.routePathId || null,
            defenderId: data.defenderId,
            recommendedTags: data.recommendedTagNames || [],
            recommendedChampions: data.recommendedChampionIds ? {
                connect: data.recommendedChampionIds.map(id => ({ id }))
            } : undefined,
            requiredTags: data.requiredTagIds ? {
                connect: data.requiredTagIds.map(id => ({ id }))
            } : undefined,
            nodes: data.nodeModifierIds ? {
                create: data.nodeModifierIds.map(nodeId => ({
                    nodeModifier: { connect: { id: nodeId } }
                }))
            } : undefined,
            videos: data.videos ? {
                create: data.videos.map(v => ({
                    videoUrl: v.videoUrl,
                    playerId: v.playerId
                }))
            } : undefined
        }
    });

    revalidatePath(`/admin/quests/${data.questPlanId}`);
    revalidatePath(`/planning/quests/${data.questPlanId}`);
    return { success: true, encounterId: encounter.id };
});

export const bulkCreateQuestEncounters = withActionContext('bulkCreateQuestEncounters', async (questPlanId: string, defenderIds: (number | null)[], startSequence: number) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const nonNullDefenderIds = defenderIds.filter((id): id is number => id !== null);
    if (nonNullDefenderIds.length > 0) {
        const foundChampions = await prisma.champion.findMany({
            where: { id: { in: nonNullDefenderIds } },
            select: { id: true }
        });
        const foundIds = new Set(foundChampions.map(c => c.id));
        const missingId = nonNullDefenderIds.find(id => !foundIds.has(id));
        if (missingId !== undefined) {
            throw new Error(`Champion with ID ${missingId} not found.`);
        }
    }

    const encounters = await prisma.$transaction(
        defenderIds.map((defenderId, i) =>
            prisma.questEncounter.create({
                data: {
                    questPlanId,
                    sequence: startSequence + i,
                    defenderId: defenderId || null,
                    recommendedTags: [],
                }
            })
        )
    );

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true, count: encounters.length };
});

const IGNORED_NODE_TITLES = new Set(["champion boost", "health", "warning"]);

export type BulkNodeImportResult = {
    champion: string;
    encounterId: string;
    encounterCreated: boolean;
    nodesLinked: number;
    nodesCreated: number;
    nodesSkipped: number;
};

export const bulkImportNodeModifiersFromJson = withActionContext('bulkImportNodeModifiersFromJson', async (questPlanId: string, jsonData: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    let parsed: { champion: string; nodes: { title: string; description: string }[] }[];
    try {
        parsed = JSON.parse(jsonData);
    } catch {
        throw new Error("Invalid JSON format.");
    }

    if (!Array.isArray(parsed)) throw new Error("JSON must be an array.");

    // Fetch existing encounters for this quest (with defenders)
    const existingEncounters = await prisma.questEncounter.findMany({
        where: { questPlanId },
        include: { defender: { select: { id: true, name: true } } },
        orderBy: { sequence: 'asc' },
    });

    const maxSequence = existingEncounters.length > 0
        ? Math.max(...existingEncounters.map(e => e.sequence))
        : 0;
    let nextSequence = maxSequence + 1;

    const results: BulkNodeImportResult[] = [];

    for (const entry of parsed) {
        const championNameLower = entry.champion.toLowerCase().trim();

        // Match existing encounter by defender full name only (shortName is not unique across champions)
        let encounter = existingEncounters.find(e =>
            e.defender?.name.toLowerCase() === championNameLower
        ) ?? null;

        let encounterCreated = false;
        if (!encounter) {
            // Try to find the champion in DB by full name only
            const champion = await prisma.champion.findFirst({
                where: {
                    name: { equals: entry.champion.trim(), mode: 'insensitive' },
                },
                select: { id: true }
            });

            encounter = await prisma.questEncounter.create({
                data: {
                    questPlanId,
                    sequence: nextSequence++,
                    defenderId: champion?.id ?? null,
                    recommendedTags: [],
                },
                include: { defender: { select: { id: true, name: true } } },
            });
            existingEncounters.push(encounter);
            encounterCreated = true;
        }

        let nodesLinked = 0;
        let nodesCreated = 0;
        let nodesSkipped = 0;

        for (const node of entry.nodes ?? []) {
            const titleLower = node.title.toLowerCase().trim();
            if (IGNORED_NODE_TITLES.has(titleLower)) {
                nodesSkipped++;
                continue;
            }

            // Find existing node modifier by name (case-insensitive)
            let modifier = await prisma.nodeModifier.findFirst({
                where: { name: { equals: node.title.trim(), mode: 'insensitive' } },
                select: { id: true },
            });

            if (!modifier) {
                modifier = await prisma.nodeModifier.create({
                    data: { name: node.title.trim(), description: node.description.trim() },
                    select: { id: true },
                });
                nodesCreated++;
            } else {
                nodesLinked++;
            }

            // Upsert the link (no-op if already exists)
            await prisma.questEncounterNode.upsert({
                where: {
                    questEncounterId_nodeModifierId: {
                        questEncounterId: encounter.id,
                        nodeModifierId: modifier.id,
                    }
                },
                create: {
                    questEncounterId: encounter.id,
                    nodeModifierId: modifier.id,
                },
                update: {},
            });
        }

        results.push({
            champion: entry.champion,
            encounterId: encounter.id,
            encounterCreated,
            nodesLinked,
            nodesCreated,
            nodesSkipped,
        });
    }

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    return { success: true, results };
});

export type QuestEncounterUpdateInput = {
    id: string;
    questPlanId: string;
    sequence?: number;
    difficulty?: import("@prisma/client").EncounterDifficulty;
    videoUrl?: string | null;
    videos?: { videoUrl: string; playerId?: string | null }[];
    tips?: string | null;
    defenderId?: number | null;
    recommendedTagNames?: string[];
    recommendedChampionIds?: number[];
    requiredTagIds?: number[];
    nodeModifierIds?: string[];
    routePathId?: string | null;
};

export const updateQuestEncounter = withActionContext('updateQuestEncounter', async (data: QuestEncounterUpdateInput) => {
    await requireBotAdmin("MANAGE_QUESTS");

    if (data.defenderId) {
        const champ = await prisma.champion.findUnique({ where: { id: data.defenderId } });
        if (!champ) {
            throw new Error(`Champion with ID ${data.defenderId} not found.`);
        }
    }

    const existingEncounter = await prisma.questEncounter.findUnique({ where: { id: data.id } });
    if (!existingEncounter || existingEncounter.questPlanId !== data.questPlanId) {
        throw new Error("Encounter not found or does not belong to this quest plan.");
    }

    if (data.routePathId) {
        const path = await prisma.questRoutePath.findUnique({
            where: { id: data.routePathId },
            include: { section: { select: { questPlanId: true } } }
        });
        if (!path || path.section.questPlanId !== data.questPlanId) {
            throw new Error("Route path not found or does not belong to this quest plan.");
        }
    }

    const encounter = await prisma.questEncounter.update({
        where: { id: data.id },
        data: {
            sequence: data.sequence,
            difficulty: data.difficulty,
            videoUrl: data.videoUrl,
            tips: data.tips,
            defenderId: data.defenderId,
            routePathId: data.routePathId === undefined ? undefined : data.routePathId,
            recommendedTags: data.recommendedTagNames !== undefined ? data.recommendedTagNames : undefined,
            recommendedChampions: data.recommendedChampionIds !== undefined ? {
                set: data.recommendedChampionIds.map(id => ({ id }))
            } : undefined,
            requiredTags: data.requiredTagIds !== undefined ? {
                set: data.requiredTagIds.map(id => ({ id }))
            } : undefined,
            nodes: data.nodeModifierIds !== undefined ? {
                deleteMany: {},
                create: data.nodeModifierIds.map(nodeId => ({
                    nodeModifier: { connect: { id: nodeId } }
                }))
            } : undefined,
            videos: data.videos !== undefined ? {
                deleteMany: {},
                create: data.videos.map(v => ({
                    videoUrl: v.videoUrl,
                    playerId: v.playerId
                }))
            } : undefined
        }
    });

    revalidatePath(`/admin/quests/${data.questPlanId}`);
    revalidatePath(`/planning/quests/${data.questPlanId}`);
    return { success: true };
});

export const deleteQuestEncounter = withActionContext('deleteQuestEncounter', async (questPlanId: string, encounterId: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const existingEncounter = await prisma.questEncounter.findUnique({ where: { id: encounterId } });
    if (!existingEncounter || existingEncounter.questPlanId !== questPlanId) {
        throw new Error("Encounter not found or does not belong to this quest plan.");
    }

    await prisma.questEncounter.delete({
        where: { id: encounterId }
    });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    return { success: true };
});

export const reorderQuestEncounters = withActionContext('reorderQuestEncounters', async (questPlanId: string, encounterIds: string[]) => {
    await requireBotAdmin("MANAGE_QUESTS");

    // Verify ownership and existence
    const existingEncounters = await prisma.questEncounter.findMany({
        where: { id: { in: encounterIds } },
        select: { id: true, questPlanId: true }
    });

    if (existingEncounters.length !== encounterIds.length) {
        throw new Error("One or more encounters not found.");
    }

    if (existingEncounters.some(e => e.questPlanId !== questPlanId)) {
        throw new Error("One or more encounters do not belong to this quest plan.");
    }

    // Two-phase update to avoid unique constraint violations on (questPlanId, sequence).
    // Phase 1: shift all to a large temporary offset so no final value collides with a current one.
    // Phase 2: write the real target sequences.
    const offset = encounterIds.length + 1000;
    await prisma.$transaction([
        ...encounterIds.map((id, index) =>
            prisma.questEncounter.update({ where: { id }, data: { sequence: offset + index } })
        ),
        ...encounterIds.map((id, index) =>
            prisma.questEncounter.update({ where: { id }, data: { sequence: index + 1 } })
        ),
    ]);

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    
    return { success: true };
});

async function sortQuestEncountersByRoute(questPlanId: string) {
    const [sections, unassignedEncounters] = await Promise.all([
        prisma.questRouteSection.findMany({
            where: { questPlanId },
            orderBy: { order: 'asc' },
            include: {
                paths: {
                    orderBy: { order: 'asc' },
                    include: {
                        encounters: {
                            select: { id: true, sequence: true },
                            orderBy: { sequence: 'asc' }
                        }
                    }
                }
            }
        }),
        prisma.questEncounter.findMany({
            where: {
                questPlanId,
                routePathId: null
            },
            select: { id: true, sequence: true },
            orderBy: { sequence: 'asc' }
        })
    ]);

    if (sections.length === 0) {
        throw new Error("This quest has no route sections to sort by.");
    }

    const childSectionsByParentPathId = new Map<string, typeof sections>();
    const rootSections: typeof sections = [];
    for (const section of sections) {
        if (section.parentPathId) {
            const current = childSectionsByParentPathId.get(section.parentPathId) || [];
            current.push(section);
            childSectionsByParentPathId.set(section.parentPathId, current);
        } else {
            rootSections.push(section);
        }
    }

    const orderedEncounterIds: string[] = [];
    const seenEncounterIds = new Set<string>();
    const seenSectionIds = new Set<string>();

    const appendEncounter = (id: string) => {
        if (seenEncounterIds.has(id)) return;
        seenEncounterIds.add(id);
        orderedEncounterIds.push(id);
    };

    const visitSection = (section: (typeof sections)[number]) => {
        if (seenSectionIds.has(section.id)) return;
        seenSectionIds.add(section.id);

        for (const path of section.paths) {
            for (const encounter of path.encounters) {
                appendEncounter(encounter.id);
            }
            for (const childSection of childSectionsByParentPathId.get(path.id) || []) {
                visitSection(childSection);
            }
        }
    };

    for (const section of rootSections) {
        visitSection(section);
    }
    for (const section of sections) {
        visitSection(section);
    }
    for (const encounter of unassignedEncounters) {
        appendEncounter(encounter.id);
    }

    if (orderedEncounterIds.length === 0) {
        return 0;
    }

    const offset = orderedEncounterIds.length + 1000;
    await prisma.$transaction([
        ...orderedEncounterIds.map((id, index) =>
            prisma.questEncounter.update({ where: { id }, data: { sequence: offset + index } })
        ),
        ...orderedEncounterIds.map((id, index) =>
            prisma.questEncounter.update({ where: { id }, data: { sequence: index + 1 } })
        ),
    ]);

    return orderedEncounterIds.length;
}

export const reorderQuestEncountersByRoute = withActionContext('reorderQuestEncountersByRoute', async (questPlanId: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const count = await sortQuestEncountersByRoute(questPlanId);

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');

    return { success: true, count };
});

// --- Bulk Video Assignment ---

export type BulkEncounterVideoInput = {
    questPlanId: string;
    items: { encounterId: string; videoUrl: string; playerId: string | null }[];
};

export const bulkAddEncounterVideos = withActionContext('bulkAddEncounterVideos', async (data: BulkEncounterVideoInput) => {
    await requireBotAdmin("MANAGE_QUESTS");

    if (data.items.length === 0) return { success: true, created: 0, skipped: 0 };

    const encounterIds = [...new Set(data.items.map(i => i.encounterId))];
    const encounters = await prisma.questEncounter.findMany({
        where: { id: { in: encounterIds } },
        select: { id: true, questPlanId: true }
    });

    if (encounters.length !== encounterIds.length) {
        throw new Error("One or more encounters not found.");
    }
    if (encounters.some(e => e.questPlanId !== data.questPlanId)) {
        throw new Error("One or more encounters do not belong to this quest plan.");
    }

    // Skip exact duplicates: same encounter + same URL already exists
    const existing = await prisma.questEncounterVideo.findMany({
        where: { questEncounterId: { in: encounterIds } },
        select: { questEncounterId: true, videoUrl: true }
    });
    const existingSet = new Set(existing.map(v => `${v.questEncounterId}::${v.videoUrl}`));
    const toCreate = data.items.filter(item => !existingSet.has(`${item.encounterId}::${item.videoUrl}`));

    if (toCreate.length > 0) {
        await prisma.questEncounterVideo.createMany({
            data: toCreate.map(item => ({
                questEncounterId: item.encounterId,
                videoUrl: item.videoUrl,
                playerId: item.playerId ?? null,
            }))
        });
    }

    revalidatePath(`/admin/quests/${data.questPlanId}`);
    revalidatePath(`/planning/quests/${data.questPlanId}`);
    return { success: true, created: toCreate.length, skipped: data.items.length - toCreate.length };
});

// --- Sharing & Public Viewing ---

/**
 * Fetch a player's quest plan for read-only viewing. No auth required.
 * Used by share links and player profile quest views.
 */
export const getPlayerQuestPlanForViewing = withActionContext('getPlayerQuestPlanForViewing', async (playerQuestPlanId: string) => {
    const playerPlan = await prisma.playerQuestPlan.findUnique({
        where: { id: playerQuestPlanId },
        include: {
            player: {
                select: { id: true, ingameName: true, avatar: true, allianceId: true }
            },
            questPlan: {
                include: {
                    category: true,
                    requiredTags: true,
                    creators: true,
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
                    encounters: {
                        orderBy: { sequence: 'asc' },
                        include: {
                            defender: true,
                            requiredTags: true,
                            recommendedChampions: true,
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
                    }
                }
            },
            encounters: {
                include: {
                    selectedChampion: true
                }
            },
            synergyChampions: {
                include: {
                    champion: true
                }
            },
            routeChoices: true
        }
    });

    if (!playerPlan) return null;

    // Only allow viewing plans for VISIBLE quests
    if (playerPlan.questPlan.status !== QuestPlanStatus.VISIBLE) return null;

    // Enrich encounter selections with roster data (star/rank/sig)
    const encounterChampionIds = playerPlan.encounters
        .map(e => e.selectedChampionId)
        .filter((id): id is number => id !== null);

    const synergyChampionIds = playerPlan.synergyChampions
        .map(s => s.championId);

    const allSelectedChampionIds = [...new Set([...encounterChampionIds, ...synergyChampionIds])];

    const rosterEntries = allSelectedChampionIds.length > 0
        ? await prisma.roster.findMany({
            where: {
                playerId: playerPlan.playerId,
                championId: { in: allSelectedChampionIds }
            },
            include: {
                champion: true
            },
            orderBy: [
                { stars: 'desc' },
                { rank: 'desc' }
            ]
        })
        : [];

    // Build a map: questEncounterId -> roster entry
    const rosterMap = new Map<string, any>();
    for (const enc of playerPlan.encounters) {
        if (enc.selectedChampionId) {
            // Find "best" entry for this champion
            // If we had a persisted rosterId, we'd prefer it here
            const bestEntry = rosterEntries.find(r => r.championId === enc.selectedChampionId);
            
            if (bestEntry) {
                rosterMap.set(enc.questEncounterId, bestEntry);
            } else if (enc.selectedChampion) {
                // Fallback using the snapshot data (selectedChampion) loaded on the encounter
                rosterMap.set(enc.questEncounterId, {
                    id: `fallback-${enc.id}`,
                    playerId: playerPlan.playerId,
                    championId: enc.selectedChampionId,
                    stars: 0,
                    rank: 0,
                    level: 0,
                    sigLevel: null,
                    isAwakened: false,
                    isAscended: false,
                    ascensionLevel: 0,
                    powerRating: 0,
                    champion: enc.selectedChampion,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
            }
        }
    }

    return {
        ...playerPlan,
        rosterEntries,
        rosterMap: Object.fromEntries(
            Array.from(rosterMap.entries())
        ) as Record<string, any>
    };
});

/**
 * Fetch all quest plans with at least one selection for a given player.
 * No auth required — for the public player profile page.
 */
export const getPlayerQuestPlansForProfile = withActionContext('getPlayerQuestPlansForProfile', async (playerId: string) => {
    const plans = await prisma.playerQuestPlan.findMany({
        where: {
            playerId,
            encounters: {
                some: {
                    OR: [
                        { selectedChampionId: { not: null } },
                        { revivesUsed: { gt: 0 } }
                    ]
                }
            },
            questPlan: {
                status: QuestPlanStatus.VISIBLE
            }
        },
        include: {
            questPlan: {
                select: {
                    id: true,
                    title: true,
                    bannerUrl: true,
                    bannerFit: true,
                    bannerPosition: true,
                    teamLimit: true,
                    category: { select: { name: true } },
                    encounters: { select: { id: true } },
                    minStarLevel: true,
                    maxStarLevel: true,
                    requiredClasses: true
                }
            },
            encounters: {
                where: {
                    OR: [
                        { selectedChampionId: { not: null } },
                        { revivesUsed: { gt: 0 } }
                    ]
                },
                select: { id: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    return plans;
});

/**
 * Get or create the PlayerQuestPlan ID for the current user on a specific quest.
 * Used by the "Share" button to generate a shareable URL.
 */
export const getShareablePlanId = withActionContext('getShareablePlanId', async (questPlanId: string) => {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");

    const questPlan = await prisma.questPlan.findUnique({
        where: { id: questPlanId },
        select: { status: true }
    });

    if (!questPlan || questPlan.status !== QuestPlanStatus.VISIBLE) {
        throw new Error("Quest plan not found or not visible");
    }

    const playerPlan = await prisma.playerQuestPlan.upsert({
        where: {
            playerId_questPlanId: {
                playerId: actingUser.id,
                questPlanId: questPlanId
            }
        },
        create: {
            playerId: actingUser.id,
            questPlanId: questPlanId
        },
        update: {},
        select: { id: true }
    });

    return playerPlan.id;
});
