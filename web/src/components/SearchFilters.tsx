"use client";

import { Search, Filter, ChevronDown, ChevronUp, Video, X, User, Shield } from "lucide-react";
import { ChampionCombobox } from "@/components/comboboxes/ChampionCombobox";
import { Champion } from "@/types/champion";
import { useState, useTransition, useCallback, useEffect, useRef, useMemo } from "react";
import { SeasonMultiSelect } from "@/components/SeasonMultiSelect";
import { cn } from "@/lib/utils";
import { FlipToggle } from "@/components/ui/flip-toggle";
import { useDebounce } from "@/hooks/use-debounce";
import { Badge } from "@/components/ui/badge";
import { AsyncPlayerCombobox } from "@/components/comboboxes/AsyncPlayerCombobox";
import { AsyncAllianceCombobox } from "@/components/comboboxes/AsyncAllianceCombobox";
import { MemoizedSelect } from "@/components/MemoizedSelect";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Player, Alliance } from "@prisma/client";

interface SearchFiltersProps {
  champions: Champion[];
  availableSeasons: number[];
  currentUser?: (Player & { alliance: Alliance | null }) | null;
}

export function SearchFilters({ champions, availableSeasons, currentUser }: SearchFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  // -- State Initialization --
  
  // Main Filters
  const [mapType, setMapType] = useState(searchParams.get("map") || "STANDARD");
  const [attackerId, setAttackerId] = useState(
      champions.find(c => c.name.toLowerCase() === (searchParams.get("attacker") || "").toLowerCase())?.id.toString() || ""
  );
  const [defenderId, setDefenderId] = useState(
      champions.find(c => c.name.toLowerCase() === (searchParams.get("defender") || "").toLowerCase())?.id.toString() || ""
  );
  const [node, setNode] = useState(searchParams.get("node") || "");
  const [hasVideo, setHasVideo] = useState(searchParams.get("hasVideo") === "true");

  // Secondary Filters
  const initialSeasons = searchParams.getAll("season").map(s => parseInt(s)).filter(n => !isNaN(n));
  const [selectedSeasons, setSelectedSeasons] = useState<number[]>(initialSeasons);
  const [war, setWar] = useState(searchParams.get("war") || "");
  const [tier, setTier] = useState(searchParams.get("tier") || "");
  const [player, setPlayer] = useState(searchParams.get("player") || "");
  const [alliance, setAlliance] = useState(searchParams.get("alliance") || "");
  const [battlegroup, setBattlegroup] = useState(searchParams.get("battlegroup") || "");

  // Debounce Text Inputs
  const debouncedNode = useDebounce(node, 500);
  const debouncedBattlegroup = useDebounce(battlegroup, 500);
  
  // Handlers - Removed handleSwap
  
  // Options
  const warOptions = useMemo(() => [
      { value: "0", label: "Offseason" },
      ...Array.from({ length: 12 }, (_, i) => ({
          value: String(i + 1),
          label: `War ${i + 1}`,
      }))
  ], []);

  const tierOptions = useMemo(() => 
      Array.from({ length: 22 }, (_, i) => ({
          value: String(i + 1),
          label: `Tier ${i + 1}`,
      }))
  , []);

  // Ref for champions to access in effect without dependency
  const championsRef = useRef(champions);
  useEffect(() => {
    championsRef.current = champions;
  }, [champions]);

  // Effect to update URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    // Map
    if (mapType) params.set("map", mapType);
    
    // Champions
    const attackerName = championsRef.current.find(c => String(c.id) === attackerId)?.name;
    const defenderName = championsRef.current.find(c => String(c.id) === defenderId)?.name;
    if (attackerName) params.set("attacker", attackerName);
    if (defenderName) params.set("defender", defenderName);
    
    // Node
    if (debouncedNode) params.set("node", debouncedNode);
    
    // Video
    if (hasVideo) params.set("hasVideo", "true");
    
    // Advanced
    selectedSeasons.forEach(s => params.append("season", s.toString()));
    if (war) params.set("war", war);
    if (tier) params.set("tier", tier);
    if (player) params.set("player", player);
    if (alliance) params.set("alliance", alliance);
    if (debouncedBattlegroup) params.set("battlegroup", debouncedBattlegroup);

    const newQueryString = params.toString();
    const currentQueryString = searchParams.toString();

    // Only push if changed to prevent loops
    if (newQueryString !== currentQueryString) {
        startTransition(() => {
            router.push(`/war-videos?${newQueryString}`, { scroll: false });
        });
    }
  }, [
    mapType, 
    attackerId, 
    defenderId, 
    debouncedNode, 
    hasVideo, 
    selectedSeasons, 
    war, 
    tier, 
    player, 
    alliance, 
    debouncedBattlegroup,
    // Router and SearchParams are stable or handled by the check
    searchParams
  ]);

  const activeAdvancedCount = [
      selectedSeasons.length > 0,
      war,
      tier,
      player,
      alliance,
      debouncedBattlegroup
  ].filter(Boolean).length;

  // Active Filter Chips
  const activeFilters = useMemo(() => {
    const filters = [];
    if (selectedSeasons.length > 0) {
        selectedSeasons.forEach(s => {
            filters.push({ id: `season-${s}`, label: `Season ${s}`, onRemove: () => setSelectedSeasons(prev => prev.filter(i => i !== s)) });
        });
    }
    if (war) filters.push({ id: 'war', label: `War ${war}`, onRemove: () => setWar("") });
    if (tier) filters.push({ id: 'tier', label: `Tier ${tier}`, onRemove: () => setTier("") });
    if (player) filters.push({ id: 'player', label: `Player: ${player}`, onRemove: () => setPlayer("") });
    if (alliance) filters.push({ id: 'alliance', label: `Alliance: ${alliance}`, onRemove: () => setAlliance("") });
    if (battlegroup) filters.push({ id: 'battlegroup', label: `BG ${battlegroup}`, onRemove: () => setBattlegroup("") });
    
    return filters;
  }, [selectedSeasons, war, tier, player, alliance, battlegroup]);


  return (
    <div className="flex flex-col gap-2 w-full max-w-[1600px] mx-auto">
        {/* Main Active Toolbar */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 p-2 bg-slate-900/60 backdrop-blur-md border border-slate-800 rounded-xl shadow-sm">
            
            {/* Top Row / Left Side: Map & Node */}
            <div className="flex items-center gap-1 w-full lg:w-auto">
                <FlipToggle 
                    value={mapType === "BIG_THING"}
                    onChange={(v) => setMapType(v ? "BIG_THING" : "STANDARD")}
                    leftLabel="Standard"
                    rightLabel="Big Thing"
                    className="h-10 w-36 shrink-0"
                />
                
                <div className="relative w-20 lg:w-24 shrink-0">
                    <Input 
                        placeholder="#" 
                        value={node}
                        onChange={e => setNode(e.target.value)}
                        className="h-10 bg-slate-950/50 border-slate-800 text-center font-mono placeholder:text-slate-600 pl-8"
                    />
                     <span className="absolute top-1/2 left-2 -translate-y-1/2 text-[9px] font-bold text-slate-500 pointer-events-none uppercase tracking-wider">
                        NODE
                    </span>
                </div>

                 <Button
                    variant={hasVideo ? "default" : "outline"}
                    size="icon"
                    onClick={() => setHasVideo(!hasVideo)}
                    className={cn(
                        "h-10 w-10 shrink-0 lg:order-last",
                        hasVideo ? "bg-red-600 hover:bg-red-700 text-white border-red-500" : "bg-slate-950/50 border-slate-800 text-slate-400 hover:text-white"
                    )}
                    title="Toggle Video Only"
                >
                    <Video className={cn("h-4 w-4", hasVideo && "fill-current")} />
                </Button>
            </div>

            {/* Middle: Champions */}
             <div className="flex flex-1 items-center gap-2 w-full">
                <div className="flex-1 min-w-[140px]">
                    <ChampionCombobox 
                        champions={champions}
                        value={attackerId}
                        onSelect={setAttackerId}
                        placeholder="Attacker..."
                        className="h-10 bg-slate-950/50 border-slate-800 w-full rounded-full"
                    />
                </div>
                 
                 <span className="text-slate-600 font-bold text-xs">VS</span>

                <div className="flex-1 min-w-[140px]">
                    <ChampionCombobox 
                        champions={champions}
                        value={defenderId}
                        onSelect={setDefenderId}
                        placeholder="Defender..."
                        className="h-10 bg-slate-950/50 border-slate-800 w-full rounded-full"
                    />
                </div>
            </div>

             {/* Right: Expand & Clear */}
            <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
               
                 {/* Clear Filters (Only show if any filter is active) */}
                 {(attackerId || defenderId || node || hasVideo || activeAdvancedCount > 0) && (
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                            setAttackerId("");
                            setDefenderId("");
                            setNode("");
                            setHasVideo(false);
                            setMapType("STANDARD");
                            // Reset Advanced
                            setSelectedSeasons([]);
                            setWar("");
                            setTier("");
                            setPlayer("");
                            setAlliance("");
                            setBattlegroup("");
                        }}
                        className="h-10 px-2 text-slate-400 hover:text-red-400"
                     >
                        <X className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Clear</span>
                     </Button>
                 )}

                <Button
                    variant={showAdvanced || activeAdvancedCount > 0 ? "secondary" : "ghost"}
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={cn(
                        "h-10 gap-2 min-w-[100px] transition-all",
                        activeAdvancedCount > 0 
                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 hover:text-purple-300" 
                            : showAdvanced 
                                ? "bg-sky-500/10 text-sky-400 border border-sky-500/20" 
                                : "text-slate-400 hover:text-white"
                    )}
                >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {activeAdvancedCount > 0 && (
                        <Badge variant="secondary" className="h-5 px-1.5 min-w-[1.25rem] bg-purple-500/20 text-purple-300 border-0 pointer-events-none">
                            {activeAdvancedCount}
                        </Badge>
                    )}
                    {showAdvanced ? <ChevronUp className="h-3 w-3 ml-auto" /> : <ChevronDown className="h-3 w-3 ml-auto" />}
                </Button>
            </div>
        </div>
        
        {/* Active Filters List */}
        {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 px-1">
                {activeFilters.map(filter => (
                    <Badge 
                        key={filter.id} 
                        variant="secondary" 
                        className="bg-slate-900/40 border border-slate-800 hover:bg-slate-800 pl-2 pr-1 py-1 gap-1 text-slate-300 font-normal transition-colors"
                    >
                        {filter.label}
                        <div 
                            role="button" 
                            onClick={filter.onRemove}
                            className="p-0.5 rounded-full hover:bg-slate-700 hover:text-white cursor-pointer"
                        >
                            <X className="h-3 w-3" />
                        </div>
                    </Badge>
                ))}
            </div>
        )}

        {/* Secondary / Advanced Filters */}
        {showAdvanced && (
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 p-4 bg-slate-900/90 border border-slate-800 rounded-xl shadow-lg animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <div className="h-5 flex items-center">
                        <Label className={cn("text-[10px] font-medium uppercase tracking-wider transition-colors", selectedSeasons.length > 0 ? "text-purple-400" : "text-slate-500")}>Seasons</Label>
                    </div>
                    <SeasonMultiSelect 
                        seasons={availableSeasons}
                        selected={selectedSeasons}
                        onChange={setSelectedSeasons}
                        className="h-9 bg-slate-950/60 border-slate-800"
                    />
                </div>
                <div className="space-y-1.5">
                    <div className="h-5 flex items-center">
                        <Label className={cn("text-[10px] font-medium uppercase tracking-wider transition-colors", war ? "text-purple-400" : "text-slate-500")}>War #</Label>
                    </div>
                    <MemoizedSelect
                        value={war}
                        onValueChange={setWar}
                        options={warOptions}
                        placeholder="Any"
                        className="h-9 bg-slate-950/60 border-slate-800"
                        contentClassName="max-h-60"
                    />
                </div>
                <div className="space-y-1.5">
                    <div className="h-5 flex items-center">
                        <Label className={cn("text-[10px] font-medium uppercase tracking-wider transition-colors", tier ? "text-purple-400" : "text-slate-500")}>Tier</Label>
                    </div>
                    <MemoizedSelect
                        value={tier}
                        onValueChange={setTier}
                        options={tierOptions}
                        placeholder="Any"
                        className="h-9 bg-slate-950/60 border-slate-800"
                        contentClassName="max-h-60"
                    />
                </div>
                 <div className="space-y-1.5">
                    <div className="flex justify-between items-center h-5">
                        <Label className={cn("text-[10px] font-medium uppercase tracking-wider transition-colors", player ? "text-purple-400" : "text-slate-500")}>Player</Label>
                        {currentUser && (
                            <Button 
                                variant={player === currentUser.ingameName ? "secondary" : "ghost"}
                                size="sm" 
                                className="h-4 px-1.5 text-[9px]"
                                onClick={() => setPlayer(player === currentUser.ingameName ? "" : currentUser.ingameName || "")}
                            >
                                <User className="h-2.5 w-2.5 mr-1" /> Me
                            </Button>
                        )}
                    </div>
                    <AsyncPlayerCombobox
                        value={player}
                        onSelect={setPlayer}
                        className="h-9 bg-slate-950/60 border-slate-800"
                    />
                </div>
                 <div className="space-y-1.5">
                    <div className="flex justify-between items-center h-5">
                        <Label className={cn("text-[10px] font-medium uppercase tracking-wider transition-colors", alliance ? "text-purple-400" : "text-slate-500")}>Alliance</Label>
                        {currentUser?.alliance && (
                            <Button 
                                variant={alliance === currentUser.alliance.name ? "secondary" : "ghost"}
                                size="sm" 
                                className="h-4 px-1.5 text-[9px]"
                                onClick={() => setAlliance(alliance === currentUser.alliance!.name ? "" : currentUser.alliance!.name)}
                            >
                                <Shield className="h-2.5 w-2.5 mr-1" /> My Ally
                            </Button>
                        )}
                    </div>
                    <AsyncAllianceCombobox
                        value={alliance}
                        onSelect={setAlliance}
                        className="h-9 bg-slate-950/60 border-slate-800"
                    />
                </div>
                 <div className="space-y-1.5">
                    <div className="h-5 flex items-center">
                        <Label className={cn("text-[10px] font-medium uppercase tracking-wider transition-colors", battlegroup ? "text-purple-400" : "text-slate-500")}>Battlegroup</Label>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950/60 border border-slate-800 rounded-md p-1 h-9">
                        {[1, 2, 3].map((bg) => (
                            <button
                                key={bg}
                                onClick={() => setBattlegroup(battlegroup === bg.toString() ? "" : bg.toString())}
                                className={cn(
                                    "flex-1 h-full rounded text-xs font-medium transition-colors hover:bg-slate-800",
                                    battlegroup === bg.toString() 
                                        ? "bg-sky-600 text-white shadow-sm" 
                                        : "text-slate-400"
                                )}
                            >
                                {bg}
                            </button>
                        ))}
                    </div>
                </div>
             </div>
        )}
    </div>
  );
}