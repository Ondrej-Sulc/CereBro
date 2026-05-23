import { ChampionClass } from "@prisma/client";
import type { ChampionImages } from "../types/champion";
import { createMcocPrestigeProjector, maxSigForRarity } from "./mcoc-prestige";

export interface RosterPrestigeInsightOptions {
    targetRank: number;
    sigBudget: number;
    rankClassFilter: ChampionClass[];
    sigClassFilter: ChampionClass[];
    rankSagaFilter: boolean;
    sigSagaFilter: boolean;
    sigAwakenedOnly?: boolean;
    limit?: number;
}

export type RosterPrestigeInsightRosterEntry = {
    id: string;
    championId: number;
    stars: number;
    rank: number;
    sigLevel?: number | null;
    ascensionLevel?: number | null;
    isAwakened?: boolean | null;
    champion: {
        name: string;
        class: ChampionClass;
        images: ChampionImages;
        tags: Array<{ name: string }>;
    };
};

export type RosterPrestigeRow = {
    championId: number;
    rarity: number;
    rank: number;
    sig: number;
    prestige: number;
};

export type RosterPrestigeRankUpInsight = {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    ascensionLevel: number;
    fromRank: number;
    toRank: number;
    prestigeGain: number;
    accountGain: number;
    reason: RosterPrestigeRecommendationReason;
    globalPrestigeRank: number | null;
    globalPrestigeRankTotal: number | null;
};

export type RosterPrestigeSigInsight = {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    ascensionLevel: number;
    rank: number;
    fromSig: number;
    toSig: number;
    prestigeGain: number;
    accountGain: number;
    prestigePerSig: number;
    reason: RosterPrestigeRecommendationReason;
    globalPrestigeRank: number | null;
    globalPrestigeRankTotal: number | null;
};

export type RosterPrestigePotentialInsight = {
    championId: number;
    championName: string;
    championClass: ChampionClass;
    championImage: ChampionImages;
    stars: number;
    ascensionLevel: number;
    fromRank: number;
    toRank: number;
    fromSig: number;
    toSig: number;
    currentPrestige: number;
    targetPrestige: number;
    prestigeGain: number;
    accountGain: number;
    reason: RosterPrestigeRecommendationReason;
    globalPrestigeRank: number | null;
    globalPrestigeRankTotal: number | null;
};

export type RosterPrestigeRecommendationReason = "already_top30" | "enters_top30" | "improves_top30";

export type RosterPrestigeInsights = {
    top30Average: number;
    top30Cutoff: number;
    prestigeMap: Record<string, number>;
    recommendations: RosterPrestigeRankUpInsight[];
    sigRecommendations: RosterPrestigeSigInsight[];
    potentialRecommendations: RosterPrestigePotentialInsight[];
};

export function calculateRosterPrestigeInsights(
    roster: RosterPrestigeInsightRosterEntry[],
    prestigeRows: RosterPrestigeRow[],
    options: RosterPrestigeInsightOptions
): RosterPrestigeInsights {
    if (roster.length === 0) {
        return emptyRosterPrestigeInsights();
    }

    const prestigeProjector = createMcocPrestigeProjector(prestigeRows);

    const getCalculatedPrestige = (champId: number, rarity: number, rank: number, sig: number, ascensionLevel: number = 0): number => {
        return prestigeProjector.project({
            championId: champId,
            rarity,
            rank,
            sigLevel: sig,
            ascensionLevel,
        });
    };

    const rosterWithPrestige = roster.map(r => {
        const prestige = getCalculatedPrestige(r.championId, r.stars, r.rank, r.sigLevel || 0, r.ascensionLevel || 0);
        return { ...r, prestige };
    });

    const rosterPrestigeMap: Record<string, number> = {};
    rosterWithPrestige.forEach(r => {
        rosterPrestigeMap[r.id] = r.prestige;
    });

    rosterWithPrestige.sort((a, b) => b.prestige - a.prestige);
    const top30Average = averagePrestige(rosterWithPrestige.map(r => r.prestige));
    const top30Cutoff = top30PrestigeCutoff(rosterWithPrestige.map(r => r.prestige));
    const currentTop30Ids = new Set(rosterWithPrestige.slice(0, 30).map(r => r.id));

    const candidates = roster.filter(r => {
        if (options.rankClassFilter.length > 0 && !options.rankClassFilter.includes(r.champion.class)) return false;
        if (options.rankSagaFilter && !r.champion.tags.some(t => t.name === "#Saga Champions")) return false;
        if (r.stars === 7) return r.rank < Math.min(options.targetRank, 6);
        if (r.stars === 6) return r.rank < 5;
        if (r.stars === 5) return r.rank < 5;
        return false;
    });

    const allRecommendations = candidates.map(c => {
        const nextPrestige = getCalculatedPrestige(c.championId, c.stars, c.rank + 1, c.sigLevel || 0, c.ascensionLevel || 0);
        if (nextPrestige === 0) return null;

        const currentPrestige = rosterPrestigeMap[c.id] || 0;
        const simulatedPrestigeList = rosterWithPrestige.map(r =>
            r.id === c.id ? nextPrestige : r.prestige
        );
        simulatedPrestigeList.sort((a, b) => b - a);

        const delta = averagePrestige(simulatedPrestigeList) - top30Average;

        return {
            championId: c.championId,
            championName: c.champion.name,
            championClass: c.champion.class,
            championImage: c.champion.images,
            stars: c.stars,
            ascensionLevel: c.ascensionLevel || 0,
            fromRank: c.rank,
            toRank: c.rank + 1,
            prestigeGain: nextPrestige - currentPrestige,
            accountGain: delta,
            reason: recommendationReason({
                isCurrentlyTop30: currentTop30Ids.has(c.id),
                projectedPrestige: nextPrestige,
                top30Cutoff,
            }),
            globalPrestigeRank: globalPrestigeRank({
                prestigeRows,
                championId: c.championId,
                rarity: c.stars,
                rank: c.rank + 1,
                sig: c.sigLevel || 0,
            })?.rank ?? null,
            globalPrestigeRankTotal: globalPrestigeRank({
                prestigeRows,
                championId: c.championId,
                rarity: c.stars,
                rank: c.rank + 1,
                sig: c.sigLevel || 0,
            })?.total ?? null,
        };
    }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0);

    const recommendations = allRecommendations
        .sort((a, b) => b.accountGain - a.accountGain)
        .slice(0, options.limit || 5);

    const potentialRecommendations = roster.map(c => {
        if (options.rankClassFilter.length > 0 && !options.rankClassFilter.includes(c.champion.class)) return null;
        if (options.rankSagaFilter && !c.champion.tags.some(t => t.name === "#Saga Champions")) return null;
        if (c.stars < 5) return null;

        const toRank = targetPotentialRank(c, options);
        const fromSig = c.sigLevel || 0;
        const toSig = maxSigForRarity(c.stars);
        const targetPrestige = getCalculatedPrestige(c.championId, c.stars, toRank, toSig, c.ascensionLevel || 0);
        if (targetPrestige === 0) return null;

        const currentPrestige = rosterPrestigeMap[c.id] || 0;
        if (targetPrestige <= currentPrestige) return null;

        const simulatedPrestigeList = rosterWithPrestige.map(r =>
            r.id === c.id ? targetPrestige : r.prestige
        );
        simulatedPrestigeList.sort((a, b) => b - a);

        const delta = averagePrestige(simulatedPrestigeList) - top30Average;
        if (delta <= 0) return null;

        return {
            championId: c.championId,
            championName: c.champion.name,
            championClass: c.champion.class,
            championImage: c.champion.images,
            stars: c.stars,
            ascensionLevel: c.ascensionLevel || 0,
            fromRank: c.rank,
            toRank,
            fromSig,
            toSig,
            currentPrestige,
            targetPrestige,
            prestigeGain: targetPrestige - currentPrestige,
            accountGain: delta,
            reason: recommendationReason({
                isCurrentlyTop30: currentTop30Ids.has(c.id),
                projectedPrestige: targetPrestige,
                top30Cutoff,
            }),
            globalPrestigeRank: globalPrestigeRank({
                prestigeRows,
                championId: c.championId,
                rarity: c.stars,
                rank: toRank,
                sig: toSig,
            })?.rank ?? null,
            globalPrestigeRankTotal: globalPrestigeRank({
                prestigeRows,
                championId: c.championId,
                rarity: c.stars,
                rank: toRank,
                sig: toSig,
            })?.total ?? null,
        };
    }).filter((r): r is RosterPrestigePotentialInsight => r !== null)
        .sort((a, b) =>
            b.accountGain - a.accountGain ||
            b.targetPrestige - a.targetPrestige ||
            b.prestigeGain - a.prestigeGain ||
            a.championName.localeCompare(b.championName)
        )
        .slice(0, options.limit || 5);

    const sigCandidates = roster.filter(r => {
        if (options.sigClassFilter.length > 0 && !options.sigClassFilter.includes(r.champion.class)) return false;
        if (options.sigSagaFilter && !r.champion.tags.some(t => t.name === "#Saga Champions")) return false;

        const isDupped = r.isAwakened && (r.sigLevel || 0) > 0;
        if (options.sigAwakenedOnly && !isDupped) return false;

        if ((r.sigLevel || 0) >= maxSigForRarity(r.stars)) return false;
        if (r.stars === 7) return true;
        if (r.stars === 6 && r.rank >= 4) return true;
        return false;
    });

    let sigRecommendations: RosterPrestigeSigInsight[] = [];

    if (options.sigBudget > 0) {
        const simState = rosterWithPrestige.map(r => ({ ...r, currentSig: r.sigLevel || 0, currentPrestige: r.prestige }));
        const addedSigs: Record<string, number> = {};

        for (let i = 0; i < options.sigBudget; i++) {
            let bestMove: { rosterIndex: number, gain: number, newPrestige: number } | null = null;
            const sortedState = [...simState].sort((a, b) => b.currentPrestige - a.currentPrestige);

            for (const cand of sigCandidates) {
                const idx = simState.findIndex(r => r.id === cand.id);
                const charState = simState[idx];

                if (charState.currentSig >= maxSigForRarity(cand.stars)) continue;

                const nextPrestige = getCalculatedPrestige(cand.championId, cand.stars, cand.rank, charState.currentSig + 1, cand.ascensionLevel || 0);
                if (nextPrestige <= charState.currentPrestige) continue;

                let moveGain = 0;
                const isInTop30 = sortedState.findIndex(s => s.id === cand.id) < 30;

                if (isInTop30) {
                    moveGain = nextPrestige - charState.currentPrestige;
                } else {
                    const p30 = sortedState[29]?.currentPrestige || 0;
                    if (nextPrestige > p30) {
                        moveGain = nextPrestige - p30;
                    }
                }

                if (moveGain > 0 && (!bestMove || moveGain > bestMove.gain)) {
                    bestMove = { rosterIndex: idx, gain: moveGain, newPrestige: nextPrestige };
                }
            }

            if (!bestMove) break;

            const target = simState[bestMove.rosterIndex];
            target.currentSig += 1;
            target.currentPrestige = bestMove.newPrestige;
            addedSigs[target.id] = (addedSigs[target.id] || 0) + 1;
        }

        sigRecommendations = Object.entries(addedSigs).map(([id, added]) => {
            const original = rosterWithPrestige.find(r => r.id === id)!;
            const finalSig = (original.sigLevel || 0) + added;
            const finalPrestige = getCalculatedPrestige(original.championId, original.stars, original.rank, finalSig, original.ascensionLevel || 0);
            const isolationList = rosterWithPrestige.map(r => r.id === id ? finalPrestige : r.prestige).sort((a, b) => b - a);
            const delta = averagePrestige(isolationList) - top30Average;
            const efficiency = delta / added;

            return {
                championId: original.championId,
                championName: original.champion.name,
                championClass: original.champion.class,
                championImage: original.champion.images,
                stars: original.stars,
                ascensionLevel: original.ascensionLevel || 0,
                rank: original.rank,
                fromSig: original.sigLevel || 0,
                toSig: finalSig,
                prestigeGain: finalPrestige - original.prestige,
                accountGain: delta,
                prestigePerSig: parseFloat(efficiency.toFixed(2)),
                reason: recommendationReason({
                    isCurrentlyTop30: currentTop30Ids.has(original.id),
                    projectedPrestige: finalPrestige,
                    top30Cutoff,
                }),
                globalPrestigeRank: globalPrestigeRank({
                    prestigeRows,
                    championId: original.championId,
                    rarity: original.stars,
                    rank: original.rank,
                    sig: finalSig,
                })?.rank ?? null,
                globalPrestigeRankTotal: globalPrestigeRank({
                    prestigeRows,
                    championId: original.championId,
                    rarity: original.stars,
                    rank: original.rank,
                    sig: finalSig,
                })?.total ?? null,
            };
        }).sort((a, b) => b.accountGain - a.accountGain);
    } else {
        sigRecommendations = sigCandidates.map(c => {
            const maxSig = maxSigForRarity(c.stars);
            const nextPrestige = getCalculatedPrestige(c.championId, c.stars, c.rank, maxSig, c.ascensionLevel || 0);
            if (nextPrestige === 0) return null;

            const currentPrestige = rosterPrestigeMap[c.id] || 0;
            const sigsNeeded = maxSig - (c.sigLevel || 0);
            const simulatedPrestigeList = rosterWithPrestige.map(r =>
                r.id === c.id ? nextPrestige : r.prestige
            );
            simulatedPrestigeList.sort((a, b) => b - a);

            const delta = averagePrestige(simulatedPrestigeList) - top30Average;
            const prestigeGain = nextPrestige - currentPrestige;
            const efficiency = sigsNeeded > 0 ? delta / sigsNeeded : 0;

            return {
                championId: c.championId,
                championName: c.champion.name,
                championClass: c.champion.class,
                championImage: c.champion.images,
                stars: c.stars,
                ascensionLevel: c.ascensionLevel || 0,
                rank: c.rank,
                fromSig: c.sigLevel || 0,
                toSig: maxSig,
                prestigeGain,
                accountGain: delta,
                prestigePerSig: parseFloat(efficiency.toFixed(2)),
                reason: recommendationReason({
                    isCurrentlyTop30: currentTop30Ids.has(c.id),
                    projectedPrestige: nextPrestige,
                    top30Cutoff,
                }),
                globalPrestigeRank: globalPrestigeRank({
                    prestigeRows,
                    championId: c.championId,
                    rarity: c.stars,
                    rank: c.rank,
                    sig: maxSig,
                })?.rank ?? null,
                globalPrestigeRankTotal: globalPrestigeRank({
                    prestigeRows,
                    championId: c.championId,
                    rarity: c.stars,
                    rank: c.rank,
                    sig: maxSig,
                })?.total ?? null,
            };
        }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0)
            .sort((a, b) => b.accountGain - a.accountGain)
            .slice(0, options.limit || 5);
    }

    return {
        top30Average,
        top30Cutoff,
        prestigeMap: rosterPrestigeMap,
        recommendations,
        sigRecommendations,
        potentialRecommendations,
    };
}

function emptyRosterPrestigeInsights(): RosterPrestigeInsights {
    return {
        top30Average: 0,
        top30Cutoff: 0,
        prestigeMap: {},
        recommendations: [],
        sigRecommendations: [],
        potentialRecommendations: [],
    };
}

function targetPotentialRank(
    entry: Pick<RosterPrestigeInsightRosterEntry, "stars" | "rank">,
    options: Pick<RosterPrestigeInsightOptions, "targetRank">
) {
    if (entry.stars === 7) return Math.max(entry.rank, Math.min(options.targetRank, 6));
    if (entry.stars === 6 || entry.stars === 5) return Math.max(entry.rank, 5);
    return entry.rank;
}

function averagePrestige(values: number[]) {
    const topValues = values.slice(0, 30);
    if (!topValues.length) return 0;
    return Math.round(topValues.reduce((sum, value) => sum + value, 0) / topValues.length);
}

function top30PrestigeCutoff(sortedPrestigeValues: number[]) {
    if (!sortedPrestigeValues.length) return 0;
    return sortedPrestigeValues[Math.min(29, sortedPrestigeValues.length - 1)] ?? 0;
}

function recommendationReason({
    isCurrentlyTop30,
    projectedPrestige,
    top30Cutoff,
}: {
    isCurrentlyTop30: boolean;
    projectedPrestige: number;
    top30Cutoff: number;
}): RosterPrestigeRecommendationReason {
    if (isCurrentlyTop30) return "improves_top30";
    return projectedPrestige > top30Cutoff ? "enters_top30" : "already_top30";
}

function globalPrestigeRank({
    prestigeRows,
    championId,
    rarity,
    rank,
    sig,
}: {
    prestigeRows: RosterPrestigeRow[];
    championId: number;
    rarity: number;
    rank: number;
    sig: number;
}) {
    const rows = prestigeRows
        .filter(row => row.rarity === rarity && row.rank === rank && row.sig === sig)
        .sort((a, b) => b.prestige - a.prestige || a.championId - b.championId);

    const index = rows.findIndex(row => row.championId === championId);
    if (index === -1) return null;
    return { rank: index + 1, total: rows.length };
}
