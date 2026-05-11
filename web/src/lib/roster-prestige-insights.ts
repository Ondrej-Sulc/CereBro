import { ChampionClass } from "@prisma/client";
import type { ChampionImages } from "../types/champion";
import { maxSigForRarity, projectMcocPrestige } from "./mcoc-prestige";

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
};

export type RosterPrestigeInsights = {
    top30Average: number;
    prestigeMap: Record<string, number>;
    recommendations: RosterPrestigeRankUpInsight[];
    sigRecommendations: RosterPrestigeSigInsight[];
};

export function calculateRosterPrestigeInsights(
    roster: RosterPrestigeInsightRosterEntry[],
    prestigeRows: RosterPrestigeRow[],
    options: RosterPrestigeInsightOptions
): RosterPrestigeInsights {
    if (roster.length === 0) {
        return emptyRosterPrestigeInsights();
    }

    const prestigeLookup = new Map<string, RosterPrestigeRow[]>();
    for (const p of prestigeRows) {
        const key = `${p.championId}:${p.rarity}:${p.rank}`;
        const rows = prestigeLookup.get(key) ?? [];
        rows.push(p);
        prestigeLookup.set(key, rows);
    }

    const getCalculatedPrestige = (champId: number, rarity: number, rank: number, sig: number, ascensionLevel: number = 0): number => {
        const rows = prestigeLookup.get(`${champId}:${rarity}:${rank}`) ?? [];
        return projectMcocPrestige({
            prestigeData: rows,
            stat: { rarity, rank, prestige: null },
            sigLevel: sig,
            ascensionLevel,
        }) ?? 0;
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
        };
    }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0);

    const recommendations = allRecommendations
        .sort((a, b) => b.accountGain - a.accountGain)
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
            };
        }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0)
            .sort((a, b) => b.accountGain - a.accountGain)
            .slice(0, options.limit || 5);
    }

    return {
        top30Average,
        prestigeMap: rosterPrestigeMap,
        recommendations,
        sigRecommendations,
    };
}

function emptyRosterPrestigeInsights(): RosterPrestigeInsights {
    return {
        top30Average: 0,
        prestigeMap: {},
        recommendations: [],
        sigRecommendations: [],
    };
}

function averagePrestige(values: number[]) {
    const topValues = values.slice(0, 30);
    if (!topValues.length) return 0;
    return Math.round(topValues.reduce((sum, value) => sum + value, 0) / topValues.length);
}
