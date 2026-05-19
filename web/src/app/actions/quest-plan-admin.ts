'use server'

import { requireBotAdmin } from "@/lib/auth-helpers";
import { deleteFromGcs, uploadToGcs } from "@/lib/gcs";
import logger from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";
import { ChampionClass, QuestPlanStatus } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

function revalidateQuestPlanAdminList() {
    revalidatePath('/admin/quests');
    revalidatePath('/planning/quests');
}

function revalidateQuestPlanAdminDetail(questPlanId: string) {
    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
}

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

        revalidateQuestPlanAdminDetail(questPlanId);
        revalidateTag('quest-plan-detail', 'default');
        revalidateTag(`quest-featured-picks-${questPlanId}`, 'default');

        return { success: true };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Failed to update featured players";
        logger.error({ err: e, questPlanId }, "Failed to update featured quest players");
        return { success: false, error: message };
    }
});

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
    requiredTagIds?: number[];
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

    revalidateQuestPlanAdminList();
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

    revalidateQuestPlanAdminList();
    revalidateQuestPlanAdminDetail(data.id);
    return { success: true };
});

export const deleteQuestPlan = withActionContext('deleteQuestPlan', async (id: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    await prisma.questPlan.delete({
        where: { id }
    });

    revalidateQuestPlanAdminList();
    return { success: true };
});

export const uploadQuestBanner = withActionContext('uploadQuestBanner', async (questPlanId: string, formData: FormData) => {
    await requireBotAdmin("MANAGE_QUESTS");

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

    const fileName = `quest-banners/${questPlanId}-${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const publicUrl = await uploadToGcs(buffer, fileName, file.type);

    try {
        await prisma.questPlan.update({
            where: { id: questPlanId },
            data: { bannerUrl: publicUrl }
        });
    } catch (error) {
        await deleteFromGcs(fileName);
        logger.error({ err: error, questPlanId, fileName }, "Failed to update quest plan banner URL, deleted GCS object");
        throw error;
    }

    revalidateQuestPlanAdminDetail(questPlanId);
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

    revalidateQuestPlanAdminDetail(id);
    return { success: true };
});
