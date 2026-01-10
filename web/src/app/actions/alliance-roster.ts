'use server';

import { prisma } from "@/lib/prisma";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { ChampionClass, Prisma } from "@prisma/client";

export type AllianceRosterEntry = {
    playerId: string;
    ingameName: string;
    battlegroup: number | null;
    avatar: string | null;
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImages: any;
    stars: number;
    rank: number;
    sigLevel: number;
    isAwakened: boolean;
    isAscended: boolean;
    tags: string[];
    tactics: { attack: boolean; defense: boolean };
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
            championImages: entry.champion.images,
            stars: entry.stars,
            rank: entry.rank,
            sigLevel: entry.sigLevel,
            isAwakened: entry.isAwakened,
            isAscended: entry.isAscended,
            tags: entry.champion.tags.map(t => t.name),
            tactics: {
                attack: hasAttackTactic,
                defense: hasDefenseTactic
            }
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

    return { tactics, tags, season };
}
