"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skull, Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { DetailedPlacementStat, ChampionEntity } from "./deep-dive-types";

interface MatchupAnalysisViewProps {
  activeSubTab: "attacker" | "counter";
  selectedAttackerId: number | null;
  selectedCounterDefenderId: number | null;
  placementStats: DetailedPlacementStat[];
  uniqueAttackers: ChampionEntity[];
  uniqueDefenders: ChampionEntity[];
}

export function MatchupAnalysisView({
  activeSubTab,
  selectedAttackerId,
  selectedCounterDefenderId,
  placementStats,
  uniqueAttackers,
  uniqueDefenders,
}: MatchupAnalysisViewProps) {

  const attackerMatchupStats = useMemo(() => {
    if (!selectedAttackerId) return [];
    const aggregated = new Map<number, DetailedPlacementStat>();
    placementStats
      .filter((s) => s.attackerId === selectedAttackerId)
      .forEach((stat) => {
        const existing = aggregated.get(stat.defenderId);
        if (existing) {
          existing.fights += stat.fights;
          existing.deaths += stat.deaths;
        } else {
          aggregated.set(stat.defenderId, { ...stat });
        }
      });
    return Array.from(aggregated.values()).sort((a, b) => b.deaths - a.deaths || b.fights - a.fights);
  }, [selectedAttackerId, placementStats]);

  const counterStats = useMemo(() => {
    if (!selectedCounterDefenderId) return [];
    const aggregated = new Map<number, DetailedPlacementStat>();
    placementStats
      .filter((s) => s.defenderId === selectedCounterDefenderId && s.attackerId)
      .forEach((stat) => {
        const existing = aggregated.get(stat.attackerId!);
        if (existing) {
          existing.fights += stat.fights;
          existing.deaths += stat.deaths;
        } else {
          aggregated.set(stat.attackerId!, { ...stat });
        }
      });
    return Array.from(aggregated.values()).sort((a, b) => a.deaths - b.deaths || b.fights - a.fights);
  }, [selectedCounterDefenderId, placementStats]);

  if (activeSubTab === "attacker") {
    const att = uniqueAttackers.find(a => a.id === selectedAttackerId);
    if (!selectedAttackerId || !att) return <EmptyState icon={<Swords className="w-12 h-12 opacity-20" />} title="Select an Attacker to begin analysis" />;
    
    const classColors = getChampionClassColors(att.class);
    const totalFights = attackerMatchupStats.reduce((acc, curr) => acc + curr.fights, 0);
    const totalDeaths = attackerMatchupStats.reduce((acc, curr) => acc + curr.deaths, 0);
    const globalSoloRate = ((totalFights - totalDeaths) / (totalFights || 1)) * 100;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="bg-slate-950/50 border-slate-800/60 overflow-hidden relative shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-64 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 opacity-[0.15] flex justify-end items-center">
              <img src={getChampionImageUrl(att.images, 'full', 'secondary')} className="h-[100%] object-cover grayscale brightness-200" alt="" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
          </div>
          
          <CardHeader className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-8 pb-8 pt-8 px-8 text-center sm:text-left">
            <div 
              className="relative shrink-0 mx-auto sm:mx-0 rounded-full p-1.5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-700 hover:scale-105"
              style={{ boxShadow: `0 0 30px ${classColors.color}25`, border: `3px solid ${classColors.color}`, width: 'fit-content' }}
            >
              <Avatar className={cn("h-32 w-32 border-none", classColors.bg)}>
                <AvatarImage src={getChampionImageUrl(att.images, 'full')} className="object-contain" />
                <AvatarFallback>{att.name.substring(0,2)}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <div className={cn("w-2 h-2 rounded-full")} style={{ backgroundColor: classColors.color }} />
                  <span className={cn("text-xs font-black uppercase tracking-[0.3em]", classColors.text)}>{att.class}</span>
                </div>
                <CardTitle className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic pr-4">{att.name}</CardTitle>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm">
                  <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Season Fights</span>
                  <span className="text-xl font-mono font-bold text-white leading-none">{totalFights}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm">
                  <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Success Rate</span>
                  <span className={cn("text-xl font-mono font-bold leading-none", globalSoloRate >= 90 ? "text-emerald-400" : "text-amber-400")}>{globalSoloRate.toFixed(0)}%</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Efficiency</span>
                    <span className="text-[10px] font-mono font-bold text-emerald-400">{globalSoloRate.toFixed(1)}%</span>
                  </div>
                  <Progress value={globalSoloRate} className="h-1 bg-slate-800" indicatorStyle={{ backgroundColor: globalSoloRate >= 90 ? '#10b981' : '#f59e0b' }} />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 border-t border-slate-800/60 relative z-10 bg-slate-950/50">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                <tr>
                  <th className="px-8 py-4">Defender</th>
                  <th className="px-8 py-4 text-center">Fights</th>
                  <th className="px-8 py-4 text-center">Win Rate</th>
                  <th className="px-8 py-4 text-right">Deaths</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-sm">
                {attackerMatchupStats.map((stat) => {
                  const soloRate = ((stat.fights - stat.deaths) / stat.fights) * 100;
                  const targetColors = getChampionClassColors(stat.defenderClass);
                  return (
                    <tr key={stat.defenderId} className="hover:bg-slate-800/20 transition-all group/target">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative rounded-lg p-0.5 shrink-0" style={{ border: `1px solid ${targetColors.color}40`, backgroundColor: `${targetColors.color}10` }}>
                            <Avatar className="h-10 w-10 border-none">
                              <AvatarImage src={getChampionImageUrl(stat.defenderImages, '64')} />
                              <AvatarFallback>{stat.defenderName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                          </div>
                          <span className={cn("font-black uppercase italic tracking-tight text-base truncate max-w-[120px] sm:max-w-none pr-2", targetColors.text)}>{stat.defenderName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center font-mono text-slate-300 font-bold">{stat.fights}</td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col gap-1.5 w-full max-w-[80px] sm:max-w-[120px] mx-auto">
                          <span className={cn("text-[10px] font-black text-center mb-0.5", soloRate >= 90 ? "text-emerald-400" : "text-amber-400")}>{soloRate.toFixed(0)}% SOLO</span>
                          <Progress value={soloRate} className="h-1 bg-slate-800" indicatorStyle={{ backgroundColor: soloRate >= 90 ? '#10b981' : '#f59e0b' }} />
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right">
                        <span className={cn("font-mono font-bold flex items-center justify-end gap-1.5", stat.deaths > 0 ? "text-red-400" : "text-emerald-500")}>
                          {stat.deaths > 0 && <Skull className="w-3.5 h-3.5" />}
                          {stat.deaths === 0 ? "SOLO" : `${stat.deaths} DEATHS`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeSubTab === "counter") {
    const def = uniqueDefenders.find(d => d.id === selectedCounterDefenderId);
    if (!selectedCounterDefenderId || !def) return <EmptyState icon={<Swords className="w-12 h-12 opacity-20" />} title="Select a Defender to begin analysis" />;
    
    const classColors = getChampionClassColors(def.class);
    
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
        <Card className="bg-slate-950/50 border-slate-800/60 overflow-hidden relative shadow-2xl">
          <div className="absolute inset-x-0 top-0 h-64 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 opacity-[0.15] flex justify-end items-center">
              <img src={getChampionImageUrl(def.images, 'full', 'secondary')} className="h-[100%] object-cover grayscale brightness-200" alt="" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
          </div>
          
          <CardHeader className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-8 pb-8 pt-8 px-8 text-center sm:text-left">
            <div 
              className="relative shrink-0 mx-auto sm:mx-0 rounded-full p-1.5 transition-transform duration-700 hover:scale-105"
              style={{ boxShadow: `0 0 30px ${classColors.color}25`, border: `3px solid ${classColors.color}`, width: 'fit-content' }}
            >
              <Avatar className={cn("h-32 w-32 border-none", classColors.bg)}>
                <AvatarImage src={getChampionImageUrl(def.images, 'full')} className="object-contain" />
                <AvatarFallback>{def.name.substring(0,2)}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]")} style={{ backgroundColor: classColors.color }} />
                  <span className={cn("text-xs font-black uppercase tracking-[0.3em]", classColors.text)}>{def.class}</span>
                </div>
                <CardTitle className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic pr-4 mb-4">{def.name}</CardTitle>
                <div className="flex items-center justify-center sm:justify-start">
                  <div className="bg-slate-900/60 border border-slate-800/60 px-4 py-2 rounded-xl backdrop-blur-sm">
                    <div className="text-sm font-black text-slate-400 uppercase tracking-tight">Fights Recorded This Season</div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0 border-t border-slate-800/60 relative z-10 bg-slate-950/50">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                <tr>
                  <th className="px-8 py-4">Attacker</th>
                  <th className="px-8 py-4 text-center">Fights</th>
                  <th className="px-8 py-4 text-center">Win Rate</th>
                  <th className="px-8 py-4 text-right">Result</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-sm">
                {counterStats.map((stat) => {
                  const soloRate = ((stat.fights - stat.deaths) / stat.fights) * 100;
                  const attColors = getChampionClassColors(stat.attackerClass!);
                  return (
                    <tr key={stat.attackerId} className="hover:bg-slate-800/20 transition-all group/counter">
                      <td className="px-8 py-4">
                        <div className="flex items-center gap-4">
                          <div className="relative rounded-lg p-0.5 shrink-0 shadow-lg group-hover/counter:scale-110 transition-transform" style={{ border: `1.5px solid ${attColors.color}`, backgroundColor: attColors.bg }}>
                            <Avatar className="h-10 w-10 border-none">
                              <AvatarImage src={getChampionImageUrl(stat.attackerImages!, '64')} />
                              <AvatarFallback>{stat.attackerName!.substring(0,2)}</AvatarFallback>
                            </Avatar>
                          </div>
                          <span className={cn("font-black text-base italic uppercase tracking-tight truncate max-w-[120px] sm:max-w-none pr-2", attColors.text)}>{stat.attackerName}</span>
                        </div>
                      </td>
                      <td className="px-8 py-4 text-center font-mono text-slate-300 font-bold">{stat.fights}</td>
                      <td className="px-8 py-4">
                        <div className="flex flex-col gap-1.5 w-full max-w-[80px] sm:max-w-[140px] mx-auto">
                          <div className="flex items-center justify-between text-[10px] font-black">
                            <span className={soloRate >= 90 ? "text-emerald-400" : "text-amber-400"}>{soloRate.toFixed(0)}% SOLO</span>
                            <Trophy className={cn("w-3 h-3", soloRate >= 90 ? "text-yellow-500" : "text-slate-600")} />
                          </div>
                          <Progress value={soloRate} className="h-1 bg-slate-800" indicatorStyle={{ backgroundColor: soloRate >= 90 ? '#10b981' : '#f59e0b' }} />
                        </div>
                      </td>
                      <td className="px-8 py-4 text-right font-mono font-bold">
                        <span className={cn("px-2 py-1 rounded text-xs", stat.deaths > 0 ? "text-red-400" : "text-emerald-400")}>
                          {stat.deaths === 0 ? "SOLO" : `${stat.deaths} DEATHS`}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}

function EmptyState({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800/60 rounded-2xl bg-slate-950/20 text-slate-500 space-y-4">
      <div className="p-4 rounded-full bg-slate-900/50">
        {icon}
      </div>
      <p className="font-bold tracking-tight text-lg">{title}</p>
    </div>
  );
}
