'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance, requireBotAdmin } from "@/lib/auth-helpers";
import { revalidatePath, unstable_cache, revalidateTag } from "next/cache";
import logger from "@/lib/logger";
import { ChampionClass, QuestPlanStatus } from "@prisma/client";
import { uploadToGcs, deleteFromGcs } from "@/lib/gcs";
import { QuestWithRelations, QuestSummary } from "@/types/quests";

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

export async function createQuestCategory(name: string, order: number = 0, parentId?: string) {
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
}

export async function updateQuestCategory(
    id: string,
    data: { name?: string; order?: number; thumbnailUrl?: string | null; parentId?: string | null }
) {
    await requireBotAdmin("MANAGE_QUESTS");

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
}

export async function uploadQuestCategoryThumbnail(categoryId: string, formData: FormData) {
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
        await deleteFromGcs(fileName);
        console.error("Failed to update quest category with thumbnail URL, deleted GCS object.", error);
        throw error;
    }

    revalidateTag('quest-categories', 'default');
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');

    return { success: true, url: publicUrl };
}

// --- Quest Plans ---

export async function getQuestPlans(categoryId?: string, status?: QuestPlanStatus, currentPlayerId?: string): Promise<QuestSummary[]> {
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

                return {
                    ...quest,
                    creators: creatorsWithUsers
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
}

export const getQuestPlanById = unstable_cache(
    async (id: string): Promise<QuestWithRelations | null> => {
        const quest = await prisma.questPlan.findUnique({
            where: { id },
            include: {
                category: true,
                requiredTags: true,
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
                        recommendedChampions: true,
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

export async function updateFeaturedPlayers(
    questPlanId: string,
    playerIds: string[]
): Promise<{ success: boolean; error?: string }> {
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
}

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

export async function createQuestPlan(data: QuestPlanCreateInput) {
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
}

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

export async function updateQuestPlan(data: QuestPlanUpdateInput) {
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
}

export async function deleteQuestPlan(id: string) {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questPlan.delete({
        where: { id }
    });

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
}

export async function uploadQuestBanner(questPlanId: string, formData: FormData) {
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
}

export async function duplicateQuestPlan(id: string) {
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
}

export async function clearRecommendedChampionsInQuest(id: string) {
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
}

// --- User Progress / Selections ---

export async function savePlayerQuestCounter(questPlanId: string, questEncounterId: string, selectedChampionId: number | null) {
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
}

/**
 * Save or remove a synergy champion for a player's quest plan.
 * Synergy champions are not assigned to any specific encounter but count towards the team limit.
 */
export async function savePlayerQuestSynergy(questPlanId: string, championId: number, isRemoving: boolean = false) {
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
        await prisma.playerQuestSynergyChampion.delete({
            where: {
                playerQuestPlanId_championId: {
                    playerQuestPlanId: playerPlan.id,
                    championId: championId
                }
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
            const hasTag = quest.requiredTags.some(qt => champ.tags.some(ct => ct.id === qt.id));
            if (!hasTag) throw new Error(`Quest requires specific tags.`);
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
}

// --- Quest Encounters ---

export type QuestEncounterCreateInput = {
    questPlanId: string;
    sequence: number;
    videoUrl?: string | null;
    videos?: { videoUrl: string; playerId?: string | null }[];
    tips?: string;
    defenderId?: number;
    recommendedTagNames?: string[];
    recommendedChampionIds?: number[];
    requiredTagIds?: number[];
    nodeModifierIds?: string[];
};

export async function createQuestEncounter(data: QuestEncounterCreateInput) {
    await requireBotAdmin("MANAGE_QUESTS");

    if (data.defenderId) {
        const champ = await prisma.champion.findUnique({ where: { id: data.defenderId } });
        if (!champ) {
            throw new Error(`Champion with ID ${data.defenderId} not found.`);
        }
    }

    const encounter = await prisma.questEncounter.create({
        data: {
            sequence: data.sequence,
            videoUrl: data.videoUrl,
            tips: data.tips,
            questPlanId: data.questPlanId,
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
}

export async function bulkCreateQuestEncounters(questPlanId: string, defenderIds: (number | null)[], startSequence: number) {
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
}

const IGNORED_NODE_TITLES = new Set(["champion boost", "health", "warning"]);

export type BulkNodeImportResult = {
    champion: string;
    encounterId: string;
    encounterCreated: boolean;
    nodesLinked: number;
    nodesCreated: number;
    nodesSkipped: number;
};

export async function bulkImportNodeModifiersFromJson(questPlanId: string, jsonData: string) {
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
}

export type QuestEncounterUpdateInput = {
    id: string;
    questPlanId: string;
    sequence?: number;
    videoUrl?: string | null;
    videos?: { videoUrl: string; playerId?: string | null }[];
    tips?: string | null;
    defenderId?: number | null;
    recommendedTagNames?: string[];
    recommendedChampionIds?: number[];
    requiredTagIds?: number[];
    nodeModifierIds?: string[];
};

export async function updateQuestEncounter(data: QuestEncounterUpdateInput) {
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

    const encounter = await prisma.questEncounter.update({
        where: { id: data.id },
        data: {
            sequence: data.sequence,
            videoUrl: data.videoUrl,
            tips: data.tips,
            defenderId: data.defenderId,
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
}

export async function deleteQuestEncounter(questPlanId: string, encounterId: string) {
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
}

export async function reorderQuestEncounters(questPlanId: string, encounterIds: string[]) {
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
}

// --- Sharing & Public Viewing ---

/**
 * Fetch a player's quest plan for read-only viewing. No auth required.
 * Used by share links and player profile quest views.
 */
export async function getPlayerQuestPlanForViewing(playerQuestPlanId: string) {
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
            }
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
}

/**
 * Fetch all quest plans with at least one selection for a given player.
 * No auth required — for the public player profile page.
 */
export async function getPlayerQuestPlansForProfile(playerId: string) {
    const plans = await prisma.playerQuestPlan.findMany({
        where: {
            playerId,
            encounters: {
                some: {
                    selectedChampionId: { not: null }
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
                where: { selectedChampionId: { not: null } },
                select: { id: true }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    return plans;
}

/**
 * Get or create the PlayerQuestPlan ID for the current user on a specific quest.
 * Used by the "Share" button to generate a shareable URL.
 */
export async function getShareablePlanId(questPlanId: string) {
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
}
