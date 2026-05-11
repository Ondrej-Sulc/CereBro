import { prisma } from "@/lib/prisma";
import {
    calculateRosterPrestigeInsights,
    type RosterPrestigeInsightOptions,
    type RosterPrestigeInsightRosterEntry,
    type RosterPrestigeInsights,
} from "./roster-prestige-insights";

export {
    calculateRosterPrestigeInsights,
    type RosterPrestigeInsightOptions,
    type RosterPrestigeInsightRosterEntry,
    type RosterPrestigeInsights,
    type RosterPrestigeRow,
} from "./roster-prestige-insights";

export async function loadRosterPrestigeInsights(
    roster: RosterPrestigeInsightRosterEntry[],
    options: RosterPrestigeInsightOptions
): Promise<RosterPrestigeInsights> {
    if (roster.length === 0) {
        return calculateRosterPrestigeInsights(roster, [], options);
    }

    const championIds = Array.from(new Set(roster.map(r => r.championId)));
    const prestigeRows = await prisma.championPrestige.findMany({
        where: { championId: { in: championIds } },
        select: { championId: true, rarity: true, rank: true, sig: true, prestige: true },
    });

    return calculateRosterPrestigeInsights(roster, prestigeRows, options);
}

export const calculateRosterRecommendations = loadRosterPrestigeInsights;
