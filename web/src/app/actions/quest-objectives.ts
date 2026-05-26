'use server'

import { requireBotAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";
import { ChampionClass, QuestObjectiveTagMode } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";

export type QuestObjectiveRouteChoiceInput = {
    questRouteSectionId: string;
    questRoutePathId: string;
    isLocked?: boolean;
};

export type QuestObjectiveUpsertInput = {
    id?: string;
    questPlanId: string;
    slug: string;
    title: string;
    shortTitle?: string | null;
    description?: string | null;
    order: number;
    isVisible?: boolean;
    teamLimitOverride?: number | null;
    minStarLevel?: number | null;
    maxStarLevel?: number | null;
    requiredClasses?: ChampionClass[];
    requiredTagMode?: QuestObjectiveTagMode;
    requiredTagIds?: number[];
    endpointEncounterId?: string | null;
    defaultShowContinuation?: boolean;
    routeChoices?: QuestObjectiveRouteChoiceInput[];
};

function revalidateQuestObjectivePlan(questPlanId: string) {
    revalidatePath(`/admin/quests/${questPlanId}`);
    revalidatePath(`/planning/quests/${questPlanId}`);
    revalidateTag('quest-plan-detail', 'default');
    revalidateTag('quest-plans', 'default');
}

function normalizeSlug(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

async function assertObjectiveRefsBelongToQuest({
    questPlanId,
    endpointEncounterId,
    routeChoices = [],
}: {
    questPlanId: string;
    endpointEncounterId?: string | null;
    routeChoices?: QuestObjectiveRouteChoiceInput[];
}) {
    if (endpointEncounterId) {
        const endpoint = await prisma.questEncounter.findUnique({
            where: { id: endpointEncounterId },
            select: { questPlanId: true },
        });
        if (!endpoint || endpoint.questPlanId !== questPlanId) {
            throw new Error("Endpoint encounter does not belong to this quest plan.");
        }
    }

    if (routeChoices.length === 0) return;

    const sectionIds = [...new Set(routeChoices.map(choice => choice.questRouteSectionId))];
    const pathIds = [...new Set(routeChoices.map(choice => choice.questRoutePathId))];
    const [sections, paths] = await Promise.all([
        prisma.questRouteSection.findMany({
            where: { id: { in: sectionIds } },
            select: { id: true, questPlanId: true },
        }),
        prisma.questRoutePath.findMany({
            where: { id: { in: pathIds } },
            select: { id: true, sectionId: true, section: { select: { questPlanId: true } } },
        }),
    ]);

    const sectionQuestById = new Map(sections.map(section => [section.id, section.questPlanId]));
    const pathById = new Map(paths.map(path => [path.id, path]));

    for (const choice of routeChoices) {
        if (sectionQuestById.get(choice.questRouteSectionId) !== questPlanId) {
            throw new Error("Objective route section does not belong to this quest plan.");
        }
        const path = pathById.get(choice.questRoutePathId);
        if (!path || path.section.questPlanId !== questPlanId || path.sectionId !== choice.questRouteSectionId) {
            throw new Error("Objective route path does not belong to the selected route section.");
        }
    }
}

export const upsertQuestObjective = withActionContext('upsertQuestObjective', async (input: QuestObjectiveUpsertInput) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const slug = normalizeSlug(input.slug);
    if (!slug) throw new Error("Objective slug is required.");
    if (!input.title.trim()) throw new Error("Objective title is required.");
    if (!Number.isInteger(input.order) || input.order < 1) throw new Error("Objective order must be a positive integer.");

    await assertObjectiveRefsBelongToQuest({
        questPlanId: input.questPlanId,
        endpointEncounterId: input.endpointEncounterId,
        routeChoices: input.routeChoices,
    });

    const objective = await prisma.$transaction(async (tx) => {
        const saved = await tx.questObjective.upsert({
            where: input.id
                ? { id: input.id }
                : { questPlanId_slug: { questPlanId: input.questPlanId, slug } },
            create: {
                questPlanId: input.questPlanId,
                slug,
                title: input.title.trim(),
                shortTitle: input.shortTitle?.trim() || null,
                description: input.description?.trim() || null,
                order: input.order,
                isVisible: input.isVisible ?? true,
                teamLimitOverride: input.teamLimitOverride ?? null,
                minStarLevel: input.minStarLevel ?? null,
                maxStarLevel: input.maxStarLevel ?? null,
                requiredClasses: input.requiredClasses ?? [],
                requiredTagMode: input.requiredTagMode ?? QuestObjectiveTagMode.ALL,
                endpointEncounterId: input.endpointEncounterId || null,
                defaultShowContinuation: Boolean(input.defaultShowContinuation),
                requiredTags: input.requiredTagIds ? { connect: input.requiredTagIds.map(id => ({ id })) } : undefined,
            },
            update: {
                slug,
                title: input.title.trim(),
                shortTitle: input.shortTitle?.trim() || null,
                description: input.description?.trim() || null,
                order: input.order,
                isVisible: input.isVisible ?? true,
                teamLimitOverride: input.teamLimitOverride ?? null,
                minStarLevel: input.minStarLevel ?? null,
                maxStarLevel: input.maxStarLevel ?? null,
                requiredClasses: input.requiredClasses ?? [],
                requiredTagMode: input.requiredTagMode ?? QuestObjectiveTagMode.ALL,
                endpointEncounterId: input.endpointEncounterId || null,
                defaultShowContinuation: Boolean(input.defaultShowContinuation),
                requiredTags: { set: (input.requiredTagIds ?? []).map(id => ({ id })) },
            },
        });

        if (input.routeChoices !== undefined) {
            await tx.questObjectiveRouteChoice.deleteMany({ where: { questObjectiveId: saved.id } });
            if (input.routeChoices.length > 0) {
                await tx.questObjectiveRouteChoice.createMany({
                    data: input.routeChoices.map(choice => ({
                        questObjectiveId: saved.id,
                        questRouteSectionId: choice.questRouteSectionId,
                        questRoutePathId: choice.questRoutePathId,
                        isLocked: Boolean(choice.isLocked),
                    })),
                });
            }
        }

        return saved;
    });

    revalidateQuestObjectivePlan(input.questPlanId);
    return { success: true, objectiveId: objective.id };
});

export const deleteQuestObjective = withActionContext('deleteQuestObjective', async (questPlanId: string, objectiveId: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const objective = await prisma.questObjective.findUnique({
        where: { id: objectiveId },
        select: { questPlanId: true },
    });
    if (!objective || objective.questPlanId !== questPlanId) {
        throw new Error("Objective not found or does not belong to this quest plan.");
    }

    await prisma.questObjective.delete({ where: { id: objectiveId } });
    revalidateQuestObjectivePlan(questPlanId);
    return { success: true };
});

async function findRoutePath(questPlanId: string, sectionTitle: string, pathTitle: string, parentPathTitle?: string) {
    return prisma.questRoutePath.findFirst({
        where: {
            title: pathTitle,
            section: {
                questPlanId,
                title: sectionTitle,
                ...(parentPathTitle ? { parentPath: { title: parentPathTitle } } : {}),
            },
        },
        select: { id: true, sectionId: true },
        orderBy: { order: 'asc' },
    });
}

async function findEncounter(questPlanId: string, defenderName: string, routePathId?: string) {
    return prisma.questEncounter.findFirst({
        where: {
            questPlanId,
            defender: { name: defenderName },
            ...(routePathId ? { routePathId } : {}),
        },
        select: { id: true },
        orderBy: { sequence: 'asc' },
    });
}

export const seedNecropolisCarinaObjectives = withActionContext('seedNecropolisCarinaObjectives', async (questPlanId: string) => {
    await requireBotAdmin("MANAGE_QUESTS");

    const quest = await prisma.questPlan.findUnique({ where: { id: questPlanId }, select: { id: true, title: true } });
    if (!quest || !quest.title.toLowerCase().includes("necropolis")) {
        throw new Error("This seed is only intended for The Necropolis quest plan.");
    }

    const startLeft = await findRoutePath(questPlanId, "Start", "Left");
    const startRight = await findRoutePath(questPlanId, "Start", "Right");
    const leftPath1 = await findRoutePath(questPlanId, "Left S1", "Path 1", "Left");
    const leftPath3 = await findRoutePath(questPlanId, "Left S1", "Path 3", "Left");
    const leftS2Path1 = await findRoutePath(questPlanId, "Left S2", "Path 1", "Left");
    const rightPath4 = await findRoutePath(questPlanId, "Right S1", "Path 4", "Right");
    const rightPath6 = await findRoutePath(questPlanId, "Right S1", "Path 6", "Right");

    const missingRoute = [
        ["Start / Left", startLeft],
        ["Start / Right", startRight],
        ["Left S1 / Path 1", leftPath1],
        ["Left S1 / Path 3", leftPath3],
        ["Left S2 / Path 1", leftS2Path1],
        ["Right S1 / Path 4", rightPath4],
        ["Right S1 / Path 6", rightPath6],
    ].find(([, value]) => !value);
    if (missingRoute) throw new Error(`Could not find route path: ${missingRoute[0]}`);

    const psychoPath1 = await findRoutePath(questPlanId, "Left S1", "S1 Shared", "Path 1");
    const psychoPath3 = await findRoutePath(questPlanId, "Left S1", "S1 Shared", "Path 3");
    const sunspotPath4 = await findRoutePath(questPlanId, "Right S1", "S1 Shared", "Path 4");
    const sunspotPath6 = await findRoutePath(questPlanId, "Right S1", "S1 Shared", "Path 6");
    const [grandmaster, psychoManPath1, psychoManPath3, sunspotPath4Encounter, sunspotPath6Encounter] = await Promise.all([
        findEncounter(questPlanId, "Nameless Grandmaster"),
        psychoPath1 ? findEncounter(questPlanId, "Psycho-Man", psychoPath1.id) : null,
        psychoPath3 ? findEncounter(questPlanId, "Psycho-Man", psychoPath3.id) : null,
        sunspotPath4 ? findEncounter(questPlanId, "Sunspot", sunspotPath4.id) : null,
        sunspotPath6 ? findEncounter(questPlanId, "Sunspot", sunspotPath6.id) : null,
    ]);

    const tags = await prisma.tag.findMany({
        where: {
            OR: [
                { name: "10 Year Challenge", category: "Carina's Challenges" },
                { name: "Deathless", category: "Organization" },
                { name: "Carina's Challengers", category: "Carina's Challenges" },
                { name: "God", category: "Attributes" },
                { name: "Cul's Worthy", category: "Organization" },
                { name: "Dimensional Being", category: "Attributes" },
            ],
        },
        select: { id: true, name: true, category: true },
    });
    const tagId = (name: string, category: string) => {
        const tag = tags.find(candidate => candidate.name === name && candidate.category === category);
        if (!tag) throw new Error(`Required tag is missing: ${name} (${category})`);
        return tag.id;
    };

    const objectives: QuestObjectiveUpsertInput[] = [
        {
            questPlanId,
            slug: "ten-year-challenge",
            title: "10 Year Challenge",
            shortTitle: "10 Year",
            order: 1,
            requiredTagIds: [tagId("10 Year Challenge", "Carina's Challenges")],
            endpointEncounterId: grandmaster?.id ?? null,
            routeChoices: [
                { questRouteSectionId: startLeft!.sectionId, questRoutePathId: startLeft!.id },
                { questRouteSectionId: leftPath1!.sectionId, questRoutePathId: leftPath1!.id },
                { questRouteSectionId: leftS2Path1!.sectionId, questRoutePathId: leftS2Path1!.id },
            ],
        },
        {
            questPlanId,
            slug: "deathless",
            title: "Deathless",
            order: 2,
            minStarLevel: 7,
            maxStarLevel: 7,
            requiredTagIds: [tagId("Deathless", "Organization")],
            endpointEncounterId: grandmaster?.id ?? null,
            routeChoices: [
                { questRouteSectionId: startLeft!.sectionId, questRoutePathId: startLeft!.id },
                { questRouteSectionId: leftPath1!.sectionId, questRoutePathId: leftPath1!.id },
                { questRouteSectionId: leftS2Path1!.sectionId, questRoutePathId: leftS2Path1!.id },
            ],
        },
        {
            questPlanId,
            slug: "masterful-mutants",
            title: "Masterful Mutants",
            shortTitle: "Mutants",
            order: 3,
            requiredClasses: [ChampionClass.MUTANT],
            endpointEncounterId: psychoManPath3?.id ?? null,
            routeChoices: [
                { questRouteSectionId: startLeft!.sectionId, questRoutePathId: startLeft!.id, isLocked: true },
                { questRouteSectionId: leftPath3!.sectionId, questRoutePathId: leftPath3!.id, isLocked: true },
            ],
        },
        {
            questPlanId,
            slug: "carinas-challengers",
            title: "Carina's Challengers",
            shortTitle: "Carina",
            order: 4,
            requiredTagIds: [tagId("Carina's Challengers", "Carina's Challenges")],
            endpointEncounterId: sunspotPath4Encounter?.id ?? null,
            routeChoices: [
                { questRouteSectionId: startRight!.sectionId, questRoutePathId: startRight!.id, isLocked: true },
                { questRouteSectionId: rightPath4!.sectionId, questRoutePathId: rightPath4!.id, isLocked: true },
            ],
        },
        {
            questPlanId,
            slug: "worthy-gods",
            title: "Worthy Gods",
            shortTitle: "Gods",
            order: 5,
            requiredTagMode: QuestObjectiveTagMode.ANY,
            requiredTagIds: [tagId("God", "Attributes"), tagId("Cul's Worthy", "Organization")],
            endpointEncounterId: psychoManPath1?.id ?? null,
            routeChoices: [
                { questRouteSectionId: startLeft!.sectionId, questRoutePathId: startLeft!.id, isLocked: true },
                { questRouteSectionId: leftPath1!.sectionId, questRoutePathId: leftPath1!.id, isLocked: true },
            ],
        },
        {
            questPlanId,
            slug: "out-of-this-world",
            title: "Out Of This World",
            shortTitle: "Dimensional",
            order: 6,
            requiredTagIds: [tagId("Dimensional Being", "Attributes")],
            endpointEncounterId: sunspotPath6Encounter?.id ?? null,
            routeChoices: [
                { questRouteSectionId: startRight!.sectionId, questRoutePathId: startRight!.id, isLocked: true },
                { questRouteSectionId: rightPath6!.sectionId, questRoutePathId: rightPath6!.id, isLocked: true },
            ],
        },
    ];

    for (const objective of objectives) {
        await upsertQuestObjective(objective);
    }

    revalidateQuestObjectivePlan(questPlanId);
    return { success: true, count: objectives.length };
});
