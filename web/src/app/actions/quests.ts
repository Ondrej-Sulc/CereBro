'use server'

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";
import logger from "@/lib/logger";
import { ChampionClass } from "@prisma/client";

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
    if (!actingUser || !actingUser.isBotAdmin) throw new Error("Unauthorized");

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
    categoryId?: string;
    minStarLevel?: number;
    maxStarLevel?: number;
    requiredClasses?: ChampionClass[];
    requiredTagIds?: number[]; // Note: Tag.id is actually Int in the schema
};

export async function createQuestPlan(data: QuestPlanCreateInput) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.isBotAdmin) throw new Error("Unauthorized");

    const plan = await prisma.questPlan.create({
        data: {
            title: data.title,
            categoryId: data.categoryId,
            creatorId: actingUser.id,
            minStarLevel: data.minStarLevel,
            maxStarLevel: data.maxStarLevel,
            requiredClasses: data.requiredClasses || [],
            requiredTags: data.requiredTagIds ? {
                connect: data.requiredTagIds.map(id => ({ id }))
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
    categoryId?: string | null;
    minStarLevel?: number | null;
    maxStarLevel?: number | null;
    requiredClasses?: ChampionClass[];
    requiredTagIds?: number[];
};

export async function updateQuestPlan(data: QuestPlanUpdateInput) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.isBotAdmin) throw new Error("Unauthorized");

    await prisma.questPlan.update({
        where: { id: data.id },
        data: {
            title: data.title,
            categoryId: data.categoryId,
            minStarLevel: data.minStarLevel,
            maxStarLevel: data.maxStarLevel,
            requiredClasses: data.requiredClasses,
            requiredTags: data.requiredTagIds !== undefined ? {
                set: data.requiredTagIds.map(id => ({ id }))
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
    if (!actingUser || !actingUser.isBotAdmin) throw new Error("Unauthorized");

    await prisma.questPlan.delete({
        where: { id }
    });

    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
    return { success: true };
}

// --- User Progress / Selections ---

export async function savePlayerQuestCounter(questPlanId: string, questEncounterId: string, selectedChampionId: number | null) {
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
    tips?: string;
    defenderId?: number;
    recommendedTagNames?: string[];
    recommendedChampionIds?: number[];
    nodeModifierIds?: string[];
};

export async function createQuestEncounter(data: QuestEncounterCreateInput) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.isBotAdmin) throw new Error("Unauthorized");

    if (data.defenderId) {
        const champ = await prisma.champion.findUnique({ where: { id: data.defenderId } });
        if (!champ) {
            throw new Error(`Champion with ID ${data.defenderId} not found.`);
        }
    }

    const encounter = await prisma.questEncounter.create({
        data: {
            sequence: data.sequence,
            tips: data.tips,
            questPlanId: data.questPlanId,
            defenderId: data.defenderId,
            recommendedTags: data.recommendedTagNames || [],
            recommendedChampions: data.recommendedChampionIds ? {
                connect: data.recommendedChampionIds.map(id => ({ id }))
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
    tips?: string | null;
    defenderId?: number | null;
    recommendedTagNames?: string[];
    recommendedChampionIds?: number[];
    nodeModifierIds?: string[];
};

export async function updateQuestEncounter(data: QuestEncounterUpdateInput) {
    const actingUser = await getUserPlayerWithAlliance();
    if (!actingUser || !actingUser.isBotAdmin) throw new Error("Unauthorized");

    if (data.defenderId) {
        const champ = await prisma.champion.findUnique({ where: { id: data.defenderId } });
        if (!champ) {
            throw new Error(`Champion with ID ${data.defenderId} not found.`);
        }
    }

    const encounter = await prisma.questEncounter.update({
        where: { id: data.id },
        data: {
            sequence: data.sequence,
            tips: data.tips,
            defenderId: data.defenderId,
            recommendedTags: data.recommendedTagNames !== undefined ? data.recommendedTagNames : undefined,
            recommendedChampions: data.recommendedChampionIds !== undefined ? {
                set: data.recommendedChampionIds.map(id => ({ id }))
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
    if (!actingUser || !actingUser.isBotAdmin) throw new Error("Unauthorized");

    await prisma.questEncounter.delete({
        where: { id: encounterId }
    });

    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    return { success: true };
}
