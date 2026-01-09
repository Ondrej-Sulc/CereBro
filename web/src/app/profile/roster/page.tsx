import { redirect } from "next/navigation";
import { getRoster } from "@cerebro/core/services/rosterService";
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
  searchParams: Promise<{ targetRank?: string }>;
}) {
  const searchParams = await props.searchParams;
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/signin?callbackUrl=/profile/roster");
  }

  const rosterResult = await getRoster(player.id, null, null, null);
  const roster = typeof rosterResult === "string" ? [] : rosterResult;

  // Calculate Top 30 Average Prestige
  let top30Average = 0;
  let recommendations: any[] = [];
  const rosterPrestigeMap: Record<string, number> = {};
  
  // Determine Simulation Cap
  let maxRosterRank = 1;
  roster.forEach(r => {
      if (r.stars === 7 && r.rank > maxRosterRank) maxRosterRank = r.rank;
      // Map 6* R5 roughly to 7* R3 for "max rank" logic? 
      // Actually, simplified: just track max numerical rank found regardless of rarity, 
      // usually 7* rank is lower than 6* rank (R3 vs R5).
      // But for the slider/dropdown, we usually mean "7-Star Rank Level".
      // If user has 6* R5 (Max) and 7* R2. They might want to see R3.
      // Let's look for highest 7* rank. If no 7*, default to 3?
  });
  
  const highest7StarRank = roster.reduce((max, r) => (r.stars === 7 ? Math.max(max, r.rank) : max), 0);
  // Default to highest 7* rank, or 3 if none, or 2?
  // User said "default to a rank that the highest champion is".
  // If I have 7* R4, default is 4.
  const defaultTarget = highest7StarRank > 0 ? highest7StarRank : 3;
  
  const targetRank = searchParams.targetRank ? parseInt(searchParams.targetRank) : defaultTarget;

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
              championName: c.champion.name,
              championClass: c.champion.class,
              championImage: c.champion.images,
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
        top30Average={top30Average}
        prestigeMap={rosterPrestigeMap}
        recommendations={recommendations}
        simulationTargetRank={targetRank}
      />
    </div>
  );
}
