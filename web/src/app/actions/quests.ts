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
            include: {
                children: true,
            }
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

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
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

/**
 * Aggregate champion pick counts per encounter for a quest plan.
 * Returns a map: encounterId -> { championId, count }[] sorted by count desc.
 */
export type PopularCountersMap = Record<string, { championId: number; count: number }[]>;

export const getEncounterPopularCounters = unstable_cache(
    async (questPlanId: string): Promise<PopularCountersMap> => {
        const results = await prisma.playerQuestEncounter.groupBy({
            by: ['questEncounterId', 'selectedChampionId'],
            where: {
                questPlanId,
                selectedChampionId: { not: null }
            },
            _count: { selectedChampionId: true }
        });

        const map: PopularCountersMap = {};
        for (const row of results) {
            if (!row.selectedChampionId) continue;
            if (!map[row.questEncounterId]) map[row.questEncounterId] = [];
            map[row.questEncounterId].push({
                championId: row.selectedChampionId,
                count: row._count.selectedChampionId
            });
        }

        // Sort each encounter's picks by count descending
        for (const encId of Object.keys(map)) {
            map[encId].sort((a, b) => b.count - a.count);
        }

        return map;
    },
    ['quest-popular-counters'],
    { tags: ['quest-popular-counters'] }
);

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
    revalidateTag('quest-popular-counters', 'default');
    return { success: true };
}

// --- Quest Encounters ---

export type QuestEncounterCreateInput = {
    questPlanId: string;
    sequence: number;
    videoUrl?: string | null;
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
            } : undefined
        }
    });

    revalidatePath(`/admin/quests/${data.questPlanId}`);
    revalidatePath(`/planning/quests/${data.questPlanId}`);
    return { success: true, encounterId: encounter.id };
}

export type QuestEncounterUpdateInput = {
    id: string;
    questPlanId: string;
    sequence?: number;
    videoUrl?: string | null;
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
            }
        }
    });

    if (!playerPlan) return null;

    // Only allow viewing plans for VISIBLE quests
    if (playerPlan.questPlan.status !== QuestPlanStatus.VISIBLE) return null;

    // Enrich encounter selections with roster data (star/rank/sig)
    const selectedChampionIds = playerPlan.encounters
        .map(e => e.selectedChampionId)
        .filter((id): id is number => id !== null);

    const rosterEntries = selectedChampionIds.length > 0
        ? await prisma.roster.findMany({
            where: {
                playerId: playerPlan.playerId,
                championId: { in: selectedChampionIds }
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
