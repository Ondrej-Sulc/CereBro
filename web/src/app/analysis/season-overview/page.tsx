import { Card } from "@/components/ui/card";
import { Skull, Trophy, BarChart2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SeasonSelector } from "./season-selector";
import { getUserPlayerWithAlliance } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import logger from "@/lib/logger";
import { SeasonOverviewView } from "./season-overview-view";
import { SeasonAnalysisContainer } from "./season-analysis-container";
import { getAvailableSeasons, getSeasonData } from "./season-data";

// Force dynamic rendering to ensure up-to-date data
export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SeasonOverviewPage({ searchParams }: PageProps) {
  const awaitedSearchParams = await searchParams;

  // 0. Check Authentication and Alliance
  const player = await getUserPlayerWithAlliance();
  
  if (!player) {
    redirect("/api/auth/discord-login?redirectTo=/analysis/season-overview");
  }

  if (!player.allianceId) {
    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                    Season Overview
                </h1>
            </div>
            <Card className="bg-slate-950/50 border-slate-800/60 p-12 flex flex-col items-center justify-center text-center gap-4">
                <Lock className="w-12 h-12 text-slate-700" />
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-300">Alliance Membership Required</h2>
                    <p className="text-slate-500 max-w-md">
                        You must be a member of an alliance to view season statistics. 
                        Please join an alliance in Discord using CereBro.
                    </p>
                </div>
            </Card>
        </div>
    );
  }

  const allianceId = player.allianceId;
  logger.info({ userId: player.id, allianceId }, "User accessing Season Overview page");

  // 1. Fetch available seasons
  const seasons = await getAvailableSeasons(allianceId);

  // Early return if no seasons found
  if (!seasons || seasons.length === 0) {
    return (
        <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                    <Trophy className="h-6 w-6 text-yellow-500" />
                </div>
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                        Season Overview
                    </h1>
                    <p className="text-sm text-slate-400 font-medium">
                        {player.alliance?.name}
                    </p>
                </div>
            </div>
            <Card className="bg-slate-950/50 border-slate-800/60 p-12 flex flex-col items-center justify-center text-center gap-4">
                <BarChart2 className="w-12 h-12 text-slate-700" />
                <div className="space-y-2">
                    <h2 className="text-xl font-semibold text-slate-300">No Season Data Found</h2>
                    <p className="text-slate-500 max-w-md">
                        There are no recorded alliance war seasons in the database for your alliance yet. 
                        Complete some wars to see performance analysis here.
                    </p>
                </div>
            </Card>
        </div>
    );
  }

  const latestSeason = seasons[0];

  // Colors
  const bgColors = {
      1: player.alliance?.battlegroup1Color || "#ef4444",
      2: player.alliance?.battlegroup2Color || "#22c55e",
      3: player.alliance?.battlegroup3Color || "#3b82f6"
  };

  // Parse and validate the selected season
  let selectedSeason: number;
  const seasonParam = awaitedSearchParams.season;
  
  if (typeof seasonParam === 'string') {
      const parsed = parseInt(seasonParam, 10);
      selectedSeason = !isNaN(parsed) && Number.isInteger(parsed) ? parsed : latestSeason;
  } else {
      selectedSeason = latestSeason;
  }

  // Ensure selectedSeason is actually in the seasons list or fallback to latest
  if (!seasons.includes(selectedSeason)) {
      selectedSeason = latestSeason;
  }

  // 2. Fetch and Process Data
  const {
      deathDistribution,
      topDefenders,
      topAttackers,
      hardestNodes,
      placementStats,
      totalWars,
      mapTypes,
      allPlayers,
      globalDeaths,
      globalSoloRate
  } = await getSeasonData(allianceId, selectedSeason);
    
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-7xl space-y-8">
        
        {/* Unified Season Header */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Context (Season Identity) */}
            <Card className="lg:col-span-7 bg-slate-950/40 border-slate-800/60 p-6 flex flex-col justify-between gap-6 relative overflow-hidden group">
                {/* Background Accent */}
                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-yellow-500/5 to-transparent pointer-events-none" />
                
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4 z-10">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/10 rounded-xl border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                            <Trophy className="h-8 w-8 text-yellow-500" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black italic uppercase text-white tracking-tighter leading-none">
                                Season Overview
                            </h1>
                            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">
                                {player.alliance?.name}
                            </p>
                        </div>
                    </div>
                    <SeasonSelector seasons={seasons} currentSeason={selectedSeason} />
                </div>

                <div className="grid grid-cols-3 gap-4 z-10 pt-4 border-t border-slate-800/60">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Current Season</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-mono font-black text-slate-200">S{selectedSeason}</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Wars Logged</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-xl font-mono font-black text-slate-200">{totalWars}</span>
                            <span className="text-[10px] text-slate-500 font-bold">WARS</span>
                        </div>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Active Map</span>
                        <div className="flex items-center gap-2">
                            {mapTypes.has("BIG_THING") ? (
                                <span className="text-sm font-black text-purple-400 uppercase italic">Big Thing</span>
                            ) : (
                                <span className="text-sm font-black text-slate-400 uppercase italic">Standard</span>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Right Column: Performance (Global Stats) */}
            <Card className="lg:col-span-5 bg-slate-950/40 border-slate-800/60 p-6 flex flex-col justify-between gap-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-1 h-full bg-emerald-500/50" />
                
                <div className="flex justify-between items-start z-10">
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-slate-500 tracking-widest mb-1">Global Efficiency</span>
                        <span className={cn(
                            "text-4xl font-black italic font-mono leading-none tracking-tighter",
                            globalSoloRate >= 95 ? "text-emerald-400" : globalSoloRate >= 80 ? "text-slate-200" : "text-amber-500"
                        )}>
                            {globalSoloRate.toFixed(1)}%
                        </span>
                    </div>
                    <div className="flex flex-col items-end">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Total Deaths</span>
                        <div className="flex items-center gap-2 text-red-400 bg-red-950/20 px-3 py-1 rounded border border-red-900/30">
                            <Skull className="w-4 h-4" />
                            <span className="text-xl font-mono font-black">{globalDeaths}</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-4 border-t border-slate-800/60 z-10">
                    <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-black uppercase text-slate-600 mb-1">Path</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-mono font-black text-slate-300">{deathDistribution.path}</span>
                            <span className="text-[9px] text-slate-600">({globalDeaths > 0 ? ((deathDistribution.path / globalDeaths) * 100).toFixed(0) : 0}%)</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-slate-800/60" />
                    <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-black uppercase text-slate-600 mb-1">Mini-Boss</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-mono font-black text-slate-300">{deathDistribution.miniBoss}</span>
                            <span className="text-[9px] text-slate-600">({globalDeaths > 0 ? ((deathDistribution.miniBoss / globalDeaths) * 100).toFixed(0) : 0}%)</span>
                        </div>
                    </div>
                    <div className="w-px h-8 bg-slate-800/60" />
                    <div className="flex flex-col items-center flex-1">
                        <span className="text-[9px] font-black uppercase text-slate-600 mb-1">Boss</span>
                        <div className="flex items-baseline gap-1">
                            <span className="text-sm font-mono font-black text-slate-300">{deathDistribution.boss}</span>
                            <span className="text-[9px] text-slate-600">({globalDeaths > 0 ? ((deathDistribution.boss / globalDeaths) * 100).toFixed(0) : 0}%)</span>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
  
        {/* Interactive Unified Roster Grid */}
        <SeasonOverviewView 
            allPlayers={allPlayers} 
            bgColors={bgColors} 
        />

        {/* Combined Insights & Deep Dive */}
        <SeasonAnalysisContainer 
            topDefenders={topDefenders}
            topAttackers={topAttackers}
            hardestNodes={hardestNodes}
            placementStats={placementStats}
        />
      </div>
    );
}
