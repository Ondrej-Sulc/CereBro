"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";
import { useState, useMemo } from "react";
import { PlayerStats } from "./types";
import { BattlegroupSummary } from "./components/battlegroup-summary";
import { PlayerPerformanceList } from "./components/player-performance-list";
import { CombatHistoryDialog } from "./components/combat-history-dialog";

export type { PlayerStats } from "./types";

interface SeasonOverviewViewProps {
  allPlayers: PlayerStats[];
  bgColors: { 1: string; 2: string; 3: string };
}

export function SeasonOverviewView({
  allPlayers,
  bgColors,
}: SeasonOverviewViewProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [selectedBg, setSelectedBg] = useState<1 | 2 | 3 | null>(null);

  const sortedPlayers = useMemo(() => {
    return [...allPlayers].sort((a, b) => {
        // Primary: Deaths (Ascending)
        if (a.deaths !== b.deaths) return a.deaths - b.deaths;
        // Secondary: Fights (Descending)
        return b.fights - a.fights;
    });
  }, [allPlayers]);

  const visiblePlayers = useMemo(() => {
    if (!selectedBg) return sortedPlayers;
    return sortedPlayers.filter(p => p.battlegroup === selectedBg);
  }, [sortedPlayers, selectedBg]);

  return (
    <div className="space-y-6">
      <Card className="bg-slate-950/40 border-slate-800/60 flex flex-col shadow-2xl backdrop-blur-md overflow-hidden">
          <BattlegroupSummary 
            allPlayers={allPlayers} 
            bgColors={bgColors} 
            selectedBg={selectedBg} 
            onSelectBg={setSelectedBg} 
          />

          <CardHeader className="pb-4 border-b border-slate-800/60 bg-slate-900/40 relative z-10">
            <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-black italic uppercase tracking-tighter flex items-center gap-3 text-slate-200">
                    <Users className="w-6 h-6" />
                    Alliance Roster Performance
                </CardTitle>
                <Badge variant="outline" className="bg-slate-950/50 text-slate-400 border-slate-800 text-xs font-black uppercase px-2 py-0.5">
                    {visiblePlayers.length} Members
                </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1 relative z-10">
            <PlayerPerformanceList 
                players={visiblePlayers} 
                allPlayers={sortedPlayers} 
                bgColors={bgColors} 
                onSelectPlayer={setSelectedPlayer} 
            />
          </CardContent>
      </Card>

      <CombatHistoryDialog 
        player={selectedPlayer} 
        onClose={() => setSelectedPlayer(null)} 
      />
    </div>
  );
}

