'use server'

import { requireBotAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";
import { QuestPlanStatus } from "@prisma/client";
import { revalidatePath, revalidateTag } from "next/cache";
import { sortQuestEncountersByRoute } from "./quest-encounters";
import {
    formatCategoryRef,
    formatChampionRef,
    formatTagRef,
    makeRoutePathKey,
    makeRouteSectionKey,
    parseQuestPlanExport,
    summarizeMissingQuestImportReferences,
    tagKey,
    uniqueStrings,
    type MissingQuestImportReferences,
    type QuestExportCategory,
    type QuestExportChampionRef,
    type QuestExportPlayerRef,
    type QuestExportTagRef,
    type QuestPlanExportPayload,
} from "@/lib/quest-plan-transfer";

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
            objectives: {
                orderBy: { order: 'asc' },
                include: {
                    requiredTags: true,
                    routeChoices: true,
                    routeRecommendations: {
                        orderBy: { order: 'asc' },
                        include: { choices: true }
                    },
                    endpointEncounter: { select: { sequence: true } }
                }
            },
            encounters: {
                orderBy: { sequence: 'asc' },
                include: {
                    defender: { select: { slug: true, name: true } },
                    recommendedChampions: { select: { slug: true, name: true } },
                    objectiveRecommendationSets: {
                        include: {
                            objective: { select: { slug: true } },
                            champions: {
                                orderBy: { order: 'asc' },
                                include: {
                                    champion: { select: { slug: true, name: true } }
                                }
                            }
                        }
                    },
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
        objectives: quest.objectives.map(objective => ({
            slug: objective.slug,
            title: objective.title,
            shortTitle: objective.shortTitle,
            description: objective.description,
            imageUrl: objective.imageUrl,
            imageFit: objective.imageFit,
            imagePosition: objective.imagePosition,
            order: objective.order,
            isVisible: objective.isVisible,
            teamLimitOverride: objective.teamLimitOverride,
            minStarLevel: objective.minStarLevel,
            maxStarLevel: objective.maxStarLevel,
            requiredClasses: objective.requiredClasses,
            requiredTagMode: objective.requiredTagMode,
            requiredTags: objective.requiredTags.map(tag => ({ name: tag.name, category: tag.category })),
            endpointEncounterSequence: objective.endpointEncounter?.sequence ?? null,
            defaultShowContinuation: objective.defaultShowContinuation,
            routeChoices: objective.routeChoices
                .map(choice => ({
                    routeSectionKey: sectionKeyById.get(choice.questRouteSectionId) ?? "",
                    routePathKey: pathKeyById.get(choice.questRoutePathId) ?? "",
                    isLocked: choice.isLocked,
                }))
                .filter(choice => choice.routeSectionKey && choice.routePathKey),
            routeRecommendations: objective.routeRecommendations.map(recommendation => ({
                slug: recommendation.slug,
                title: recommendation.title,
                order: recommendation.order,
                choices: recommendation.choices
                    .map(choice => ({
                        routeSectionKey: sectionKeyById.get(choice.questRouteSectionId) ?? "",
                        routePathKey: pathKeyById.get(choice.questRoutePathId) ?? "",
                    }))
                    .filter(choice => choice.routeSectionKey && choice.routePathKey),
            })),
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
            objectiveRecommendedChampions: Object.fromEntries(
                encounter.objectiveRecommendationSets.map(set => [
                    set.objective.slug,
                    set.champions.map(item => ({
                        slug: item.champion.slug,
                        name: item.champion.name,
                    }))
                ])
            ),
            requiredTags: encounter.requiredTags.map(tag => ({ name: tag.name, category: tag.category })),
            nodes: encounter.nodes.map(node => ({
                name: node.nodeModifier.name,
                description: node.nodeModifier.description,
                isHighlighted: node.isHighlighted
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
            ...encounter.recommendedChampions,
            ...Object.values(encounter.objectiveRecommendedChampions).flat()
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
        ...payload.objectives.flatMap(objective => objective.requiredTags),
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

        const sectionIdByKey = new Map<string, string>();
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
            sectionIdByKey.set(section.key, createdSection.id);
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

        const encounterIdBySequence = new Map<number, string>();
        for (const encounter of payload.encounters) {
            const createdEncounter = await tx.questEncounter.create({
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
                            nodeModifierId: nodeModifierIdByName.get(node.name)!,
                            isHighlighted: Boolean(node.isHighlighted)
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
            encounterIdBySequence.set(encounter.sequence, createdEncounter.id);
        }

        const objectiveIdBySlug = new Map<string, string>();
        for (const objective of [...payload.objectives].sort((a, b) => a.order - b.order)) {
            const createdObjective = await tx.questObjective.create({
                data: {
                    questPlanId: plan.id,
                    slug: objective.slug,
                    title: objective.title,
                    shortTitle: objective.shortTitle,
                    description: objective.description,
                    imageUrl: objective.imageUrl,
                    imageFit: objective.imageFit || "cover",
                    imagePosition: objective.imagePosition || "center",
                    order: objective.order,
                    isVisible: objective.isVisible,
                    teamLimitOverride: objective.teamLimitOverride,
                    minStarLevel: objective.minStarLevel,
                    maxStarLevel: objective.maxStarLevel,
                    requiredClasses: objective.requiredClasses,
                    requiredTagMode: objective.requiredTagMode,
                    endpointEncounterId: objective.endpointEncounterSequence == null
                        ? null
                        : encounterIdBySequence.get(objective.endpointEncounterSequence) ?? null,
                    defaultShowContinuation: objective.defaultShowContinuation,
                    requiredTags: {
                        connect: objective.requiredTags.map(tag => ({ id: resolveTagId(tag)! }))
                    },
                    routeChoices: {
                        create: objective.routeChoices
                            .map(choice => {
                                const sectionId = sectionIdByKey.get(choice.routeSectionKey);
                                const pathId = pathIdByKey.get(choice.routePathKey);
                                if (!sectionId || !pathId) return null;
                                return {
                                    questRouteSectionId: sectionId,
                                    questRoutePathId: pathId,
                                    isLocked: choice.isLocked,
                                };
                            })
                            .filter((choice): choice is { questRouteSectionId: string; questRoutePathId: string; isLocked: boolean } => Boolean(choice))
                    },
                    routeRecommendations: {
                        create: objective.routeRecommendations.map(recommendation => ({
                            slug: recommendation.slug,
                            title: recommendation.title,
                            order: recommendation.order,
                            choices: {
                                create: recommendation.choices
                                    .map(choice => {
                                        const sectionId = sectionIdByKey.get(choice.routeSectionKey);
                                        const pathId = pathIdByKey.get(choice.routePathKey);
                                        if (!sectionId || !pathId) return null;
                                        return {
                                            questRouteSectionId: sectionId,
                                            questRoutePathId: pathId,
                                        };
                                    })
                                    .filter((choice): choice is { questRouteSectionId: string; questRoutePathId: string } => Boolean(choice))
                            }
                        }))
                    }
                }
            });
            objectiveIdBySlug.set(objective.slug, createdObjective.id);
        }

        for (const encounter of payload.encounters) {
            const questEncounterId = encounterIdBySequence.get(encounter.sequence);
            if (!questEncounterId) continue;
            for (const [objectiveSlug, recommendations] of Object.entries(encounter.objectiveRecommendedChampions)) {
                const questObjectiveId = objectiveIdBySlug.get(objectiveSlug);
                if (!questObjectiveId) continue;
                await tx.questObjectiveEncounterRecommendationSet.create({
                    data: {
                        questObjectiveId,
                        questEncounterId,
                        champions: {
                            create: recommendations.map((champion, order) => ({
                                championId: resolveChampionId(champion)!,
                                order,
                            }))
                        }
                    }
                });
            }
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

