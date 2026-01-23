"use client";

import { useState } from "react";
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
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChampionImageUrl } from "@/lib/championHelper";
import { DeepDiveTab, DeepDiveSubTab, ChampionEntity } from "./deep-dive-types";

interface DeepDiveSidebarProps {
  activeTab: DeepDiveTab;
  activeDefenseSubTab: "node" | "defender";
  activeMatchupSubTab: "attacker" | "counter";
  onDefenseSubTabChange: (v: "node" | "defender") => void;
  onMatchupSubTabChange: (v: "attacker" | "counter") => void;
  
  selectedNode: number | null;
  selectedDefenderId: number | null;
  selectedAttackerId: number | null;
  selectedCounterDefenderId: number | null;
  
  onNodeSelect: (node: number) => void;
  onDefenderSelect: (id: number) => void;
  onAttackerSelect: (id: number) => void;
  onCounterDefenderSelect: (id: number) => void;

  uniqueNodes: number[];
  uniqueDefenders: ChampionEntity[];
  uniqueAttackers: ChampionEntity[];
}

export function DeepDiveSidebar({
  activeTab,
  activeDefenseSubTab,
  activeMatchupSubTab,
  onDefenseSubTabChange,
  onMatchupSubTabChange,
  selectedNode,
  selectedDefenderId,
  selectedAttackerId,
  selectedCounterDefenderId,
  onNodeSelect,
  onDefenderSelect,
  onAttackerSelect,
  onCounterDefenderSelect,
  uniqueNodes,
  uniqueDefenders,
  uniqueAttackers,
}: DeepDiveSidebarProps) {
  const [nodeOpen, setNodeOpen] = useState(false);
  const [defenderOpen, setDefenderOpen] = useState(false);
  const [attackerOpen, setAttackerOpen] = useState(false);
  const [counterDefenderOpen, setCounterDefenderOpen] = useState(false);

  return (
    <Card className="bg-slate-950/40 border-slate-800/60 overflow-hidden backdrop-blur-sm shadow-xl">
      <CardHeader className="pb-4 border-b border-slate-800/60 bg-slate-900/30">
        <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Filter View</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-6">
        {activeTab === "defense" ? (
          <div className="space-y-4">
            <Tabs value={activeDefenseSubTab} onValueChange={(v) => onDefenseSubTabChange(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 mb-4 h-9">
                <TabsTrigger value="node" className="text-xs">Node</TabsTrigger>
                <TabsTrigger value="defender" className="text-xs">Defender</TabsTrigger>
              </TabsList>
              
              <TabsContent value="node" className="m-0">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Node</label>
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
                              <CommandItem key={node} value={node.toString()} onSelect={(val) => { onNodeSelect(parseInt(val)); setNodeOpen(false); }} className="data-[selected=true]:bg-purple-600/20 data-[selected=true]:text-purple-400">
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
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Defender</label>
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
                              <CommandItem key={defender.id} value={defender.name} onSelect={() => { onDefenderSelect(defender.id); setDefenderOpen(false); }} className="data-[selected=true]:bg-purple-600/20 data-[selected=true]:text-purple-400">
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
            <Tabs value={activeMatchupSubTab} onValueChange={(v) => onMatchupSubTabChange(v as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-slate-900/50 mb-4 h-9">
                <TabsTrigger value="attacker" className="text-xs">Attacker</TabsTrigger>
                <TabsTrigger value="counter" className="text-xs">Defender</TabsTrigger>
              </TabsList>
              
              <TabsContent value="attacker" className="m-0">
                <div className="space-y-2">
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Attacker</label>
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
                              <CommandItem key={attacker.id} value={attacker.name} onSelect={() => { onAttackerSelect(attacker.id); setAttackerOpen(false); }} className="data-[selected=true]:bg-sky-600/20 data-[selected=true]:text-sky-400">
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
                  <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Select Defender</label>
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
                              <CommandItem key={defender.id} value={defender.name} onSelect={() => { onCounterDefenderSelect(defender.id); setCounterDefenderOpen(false); }} className="data-[selected=true]:bg-sky-600/20 data-[selected=true]:text-sky-400">
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
  );
}
