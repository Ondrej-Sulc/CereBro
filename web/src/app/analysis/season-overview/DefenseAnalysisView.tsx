"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skull, Target, Shield } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import { DetailedPlacementStat, ChampionEntity } from "./deep-dive-types";

interface DefenseAnalysisViewProps {
  activeSubTab: "node" | "defender";
  selectedNode: number | null;
  selectedDefenderId: number | null;
  placementStats: DetailedPlacementStat[];
  uniqueDefenders: ChampionEntity[];
}

export function DefenseAnalysisView({
  activeSubTab,
  selectedNode,
  selectedDefenderId,
  placementStats,
  uniqueDefenders,
}: DefenseAnalysisViewProps) {
  
  const nodeStats = useMemo(() => {
    if (!selectedNode) return [];
    const aggregated = new Map<number, DetailedPlacementStat>();
    placementStats
      .filter((s) => s.nodeNumber === selectedNode)
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
  }, [selectedNode, placementStats]);

  const defenderPlacementStats = useMemo(() => {
    if (!selectedDefenderId) return [];
    const aggregated = new Map<number, DetailedPlacementStat>();
    placementStats
      .filter((s) => s.defenderId === selectedDefenderId)
      .forEach((stat) => {
        const existing = aggregated.get(stat.nodeNumber);
        if (existing) {
          existing.fights += stat.fights;
          existing.deaths += stat.deaths;
        } else {
          aggregated.set(stat.nodeNumber, { ...stat });
        }
      });
    return Array.from(aggregated.values()).sort((a, b) => b.deaths - a.deaths || b.fights - a.fights);
  }, [selectedDefenderId, placementStats]);

  if (activeSubTab === "node") {
    if (!selectedNode) return <EmptyState icon={<Shield className="w-12 h-12 opacity-20" />} title="Select a Node to begin analysis" />;
    
    return (
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
        <Card className="bg-slate-950/50 border-slate-800/60 overflow-hidden relative group shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <Target className="w-32 h-32 text-amber-500 rotate-12" />
          </div>
          <div className="absolute inset-0 h-40 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
          <CardHeader className="relative z-10 flex flex-col sm:flex-row items-center gap-6 border-b border-slate-800/60 bg-slate-900/20 pb-6">
            <div className="shrink-0">
              <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.15)] group-hover:scale-105 transition-transform duration-500">
                <span className="text-3xl font-mono font-bold text-amber-500">{selectedNode}</span>
              </div>
            </div>
            <div className="flex-1 text-center sm:text-left">
              <CardTitle className="text-3xl font-bold text-white tracking-tight">Node Stats</CardTitle>
              <div className="flex items-center justify-center sm:justify-start gap-6 mt-3">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Fights</span>
                  <span className="text-xl font-mono font-bold text-slate-200">{nodeStats.reduce((acc, curr) => acc + curr.fights, 0)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Deaths</span>
                  <span className="text-xl font-mono font-bold text-red-400">{nodeStats.reduce((acc, curr) => acc + curr.deaths, 0)}</span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-left">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-bold tracking-widest border-b border-slate-800/60">
                <tr>
                  <th className="px-6 py-4">Defender</th>
                  <th className="px-6 py-4 text-center">Fights</th>
                  <th className="px-6 py-4 text-right">Lethality</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-sm">
                {nodeStats.map((stat) => {
                  const classColors = getChampionClassColors(stat.defenderClass);
                  const lethality = (stat.deaths / (stat.fights || 1));
                  return (
                    <tr key={stat.defenderId} className="hover:bg-slate-800/30 transition-all duration-300 group/row">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div 
                            className="relative rounded-full p-0.5 shrink-0 shadow-lg group-hover/row:scale-110 transition-transform duration-300"
                            style={{ boxShadow: `0 0 10px ${classColors.color}40`, border: `1.5px solid ${classColors.color}` }}
                          >
                            <Avatar className={cn("h-10 w-10 border-none", classColors.bg)}>
                              <AvatarImage src={getChampionImageUrl(stat.defenderImages, '64')} />
                              <AvatarFallback>{stat.defenderName.substring(0,2)}</AvatarFallback>
                            </Avatar>
                          </div>
                          <span className={cn("font-black uppercase italic tracking-tight text-base truncate max-w-[120px] sm:max-w-none pr-2", classColors.text)}>{stat.defenderName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono text-slate-300 font-bold">{stat.fights}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex flex-col gap-1.5 min-w-[80px] sm:min-w-[120px] ml-auto">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                            <span>{stat.deaths} DEATHS</span>
                            <span>{Math.min(100, lethality * 100).toFixed(0)}%</span>
                          </div>
                          <Progress 
                            value={Math.min(100, lethality * 100)} 
                            className="h-1.5 bg-slate-800"
                            indicatorStyle={{ backgroundColor: lethality > 0.5 ? '#ef4444' : '#f59e0b' }} 
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (activeSubTab === "defender") {
    const def = uniqueDefenders.find(d => d.id === selectedDefenderId);
    if (!selectedDefenderId || !def) return <EmptyState icon={<Shield className="w-12 h-12 opacity-20" />} title="Select a Defender to begin analysis" />;
    
    const classColors = getChampionClassColors(def.class);
    const totalFights = defenderPlacementStats.reduce((acc, curr) => acc + curr.fights, 0);
    const totalDeaths = defenderPlacementStats.reduce((acc, curr) => acc + curr.deaths, 0);
    const avgLethality = totalDeaths / (totalFights || 1);

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
              className="relative shrink-0 mx-auto sm:mx-0 rounded-full p-1.5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-700 hover:scale-105"
              style={{ boxShadow: `0 0 30px ${classColors.color}25`, border: `3px solid ${classColors.color}`, width: 'fit-content' }}
            >
              <Avatar className={cn("h-32 w-32 border-none", classColors.bg)}>
                <AvatarImage src={getChampionImageUrl(def.images, 'full')} className="object-contain" />
                <AvatarFallback className="text-3xl">{def.name.substring(0,2)}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1">
                  <div className={cn("w-2 h-2 rounded-full animate-pulse")} style={{ backgroundColor: classColors.color }} />
                  <span className={cn("text-xs font-black uppercase tracking-[0.3em]", classColors.text)}>{def.class}</span>
                </div>
                <CardTitle className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic pr-4">{def.name}</CardTitle>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm">
                  <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Season Fights</span>
                  <span className="text-xl font-mono font-bold text-white leading-none">{totalFights}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm">
                  <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Total Kills</span>
                  <span className="text-xl font-mono font-bold text-red-400 leading-none">{totalDeaths}</span>
                </div>
                <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-slate-500 uppercase font-black">Lethality</span>
                    <span className="text-[10px] font-mono font-bold text-amber-400">{(avgLethality * 10).toFixed(1)}/10</span>
                  </div>
                  <Progress value={Math.min(100, avgLethality * 100)} className="h-1 bg-slate-800" indicatorStyle={{ backgroundColor: classColors.color }} />
                </div>
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0 border-t border-slate-800/60 relative z-10 bg-slate-950/50">
            <table className="w-full text-left border-collapse">
              <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                <tr>
                  <th className="px-8 py-4">Node</th>
                  <th className="px-8 py-4 text-center">Fights</th>
                  <th className="px-8 py-4 text-right">Threat Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/40 text-sm">
                {defenderPlacementStats.map((stat) => (
                  <tr key={stat.nodeNumber} className="hover:bg-slate-800/20 transition-all group/node">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-bold text-amber-500 group-hover/node:border-amber-500/50 transition-colors">
                          {stat.nodeNumber}
                        </div>
                        <span className="font-bold text-slate-200">Node {stat.nodeNumber}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center font-mono text-slate-400 font-bold">{stat.fights}</td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex flex-col gap-1.5 w-full max-w-[140px] ml-auto">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                          <span className="flex items-center gap-1"><Skull className="w-2.5 h-2.5" /> {stat.deaths}</span>
                          <span>{(stat.deaths / (stat.fights || 1) * 100).toFixed(0)}%</span>
                        </div>
                        <Progress value={(stat.deaths / (stat.fights || 1)) * 100} className="h-1 bg-slate-800" indicatorStyle={{ backgroundColor: stat.deaths > 0 ? '#ef4444' : '#334155' }} />
                      </div>
                    </td>
                  </tr>
                ))}
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
