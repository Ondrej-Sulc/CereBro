import { prisma } from "@/lib/prisma";
import { ChampionClass } from "@prisma/client";
import type { ChampionImages } from "@/types/champion";
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

type RosterPrestigeInsightSearchParams =
    | URLSearchParams
    | Record<string, string | string[] | null | undefined>;

export type RosterPrestigeInsightSnapshot = {
    options: RosterPrestigeInsightOptions;
    insights: RosterPrestigeInsights;
};

export function normalizeRosterPrestigeInsightOptions(
    searchParams: RosterPrestigeInsightSearchParams,
    roster: Pick<RosterPrestigeInsightRosterEntry, "stars" | "rank">[]
): RosterPrestigeInsightOptions {
    const requestedTargetRank = readNumberParam(searchParams, "targetRank", 0);
    const targetRank = requestedTargetRank > 0
        ? requestedTargetRank
        : defaultRosterPrestigeTargetRank(roster);

    return {
        targetRank,
        sigBudget: readNumberParam(searchParams, "sigBudget", 0),
        rankClassFilter: readClassListParam(searchParams, "rankClassFilter"),
        sigClassFilter: readClassListParam(searchParams, "sigClassFilter"),
        rankSagaFilter: readBooleanParam(searchParams, "rankSagaFilter"),
        sigSagaFilter: readBooleanParam(searchParams, "sigSagaFilter"),
        sigAwakenedOnly: readBooleanParam(searchParams, "sigAwakenedOnly"),
        limit: clampLimit(readNumberParam(searchParams, "limit", 5)),
    };
}

export function defaultRosterPrestigeTargetRank(
    roster: Pick<RosterPrestigeInsightRosterEntry, "stars" | "rank">[]
) {
    const highest7StarRank = roster.reduce((max, r) => (r.stars === 7 ? Math.max(max, r.rank) : max), 0);
    return highest7StarRank > 0 ? highest7StarRank : 3;
}

export async function loadRosterPrestigeInsightSnapshot(
    roster: RosterPrestigeInsightRosterEntry[],
    searchParams: RosterPrestigeInsightSearchParams
): Promise<RosterPrestigeInsightSnapshot> {
    const options = normalizeRosterPrestigeInsightOptions(searchParams, roster);
    return {
        options,
        insights: await loadRosterPrestigeInsights(roster, options),
    };
}

export async function loadPlayerRosterPrestigeInsightSnapshot(
    playerId: string,
    searchParams: RosterPrestigeInsightSearchParams
): Promise<RosterPrestigeInsightSnapshot> {
    const roster = await loadPlayerRosterPrestigeInsightEntries(playerId);
    return loadRosterPrestigeInsightSnapshot(roster, searchParams);
}

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

export function visibleRosterPrestigeInsights(
    insights: RosterPrestigeInsights,
    options: { includeSuggestions: boolean }
): RosterPrestigeInsights {
    if (options.includeSuggestions) return insights;
    return {
        top30Average: insights.top30Average,
        prestigeMap: insights.prestigeMap,
        recommendations: [],
        sigRecommendations: [],
    };
}

async function loadPlayerRosterPrestigeInsightEntries(playerId: string): Promise<RosterPrestigeInsightRosterEntry[]> {
    const roster = await prisma.roster.findMany({
        where: { playerId },
        select: {
            id: true,
            championId: true,
            stars: true,
            rank: true,
            sigLevel: true,
            ascensionLevel: true,
            isAwakened: true,
            champion: {
                select: {
                    name: true,
                    class: true,
                    images: true,
                    tags: { select: { name: true } },
                },
            },
        },
        orderBy: [{ stars: "desc" }, { rank: "desc" }],
    });

    return roster.map(entry => ({
        id: entry.id,
        championId: entry.championId,
        stars: entry.stars,
        rank: entry.rank,
        sigLevel: entry.sigLevel,
        ascensionLevel: entry.ascensionLevel,
        isAwakened: entry.isAwakened,
        champion: {
            name: entry.champion.name,
            class: entry.champion.class,
            images: entry.champion.images as unknown as ChampionImages,
            tags: entry.champion.tags,
        },
    }));
}

function readNumberParam(
    searchParams: RosterPrestigeInsightSearchParams,
    key: string,
    fallback: number
) {
    const value = readParam(searchParams, key);
    if (!value) return fallback;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function readBooleanParam(searchParams: RosterPrestigeInsightSearchParams, key: string) {
    return readParam(searchParams, key) === "true";
}

function readClassListParam(searchParams: RosterPrestigeInsightSearchParams, key: string) {
    const validClasses = Object.values(ChampionClass);
    return (readParam(searchParams, key) ?? "")
        .split(",")
        .filter((value): value is ChampionClass => validClasses.includes(value as ChampionClass));
}

function readParam(searchParams: RosterPrestigeInsightSearchParams, key: string) {
    if (searchParams instanceof URLSearchParams) return searchParams.get(key);
    const value = searchParams[key];
    if (Array.isArray(value)) return value[0] ?? null;
    return value ?? null;
}

function clampLimit(value: number) {
    return Math.min(Math.max(value || 5, 1), 100);
}
