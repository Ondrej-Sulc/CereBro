"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Search, Filter, ChevronDown } from "lucide-react";
import { ChampionCombobox } from "@/components/ChampionCombobox";
import { Champion } from "@/types/champion";
import { useState, useTransition } from "react";
import { SeasonMultiSelect } from "@/components/SeasonMultiSelect";
import { cn } from "@/lib/utils";

interface SearchFiltersProps {
  champions: Champion[];
  availableSeasons: number[];
}

export function SearchFilters({ champions, availableSeasons }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed

  // Local state for controlled inputs
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [attacker, setAttacker] = useState(searchParams.get("attacker") || "");
  const [defender, setDefender] = useState(searchParams.get("defender") || "");
  const [node, setNode] = useState(searchParams.get("node") || "");
  const [war, setWar] = useState(searchParams.get("war") || "");
  const [tier, setTier] = useState(searchParams.get("tier") || "");
  const [player, setPlayer] = useState(searchParams.get("player") || "");
  const [alliance, setAlliance] = useState(searchParams.get("alliance") || "");
  const [battlegroup, setBattlegroup] = useState(searchParams.get("battlegroup") || "");
  
  const initialSeasons = searchParams.getAll("season").map(s => parseInt(s)).filter(n => !isNaN(n));
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>(initialSeasons);
  
  const [hasVideo, setHasVideo] = useState(searchParams.get("hasVideo") === "true");

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    startTransition(() => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      
      const attackerName = champions.find(c => String(c.id) === attacker)?.name || attacker;
      const defenderName = champions.find(c => String(c.id) === defender)?.name || defender;

      if (attackerName) params.set("attacker", attackerName);
      if (defenderName) params.set("defender", defenderName);
      if (node) params.set("node", node);
      if (war) params.set("war", war);
      if (tier) params.set("tier", tier);
      if (player) params.set("player", player);
      if (alliance) params.set("alliance", alliance);
      if (battlegroup) params.set("battlegroup", battlegroup);
      
      selectedSeasons.forEach(s => params.append("season", s.toString()));
      
      if (hasVideo) params.set("hasVideo", "true");

      router.push(`/war-videos?${params.toString()}`);
    });
  };

  const getIdByName = (name: string) => champions.find(c => c.name.toLowerCase() === name.toLowerCase())?.id.toString() || "";

  const [attackerId, setAttackerId] = useState(getIdByName(attacker));
  const [defenderId, setDefenderId] = useState(getIdByName(defender));

  const handleAttackerSelect = (id: string) => {
      setAttackerId(id);
      setAttacker(id); 
  }

  const handleDefenderSelect = (id: string) => {
      setDefenderId(id);
      setDefender(id);
  }

  return (
    <div className="flex flex-col gap-4 max-w-7xl w-full">
      {/* Mobile Filter Toggle Header */}
      <div 
        className="md:hidden flex items-center justify-between p-3 bg-slate-900/30 rounded-lg border border-slate-800/50 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Filter className="h-4 w-4 text-sky-400" /> Filters
        </h3>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", !isCollapsed && "rotate-180")} />
      </div>

      <form onSubmit={handleSearch} className={cn("flex flex-col gap-4", isCollapsed && "hidden md:flex")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6 gap-3 p-3 bg-slate-900/30 rounded-lg border border-slate-800/50">
          <div className="space-y-2 lg:col-span-2 xl:col-span-2">
            <Label className="text-xs text-slate-400">Attacker</Label>
            <ChampionCombobox 
              champions={champions}
              value={attackerId}
              onSelect={handleAttackerSelect}
              placeholder="Select Attacker"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm w-full"
            />
          </div>
          <div className="space-y-2 lg:col-span-2 xl:col-span-2">
            <Label className="text-xs text-slate-400">Defender</Label>
            <ChampionCombobox 
              champions={champions}
              value={defenderId}
              onSelect={handleDefenderSelect}
              placeholder="Select Defender"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="node" className="text-xs text-slate-400">Node</Label>
            <Input
              id="node"
              type="number"
              value={node}
              onChange={(e) => setNode(e.target.value)}
              placeholder="#"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="player" className="text-xs text-slate-400">Player</Label>
            <Input
              id="player"
              value={player}
              onChange={(e) => setPlayer(e.target.value)}
              placeholder="Name"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="alliance" className="text-xs text-slate-400">Alliance</Label>
            <Input
              id="alliance"
              value={alliance}
              onChange={(e) => setAlliance(e.target.value)}
              placeholder="Tag or Name"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Seasons</Label>
            <SeasonMultiSelect 
              seasons={availableSeasons}
              selected={selectedSeasons}
              onChange={setSelectedSeasons}
              className="h-8 bg-slate-950/50 border-slate-800 text-sm w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="war" className="text-xs text-slate-400">War</Label>
            <Input
              id="war"
              type="number"
              value={war}
              onChange={(e) => setWar(e.target.value)}
              placeholder="#"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tier" className="text-xs text-slate-400">Tier</Label>
            <Input
              id="tier"
              type="number"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
              placeholder="#"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="battlegroup" className="text-xs text-slate-400">BG</Label>
            <Input
              id="battlegroup"
              type="number"
              min={1}
              max={3}
              value={battlegroup}
              onChange={(e) => setBattlegroup(e.target.value)}
              placeholder="#"
              className="h-8 bg-slate-950/50 border-slate-800 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
          <div className="flex items-end pb-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasVideo"
                checked={hasVideo}
                onCheckedChange={(checked) => setHasVideo(Boolean(checked))}
              />
              <Label htmlFor="hasVideo" className="text-sm cursor-pointer text-slate-300">Has Video</Label>
            </div>
          </div>
          <div className="flex items-end">
            <Button type="submit" className="bg-sky-600 hover:bg-sky-700 text-white w-full h-8" disabled={isPending}>
              {isPending ? "..." : "Search"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}