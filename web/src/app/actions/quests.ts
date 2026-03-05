'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { ChampionClass, QuestPlanStatus } from "@prisma/client";
import { uploadToGcs } from "@/lib/gcs";

// --- Quest Categories ---

export async function getQuestCategories() {
    return prisma.questCategory.findMany({
        orderBy: { order: 'asc' },
        include: {
            children: true,
        }
    });
}

export async function createQuestCategory(name: string, order: number = 0, parentId?: string) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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

export async function getQuestPlans(categoryId?: string) {
    return prisma.questPlan.findMany({
        where: categoryId ? { categoryId } : undefined,
        orderBy: { createdAt: 'desc' },
        include: {
            category: true,
            creator: true,
            encounters: {
                include: {
                    defender: true
                }
            }
        }
    });
}

export async function getQuestPlanById(id: string) {
    return prisma.questPlan.findUnique({
        where: { id },
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
            }
        }
    });
}

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
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

    await prisma.questPlan.delete({
        where: { id }
    });

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
}

export async function uploadQuestBanner(questPlanId: string, formData: FormData) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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
    await prisma.questPlan.update({
        where: { id: questPlanId },
        data: { bannerUrl: publicUrl }
    });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);

    return { success: true, url: publicUrl };
}

export async function duplicateQuestPlan(id: string) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

    const encounters = await prisma.questEncounter.findMany({
        where: { questPlanId: id },
        select: { id: true }
    });

    for (const encounter of encounters) {
        await prisma.questEncounter.update({
            where: { id: encounter.id },
            data: {
                recommendedChampions: {
                    set: []
                }
            }
        });
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
            selectedChampionId: selectedChampionId
        },
        update: {
            selectedChampionId: selectedChampionId
        }
    });

    revalidatePath(`/planning/quests/${questPlanId}`);
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
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser) throw new Error("Unauthorized");
    const botUser = actingUser.botUserId ? await prisma.botUser.findUnique({ where: { id: actingUser.botUserId } }) : null;
    if (!botUser || !botUser.isBotAdmin) throw new Error("Unauthorized");

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
