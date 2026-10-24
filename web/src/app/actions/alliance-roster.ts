'use server';

import { prisma } from "@/lib/prisma";
import { ChampionImages } from "@/types/champion";
import { withActionContext } from "@/lib/with-request-context";
import type { ProfileRosterEntry } from "@/app/profile/roster/types";
import { attachResistances, getResistanceIndex } from "@/lib/data/champion-resistances";

export type AllianceRosterEntry = Pick<ProfileRosterEntry, "id" | "playerId" | "championId" | "stars" | "rank" | "sigLevel" | "isAwakened" | "isAscended" | "ascensionLevel"> & {
    ingameName: string;
    battlegroup: number | null;
    avatar: string | null;
    champion: Pick<ProfileRosterEntry["champion"], "id" | "name" | "class" | "slug" | "images" | "tags" | "abilities">;
    tactics: { attack: boolean; defense: boolean };
};

export const getAllianceRoster = withActionContext('getAllianceRoster', async (
    allianceId: string, 
    season?: number
) => {
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
                    slug: true,
                    images: true,
                    tags: {
                        select: { id: true, name: true }
                    },
                    abilities: {
                        select: {
                            id: true,
                            type: true,
                            source: true,
                            effectForm: true,
                            effectDirection: true,
                            ability: {
                                select: {
                                    name: true,
                                    iconUrl: true,
                                    description: true,
                                    gameGlossaryTermId: true,
                                    gameGlossaryTerm: { select: { raw: true } },
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
                                            slug: true,
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

    const resistanceIndex = await getResistanceIndex();
    const membersById = new Map(members.map(member => [member.id, member]));
    const champions = new Map<number, AllianceRosterEntry["champion"]>();
    for (const { champion } of rosterEntries) {
        if (champions.has(champion.id)) continue;
        champions.set(champion.id, {
            ...champion,
            images: champion.images as unknown as ChampionImages,
            abilities: attachResistances(champion.abilities, resistanceIndex).map(link => ({
                ...link,
                synergyChampions: link.synergyChampions.map(({ champion: partner }) => ({
                    champion: { ...partner, images: partner.images as unknown as ChampionImages },
                })),
            })),
        });
    }

    // Preserve the shared kit shape, including source metadata and validated resistance targets.
    const result: AllianceRosterEntry[] = rosterEntries.map(entry => {
        const player = membersById.get(entry.playerId)!;
        
        // Determine Tactics
        const champTagIds = new Set(entry.champion.tags.map(t => t.id));
        const hasAttackTactic = [...attackTagIds].some(id => champTagIds.has(id!));
        const hasDefenseTactic = [...defenseTagIds].some(id => champTagIds.has(id!));

        return {
            id: entry.id,
            playerId: player.id,
            ingameName: player.ingameName,
            battlegroup: player.battlegroup,
            avatar: player.avatar,
            championId: entry.champion.id,
            champion: champions.get(entry.championId)!,
            stars: entry.stars,
            rank: entry.rank,
            sigLevel: entry.sigLevel,
            isAwakened: entry.isAwakened,
            isAscended: entry.isAscended,
            ascensionLevel: entry.ascensionLevel,
            tactics: {
                attack: hasAttackTactic,
                defense: hasDefenseTactic
            },
        };
    });

    return result;
});
