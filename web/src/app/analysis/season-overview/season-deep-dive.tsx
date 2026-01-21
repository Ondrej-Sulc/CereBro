"use client";

import { useState, useMemo } from "react";
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
  Target,
} from "lucide-react";

export interface DetailedPlacementStat {
  nodeNumber: number;
  defenderId: number;
  defenderName: string;
  defenderClass: ChampionClass;
  defenderImages: ChampionImages;
  fights: number;
  deaths: number;
}

interface SeasonDeepDiveProps {
  placementStats: DetailedPlacementStat[];
}

export function SeasonDeepDive({ placementStats }: SeasonDeepDiveProps) {
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [selectedDefenderId, setSelectedDefenderId] = useState<number | null>(
    null
  );
  const [nodeOpen, setNodeOpen] = useState(false);
  const [defenderOpen, setDefenderOpen] = useState(false);

  // 1. Unique Nodes and Defenders
  const uniqueNodes = useMemo(() => {
    const nodes = new Set<number>();
    placementStats.forEach((s) => nodes.add(s.nodeNumber));
    return Array.from(nodes).sort((a, b) => a - b);
  }, [placementStats]);

  const uniqueDefenders = useMemo(() => {
    const defenders = new Map<
      number,
      { id: number; name: string; class: ChampionClass; images: ChampionImages }
    >();
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
    return Array.from(defenders.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [placementStats]);

  // 2. Aggregations for Selected Node (Group by Defender)
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
              // Clone to avoid mutating original array if references are shared
              aggregated.set(stat.defenderId, { ...stat });
          }
      });

    return Array.from(aggregated.values())
      .sort((a, b) => b.deaths - a.deaths || b.fights - a.fights);
  }, [selectedNode, placementStats]);

  // 3. Aggregations for Selected Defender (Group by Node)
  const defenderStats = useMemo(() => {
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
               // Clone to avoid mutating original array
              aggregated.set(stat.nodeNumber, { ...stat });
          }
      });

    return Array.from(aggregated.values())
      .sort((a, b) => b.deaths - a.deaths || b.fights - a.fights);
  }, [selectedDefenderId, placementStats]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <Search className="h-6 w-6 text-purple-500" />
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
            Deep Dive Analysis
        </h2>
      </div>

      <Tabs defaultValue="node" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-slate-900/50 border border-slate-800">
          <TabsTrigger value="node" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">By Node</TabsTrigger>
          <TabsTrigger value="defender" className="data-[state=active]:bg-purple-600 data-[state=active]:text-white">By Defender</TabsTrigger>
        </TabsList>

        {/* --- BY NODE --- */}
        <TabsContent value="node" className="mt-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-4">
            <Card className="w-full md:w-80 bg-slate-950/50 border-slate-800/60 h-fit">
              <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Select Node
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Popover open={nodeOpen} onOpenChange={setNodeOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={nodeOpen}
                      className="w-full justify-between bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      {selectedNode
                        ? `Node ${selectedNode}`
                        : "Select node..."}
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
                            <CommandItem
                              key={node}
                              value={node.toString()}
                              onSelect={(currentValue) => {
                                setSelectedNode(parseInt(currentValue));
                                setNodeOpen(false);
                              }}
                              className="text-slate-200 data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedNode === node
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
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
                     <div className="flex items-center justify-between">
                         <span className="text-sm text-slate-500">Total Fights</span>
                         <span className="text-lg font-mono font-bold text-slate-200">
                             {nodeStats.reduce((acc, curr) => acc + curr.fights, 0)}
                         </span>
                     </div>
                     <div className="flex items-center justify-between">
                         <span className="text-sm text-slate-500">Total Deaths</span>
                         <span className="text-lg font-mono font-bold text-red-400 flex items-center gap-1">
                             <Skull className="w-4 h-4" />
                             {nodeStats.reduce((acc, curr) => acc + curr.deaths, 0)}
                         </span>
                     </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex-1">
              {selectedNode ? (
                <Card className="bg-slate-950/50 border-slate-800/60">
                    <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                        <CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2">
                             <Target className="w-5 h-5 text-amber-500" />
                             Node {selectedNode} Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                         <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Defender</th>
                                        <th className="px-4 py-3 text-center">Fights</th>
                                        <th className="px-4 py-3 text-center">Deaths</th>
                                        <th className="px-4 py-3 text-right">Avg Deaths</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40 text-sm">
                                    {nodeStats.map((stat) => {
                                        const classColors = getChampionClassColors(stat.defenderClass);
                                        return (
                                        <tr key={stat.defenderId} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className={cn("h-9 w-9 border-none ring-1.5", classColors.border)}>
                                                        <AvatarImage src={getChampionImageUrl(stat.defenderImages, '64')} />
                                                        <AvatarFallback>{stat.defenderName.substring(0,2)}</AvatarFallback>
                                                    </Avatar>
                                                    <span className={cn("font-bold truncate", classColors.text)}>
                                                        {stat.defenderName}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono text-slate-300">
                                                {stat.fights}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm",
                                                    stat.deaths > 0 ? "bg-red-950/20 text-red-400 border border-red-900/30" : "text-emerald-400"
                                                )}>
                                                    {stat.deaths > 0 && <Skull className="w-3 h-3" />}
                                                    {stat.deaths}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                                                {(stat.deaths / (stat.fights || 1)).toFixed(2)}
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                         </div>
                    </CardContent>
                </Card>
              ) : (
                <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/20">
                    <p className="text-slate-500 flex items-center gap-2">
                        <Target className="w-5 h-5" />
                        Select a node to view stats
                    </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* --- BY DEFENDER --- */}
        <TabsContent value="defender" className="mt-6 space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
            <Card className="w-full md:w-80 bg-slate-950/50 border-slate-800/60 h-fit">
              <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                <CardTitle className="text-sm font-medium text-slate-400 uppercase tracking-wider">
                  Select Defender
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                <Popover open={defenderOpen} onOpenChange={setDefenderOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={defenderOpen}
                      className="w-full justify-between bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      {selectedDefenderId
                        ? uniqueDefenders.find(d => d.id === selectedDefenderId)?.name
                        : "Select defender..."}
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
                            <CommandItem
                              key={defender.id}
                              value={defender.name}
                              onSelect={() => {
                                setSelectedDefenderId(defender.id);
                                setDefenderOpen(false);
                              }}
                              className="text-slate-200 data-[selected=true]:bg-slate-800 data-[selected=true]:text-white"
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedDefenderId === defender.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex items-center gap-2">
                                  <Avatar className="h-6 w-6">
                                      <AvatarImage src={getChampionImageUrl(defender.images, '64')} />
                                      <AvatarFallback>{defender.name.substring(0,2)}</AvatarFallback>
                                  </Avatar>
                                  {defender.name}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {selectedDefenderId && (
                  <div className="mt-6 space-y-4">
                     {/* Defender Info Summary */}
                     {(() => {
                         const def = uniqueDefenders.find(d => d.id === selectedDefenderId);
                         if (!def) return null;
                         const classColors = getChampionClassColors(def.class);
                         return (
                            <div className="flex flex-col items-center gap-3 mb-6">
                                <Avatar className={cn("h-28 w-28 ring-4 ring-offset-4 ring-offset-slate-950 shadow-2xl transition-transform hover:scale-105 duration-300", classColors.ring)}>
                                    <AvatarImage src={getChampionImageUrl(def.images, 'full')} />
                                    <AvatarFallback className="text-xl">{def.name.substring(0,2)}</AvatarFallback>
                                </Avatar>
                                <span className={cn("text-2xl font-bold tracking-tight", classColors.text)}>{def.name}</span>
                                <Badge variant="outline" className={cn("bg-slate-900 border-opacity-50", classColors.border, classColors.text)}>
                                    {def.class}
                                </Badge>
                            </div>
                         );
                     })()}

                     <div className="flex items-center justify-between">
                         <span className="text-sm text-slate-500">Total Placements</span>
                         <span className="text-lg font-mono font-bold text-slate-200">
                             {defenderStats.reduce((acc, curr) => acc + curr.fights, 0)}
                         </span>
                     </div>
                     <div className="flex items-center justify-between">
                         <span className="text-sm text-slate-500">Total Deaths</span>
                         <span className="text-lg font-mono font-bold text-red-400 flex items-center gap-1">
                             <Skull className="w-4 h-4" />
                             {defenderStats.reduce((acc, curr) => acc + curr.deaths, 0)}
                         </span>
                     </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex-1">
              {selectedDefenderId ? (
                <Card className="bg-slate-950/50 border-slate-800/60">
                    <CardHeader className="pb-3 border-b border-slate-800/60 bg-slate-900/20">
                        <CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2">
                             <Shield className="w-5 h-5 text-red-400" />
                             Placement Performance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                         <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-900/40 font-medium">
                                    <tr>
                                        <th className="px-4 py-3">Node</th>
                                        <th className="px-4 py-3 text-center">Fights</th>
                                        <th className="px-4 py-3 text-center">Deaths</th>
                                        <th className="px-4 py-3 text-right">Avg Deaths</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/40 text-sm">
                                    {defenderStats.map((stat, idx) => {
                                        return (
                                        <tr key={stat.nodeNumber} className="hover:bg-slate-800/20 transition-colors">
                                            <td className="px-4 py-3">
                                                <Badge variant="outline" className="bg-slate-900 text-amber-500 border-amber-500/30 font-mono text-sm">
                                                    Node {stat.nodeNumber}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-3 text-center font-mono text-slate-300">
                                                {stat.fights}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={cn(
                                                    "inline-flex items-center gap-1 font-mono font-bold px-2 py-0.5 rounded text-sm",
                                                    stat.deaths > 0 ? "bg-red-950/20 text-red-400 border border-red-900/30" : "text-emerald-400"
                                                )}>
                                                    {stat.deaths > 0 && <Skull className="w-3 h-3" />}
                                                    {stat.deaths}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                                                {(stat.deaths / (stat.fights || 1)).toFixed(2)}
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                         </div>
                    </CardContent>
                </Card>
              ) : (
                <div className="h-full min-h-[300px] flex items-center justify-center border-2 border-dashed border-slate-800 rounded-lg bg-slate-900/20">
                    <p className="text-slate-500 flex items-center gap-2">
                        <Shield className="w-5 h-5" />
                        Select a defender to view stats
                    </p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}