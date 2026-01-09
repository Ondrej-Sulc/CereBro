import { redirect } from "next/navigation";
import { getRoster } from "@cerebro/core/services/rosterService";
import { getCachedChampions } from "@/lib/data/champions";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { RosterView } from "./roster-view";
import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "My Roster | CereBro",
  description: "Manage and view your MCOC champion roster.",
};

export default async function RosterPage(props: {
  searchParams: Promise<{ targetRank?: string; sigBudget?: string }>;
}) {
  const searchParams = await props.searchParams;
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/profile/roster");
  }

  const [rosterResult, allChampions] = await Promise.all([
      getRoster(player.id, null, null, null),
      getCachedChampions()
  ]);
  
  const roster = typeof rosterResult === "string" ? [] : rosterResult;

  // Calculate Top 30 Average Prestige
  let top30Average = 0;
  let recommendations: any[] = [];
  let sigRecommendations: any[] = [];
  const rosterPrestigeMap: Record<string, number> = {};
  
  // Determine Simulation Cap
  let maxRosterRank = 1;
  roster.forEach(r => {
      if (r.stars === 7 && r.rank > maxRosterRank) maxRosterRank = r.rank;
  });
  
  const highest7StarRank = roster.reduce((max, r) => (r.stars === 7 ? Math.max(max, r.rank) : max), 0);
  const defaultTarget = highest7StarRank > 0 ? highest7StarRank : 3;
  
  const targetRank = searchParams.targetRank ? parseInt(searchParams.targetRank) : defaultTarget;
  const sigBudget = searchParams.sigBudget ? parseInt(searchParams.sigBudget) : 0;

  if (roster.length > 0) {
      const championIds = Array.from(new Set(roster.map(r => r.championId)));
      
      // Fetch ALL prestige data for these champions to enable interpolation
      // This avoids complex query logic and allows flexible sig handling
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
          
          // Fallback if out of bounds (shouldn't happen with 0 and 200 bounds, but safe fallback)
          if (lowerSig !== undefined) return sigs.get(lowerSig)!;
          if (upperSig !== undefined) return sigs.get(upperSig)!;
          
          return 0;
      };

      const rosterWithPrestige = roster.map(r => {
          const prestige = getInterpolatedPrestige(r.championId, r.stars, r.rank, r.sigLevel || 0);
          return { ...r, prestige };
      });

      rosterWithPrestige.forEach(r => {
          rosterPrestigeMap[r.id] = r.prestige;
      });

      rosterWithPrestige.sort((a, b) => b.prestige - a.prestige);
      const top30 = rosterWithPrestige.slice(0, 30);
      const sum = top30.reduce((s, r) => s + r.prestige, 0);
      top30Average = top30.length > 0 ? Math.round(sum / top30.length) : 0;

      // Smart Recommendations Simulation
      const candidates = roster.filter(r => {
          // Check 7* up to targetRank (but max 6)
          if (r.stars === 7) return r.rank < Math.min(targetRank, 6); 
          // Check 6* and 5* up to Rank 5 (Max), regardless of higher targetRank
          if (r.stars === 6) return r.rank < 5;
          if (r.stars === 5) return r.rank < 5;
          return false;
      });

      const allRecommendations = candidates.map(c => {
          const nextPrestige = getInterpolatedPrestige(c.championId, c.stars, c.rank + 1, c.sigLevel || 0);
          if (nextPrestige === 0) return null;

          const currentPrestige = rosterPrestigeMap[c.id] || 0;
          
          // Simulate new Top 30 list
          // We take the existing sorted top 30 list logic (but need full list to re-sort correctly)
          // Optimization: We can just take the top 31 items from current list + this candidate
          // But safest is to map the full list.
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
                             championClass: c.champion.class,              championImage: c.champion.images,
              stars: c.stars,
              fromRank: c.rank,
              toRank: c.rank + 1,
              prestigeGain: nextPrestige - currentPrestige,
              accountGain: delta
          };
      }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0);

      recommendations = allRecommendations
          .sort((a, b) => b.accountGain - a.accountGain)
          .slice(0, 5);

      // Signature Stone Simulation
      const sigCandidates = roster.filter(r => {
          if ((r.sigLevel || 0) >= 200) return false;
          // Focus on 7* and High Rank 6*
          if (r.stars === 7) return true;
          if (r.stars === 6 && r.rank >= 4) return true;
          return false;
      });

      if (sigBudget > 0) {
          // GREEDY OPTIMIZATION
          // Clone roster state for simulation
          const simState = rosterWithPrestige.map(r => ({ ...r, currentSig: r.sigLevel || 0, currentPrestige: r.prestige }));
          // Track added sigs per champion ID
          const addedSigs: Record<string, number> = {};
          
          // Loop until budget exhausted or no moves possible
          for (let i = 0; i < sigBudget; i++) {
              let bestMove: { rosterIndex: number, gain: number, newPrestige: number } | null = null;
              
              // Sort current state to find Top 30 threshold quickly
              // (Optimization: Maintain sorted list, but for N<500 array.sort is fast enough per iteration)
              const sortedState = [...simState].sort((a, b) => b.currentPrestige - a.currentPrestige);
              const currentTop30Sum = sortedState.slice(0, 30).reduce((s, r) => s + r.currentPrestige, 0);
              
              // Evaluate +1 sig for each candidate
              for (const cand of sigCandidates) {
                  const idx = simState.findIndex(r => r.id === cand.id);
                  const charState = simState[idx];
                  
                  if (charState.currentSig >= 200) continue; // Cap at 200
                  
                  const nextPrestige = getInterpolatedPrestige(cand.championId, cand.stars, cand.rank, charState.currentSig + 1);
                  if (nextPrestige <= charState.currentPrestige) continue; // No gain (shouldn't happen with interpolation but safe check)

                  // Calculate net account gain
                  // If char is already in Top 30, gain is just delta
                  // If char enters Top 30, gain is (newPrestige - 30thPrestige)
                  
                  let moveGain = 0;
                  // We simulate the new sum
                  // Optimization: calculate delta directly
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
                  break; // No improving moves found
              }
          }
          
          // Generate Result List
          const allSigRecommendations = Object.entries(addedSigs).map(([id, added]) => {
               const original = rosterWithPrestige.find(r => r.id === id)!;
               const finalSig = (original.sigLevel || 0) + added;
               const finalPrestige = getInterpolatedPrestige(original.championId, original.stars, original.rank, finalSig);
               
               // Calculate Average Efficiency (Account Gain / Stones Used)
               const totalPrestigeGain = finalPrestige - original.prestige;
               
               // Account Gain (Final State vs Initial State)
               // Re-sort final state
               const finalSimList = simState.map(r => r.currentPrestige).sort((a, b) => b - a);
               const finalSum = finalSimList.slice(0, 30).reduce((s, p) => s + p, 0);
               const finalAvg = Math.round(finalSum / Math.min(30, finalSimList.length));

               // Note: This logic computes total account gain for the whole batch, 
               // but we want per-champion contribution roughly?
               // Actually, for the list, we can just show the efficiency and the total added.
               // The "Account Gain" displayed on the card usually implies "If you do THIS action".
               // So let's calculate the account gain of THIS specific allocation in isolation?
               // OR just show the efficiency.
               // Let's stick to consistent UI: "Account Gain" is nice.
               // Let's calc isolation gain:
                const isolationList = rosterWithPrestige.map(r => r.id === id ? finalPrestige : r.prestige).sort((a,b)=>b-a);
                const isoSum = isolationList.slice(0, 30).reduce((s, p) => s + p, 0);
                const isoAvg = Math.round(isoSum / 30);
                const delta = isoAvg - top30Average;
                const efficiency = delta / added;

               return {
                   championName: original.champion.name,
                   championClass: original.champion.class,
                   championImage: original.champion.images,
                   stars: original.stars,
                   rank: original.rank,
                   fromSig: original.sigLevel || 0,
                   toSig: finalSig,
                   prestigeGain: totalPrestigeGain,
                   accountGain: delta,
                   prestigePerSig: parseFloat(efficiency.toFixed(2))
               };
          });
          
          sigRecommendations = allSigRecommendations.sort((a, b) => b.accountGain - a.accountGain);

      } else {
          // DEFAULT: MAX SIG POTENTIAL
          const allSigRecommendations = sigCandidates.map(c => {
               const nextPrestige = getInterpolatedPrestige(c.championId, c.stars, c.rank, 200);
               if (nextPrestige === 0) return null;
    
               const currentPrestige = rosterPrestigeMap[c.id] || 0;
               const sigsNeeded = 200 - (c.sigLevel || 0);
               
               // Simulate Top 30 with this change
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
                   championImage: c.champion.images,
                   stars: c.stars,
                   rank: c.rank,
                   fromSig: c.sigLevel || 0,
                   toSig: 200,
                   prestigeGain: prestigeGain,
                   accountGain: delta,
                   prestigePerSig: parseFloat(efficiency.toFixed(2))
               };
          }).filter((r): r is NonNullable<typeof r> => r !== null && r.accountGain > 0);
    
          sigRecommendations = allSigRecommendations
              .sort((a, b) => b.accountGain - a.accountGain)
              .slice(0, 5);
      }
  }

  return (
    <div className="container mx-auto p-4 sm:p-8 space-y-8">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            My Roster
          </h1>
          <p className="text-slate-400 mt-1">
            Manage your champions, update stats, and track your progress.
          </p>
        </div>
        <Link href="/profile/update">
          <Button className="bg-sky-600 hover:bg-sky-700 shadow-lg shadow-sky-900/20 flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Update Roster
          </Button>
        </Link>
      </div>

      <RosterView 
        initialRoster={roster} 
        allChampions={allChampions}
        top30Average={top30Average}
        prestigeMap={rosterPrestigeMap}
        recommendations={recommendations}
        sigRecommendations={sigRecommendations}
        simulationTargetRank={targetRank}
        initialSigBudget={sigBudget}
      />
    </div>
  );
}
