"use client";

import { useState, useMemo, useEffect } from "react";
import { ChampionClass } from "@prisma/client";
import { ChampionImages } from "@/types/champion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getChampionImageUrl } from "@/lib/championHelper";
import { getChampionClassColors } from "@/lib/championClassHelper";
import {
  Check,
  ChevronsUpDown,
  Search,
  Shield,
  Skull,
  Swords,
  Target,
} from "lucide-react";

export interface DetailedPlacementStat {
  nodeNumber: number;
  defenderId: number;
  defenderName: string;
  defenderClass: ChampionClass;
  defenderImages: ChampionImages;
  attackerId?: number;
  attackerName?: string;
  attackerClass?: ChampionClass;
  attackerImages?: ChampionImages;
  fights: number;
  deaths: number;
}

export type DeepDiveTab = "defense" | "matchups";
export type DeepDiveSubTab = "node" | "defender" | "attacker" | "counter";

export interface DeepDiveSelection {
  tab: DeepDiveTab;
  subTab: DeepDiveSubTab;
  id: number;
}

interface SeasonDeepDiveProps {
  placementStats: DetailedPlacementStat[];
  externalSelection?: DeepDiveSelection | null;
}

export function SeasonDeepDive({ placementStats, externalSelection }: SeasonDeepDiveProps) {
  const [activeTab, setActiveTab] = useState<DeepDiveTab>("defense");
  const [activeDefenseSubTab, setActiveDefenseSubTab] = useState<"node" | "defender">("node");
  const [activeMatchupSubTab, setActiveMatchupSubTab] = useState<"attacker" | "counter">("attacker");

  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [selectedDefenderId, setSelectedDefenderId] = useState<number | null>(null);
  const [selectedAttackerId, setSelectedAttackerId] = useState<number | null>(null);
  const [selectedCounterDefenderId, setSelectedCounterDefenderId] = useState<number | null>(null);

  const [nodeOpen, setNodeOpen] = useState(false);
  const [defenderOpen, setDefenderOpen] = useState(false);
  const [attackerOpen, setAttackerOpen] = useState(false);
  const [counterDefenderOpen, setCounterDefenderOpen] = useState(false);

  // Sync with external selection
  useEffect(() => {
    if (!externalSelection) return;

    setActiveTab(externalSelection.tab);
    if (externalSelection.tab === "defense") {
      if (externalSelection.subTab === "node") {
        setActiveDefenseSubTab("node");
        setSelectedNode(externalSelection.id);
      } else if (externalSelection.subTab === "defender") {
        setActiveDefenseSubTab("defender");
        setSelectedDefenderId(externalSelection.id);
      }
    } else {
      if (externalSelection.subTab === "attacker") {
        setActiveMatchupSubTab("attacker");
        setSelectedAttackerId(externalSelection.id);
      } else if (externalSelection.subTab === "counter") {
        setActiveMatchupSubTab("counter");
        setSelectedCounterDefenderId(externalSelection.id);
      }
    }
  }, [externalSelection]);

  // 1. Unique Entities
  const uniqueNodes = useMemo(() => {
    const nodes = new Set<number>();
    placementStats.forEach((s) => nodes.add(s.nodeNumber));
    return Array.from(nodes).sort((a, b) => a - b);
  }, [placementStats]);

  const uniqueDefenders = useMemo(() => {
    const defenders = new Map<number, { id: number; name: string; class: ChampionClass; images: ChampionImages }>();
    placementStats.forEach((s) => {
      if (!defenders.has(s.defenderId)) {
        defenders.set(s.defenderId, {
          id: s.defenderId,
          name: s.defenderName,
          class: s.defenderClass,
          images: s.defenderImages,
        });
      }
    });
    return Array.from(defenders.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [placementStats]);

  const uniqueAttackers = useMemo(() => {
    const attackers = new Map<number, { id: number; name: string; class: ChampionClass; images: ChampionImages }>();
    placementStats.forEach((s) => {
      if (s.attackerId && !attackers.has(s.attackerId)) {
        attackers.set(s.attackerId, {
          id: s.attackerId,
          name: s.attackerName!,
          class: s.attackerClass!,
          images: s.attackerImages!,
        });
      }
    });
    return Array.from(attackers.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [placementStats]);

  // 2. Aggregations for Defense Analysis
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

  // 3. Aggregations for Matchup Analysis
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
          <Search className="h-6 w-6 text-purple-500" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">Deep Dive Analysis</h2>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeepDiveTab)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="defense" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">
            Defense Analysis
          </TabsTrigger>
          <TabsTrigger value="matchups" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white">
            Matchup Analysis
          </TabsTrigger>
        </TabsList>

        {/* --- DEFENSE ANALYSIS --- */}
        <TabsContent value="defense" className="mt-6">
          <Tabs value={activeDefenseSubTab} onValueChange={(v) => setActiveDefenseSubTab(v as any)} className="w-full">
            <TabsList className="grid w-full max-w-xs grid-cols-2 bg-slate-900/30 mb-6">
              <TabsTrigger value="node" className="text-xs">By Node</TabsTrigger>
              <TabsTrigger value="defender" className="text-xs">By Defender</TabsTrigger>
            </TabsList>

            <TabsContent value="node" className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Card className="w-full md:w-80 bg-slate-950/50 border-slate-800/60 h-fit">
                  <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                    <CardTitle className="text-xs font-medium text-slate-400 uppercase tracking-wider">Select Node</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4">
                    <Popover open={nodeOpen} onOpenChange={setNodeOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between bg-slate-900 border-slate-700 text-slate-200">
                          {selectedNode ? `Node ${selectedNode}` : "Select node..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[200px] p-0 bg-slate-950 border-slate-800">
                        <Command className="bg-slate-950">
                          <CommandInput placeholder="Search node..." className="text-slate-200" />
                          <CommandList>
                            <CommandEmpty>No node found.</CommandEmpty>
                            <CommandGroup>
                              {uniqueNodes.map((node) => (
                                <CommandItem key={node} value={node.toString()} onSelect={(val) => { setSelectedNode(parseInt(val)); setNodeOpen(false); }} className="text-slate-200 data-[selected=true]:bg-slate-800">
                                  <Check className={cn("mr-2 h-4 w-4", selectedNode === node ? "opacity-100" : "opacity-0")} />
                                  Node {node}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedNode && (
                      <div className="mt-6 space-y-4">
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Fights</span><span className="text-lg font-mono font-bold text-slate-200">{nodeStats.reduce((acc, curr) => acc + curr.fights, 0)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Deaths</span><span className="text-lg font-mono font-bold text-red-400 flex items-center gap-1"><Skull className="w-4 h-4" />{nodeStats.reduce((acc, curr) => acc + curr.deaths, 0)}</span></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="flex-1">
                  {selectedNode ? (
                    <Card className="bg-slate-950/50 border-slate-800/60">
                      <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20"><CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2"><Target className="w-5 h-5 text-amber-500" />Node {selectedNode} Performance</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-medium"><tr><th className="px-4 py-3">Defender</th><th className="px-4 py-3 text-center">Fights</th><th className="px-4 py-3 text-center">Deaths</th><th className="px-4 py-3 text-right">Avg Deaths</th></tr></thead>
                            <tbody className="divide-y divide-slate-800/40 text-sm">
                              {nodeStats.map((stat) => {
                                const classColors = getChampionClassColors(stat.defenderClass);
                                return (
                                  <tr key={stat.defenderId} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar className={cn("h-9 w-9 border-none ring-1.5", classColors.border)}><AvatarImage src={getChampionImageUrl(stat.defenderImages, '64')} /><AvatarFallback>{stat.defenderName.substring(0,2)}</AvatarFallback></Avatar><span className={cn("font-bold truncate", classColors.text)}>{stat.defenderName}</span></div></td>
                                    <td className="px-4 py-3 text-center font-mono text-slate-300">{stat.fights}</td>
                                    <td className="px-4 py-3 text-center"><span className={cn("inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm", stat.deaths > 0 ? "bg-red-950/20 text-red-400 border border-red-900/30" : "text-emerald-400")}>{stat.deaths > 0 && <Skull className="w-3 h-3" />}{stat.deaths}</span></td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-500">{(stat.deaths / (stat.fights || 1)).toFixed(2)}</td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/20"><p className="text-slate-500 flex items-center gap-2"><Target className="w-5 h-5" />Select a node to view stats</p></div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="defender" className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Card className="w-full md:w-80 bg-slate-950/50 border-slate-800/60 h-fit">
                  <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20"><CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Select Defender</CardTitle></CardHeader>
                  <CardContent className="p-4">
                    <Popover open={defenderOpen} onOpenChange={setDefenderOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between bg-slate-900 border-slate-700 text-slate-200">
                          {selectedDefenderId ? uniqueDefenders.find(d => d.id === selectedDefenderId)?.name : "Select defender..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800">
                        <Command className="bg-slate-950">
                          <CommandInput placeholder="Search defender..." className="text-slate-200" />
                          <CommandList>
                            <CommandEmpty>No defender found.</CommandEmpty>
                            <CommandGroup>
                              {uniqueDefenders.map((defender) => (
                                <CommandItem key={defender.id} value={defender.name} onSelect={() => { setSelectedDefenderId(defender.id); setDefenderOpen(false); }} className="text-slate-200 data-[selected=true]:bg-slate-800">
                                  <Check className={cn("mr-2 h-4 w-4", selectedDefenderId === defender.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={getChampionImageUrl(defender.images, '64')} /><AvatarFallback>{defender.name.substring(0,2)}</AvatarFallback></Avatar>{defender.name}</div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedDefenderId && (
                      <div className="mt-6 space-y-4">
                        {(() => {
                          const def = uniqueDefenders.find(d => d.id === selectedDefenderId);
                          if (!def) return null;
                          const classColors = getChampionClassColors(def.class);
                          return (
                            <div className="flex flex-col items-center gap-3 mb-6">
                              <div className={cn("relative rounded-full p-1 ring-4 ring-offset-4 ring-offset-slate-950 shadow-2xl transition-transform hover:scale-105 duration-300", classColors.text.replace('text-', 'ring-'))}>
                                <Avatar className={cn("h-28 w-28 border-none", classColors.bg)}>
                                  <AvatarImage src={getChampionImageUrl(def.images, 'full')} className="object-cover" />
                                  <AvatarFallback className="text-xl bg-transparent">{def.name.substring(0,2)}</AvatarFallback>
                                </Avatar>
                              </div>
                              <span className={cn("text-2xl font-bold tracking-tight", classColors.text)}>{def.name}</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Placements</span><span className="text-lg font-mono font-bold text-slate-200">{defenderPlacementStats.reduce((acc, curr) => acc + curr.fights, 0)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Deaths</span><span className="text-lg font-mono font-bold text-red-400 flex items-center gap-1"><Skull className="w-4 h-4" />{defenderPlacementStats.reduce((acc, curr) => acc + curr.deaths, 0)}</span></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="flex-1">
                  {selectedDefenderId ? (
                    <Card className="bg-slate-950/50 border-slate-800/60">
                      <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20"><CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2"><Shield className="w-5 h-5 text-red-400" />Placement Performance</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-medium"><tr><th className="px-4 py-3">Node</th><th className="px-4 py-3 text-center">Fights</th><th className="px-4 py-3 text-center">Deaths</th><th className="px-4 py-3 text-right">Avg Deaths</th></tr></thead>
                            <tbody className="divide-y divide-slate-800/40 text-sm">
                              {defenderPlacementStats.map((stat) => (
                                <tr key={stat.nodeNumber} className="hover:bg-slate-800/20 transition-colors">
                                  <td className="px-4 py-3"><Badge variant="outline" className="bg-slate-900 text-amber-500 border-amber-500/30 font-mono text-sm">Node {stat.nodeNumber}</Badge></td>
                                  <td className="px-4 py-3 text-center font-mono text-slate-300">{stat.fights}</td>
                                  <td className="px-4 py-3 text-center"><span className={cn("inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm", stat.deaths > 0 ? "bg-red-950/20 text-red-400 border border-red-900/30" : "text-emerald-400")}>{stat.deaths > 0 && <Skull className="w-3 h-3" />}{stat.deaths}</span></td>
                                  <td className="px-4 py-3 text-right font-mono text-slate-500">{(stat.deaths / (stat.fights || 1)).toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/20"><p className="text-slate-500 flex items-center gap-2"><Shield className="w-5 h-5" />Select a defender to view stats</p></div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* --- MATCHUP ANALYSIS --- */}
        <TabsContent value="matchups" className="mt-6">
          <Tabs value={activeMatchupSubTab} onValueChange={(v) => setActiveMatchupSubTab(v as any)} className="w-full">
            <TabsList className="grid w-full max-w-xs grid-cols-2 bg-slate-900/30 mb-6">
              <TabsTrigger value="attacker" className="text-xs">By Attacker</TabsTrigger>
              <TabsTrigger value="counter" className="text-xs">By Counter</TabsTrigger>
            </TabsList>

            <TabsContent value="attacker" className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Card className="w-full md:w-80 bg-slate-950/50 border-slate-800/60 h-fit">
                  <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20"><CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Select Attacker</CardTitle></CardHeader>
                  <CardContent className="p-4">
                    <Popover open={attackerOpen} onOpenChange={setAttackerOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between bg-slate-900 border-slate-700 text-slate-200">
                          {selectedAttackerId ? uniqueAttackers.find(a => a.id === selectedAttackerId)?.name : "Select attacker..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800">
                        <Command className="bg-slate-950">
                          <CommandInput placeholder="Search attacker..." className="text-slate-200" />
                          <CommandList>
                            <CommandEmpty>No attacker found.</CommandEmpty>
                            <CommandGroup>
                              {uniqueAttackers.map((attacker) => (
                                <CommandItem key={attacker.id} value={attacker.name} onSelect={() => { setSelectedAttackerId(attacker.id); setAttackerOpen(false); }} className="text-slate-200 data-[selected=true]:bg-slate-800">
                                  <Check className={cn("mr-2 h-4 w-4", selectedAttackerId === attacker.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={getChampionImageUrl(attacker.images, '64')} /><AvatarFallback>{attacker.name.substring(0,2)}</AvatarFallback></Avatar>{attacker.name}</div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedAttackerId && (
                      <div className="mt-6 space-y-4">
                        {(() => {
                          const att = uniqueAttackers.find(a => a.id === selectedAttackerId);
                          if (!att) return null;
                          const classColors = getChampionClassColors(att.class);
                          return (
                            <div className="flex flex-col items-center gap-3 mb-6">
                              <div className={cn("relative rounded-full p-1 ring-4 ring-offset-4 ring-offset-slate-950 shadow-2xl transition-transform hover:scale-105 duration-300", classColors.text.replace('text-', 'ring-'))}>
                                <Avatar className={cn("h-28 w-28 border-none", classColors.bg)}>
                                  <AvatarImage src={getChampionImageUrl(att.images, 'full')} className="object-cover" />
                                  <AvatarFallback className="text-xl bg-transparent">{att.name.substring(0,2)}</AvatarFallback>
                                </Avatar>
                              </div>
                              <span className={cn("text-2xl font-bold tracking-tight", classColors.text)}>{att.name}</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Fights</span><span className="text-lg font-mono font-bold text-slate-200">{attackerMatchupStats.reduce((acc, curr) => acc + curr.fights, 0)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Deaths</span><span className="text-lg font-mono font-bold text-red-400 flex items-center gap-1"><Skull className="w-4 h-4" />{attackerMatchupStats.reduce((acc, curr) => acc + curr.deaths, 0)}</span></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="flex-1">
                  {selectedAttackerId ? (
                    <Card className="bg-slate-950/50 border-slate-800/60">
                      <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20"><CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2"><Swords className="w-5 h-5 text-sky-400" />Matchup History</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-medium"><tr><th className="px-4 py-3">Defender</th><th className="px-4 py-3 text-center">Fights</th><th className="px-4 py-3 text-center">Solo %</th><th className="px-4 py-3 text-right">Deaths</th></tr></thead>
                            <tbody className="divide-y divide-slate-800/40 text-sm">
                              {attackerMatchupStats.map((stat) => {
                                const classColors = getChampionClassColors(stat.defenderClass);
                                const soloRate = ((stat.fights - stat.deaths) / stat.fights) * 100;
                                return (
                                  <tr key={stat.defenderId} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar className={cn("h-9 w-9 border-none ring-1.5", classColors.border)}><AvatarImage src={getChampionImageUrl(stat.defenderImages, '64')} /><AvatarFallback>{stat.defenderName.substring(0,2)}</AvatarFallback></Avatar><span className={cn("font-bold truncate", classColors.text)}>{stat.defenderName}</span></div></td>
                                    <td className="px-4 py-3 text-center font-mono text-slate-300">{stat.fights}</td>
                                    <td className="px-4 py-3 text-center font-mono"><span className={cn(soloRate >= 95 ? "text-emerald-400" : soloRate >= 80 ? "text-slate-300" : "text-amber-500")}>{soloRate.toFixed(0)}%</span></td>
                                    <td className="px-4 py-3 text-right"><span className={cn("inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm", stat.deaths > 0 ? "bg-red-950/20 text-red-400 border border-red-900/30" : "text-emerald-400")}>{stat.deaths > 0 && <Skull className="w-3 h-3" />}{stat.deaths}</span></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/20"><p className="text-slate-500 flex items-center gap-2"><Swords className="w-5 h-5" />Select an attacker to view matchups</p></div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="counter" className="space-y-6">
              <div className="flex flex-col md:flex-row gap-4">
                <Card className="w-full md:w-80 bg-slate-950/50 border-slate-800/60 h-fit">
                  <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20"><CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">Select Defender</CardTitle></CardHeader>
                  <CardContent className="p-4">
                    <Popover open={counterDefenderOpen} onOpenChange={setCounterDefenderOpen}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="w-full justify-between bg-slate-900 border-slate-700 text-slate-200">
                          {selectedCounterDefenderId ? uniqueDefenders.find(d => d.id === selectedCounterDefenderId)?.name : "Select defender..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800">
                        <Command className="bg-slate-950">
                          <CommandInput placeholder="Search defender..." className="text-slate-200" />
                          <CommandList>
                            <CommandEmpty>No defender found.</CommandEmpty>
                            <CommandGroup>
                              {uniqueDefenders.map((defender) => (
                                <CommandItem key={defender.id} value={defender.name} onSelect={() => { setSelectedCounterDefenderId(defender.id); setCounterDefenderOpen(false); }} className="text-slate-200 data-[selected=true]:bg-slate-800">
                                  <Check className={cn("mr-2 h-4 w-4", selectedCounterDefenderId === defender.id ? "opacity-100" : "opacity-0")} />
                                  <div className="flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={getChampionImageUrl(defender.images, '64')} /><AvatarFallback>{defender.name.substring(0,2)}</AvatarFallback></Avatar>{defender.name}</div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {selectedCounterDefenderId && (
                      <div className="mt-6 space-y-4">
                        {(() => {
                          const def = uniqueDefenders.find(d => d.id === selectedCounterDefenderId);
                          if (!def) return null;
                          const classColors = getChampionClassColors(def.class);
                          return (
                            <div className="flex flex-col items-center gap-3 mb-6">
                              <div className={cn("relative rounded-full p-1 ring-4 ring-offset-4 ring-offset-slate-950 shadow-2xl transition-transform hover:scale-105 duration-300", classColors.text.replace('text-', 'ring-'))}>
                                <Avatar className={cn("h-28 w-28 border-none", classColors.bg)}>
                                  <AvatarImage src={getChampionImageUrl(def.images, 'full')} className="object-cover" />
                                  <AvatarFallback className="text-xl bg-transparent">{def.name.substring(0,2)}</AvatarFallback>
                                </Avatar>
                              </div>
                              <span className={cn("text-2xl font-bold tracking-tight", classColors.text)}>{def.name}</span>
                            </div>
                          );
                        })()}
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Faced</span><span className="text-lg font-mono font-bold text-slate-200">{counterStats.reduce((acc, curr) => acc + curr.fights, 0)}</span></div>
                        <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Total Kills</span><span className="text-lg font-mono font-bold text-red-400 flex items-center gap-1"><Skull className="w-4 h-4" />{counterStats.reduce((acc, curr) => acc + curr.deaths, 0)}</span></div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <div className="flex-1">
                  {selectedCounterDefenderId ? (
                    <Card className="bg-slate-950/50 border-slate-800/60">
                      <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20"><CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2"><Shield className="w-5 h-5 text-red-400" />Best Counters</CardTitle></CardHeader>
                      <CardContent className="p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-medium"><tr><th className="px-4 py-3">Attacker</th><th className="px-4 py-3 text-center">Fights</th><th className="px-4 py-3 text-center">Solo %</th><th className="px-4 py-3 text-right">Deaths</th></tr></thead>
                            <tbody className="divide-y divide-slate-800/40 text-sm">
                              {counterStats.map((stat) => {
                                const classColors = getChampionClassColors(stat.attackerClass!);
                                const soloRate = ((stat.fights - stat.deaths) / stat.fights) * 100;
                                return (
                                  <tr key={stat.attackerId} className="hover:bg-slate-800/20 transition-colors">
                                    <td className="px-4 py-3"><div className="flex items-center gap-3"><Avatar className={cn("h-9 w-9 border-none ring-1.5", classColors.border)}><AvatarImage src={getChampionImageUrl(stat.attackerImages!, '64')} /><AvatarFallback>{stat.attackerName!.substring(0,2)}</AvatarFallback></Avatar><span className={cn("font-bold truncate", classColors.text)}>{stat.attackerName}</span></div></td>
                                    <td className="px-4 py-3 text-center font-mono text-slate-300">{stat.fights}</td>
                                    <td className="px-4 py-3 text-center font-mono"><span className={cn(soloRate >= 95 ? "text-emerald-400" : soloRate >= 80 ? "text-slate-300" : "text-amber-500")}>{soloRate.toFixed(0)}%</span></td>
                                    <td className="px-4 py-3 text-right"><span className={cn("inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm", stat.deaths > 0 ? "bg-red-950/20 text-red-400 border border-red-900/30" : "text-emerald-400")}>{stat.deaths > 0 && <Skull className="w-3 h-3" />}{stat.deaths}</span></td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/20"><p className="text-slate-500 flex items-center gap-2"><Shield className="w-5 h-5" />Select a defender to find its best counters</p></div>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}