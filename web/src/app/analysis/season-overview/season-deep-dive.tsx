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
import { Progress } from "@/components/ui/progress";
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
  Trophy,
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
    <div className="space-y-8 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                <Search className="h-6 w-6 text-purple-400" />
            </div>
            <div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Deep Dive Analysis</h2>
                <p className="text-sm text-slate-500 font-medium">Explore granular season performance and matchups</p>
            </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DeepDiveTab)} className="w-full sm:w-auto">
            <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 border border-slate-800 p-1 h-11">
            <TabsTrigger value="defense" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white transition-all duration-300 rounded-md">
                <Shield className="w-4 h-4 mr-2" />
                Defense
            </TabsTrigger>
            <TabsTrigger value="matchups" className="data-[state=active]:bg-sky-600 data-[state=active]:text-white transition-all duration-300 rounded-md">
                <Swords className="w-4 h-4 mr-2" />
                Matchups
            </TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* SIDEBAR SELECTORS */}
        <div className="lg:col-span-1 space-y-6">
            <Card className="bg-slate-950/40 border-slate-800/60 overflow-hidden backdrop-blur-sm shadow-xl">
                <CardHeader className="pb-4 border-b border-slate-800/60 bg-slate-900/30">
                    <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Filter View</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-6">
                    {activeTab === "defense" ? (
                        <div className="space-y-4">
                            <Tabs value={activeDefenseSubTab} onValueChange={(v) => setActiveDefenseSubTab(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 mb-4 h-9">
                                    <TabsTrigger value="node" className="text-xs">Node</TabsTrigger>
                                    <TabsTrigger value="defender" className="text-xs">Defender</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="node" className="m-0">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Node Number</label>
                                        <Popover open={nodeOpen} onOpenChange={setNodeOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between bg-slate-900/50 border-slate-700/50 text-slate-200 hover:bg-slate-800">
                                                    {selectedNode ? `Node ${selectedNode}` : "Select node..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[200px] p-0 bg-slate-950 border-slate-800">
                                                <Command className="bg-slate-950">
                                                    <CommandInput placeholder="Search node..." />
                                                    <CommandList>
                                                        <CommandEmpty>No node found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {uniqueNodes.map((node) => (
                                                                <CommandItem key={node} value={node.toString()} onSelect={(val) => { setSelectedNode(parseInt(val)); setNodeOpen(false); }} className="data-[selected=true]:bg-purple-600/20 data-[selected=true]:text-purple-400">
                                                                    <Check className={cn("mr-2 h-4 w-4", selectedNode === node ? "opacity-100" : "opacity-0")} />
                                                                    Node {node}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </TabsContent>

                                <TabsContent value="defender" className="m-0">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Champion</label>
                                        <Popover open={defenderOpen} onOpenChange={setDefenderOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between bg-slate-900/50 border-slate-700/50 text-slate-200 hover:bg-slate-800">
                                                    {selectedDefenderId ? uniqueDefenders.find(d => d.id === selectedDefenderId)?.name : "Select defender..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800">
                                                <Command className="bg-slate-950">
                                                    <CommandInput placeholder="Search defender..." />
                                                    <CommandList>
                                                        <CommandEmpty>No defender found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {uniqueDefenders.map((defender) => (
                                                                <CommandItem key={defender.id} value={defender.name} onSelect={() => { setSelectedDefenderId(defender.id); setDefenderOpen(false); }} className="data-[selected=true]:bg-purple-600/20 data-[selected=true]:text-purple-400">
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6"><AvatarImage src={getChampionImageUrl(defender.images, '64')} /><AvatarFallback>{defender.name.substring(0,2)}</AvatarFallback></Avatar>
                                                                        {defender.name}
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <Tabs value={activeMatchupSubTab} onValueChange={(v) => setActiveMatchupSubTab(v as any)} className="w-full">
                                <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 mb-4 h-9">
                                    <TabsTrigger value="attacker" className="text-xs">Attacker</TabsTrigger>
                                    <TabsTrigger value="counter" className="text-xs">Defender</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="attacker" className="m-0">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Your Attacker</label>
                                        <Popover open={attackerOpen} onOpenChange={setAttackerOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between bg-slate-900/50 border-slate-700/50 text-slate-200 hover:bg-slate-800">
                                                    {selectedAttackerId ? uniqueAttackers.find(a => a.id === selectedAttackerId)?.name : "Select attacker..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800">
                                                <Command className="bg-slate-950">
                                                    <CommandInput placeholder="Search attacker..." />
                                                    <CommandList>
                                                        <CommandEmpty>No attacker found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {uniqueAttackers.map((attacker) => (
                                                                <CommandItem key={attacker.id} value={attacker.name} onSelect={() => { setSelectedAttackerId(attacker.id); setAttackerOpen(false); }} className="data-[selected=true]:bg-sky-600/20 data-[selected=true]:text-sky-400">
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6"><AvatarImage src={getChampionImageUrl(attacker.images, '64')} /><AvatarFallback>{attacker.name.substring(0,2)}</AvatarFallback></Avatar>
                                                                        {attacker.name}
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </TabsContent>

                                <TabsContent value="counter" className="m-0">
                                    <div className="space-y-2">
                                        <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Enemy Defender</label>
                                        <Popover open={counterDefenderOpen} onOpenChange={setCounterDefenderOpen}>
                                            <PopoverTrigger asChild>
                                                <Button variant="outline" className="w-full justify-between bg-slate-900/50 border-slate-700/50 text-slate-200 hover:bg-slate-800">
                                                    {selectedCounterDefenderId ? uniqueDefenders.find(d => d.id === selectedCounterDefenderId)?.name : "Select defender..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[280px] p-0 bg-slate-950 border-slate-800">
                                                <Command className="bg-slate-950">
                                                    <CommandInput placeholder="Search defender..." />
                                                    <CommandList>
                                                        <CommandEmpty>No defender found.</CommandEmpty>
                                                        <CommandGroup>
                                                            {uniqueDefenders.map((defender) => (
                                                                <CommandItem key={defender.id} value={defender.name} onSelect={() => { setSelectedCounterDefenderId(defender.id); setCounterDefenderOpen(false); }} className="data-[selected=true]:bg-sky-600/20 data-[selected=true]:text-sky-400">
                                                                    <div className="flex items-center gap-2">
                                                                        <Avatar className="h-6 w-6"><AvatarImage src={getChampionImageUrl(defender.images, '64')} /><AvatarFallback>{defender.name.substring(0,2)}</AvatarFallback></Avatar>
                                                                        {defender.name}
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        {/* MAIN CONTENT AREA */}
        <div className="lg:col-span-3 space-y-6">
            {activeTab === "defense" && (
                <>
                    {activeDefenseSubTab === "node" && selectedNode && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                            <Card className="bg-slate-950/50 border-slate-800/60 overflow-hidden relative group shadow-2xl">
                                <div className="absolute top-0 right-0 p-8 opacity-5">
                                    <Target className="w-32 h-32 text-amber-500 rotate-12" />
                                </div>
                                <div className="absolute inset-0 h-40 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent opacity-50 pointer-events-none" />
                                <CardHeader className="relative z-10 flex flex-row items-center gap-6 border-b border-slate-800/60 bg-slate-900/20 pb-6">
                                    <div className="flex flex-col items-center">
                                        <div className="w-20 h-20 rounded-2xl bg-slate-900 border border-amber-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(245,158,11,0.15)] group-hover:scale-105 transition-transform duration-500">
                                            <span className="text-3xl font-mono font-bold text-amber-500">{selectedNode}</span>
                                        </div>
                                        <Badge className="mt-2 bg-amber-500 text-slate-950 font-bold border-none uppercase text-[10px]">Node</Badge>
                                    </div>
                                    <div className="flex-1">
                                        <CardTitle className="text-3xl font-bold text-white tracking-tight">Node {selectedNode} Intelligence</CardTitle>
                                        <div className="flex items-center gap-6 mt-3">
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Encounters</span>
                                                <span className="text-xl font-mono font-bold text-slate-200">{nodeStats.reduce((acc, curr) => acc + curr.fights, 0)}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Lethality</span>
                                                <span className="text-xl font-mono font-bold text-red-400">{nodeStats.reduce((acc, curr) => acc + curr.deaths, 0)} Deaths</span>
                                            </div>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <table className="w-full text-left">
                                        <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-bold tracking-widest border-b border-slate-800/60">
                                            <tr>
                                                <th className="px-6 py-4">Placement History</th>
                                                <th className="px-6 py-4 text-center">Wars</th>
                                                <th className="px-6 py-4 text-center">Threat Level</th>
                                                <th className="px-6 py-4 text-right">Avg Deaths</th>
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
                                                                    className="relative rounded-full p-0.5 shadow-lg group-hover/row:scale-110 transition-transform duration-300"
                                                                    style={{ boxShadow: `0 0 10px ${classColors.color}40`, border: `1.5px solid ${classColors.color}` }}
                                                                >
                                                                    <Avatar className={cn("h-10 w-10 border-none", classColors.bg)}>
                                                                        <AvatarImage src={getChampionImageUrl(stat.defenderImages, '64')} />
                                                                        <AvatarFallback>{stat.defenderName.substring(0,2)}</AvatarFallback>
                                                                    </Avatar>
                                                                </div>
                                                                <span className={cn("font-bold text-base", classColors.text)}>{stat.defenderName}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center font-mono text-slate-300 font-bold">{stat.fights}</td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                                                    <span>{stat.deaths} DEATHS</span>
                                                                    <span>{Math.min(100, lethality * 100).toFixed(0)}%</span>
                                                                </div>
                                                                <Progress 
                                                                    value={Math.min(100, lethality * 100)} 
                                                                    className="h-1.5 bg-slate-800"
                                                                    style={{ ["--primary" as any]: lethality > 0.5 ? '#ef4444' : '#f59e0b' }} 
                                                                />
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            <span className={cn("font-mono font-bold px-2 py-1 rounded-md text-xs", stat.deaths > 0 ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20")}>
                                                                {lethality.toFixed(2)}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeDefenseSubTab === "defender" && selectedDefenderId && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {(() => {
                                const def = uniqueDefenders.find(d => d.id === selectedDefenderId);
                                if (!def) return null;
                                const classColors = getChampionClassColors(def.class);
                                const totalFights = defenderPlacementStats.reduce((acc, curr) => acc + curr.fights, 0);
                                const totalDeaths = defenderPlacementStats.reduce((acc, curr) => acc + curr.deaths, 0);
                                const avgLethality = totalDeaths / (totalFights || 1);

                                return (
                                    <div className="space-y-6">
                                        <Card className="bg-slate-950/50 border-slate-800/60 overflow-hidden relative shadow-2xl">
                                            {/* Header Background Effects */}
                                            <div className="absolute inset-x-0 top-0 h-64 overflow-hidden pointer-events-none">
                                                <div className="absolute inset-0 opacity-[0.03] flex justify-end items-center">
                                                    <img src={getChampionImageUrl(def.images, 'full')} className="h-[150%] object-cover grayscale brightness-200 -mr-20" alt="" />
                                                </div>
                                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                                            </div>
                                            
                                            <CardHeader className="relative z-10 flex flex-col md:flex-row md:items-center gap-8 pb-8 pt-8 px-8">
                                                <div 
                                                    className="relative shrink-0 rounded-full p-1.5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-700 hover:scale-105"
                                                    style={{ boxShadow: `0 0 30px ${classColors.color}25`, border: `3px solid ${classColors.color}` }}
                                                >
                                                    <Avatar className={cn("h-32 w-32 border-none", classColors.bg)}>
                                                        <AvatarImage src={getChampionImageUrl(def.images, 'full')} className="object-contain" />
                                                        <AvatarFallback className="text-3xl">{def.name.substring(0,2)}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <div className="flex-1 space-y-4">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <div className={cn("w-2 h-2 rounded-full animate-pulse")} style={{ backgroundColor: classColors.color }} />
                                                            <span className={cn("text-xs font-black uppercase tracking-[0.3em]", classColors.text)}>{def.class}</span>
                                                        </div>
                                                        <CardTitle className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">{def.name}</CardTitle>
                                                    </div>
                                                    
                                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                                        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm">
                                                            <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Total Placed</span>
                                                            <span className="text-xl font-mono font-bold text-white leading-none">{totalFights}</span>
                                                        </div>
                                                        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm">
                                                            <span className="text-[9px] text-slate-500 uppercase font-black block mb-1">Total Kills</span>
                                                            <span className="text-xl font-mono font-bold text-red-400 leading-none">{totalDeaths}</span>
                                                        </div>
                                                        <div className="bg-slate-900/60 border border-slate-800/60 rounded-xl p-3 backdrop-blur-sm col-span-2">
                                                            <div className="flex items-center justify-between mb-1">
                                                                <span className="text-[9px] text-slate-500 uppercase font-black">Lethality Index</span>
                                                                <span className="text-[10px] font-mono font-bold text-amber-400">{(avgLethality * 10).toFixed(1)}/10</span>
                                                            </div>
                                                            <Progress value={Math.min(100, avgLethality * 100)} className="h-1 bg-slate-800" style={{ ["--primary" as any]: classColors.color }} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            
                                            <CardContent className="p-0 border-t border-slate-800/60 relative z-10 bg-slate-950/50">
                                                <table className="w-full text-left border-collapse">
                                                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                                                        <tr>
                                                            <th className="px-8 py-4">Node Sector</th>
                                                            <th className="px-8 py-4 text-center">Deployment Count</th>
                                                            <th className="px-8 py-4 text-center">Threat Level</th>
                                                            <th className="px-8 py-4 text-right">Efficiency</th>
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
                                                                        <span className="font-bold text-slate-200">Sector {stat.nodeNumber}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-5 text-center font-mono text-slate-400 font-bold">{stat.fights} Wars</td>
                                                                <td className="px-8 py-5">
                                                                    <div className="flex flex-col gap-1.5 w-full max-w-[140px] mx-auto">
                                                                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                                                                            <span className="flex items-center gap-1"><Skull className="w-2.5 h-2.5" /> {stat.deaths}</span>
                                                                            <span>{(stat.deaths / (stat.fights || 1) * 100).toFixed(0)}%</span>
                                                                        </div>
                                                                        <Progress value={(stat.deaths / (stat.fights || 1)) * 100} className="h-1 bg-slate-800" style={{ ["--primary" as any]: stat.deaths > 0 ? '#ef4444' : '#334155' }} />
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-5 text-right">
                                                                    <Badge variant="outline" className={cn("font-mono font-bold border-none bg-slate-900", (stat.deaths / (stat.fights || 1)) > 0.5 ? "text-red-400" : "text-slate-500")}>
                                                                        {(stat.deaths / (stat.fights || 1)).toFixed(2)} K/W
                                                                    </Badge>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </CardContent>
                                        </Card>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {!selectedNode && !selectedDefenderId && (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800/60 rounded-2xl bg-slate-950/20 text-slate-500 space-y-4">
                            <div className="p-4 rounded-full bg-slate-900/50">
                                <Shield className="w-12 h-12 opacity-20" />
                            </div>
                            <p className="font-bold tracking-tight text-lg">Select a Node or Defender to begin analysis</p>
                        </div>
                    )}
                </>
            )}

            {activeTab === "matchups" && (
                <>
                    {activeMatchupSubTab === "attacker" && selectedAttackerId && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {(() => {
                                const att = uniqueAttackers.find(a => a.id === selectedAttackerId);
                                if (!att) return null;
                                const classColors = getChampionClassColors(att.class);
                                const totalFights = attackerMatchupStats.reduce((acc, curr) => acc + curr.fights, 0);
                                const totalDeaths = attackerMatchupStats.reduce((acc, curr) => acc + curr.deaths, 0);
                                const globalSoloRate = ((totalFights - totalDeaths) / (totalFights || 1)) * 100;

                                return (
                                    <Card className="bg-slate-950/50 border-slate-800/60 overflow-hidden relative shadow-2xl">
                                        {/* Header Background Effects */}
                                        <div className="absolute inset-x-0 top-0 h-64 overflow-hidden pointer-events-none">
                                            <div className="absolute inset-0 opacity-[0.03] flex justify-end items-center">
                                                <img src={getChampionImageUrl(att.images, 'full')} className="h-[150%] object-cover grayscale brightness-200 -mr-20" alt="" />
                                            </div>
                                            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                                        </div>
                                        
                                        <CardHeader className="relative z-10 flex flex-col md:flex-row md:items-center gap-8 pb-8 pt-8 px-8">
                                            <div 
                                                className="relative shrink-0 rounded-full p-1.5 shadow-[0_0_50px_rgba(0,0,0,0.5)] transition-transform duration-700 hover:scale-105"
                                                style={{ boxShadow: `0 0 30px ${classColors.color}25`, border: `3px solid ${classColors.color}` }}
                                            >
                                                <Avatar className={cn("h-32 w-32 border-none", classColors.bg)}>
                                                    <AvatarImage src={getChampionImageUrl(att.images, 'full')} className="object-contain" />
                                                    <AvatarFallback>{att.name.substring(0,2)}</AvatarFallback>
                                                </Avatar>
                                            </div>
                                            <div className="flex-1 space-y-4">
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={cn("w-2 h-2 rounded-full")} style={{ backgroundColor: classColors.color }} />
                                                        <span className={cn("text-xs font-black uppercase tracking-[0.3em]", classColors.text)}>{att.class}</span>
                                                    </div>
                                                    <CardTitle className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic">{att.name}</CardTitle>
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
                                                            <span className="text-[9px] text-slate-500 uppercase font-black">Combat Efficiency</span>
                                                            <span className="text-[10px] font-mono font-bold text-emerald-400">{globalSoloRate.toFixed(1)}%</span>
                                                        </div>
                                                        <Progress value={globalSoloRate} className="h-1 bg-slate-800" style={{ ["--primary" as any]: globalSoloRate >= 90 ? '#10b981' : '#f59e0b' }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardHeader>

                                        <CardContent className="p-0 border-t border-slate-800/60 relative z-10 bg-slate-950/50">
                                            <table className="w-full text-left">
                                                <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                                                    <tr>
                                                        <th className="px-8 py-4">Engagement Target</th>
                                                        <th className="px-8 py-4 text-center">Fights</th>
                                                        <th className="px-8 py-4 text-center">Win Prob.</th>
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
                                                                        <div className="relative rounded-lg p-0.5" style={{ border: `1px solid ${targetColors.color}40`, backgroundColor: `${targetColors.color}10` }}>
                                                                            <Avatar className="h-10 w-10 border-none">
                                                                                <AvatarImage src={getChampionImageUrl(stat.defenderImages, '64')} />
                                                                                <AvatarFallback>{stat.defenderName.substring(0,2)}</AvatarFallback>
                                                                            </Avatar>
                                                                        </div>
                                                                        <span className={cn("font-bold text-base", targetColors.text)}>{stat.defenderName}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4 text-center font-mono text-slate-300 font-bold">{stat.fights}</td>
                                                                <td className="px-8 py-4">
                                                                    <div className="flex flex-col gap-1.5 w-full max-w-[120px] mx-auto">
                                                                        <span className={cn("text-[10px] font-black text-center mb-0.5", soloRate >= 90 ? "text-emerald-400" : "text-amber-400")}>{soloRate.toFixed(0)}% SOLO</span>
                                                                        <Progress value={soloRate} className="h-1 bg-slate-800" style={{ ["--primary" as any]: soloRate >= 90 ? '#10b981' : '#f59e0b' }} />
                                                                    </div>
                                                                </td>
                                                                <td className="px-8 py-4 text-right">
                                                                    <span className={cn("font-mono font-bold flex items-center justify-end gap-1.5", stat.deaths > 0 ? "text-red-400" : "text-emerald-500")}>
                                                                        {stat.deaths > 0 && <Skull className="w-3.5 h-3.5" />}
                                                                        {stat.deaths === 0 ? "PERFECT" : `${stat.deaths} KILLS`}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </CardContent>
                                    </Card>
                                );
                            })()}
                        </div>
                    )}

                    {activeMatchupSubTab === "counter" && selectedCounterDefenderId && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {(() => {
                                const def = uniqueDefenders.find(d => d.id === selectedCounterDefenderId);
                                if (!def) return null;
                                const classColors = getChampionClassColors(def.class);
                                
                                return (
                                    <div className="space-y-6">
                                        <Card className="bg-slate-950/50 border-slate-800/60 overflow-hidden relative shadow-2xl">
                                            {/* Header Background Effects */}
                                            <div className="absolute inset-x-0 top-0 h-64 overflow-hidden pointer-events-none">
                                                <div className="absolute inset-0 opacity-[0.03] flex justify-end items-center">
                                                    <img src={getChampionImageUrl(def.images, 'full')} className="h-[150%] object-cover grayscale brightness-200 -mr-20" alt="" />
                                                </div>
                                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent" />
                                            </div>
                                            
                                            <CardHeader className="relative z-10 flex flex-col md:flex-row md:items-center gap-8 pb-8 pt-8 px-8">
                                                <div 
                                                    className="relative shrink-0 rounded-full p-1.5 transition-transform duration-700 hover:scale-105"
                                                    style={{ boxShadow: `0 0 30px ${classColors.color}25`, border: `3px solid ${classColors.color}` }}
                                                >
                                                    <Avatar className={cn("h-32 w-32 border-none", classColors.bg)}>
                                                        <AvatarImage src={getChampionImageUrl(def.images, 'full')} className="object-contain" />
                                                        <AvatarFallback>{def.name.substring(0,2)}</AvatarFallback>
                                                    </Avatar>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]")} style={{ backgroundColor: classColors.color }} />
                                                        <span className={cn("text-xs font-black uppercase tracking-[0.3em]", classColors.text)}>{def.class}</span>
                                                    </div>
                                                    <CardTitle className="text-4xl md:text-5xl font-black text-white tracking-tighter uppercase italic mb-4">{def.name}</CardTitle>
                                                    <div className="flex items-center gap-4">
                                                        <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl backdrop-blur-sm">
                                                            <div className="text-xl font-black text-emerald-400 uppercase tracking-tighter">Recommended Counters</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </CardHeader>

                                            <CardContent className="p-0 border-t border-slate-800/60 relative z-10 bg-slate-950/50">
                                                <table className="w-full text-left">
                                                    <thead className="text-[10px] text-slate-500 uppercase bg-slate-900/40 font-black tracking-widest border-b border-slate-800/60">
                                                        <tr>
                                                            <th className="px-8 py-4">Counter-Operative</th>
                                                            <th className="px-8 py-4 text-center">Engagements</th>
                                                            <th className="px-8 py-4 text-center">Efficiency Rating</th>
                                                            <th className="px-8 py-4 text-right">Combat Log</th>
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
                                                                            <div className="relative rounded-lg p-0.5 shadow-lg group-hover/counter:scale-110 transition-transform" style={{ border: `1.5px solid ${attColors.color}`, backgroundColor: attColors.bg }}>
                                                                                <Avatar className="h-10 w-10 border-none">
                                                                                    <AvatarImage src={getChampionImageUrl(stat.attackerImages!, '64')} />
                                                                                    <AvatarFallback>{stat.attackerName!.substring(0,2)}</AvatarFallback>
                                                                                </Avatar>
                                                                            </div>
                                                                            <span className={cn("font-black text-base italic uppercase tracking-tight", attColors.text)}>{stat.attackerName}</span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-4 text-center font-mono text-slate-300 font-bold">{stat.fights} Wars</td>
                                                                    <td className="px-8 py-4">
                                                                        <div className="flex flex-col gap-1.5 w-full max-w-[140px] mx-auto">
                                                                            <div className="flex items-center justify-between text-[10px] font-black">
                                                                                <span className={attColors.text}>{soloRate.toFixed(0)}% SUCCESS</span>
                                                                                <Trophy className={cn("w-3 h-3", soloRate >= 90 ? "text-yellow-500" : "text-slate-600")} />
                                                                            </div>
                                                                            <Progress value={soloRate} className="h-1 bg-slate-800" style={{ ["--primary" as any]: attColors.color }} />
                                                                        </div>
                                                                    </td>
                                                                    <td className="px-8 py-4 text-right font-mono font-bold">
                                                                        <span className={cn("px-2 py-1 rounded text-xs", stat.deaths > 0 ? "text-red-400" : "text-emerald-400 bg-emerald-500/5")}>
                                                                            {stat.deaths === 0 ? "SOLO VERIFIED" : `${stat.deaths} DEATHS`}
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
                            })()}
                        </div>
                    )}

                    {!selectedAttackerId && !selectedCounterDefenderId && (
                        <div className="h-full min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-slate-800/60 rounded-2xl bg-slate-950/20 text-slate-500 space-y-4">
                            <div className="p-4 rounded-full bg-slate-900/50">
                                <Swords className="w-12 h-12 opacity-20" />
                            </div>
                            <p className="font-bold tracking-tight text-lg">Select an Attacker or Counter-Target to begin analysis</p>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
    </div>
  );
}