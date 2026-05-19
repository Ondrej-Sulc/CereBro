'use server'

import { requireBotAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { orderQuestEncounterIdsByRoute } from "@/lib/quest-planning-route-progress";
import { withActionContext } from "@/lib/with-request-context";
import { revalidatePath, revalidateTag } from "next/cache";

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
    nodeLinks?: { nodeModifierId: string; isHighlighted?: boolean }[];
    routePathId?: string | null;
};

function normalizeEncounterNodeLinks(data: { nodeModifierIds?: string[]; nodeLinks?: { nodeModifierId: string; isHighlighted?: boolean }[] }) {
    if (data.nodeLinks !== undefined) {
        return data.nodeLinks
            .filter(link => link.nodeModifierId)
            .map(link => ({
                nodeModifierId: link.nodeModifierId,
                isHighlighted: Boolean(link.isHighlighted)
            }));
    }

    if (data.nodeModifierIds !== undefined) {
        return data.nodeModifierIds
            .filter(Boolean)
            .map(nodeModifierId => ({ nodeModifierId, isHighlighted: false }));
    }

    return undefined;
}

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

    const nodeLinks = normalizeEncounterNodeLinks(data);

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
            nodes: nodeLinks ? {
                create: nodeLinks.map(node => ({
                    nodeModifierId: node.nodeModifierId,
                    isHighlighted: node.isHighlighted
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

        let encounter = existingEncounters.find(e =>
            e.defender?.name.toLowerCase() === championNameLower
        ) ?? null;

        let encounterCreated = false;
        if (!encounter) {
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
    nodeLinks?: { nodeModifierId: string; isHighlighted?: boolean }[];
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

    const nodeLinks = normalizeEncounterNodeLinks(data);

    await prisma.questEncounter.update({
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
            nodes: nodeLinks !== undefined ? {
                deleteMany: {},
                create: nodeLinks.map(node => ({
                    nodeModifierId: node.nodeModifierId,
                    isHighlighted: node.isHighlighted
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

export async function sortQuestEncountersByRoute(questPlanId: string) {
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

    const orderedEncounterIds = orderQuestEncounterIdsByRoute({
        routeSections: sections,
        unassignedEncounters,
    });

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
