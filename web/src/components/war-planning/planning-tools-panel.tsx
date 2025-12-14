"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Champion, Player, Roster, ChampionClass, Tag } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Shield, Star, X, Filter, CircleOff, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { getPlayerRoster, getOwnersOfChampion } from "@/app/planning/actions";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { usePlayerColor } from "./player-color-context"; 
import { getChampionClassColors } from "@/lib/championClassHelper"; 

interface PlanningToolsPanelProps {
  players: Player[];
  champions: Champion[];
  allianceId: string;
  onClose?: () => void;
  currentBattlegroup?: number;
  onAddExtra?: (playerId: string, championId: number, starLevel?: number) => void;
  initialPlayerId?: string | null;
  assignedChampions: { playerId: string; championId: number }[];
  activeTag?: Tag | null;
}

type ChampionWithTags = Champion & { tags?: { name: string }[] };
type RosterWithChampion = Roster & { champion: ChampionWithTags };
type RosterWithPlayer = Roster & { player: Player };

export default function PlanningToolsPanel({
  players, 
  champions, 
  allianceId, 
  onClose, 
  currentBattlegroup, 
  onAddExtra, 
  initialPlayerId,
  assignedChampions,
  activeTag
}: PlanningToolsPanelProps) {
  const { toast } = useToast();
  const { getPlayerColor } = usePlayerColor(); // Initialize usePlayerColor
  const [rosterResults, setRosterResults] = useState<RosterWithChampion[]>([]);
  const [ownerResults, setOwnerResults] = useState<RosterWithPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChampionId, setSelectedChampionId] = useState<string>("");
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(initialPlayerId || "");
  const [selectedClass, setSelectedClass] = useState<ChampionClass | null>(null);

  const rosterReqSeq = useRef(0);

  const selectedPlayer = players.find(p => p.id === selectedPlayerId);

  const filteredPlayers = currentBattlegroup 
    ? players.filter(p => p.battlegroup === currentBattlegroup)
    : players;

  const CLASSES: ChampionClass[] = ["SCIENCE", "SKILL", "MYSTIC", "COSMIC", "TECH", "MUTANT"];

  const filteredRoster = rosterResults.filter(item => 
    !selectedClass || item.champion.class === selectedClass
  );

  const handlePlayerSelect = useCallback(async (playerId: string) => {
    setSelectedPlayerId(playerId);
    setIsLoading(true);
    setSelectedClass(null); // Reset filter on player change
    const reqId = ++rosterReqSeq.current;

    try {
      const results = await getPlayerRoster(playerId);
      if (reqId === rosterReqSeq.current) {
        setRosterResults(results as RosterWithChampion[]);
      }
    } catch (error) {
      console.error("Failed to fetch roster", error);
    } finally {
      if (reqId === rosterReqSeq.current) setIsLoading(false);
    }
  }, []); // Dependencies removed

  // Effect to update when prop changes
  useEffect(() => {
      if (initialPlayerId) {
          handlePlayerSelect(initialPlayerId);
      }
  }, [initialPlayerId, handlePlayerSelect]);

  const handleChampionSelect = async (championId: string) => {
    setSelectedChampionId(championId);
    if (!championId) {
      setOwnerResults([]);
      return;
    }
    
    const parsedChampionId = Number.parseInt(championId, 10);
    if (!Number.isFinite(parsedChampionId)) {
        setOwnerResults([]);
        return;
    }

    setIsLoading(true);
    try {
      const results = await getOwnersOfChampion(parsedChampionId, allianceId, currentBattlegroup);
      setOwnerResults(results as RosterWithPlayer[]);
    } catch (error) {
      console.error("Failed to fetch owners", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddChampion = (item: RosterWithChampion) => {
      if (onAddExtra && selectedPlayerId) {
          onAddExtra(selectedPlayerId, item.champion.id, item.stars);
          toast({
              title: "Champion Added",
              description: `Added ${item.champion.name} to extra assignments.`,
          });
      }
  };

  const handleAddOwner = (item: RosterWithPlayer) => {
    const parsedId = Number.parseInt(selectedChampionId, 10);
    if (!Number.isFinite(parsedId)) return;

    const champion = champions.find(c => c.id === parsedId);
    
    if (onAddExtra && champion) {
        onAddExtra(item.player.id, champion.id, item.stars);
        toast({
            title: "Champion Added",
            description: `Added ${champion.name} to ${item.player.ingameName}'s extra assignments.`,
        });
    }
  };


  return (
    <div className="h-full flex flex-col bg-slate-950 border-l border-slate-800">
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Planning Tools</h3>
          <p className="text-xs text-muted-foreground">Search rosters & owners</p>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="roster" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="roster">Player Roster</TabsTrigger>
            <TabsTrigger value="owners">Find Champion</TabsTrigger>
          </TabsList>
          
          <TabsContent value="roster" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Player</label>
              <Select value={selectedPlayerId} onValueChange={handlePlayerSelect}>
                <SelectTrigger className="rounded-full">
                  {selectedPlayer ? (
                    <div className="flex items-center gap-2">
                        {selectedPlayer.avatar ? (
                          <div 
                            className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-800 border ml-[-10px]"
                            style={{ borderColor: getPlayerColor(selectedPlayer.id) }}
                          >
                            <Image 
                              src={selectedPlayer.avatar} 
                              alt={selectedPlayer.ingameName} 
                              fill 
                              sizes="32px"
                              className="object-cover" 
                            />
                          </div>
                        ) : (
                           <div 
                             className="relative w-8 h-8 rounded-full flex items-center justify-center border"
                             style={{ borderColor: getPlayerColor(selectedPlayer.id) }}
                           >
                             <Users className="w-5 h-5 text-slate-400" />
                           </div>
                        )}
                        <span className="truncate font-bold">{selectedPlayer.ingameName}</span>
                    </div>
                  ) : (
                    <SelectValue placeholder="Choose a player..." />
                  )}
                </SelectTrigger>
                <SelectContent>
                  {filteredPlayers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.avatar ? (
                          <div 
                            className="relative w-6 h-6 rounded-full overflow-hidden bg-slate-800 border"
                            style={{ borderColor: getPlayerColor(p.id) }}
                          >
                            <Image 
                              src={p.avatar} 
                              alt={p.ingameName} 
                              fill 
                              sizes="32px"
                              className="object-cover" 
                            />
                          </div>
                        ) : (
                           <div 
                             className="relative w-6 h-6 rounded-full flex items-center justify-center border"
                             style={{ borderColor: getPlayerColor(p.id) }}
                           >
                             <Users className="w-4 h-4 text-slate-400" />
                           </div>
                        )}
                        <span className="truncate">{p.ingameName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class Filter Bar */}
            {rosterResults.length > 0 && (
                <div className="flex items-center gap-1.5 justify-between bg-slate-900/50 p-1.5 rounded-lg border border-slate-800">
                    <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                            "h-7 w-7 rounded-full transition-all",
                            !selectedClass ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
                        )}
                        onClick={() => setSelectedClass(null)}
                        title="All Classes"
                    >
                        <CircleOff className="h-4 w-4" />
                    </Button>
                    <div className="h-4 w-px bg-slate-800" />
                    {CLASSES.map(c => {
                        const colors = getChampionClassColors(c);
                        const isSelected = selectedClass === c;
                        // Determine icon path - simple mapping based on capitalisation
                        // Actually I can just title case it: Science, Skill, etc.
                        const iconName = c.charAt(0) + c.slice(1).toLowerCase();
                        const iconPath = `/icons/${iconName}.png`;

                        return (
                            <Button
                                key={c}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "h-7 w-7 p-1 rounded-full transition-all border",
                                    isSelected 
                                        ? cn(colors.bg, colors.border) 
                                        : "bg-transparent border-transparent hover:bg-slate-800"
                                )}
                                onClick={() => setSelectedClass(isSelected ? null : c)}
                                title={c}
                            >
                                <div className="relative w-full h-full">
                                    <Image 
                                        src={iconPath} 
                                        alt={c} 
                                        fill 
                                        sizes="20px"
                                        className="object-contain"
                                    />
                                </div>
                            </Button>
                        );
                    })}
                </div>
            )}

            <div className="space-y-2 mt-2">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading roster...</p>
              ) : filteredRoster.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {filteredRoster.map((item) => {
                    const classColors = getChampionClassColors(item.champion.class);
                    const isAssigned = assignedChampions.some(
                      (p) => p.playerId === selectedPlayerId && p.championId === item.champion.id
                    );
                    const isTacticChampion = 
                      activeTag && 
                      item.champion.tags?.some(t => t.name === activeTag.name);
                    return (
                    <div 
                        key={item.id} 
                        className={cn(
                            "flex items-center gap-3 p-2 rounded-md border bg-slate-900/50 transition-colors",
                            onAddExtra && "cursor-pointer hover:bg-slate-800 hover:border-slate-700",
                            isAssigned && "border-transparent", // Border is handled by gradient now
                            isTacticChampion && "border-teal-500"
                        )}
                        style={{
                          backgroundImage: isAssigned ? `linear-gradient(to right, ${classColors.color}20, transparent)` : undefined,
                          borderWidth: isTacticChampion ? '1px' : undefined, // Explicit 1px border for tactic champion
                        }}
                        onClick={() => handleAddChampion(item)}
                    >
                      <div className={cn("relative h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-slate-800 border", classColors.border)}>
                        <Image
                          src={getChampionImageUrl(item.champion.images, '64')}
                          alt={item.champion.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-1.5">
                            <p className={cn("font-bold text-sm", classColors.text)}>{item.champion.name}</p>
                            {isTacticChampion && <Shield className="h-3 w-3 text-teal-400 flex-shrink-0" />}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className={cn("flex items-center font-bold", item.isAwakened ? "text-slate-300" : "text-yellow-500")}>
                            {item.stars}<Star className="h-3 w-3 fill-current ml-0.5" />
                          </span>
                          <span>R{item.rank}</span>
                          {item.isAscended && <span className="text-pink-400 font-bold">Ascended</span>}
                        </div>
                      </div>
                      {isAssigned && (
                        <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      )}
                    </div>
                  );})}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a player to view their top champions.
                </p>
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="owners" className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Champion</label>
              <ChampionCombobox
                champions={champions}
                value={selectedChampionId}
                onSelect={handleChampionSelect}
                placeholder="Search for a champion..."
              />
            </div>

            <div className="space-y-2 mt-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Searching owners...</p>
              ) : ownerResults.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {ownerResults.map((item) => (
                    <div 
                        key={item.id} 
                        className={cn(
                          "flex items-center justify-between p-2 rounded-md border border-slate-800/50 bg-slate-900/50 border-l-[2px] transition-colors",
                          onAddExtra && "cursor-pointer hover:bg-slate-800 hover:border-slate-700"
                        )}
                        style={{ borderLeftColor: getPlayerColor(item.player.id) }}
                        onClick={() => handleAddOwner(item)}
                    >
                      <div className="flex items-center gap-3">
                        {item.player.avatar ? (
                          <Image
                            src={item.player.avatar}
                            alt={item.player.ingameName ?? "Player Avatar"}
                            width={32}
                            height={32}
                            className="rounded-full border"
                            style={{ borderColor: getPlayerColor(item.player.id) }}
                          />
                        ) : (
                          <div 
                             className="relative h-6 w-6 rounded-full flex items-center justify-center border"
                             style={{ borderColor: getPlayerColor(item.player.id) }}
                           >
                            <Users className="h-5 w-5 text-slate-400" />
                          </div>
                        )}
                        <p className="font-bold text-sm">{item.player.ingameName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={cn("flex items-center font-bold", item.isAwakened ? "text-slate-300" : "text-yellow-500")}>
                          {item.stars}<Star className="h-3 w-3 fill-current ml-0.5" />
                        </span>
                        <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">R{item.rank}</span>
                        {item.isAscended && <span className="text-pink-400 font-bold" title="Ascended">ASC</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select a champion to see who owns it in your alliance.
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
