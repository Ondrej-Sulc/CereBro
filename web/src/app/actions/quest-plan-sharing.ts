'use server'

import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { projectSavedQuestPlanRosterMap } from "@/lib/saved-quest-plan-projection";
import { withActionContext } from "@/lib/with-request-context";
import { QuestPlanStatus } from "@prisma/client";

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
                    selectedChampion: true,
                    prefightChampion: true
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

    if (playerPlan.questPlan.status !== QuestPlanStatus.VISIBLE) return null;

    const encounterChampionIds = playerPlan.encounters
        .map(e => e.selectedChampionId)
        .filter((id): id is number => id !== null);
    const prefightChampionIds = playerPlan.encounters
        .map(e => e.prefightChampionId)
        .filter((id): id is number => id !== null);

    const synergyChampionIds = playerPlan.synergyChampions
        .map(s => s.championId);

    const allSelectedChampionIds = [...new Set([...encounterChampionIds, ...prefightChampionIds, ...synergyChampionIds])];

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

    return {
        ...playerPlan,
        rosterEntries,
        rosterMap: projectSavedQuestPlanRosterMap({
            playerId: playerPlan.playerId,
            encounters: playerPlan.encounters,
            rosterEntries,
        }) as Record<string, unknown>
    };
});

/**
 * Fetch all quest plans with at least one selection for a given player.
 * No auth required - for the public player profile page.
 */
export const getPlayerQuestPlansForProfile = withActionContext('getPlayerQuestPlansForProfile', async (playerId: string) => {
    const plans = await prisma.playerQuestPlan.findMany({
        where: {
            playerId,
            encounters: {
                some: {
                    OR: [
                        { selectedChampionId: { not: null } },
                        { prefightChampionId: { not: null } },
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
                        { prefightChampionId: { not: null } },
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
