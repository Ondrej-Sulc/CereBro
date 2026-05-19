'use server'

import { requireBotAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";
import { revalidatePath, revalidateTag } from "next/cache";
import { sortQuestEncountersByRoute } from "./quest-encounters";

function revalidateQuestRoutePlan(questPlanId: string) {
    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
}

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

    revalidateQuestRoutePlan(questPlanId);
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

    revalidateQuestRoutePlan(questPlanId);
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
                            nodeModifierId: node.nodeModifierId,
                            isHighlighted: node.isHighlighted
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

    revalidateQuestRoutePlan(questPlanId);
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

    revalidateQuestRoutePlan(questPlanId);
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

    revalidateQuestRoutePlan(questPlanId);
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

    revalidateQuestRoutePlan(questPlanId);
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

    revalidateQuestRoutePlan(questPlanId);
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

    revalidateQuestRoutePlan(questPlanId);
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

    revalidateQuestRoutePlan(questPlanId);
    return { success: true };
});
