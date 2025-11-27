"use client";

import { useState } from "react";
import { Champion, Player, Roster } from "@prisma/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Users, Shield, Star, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { getPlayerRoster, getOwnersOfChampion } from "@/app/planning/actions";
import Image from "next/image";
import { getChampionImageUrl } from "@/lib/championHelper";
import { Button } from "@/components/ui/button";

interface PlanningToolsPanelProps {
  players: Player[];
  champions: Champion[];
  allianceId: string;
  onClose?: () => void;
}

type RosterWithChampion = Roster & { champion: Champion };
type RosterWithPlayer = Roster & { player: Player };

export default function PlanningToolsPanel({ players, champions, allianceId, onClose }: PlanningToolsPanelProps) {
  const [rosterResults, setRosterResults] = useState<RosterWithChampion[]>([]);
  const [ownerResults, setOwnerResults] = useState<RosterWithPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handlePlayerSelect = async (playerId: string) => {
    setIsLoading(true);
    try {
      const results = await getPlayerRoster(playerId);
      setRosterResults(results as RosterWithChampion[]);
    } catch (error) {
      console.error("Failed to fetch roster", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChampionSelect = async (championId: string) => {
    setIsLoading(true);
    try {
      const results = await getOwnersOfChampion(parseInt(championId), allianceId);
      setOwnerResults(results as RosterWithPlayer[]);
    } catch (error) {
      console.error("Failed to fetch owners", error);
    } finally {
      setIsLoading(false);
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
              <Select onValueChange={handlePlayerSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a player..." />
                </SelectTrigger>
                <SelectContent>
                  {players.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.ingameName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 mt-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Loading roster...</p>
              ) : rosterResults.length > 0 ? (
                <div className="grid grid-cols-1 gap-2">
                  {rosterResults.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 p-2 rounded-md border bg-slate-900/50">
                      <div className="relative h-10 w-10 rounded-full overflow-hidden bg-slate-800 flex-shrink-0">
                        <Image
                          src={getChampionImageUrl(item.champion.images as any, '64')}
                          alt={item.champion.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{item.champion.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex items-center text-yellow-500">
                            {item.stars}<Star className="h-3 w-3 fill-current ml-0.5" />
                          </span>
                          <span>R{item.rank}</span>
                          {item.isAscended && <span className="text-pink-400 font-bold">Ascended</span>}
                          {item.isAwakened && <span className="text-sky-400">Awakened</span>}
                        </div>
                      </div>
                    </div>
                  ))}
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
                value=""
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
                    <div key={item.id} className="flex items-center justify-between p-2 rounded-md border bg-slate-900/50">
                      <div className="flex items-center gap-3">
                        <Users className="h-5 w-5 text-slate-400" />
                        <p className="font-bold text-sm">{item.player.ingameName}</p>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="flex items-center text-yellow-500 font-bold">
                          {item.stars}<Star className="h-3 w-3 fill-current ml-0.5" />
                        </span>
                        <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">R{item.rank}</span>
                        {item.isAscended && <span className="text-pink-400 font-bold" title="Ascended">ASC</span>}
                        {item.isAwakened && <span className="text-sky-400" title="Awakened">SIG</span>}
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
