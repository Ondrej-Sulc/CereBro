'use server';

import { prisma } from "@/lib/prisma";
import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";

export type AllianceRosterEntry = {
    playerId: string;
    ingameName: string;
    battlegroup: number | null;
    avatar: string | null;
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImages: ChampionImages;
    stars: number;
    rank: number;
    sigLevel: number;
    isAwakened: boolean;
    isAscended: boolean;
    tags: string[];
    tactics: { attack: boolean; defense: boolean };
    abilities: {
        name: string;
        type: string; // AbilityLinkType
        source: string | null;
        categories: string[];
        synergyChampions: {
            name: string;
            images: ChampionImages;
        }[];
    }[];
};

export async function getAllianceRoster(
    allianceId: string, 
    season?: number
) {
    // 1. Fetch all members of the alliance
    const members = await prisma.player.findMany({
        where: { allianceId },
        select: { id: true, ingameName: true, battlegroup: true, avatar: true }
    });

    if (members.length === 0) return [];

    // 2. Fetch current season for tactics if not provided
    let targetSeason = season;
    if (!targetSeason) {
        // Find the latest war to guess season, or default to a safe fallback
        const latestWar = await prisma.war.findFirst({
            where: { allianceId },
            orderBy: { createdAt: 'desc' }
        });
        targetSeason = latestWar?.season || 0;
    }

    // 3. Fetch Tactics for the season
    // We fetch ALL tactics for the season to map champion tags
    const tactics = await prisma.warTactic.findMany({
        where: { season: targetSeason },
        include: {
            attackTag: true,
            defenseTag: true
        }
    });

    const attackTagIds = new Set(tactics.filter(t => t.attackTagId).map(t => t.attackTagId));
    const defenseTagIds = new Set(tactics.filter(t => t.defenseTagId).map(t => t.defenseTagId));

    // 4. Fetch Roster with Champion details and Tags
    // Optimizing: We only need specific fields. 
    // We fetch ALL roster entries for these players.
    const memberIds = members.map(m => m.id);
    
    const rosterEntries = await prisma.roster.findMany({
        where: { playerId: { in: memberIds } },
        include: {
            champion: {
                select: {
                    id: true,
                    name: true,
                    class: true,
                    images: true,
                    tags: {
                        select: { id: true, name: true }
                    },
                    abilities: {
                        select: {
                            type: true,
                            source: true,
                            ability: {
                                select: {
                                    name: true,
                                    categories: {
                                        select: { name: true }
                                    }
                                }
                            },
                            synergyChampions: {
                                select: {
                                    champion: {
                                        select: {
                                            name: true,
                                            images: true
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    // 5. Transform to flat structure for the matrix
    const result: AllianceRosterEntry[] = rosterEntries.map(entry => {
        const player = members.find(m => m.id === entry.playerId)!;
        
        // Determine Tactics
        const champTagIds = new Set(entry.champion.tags.map(t => t.id));
        const hasAttackTactic = [...attackTagIds].some(id => champTagIds.has(id!));
        const hasDefenseTactic = [...defenseTagIds].some(id => champTagIds.has(id!));

        return {
            playerId: player.id,
            ingameName: player.ingameName,
            battlegroup: player.battlegroup,
            avatar: player.avatar,
            championId: entry.champion.id,
            championName: entry.champion.name,
            championClass: entry.champion.class,
            championImages: entry.champion.images as unknown as ChampionImages,
            stars: entry.stars,
            rank: entry.rank,
            sigLevel: entry.sigLevel,
            isAwakened: entry.isAwakened,
            isAscended: entry.isAscended,
            tags: entry.champion.tags.map(t => t.name),
            tactics: {
                attack: hasAttackTactic,
                defense: hasDefenseTactic
            },
            abilities: entry.champion.abilities.map(a => ({
                name: a.ability.name,
                type: a.type,
                source: a.source,
                categories: a.ability.categories.map(c => c.name),
                synergyChampions: a.synergyChampions.map(sc => ({
                    name: sc.champion.name,
                    images: sc.champion.images as unknown as ChampionImages
                }))
            }))
        };
    });

    return result;
}

export async function getAllianceTagsAndTactics(allianceId: string) {
     const latestWar = await prisma.war.findFirst({
        where: { allianceId },
        orderBy: { createdAt: 'desc' }
    });
    const season = latestWar?.season || 0;

    const tactics = await prisma.warTactic.findMany({
        where: { season },
        include: { attackTag: true, defenseTag: true }
    });

    const tags = await prisma.tag.findMany({
        orderBy: { name: 'asc' }
    });

    const abilityCategories = await prisma.abilityCategory.findMany({
        orderBy: { name: 'asc' }
    });

    // Fetch separate lists for Abilities and Immunities based on actual usage
    const abilityLinks = await prisma.championAbilityLink.findMany({
        where: { type: 'ABILITY' },
        select: { abilityId: true },
        distinct: ['abilityId']
    });
    
    const immunityLinks = await prisma.championAbilityLink.findMany({
        where: { type: 'IMMUNITY' },
        select: { abilityId: true },
        distinct: ['abilityId']
    });

    const abilities = await prisma.ability.findMany({
        where: { id: { in: abilityLinks.map(l => l.abilityId) } },
        select: { id: true, name: true, description: true, emoji: true },
        orderBy: { name: 'asc' }
    });

    const immunities = await prisma.ability.findMany({
        where: { id: { in: immunityLinks.map(l => l.abilityId) } },
        select: { id: true, name: true, description: true, emoji: true },
        orderBy: { name: 'asc' }
    });

    return { tactics, tags, abilityCategories, abilities, immunities, season };
}
