'use server'

import { prisma } from "@/lib/prisma";
import { withActionContext } from "@/lib/with-request-context";
import { QuestSummary, QuestWithRelations } from "@/types/quests";
import { ChampionClass, QuestPlanStatus } from "@prisma/client";
import { unstable_cache } from "next/cache";
export const getQuestCategories = unstable_cache(
    async () => {
        return prisma.questCategory.findMany({
            orderBy: { order: 'asc' },
        });
    },
    ['quest-categories'],
    { tags: ['quest-categories'] }
);

export const getQuestPlans = withActionContext('getQuestPlans', async (categoryId?: string, status?: QuestPlanStatus, currentPlayerId?: string): Promise<QuestSummary[]> => {
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
                    playerPlans: {
                        where: { isFeatured: true },
                        select: {
                            player: {
                                select: { id: true, ingameName: true, avatar: true, botUserId: true }
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

                const creatorBotUserIds = new Set(quest.creators.map(c => c.id));
                return {
                    ...quest,
                    creators: creatorsWithUsers,
                    featuredPlayers: quest.playerPlans
                        .filter(pp => !pp.player.botUserId || !creatorBotUserIds.has(pp.player.botUserId))
                        .map(({ player: { botUserId: _, ...p } }) => p)
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
                            where: {
                                OR: [
                                    { selectedChampionId: { not: null } },
                                    { prefightChampionId: { not: null } }
                                ]
                            }
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
});

export const getQuestPlanById = unstable_cache(
    async (id: string): Promise<QuestWithRelations | null> => {
        const quest = await prisma.questPlan.findUnique({
            where: { id },
            include: {
                category: true,
                requiredTags: true,
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
                        recommendedChampions: {
                            where: { isPlayable: true }
                        },
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
                            champion: syn.champion as ChampionCounterData,
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
                            champion: syn.champion as ChampionCounterData,
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
