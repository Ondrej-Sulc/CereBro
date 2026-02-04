import { prisma } from "@/lib/prisma";
import { ChampionClass, Prisma } from "@prisma/client";
import { ChampionImages } from "@/types/champion";
import { ProfileRosterEntry, Recommendation, SigRecommendation } from "@/app/profile/roster/types";

interface RecommendationOptions {
    targetRank: number;
    sigBudget: number;
    rankClassFilter: ChampionClass[];
    sigClassFilter: ChampionClass[];
    rankSagaFilter: boolean;
    sigSagaFilter: boolean;
}

export async function calculateRosterRecommendations(
    roster: ProfileRosterEntry[],
    options: RecommendationOptions
) {
    if (roster.length === 0) {
        return {
            top30Average: 0,
            prestigeMap: {} as Record<string, number>,
            recommendations: [] as Recommendation[],
            sigRecommendations: [] as SigRecommendation[]
        };
    }

    const championIds = Array.from(new Set(roster.map(r => r.championId)));

    // Fetch ALL prestige data for these champions to enable interpolation
    const allPrestigeData = await prisma.championPrestige.findMany({
        where: { championId: { in: championIds } },
        select: { championId: true, rarity: true, rank: true, sig: true, prestige: true }
    });

    // Build a structured lookup: ChampionID -> Rarity -> Rank -> Sig -> Prestige
    const prestigeLookup = new Map<number, Map<number, Map<number, Map<number, number>>>>();

    for (const p of allPrestigeData) {
        if (!prestigeLookup.has(p.championId)) prestigeLookup.set(p.championId, new Map());
        const rarityMap = prestigeLookup.get(p.championId)!;

        if (!rarityMap.has(p.rarity)) rarityMap.set(p.rarity, new Map());
        const rankMap = rarityMap.get(p.rarity)!;

        if (!rankMap.has(p.rank)) rankMap.set(p.rank, new Map());
        const sigMap = rankMap.get(p.rank)!;

        sigMap.set(p.sig, p.prestige);
    }

    // Helper for Linear Interpolation
    const getInterpolatedPrestige = (champId: number, rarity: number, rank: number, sig: number): number => {
        const sigs = prestigeLookup.get(champId)?.get(rarity)?.get(rank);
        if (!sigs) return 0;

        if (sigs.has(sig)) return sigs.get(sig)!;

        // Find bounds
        const sortedSigs = Array.from(sigs.keys()).sort((a, b) => a - b);
        const lowerSig = sortedSigs.filter(s => s <= sig).pop();
        const upperSig = sortedSigs.find(s => s > sig);

        if (lowerSig !== undefined && upperSig !== undefined) {
            const lowerVal = sigs.get(lowerSig)!;
            const upperVal = sigs.get(upperSig)!;
            const fraction = (sig - lowerSig) / (upperSig - lowerSig);
            return Math.round(lowerVal + (upperVal - lowerVal) * fraction);
        }

        // Fallback if out of bounds
        if (lowerSig !== undefined) return sigs.get(lowerSig)!;
        if (upperSig !== undefined) return sigs.get(upperSig)!;

        return 0;
    };

    const rosterWithPrestige = roster.map(r => {
        const prestige = getInterpolatedPrestige(r.championId, r.stars, r.rank, r.sigLevel || 0);
        return { ...r, prestige };
    });

    const rosterPrestigeMap: Record<string, number> = {};
    rosterWithPrestige.forEach(r => {
        rosterPrestigeMap[r.id] = r.prestige;
    });

    rosterWithPrestige.sort((a, b) => b.prestige - a.prestige);
    const top30 = rosterWithPrestige.slice(0, 30);
    const sum = top30.reduce((s, r) => s + r.prestige, 0);
    const top30Average = top30.length > 0 ? Math.round(sum / top30.length) : 0;

    // --- Smart Recommendations Simulation ---
    const candidates = roster.filter(r => {
        // Check Class Filter
        if (options.rankClassFilter.length > 0 && !options.rankClassFilter.includes(r.champion.class)) return false;

        // Check Saga Filter
        if (options.rankSagaFilter && !r.champion.tags.some(t => t.name === '#Saga Champions')) return false;

        // Check 7* up to targetRank (but max 6)
        if (r.stars === 7) return r.rank < Math.min(options.targetRank, 6);
        // Check 6* and 5* up to Rank 5 (Max)
        if (r.stars === 6) return r.rank < 5;
        if (r.stars === 5) return r.rank < 5;
        return false;
    });

    const allRecommendations = candidates.map(c => {
        const nextPrestige = getInterpolatedPrestige(c.championId, c.stars, c.rank + 1, c.sigLevel || 0);
        if (nextPrestige === 0) return null;

        const currentPrestige = rosterPrestigeMap[c.id] || 0;

        // Simulate new Top 30 list
        const simulatedPrestigeList = rosterWithPrestige.map(r =>
            r.id === c.id ? nextPrestige : r.prestige
        );
        simulatedPrestigeList.sort((a, b) => b - a);

        const simSum = simulatedPrestigeList.slice(0, 30).reduce((s, p) => s + p, 0);
        const simAvg = Math.round(simSum / Math.min(30, simulatedPrestigeList.length));
        const delta = simAvg - top30Average;

        return {
            championId: c.championId,
            championName: c.champion.name,
            championClass: c.champion.class,
            championImage: c.champion.images as unknown as ChampionImages,
            stars: c.stars,
            fromRank: c.rank,
            toRank: c.rank + 1,
            prestigeGain: nextPrestige - currentPrestige,
            accountGain: delta
        };
    }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0);

    const recommendations = allRecommendations
        .sort((a, b) => b.accountGain - a.accountGain)
        .slice(0, 5);

    // --- Signature Stone Simulation ---
    const sigCandidates = roster.filter(r => {
        if (options.sigClassFilter.length > 0 && !options.sigClassFilter.includes(r.champion.class)) return false;
        if (options.sigSagaFilter && !r.champion.tags.some(t => t.name === '#Saga Champions')) return false;

        if ((r.sigLevel || 0) >= 200) return false;
        if (r.stars === 7) return true;
        if (r.stars === 6 && r.rank >= 4) return true;
        return false;
    });

    let sigRecommendations: SigRecommendation[] = [];

    if (options.sigBudget > 0) {
        // GREEDY OPTIMIZATION
        const simState = rosterWithPrestige.map(r => ({ ...r, currentSig: r.sigLevel || 0, currentPrestige: r.prestige }));
        const addedSigs: Record<string, number> = {};

        for (let i = 0; i < options.sigBudget; i++) {
            let bestMove: { rosterIndex: number, gain: number, newPrestige: number } | null = null;
            const sortedState = [...simState].sort((a, b) => b.currentPrestige - a.currentPrestige);

            for (const cand of sigCandidates) {
                const idx = simState.findIndex(r => r.id === cand.id);
                const charState = simState[idx];

                if (charState.currentSig >= 200) continue;

                const nextPrestige = getInterpolatedPrestige(cand.championId, cand.stars, cand.rank, charState.currentSig + 1);
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

                if (moveGain > 0) {
                    if (!bestMove || moveGain > bestMove.gain) {
                        bestMove = { rosterIndex: idx, gain: moveGain, newPrestige: nextPrestige };
                    }
                }
            }

            if (bestMove) {
                const target = simState[bestMove.rosterIndex];
                target.currentSig += 1;
                target.currentPrestige = bestMove.newPrestige;
                addedSigs[target.id] = (addedSigs[target.id] || 0) + 1;
            } else {
                break;
            }
        }

        sigRecommendations = Object.entries(addedSigs).map(([id, added]) => {
            const original = rosterWithPrestige.find(r => r.id === id)!;
            const finalSig = (original.sigLevel || 0) + added;
            const finalPrestige = getInterpolatedPrestige(original.championId, original.stars, original.rank, finalSig);

            const isolationList = rosterWithPrestige.map(r => r.id === id ? finalPrestige : r.prestige).sort((a, b) => b - a);
            const isoSum = isolationList.slice(0, 30).reduce((s, p) => s + p, 0);
            const isoAvg = Math.round(isoSum / 30);
            const delta = isoAvg - top30Average;
            const efficiency = delta / added;

            return {
                championId: original.championId,
                championName: original.champion.name,
                championClass: original.champion.class,
                championImage: original.champion.images as unknown as ChampionImages,
                stars: original.stars,
                rank: original.rank,
                fromSig: original.sigLevel || 0,
                toSig: finalSig,
                prestigeGain: finalPrestige - original.prestige,
                accountGain: delta,
                prestigePerSig: parseFloat(efficiency.toFixed(2))
            };
        }).sort((a, b) => b.accountGain - a.accountGain);

    } else {
        // DEFAULT: MAX SIG POTENTIAL
        sigRecommendations = sigCandidates.map(c => {
            const nextPrestige = getInterpolatedPrestige(c.championId, c.stars, c.rank, 200);
            if (nextPrestige === 0) return null;

            const currentPrestige = rosterPrestigeMap[c.id] || 0;
            const sigsNeeded = 200 - (c.sigLevel || 0);

            const simulatedPrestigeList = rosterWithPrestige.map(r =>
                r.id === c.id ? nextPrestige : r.prestige
            );
            simulatedPrestigeList.sort((a, b) => b - a);

            const simSum = simulatedPrestigeList.slice(0, 30).reduce((s, p) => s + p, 0);
            const simAvg = Math.round(simSum / Math.min(30, simulatedPrestigeList.length));
            const delta = simAvg - top30Average;

            const prestigeGain = nextPrestige - currentPrestige;
            const efficiency = sigsNeeded > 0 ? delta / sigsNeeded : 0;

            return {
                championId: c.championId,
                championName: c.champion.name,
                championClass: c.champion.class,
                championImage: c.champion.images as unknown as ChampionImages,
                stars: c.stars,
                rank: c.rank,
                fromSig: c.sigLevel || 0,
                toSig: 200,
                prestigeGain: prestigeGain,
                accountGain: delta,
                prestigePerSig: parseFloat(efficiency.toFixed(2))
            };
        }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0)
        .sort((a, b) => b.accountGain - a.accountGain)
        .slice(0, 5);
    }

    return {
        top30Average,
        prestigeMap: rosterPrestigeMap,
        recommendations,
        sigRecommendations
    };
}
