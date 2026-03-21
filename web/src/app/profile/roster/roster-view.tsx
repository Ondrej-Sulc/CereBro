"use client";

import { useState, useMemo, forwardRef, HTMLAttributes, useCallback, useEffect, useTransition, useRef } from "react";
import { ChampionClass } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { VirtuosoGrid } from "react-virtuoso";
import { Champion } from "@/types/champion";
import Link from "next/link";
import { Upload, TrendingUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Player, Alliance } from "@prisma/client";

// Local imports
import { ProfileRosterEntry, Recommendation, SigRecommendation, PrestigePoint } from "./types";
import { ChampionCard } from "./components/champion-card";
import { RosterFilters } from "./components/roster-filters";
import { RosterInsights } from "./components/roster-insights";
import { EditChampionModal } from "./components/modals/edit-champion-modal";
import { AddChampionModal } from "./components/modals/add-champion-modal";
import { PrestigeChartModal } from "./components/modals/prestige-chart-modal";
import { useDeepMemo } from "@/hooks/use-deep-memo";
import { switchProfile } from "../actions";

function buildRosterQueryParams(params: {
  simulationTargetRank: number;
  initialSigBudget?: number;
  initialRankClassFilter: ChampionClass[];
  initialSigClassFilter: ChampionClass[];
  initialRankSagaFilter: boolean;
  initialSigSagaFilter: boolean;
  sigAwakenedOnly: boolean;
  limit?: number;
}) {
  const searchParams = new URLSearchParams();
  if (params.simulationTargetRank) searchParams.set("targetRank", params.simulationTargetRank.toString());
  if (params.initialSigBudget) searchParams.set("sigBudget", params.initialSigBudget.toString());
  if (params.initialRankClassFilter.length) searchParams.set("rankClassFilter", params.initialRankClassFilter.join(','));
  if (params.initialSigClassFilter.length) searchParams.set("sigClassFilter", params.initialSigClassFilter.join(','));
  if (params.initialRankSagaFilter) searchParams.set("rankSagaFilter", 'true');
  if (params.initialSigSagaFilter) searchParams.set("sigSagaFilter", 'true');
  if (params.sigAwakenedOnly) searchParams.set("sigAwakenedOnly", 'true');
  if (params.limit && params.limit !== 5) searchParams.set("limit", params.limit.toString());
  return searchParams.toString();
}

interface RosterViewProps {
  initialRoster: ProfileRosterEntry[];
  allChampions: Champion[];
  player: Player & { alliance: Alliance | null };
  profiles: (Player & { alliance: Alliance | null })[];
  top30Average: number;
  prestigeMap: Record<string, number>;
  recommendations?: Recommendation[];
  sigRecommendations?: SigRecommendation[];
  simulationTargetRank: number;
  initialSigBudget?: number;
  initialRankClassFilter: ChampionClass[];
  initialSigClassFilter: ChampionClass[];
  initialRankSagaFilter: boolean;
  initialSigSagaFilter: boolean;
  initialSigAwakenedOnly: boolean;
  initialTags: { id: string | number, name: string }[];
  initialAbilityCategories: { id: string | number, name: string }[];
  initialAbilities: { id: string | number, name: string }[];
  initialImmunities: { id: string | number, name: string }[];
  initialLimit: number;
  initialShowInsights?: boolean;
}

const GridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
  <div ref={ref} {...props} style={style} className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
    {children}
  </div>
));
GridList.displayName = "GridList";

interface ApiRosterResponse {
  prestigeMap: Record<string, number>;
  recommendations: Recommendation[];
  sigRecommendations: SigRecommendation[];
  top30Average: number;
}

export function RosterView({
  initialRoster, allChampions, player, profiles, top30Average: initialTop30Average, prestigeMap: initialPrestigeMap, recommendations: initialRecommendations, sigRecommendations: initialSigRecommendations,
  simulationTargetRank, initialSigBudget = 0, initialRankClassFilter, initialSigClassFilter,
  initialRankSagaFilter, initialSigSagaFilter, initialSigAwakenedOnly,
  initialTags, initialAbilityCategories, initialAbilities, initialImmunities, initialLimit,
  initialShowInsights = false
}: RosterViewProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [roster, setRoster] = useState<ProfileRosterEntry[]>(initialRoster);
  const [search, setSearch] = useState("");
  const [filterClasses, setFilterClasses] = useState<ChampionClass[]>([]);
  const [filterStars, setFilterStars] = useState<number[]>([]);
  const [filterRanks, setFilterRanks] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<"PRESTIGE" | "NAME">("PRESTIGE");
  const [showUnowned, setShowUnowned] = useState(false);
  const [editingItem, setEditingItem] = useState<ProfileRosterEntry | null>(null);
  const [showInsights, setShowInsights] = useState(initialShowInsights);
  const [sigBudget, setSigBudget] = useState(initialSigBudget);
  const [sigAwakenedOnly, setSigAwakenedOnly] = useState(initialSigAwakenedOnly);
  const [limit, setLimit] = useState<number>(initialLimit || 5);
  const [pendingSection, setPendingSection] = useState<'rank' | 'sig' | 'all' | null>(null);

  // Data State (Client-Side Fetching)
  const [clientPrestigeMap, setPrestigeMap] = useState<Record<string, number>>(initialPrestigeMap);
  const [clientRecommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations || []);
  const [clientSigRecommendations, setSigRecommendations] = useState<SigRecommendation[]>(initialSigRecommendations || []);
  const [clientTop30Average, setTop30Average] = useState(initialTop30Average);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(Object.keys(initialPrestigeMap).length === 0);
  const lastFetchedParams = useRef<string | null>(null);

  // Filter States
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [tagLogic, setTagLogic] = useState<'AND' | 'OR'>('AND');
  const [abilityCategoryFilter, setAbilityCategoryFilter] = useState<string[]>([]);
  const [abilityCategoryLogic, setAbilityCategoryLogic] = useState<'AND' | 'OR'>('OR');
  const [abilityFilter, setAbilityFilter] = useState<string[]>([]);
  const [abilityLogic, setAbilityLogic] = useState<'AND' | 'OR'>('AND');
  const [immunityFilter, setImmunityFilter] = useState<string[]>([]);
  const [immunityLogic, setImmunityLogic] = useState<'AND' | 'OR'>('AND');

  // Stabilize initial values to avoid unnecessary re-renders/effects
  const memoizedPrestigeMap = useDeepMemo(initialPrestigeMap);
  const memoizedRoster = useDeepMemo(initialRoster);
  const memoizedRankClassFilter = useDeepMemo(initialRankClassFilter);
  const memoizedSigClassFilter = useDeepMemo(initialSigClassFilter);

  const [rankUpClassFilter, setRankUpClassFilter] = useState<ChampionClass[]>(initialRankClassFilter);
  const [sigClassFilter, setSigClassFilter] = useState<ChampionClass[]>(initialSigClassFilter);
  const [rankUpSagaFilter, setRankUpSagaFilter] = useState<boolean>(initialRankSagaFilter);
  const [sigSagaFilter, setSigSagaFilter] = useState<boolean>(initialSigSagaFilter);

  // Sync state with props (for back/forward navigation or server-side updates)
  useEffect(() => { setRoster(memoizedRoster); }, [memoizedRoster]);
  useEffect(() => { setSigBudget(initialSigBudget); }, [initialSigBudget]);
  useEffect(() => { setLimit(initialLimit); }, [initialLimit]);
  useEffect(() => { setRankUpClassFilter(memoizedRankClassFilter); }, [memoizedRankClassFilter]);
  useEffect(() => { setSigClassFilter(memoizedSigClassFilter); }, [memoizedSigClassFilter]);
  useEffect(() => { setRankUpSagaFilter(initialRankSagaFilter); }, [initialRankSagaFilter]);
  useEffect(() => { setSigSagaFilter(initialSigSagaFilter); }, [initialSigSagaFilter]);
  useEffect(() => { setSigAwakenedOnly(initialSigAwakenedOnly); }, [initialSigAwakenedOnly]);
  useEffect(() => { setShowInsights(initialShowInsights); }, [initialShowInsights]);

  const currentParams = buildRosterQueryParams({
    simulationTargetRank, initialSigBudget, initialRankClassFilter, initialSigClassFilter, initialRankSagaFilter, initialSigSagaFilter, sigAwakenedOnly, limit: limit
  });

  const usePropsData = lastFetchedParams.current === currentParams || lastFetchedParams.current === null;
  const prestigeMap = usePropsData ? initialPrestigeMap : clientPrestigeMap;
  const recommendations = usePropsData ? (initialRecommendations || []) : clientRecommendations;
  const sigRecommendations = usePropsData ? (initialSigRecommendations || []) : clientSigRecommendations;
  const top30Average = usePropsData ? initialTop30Average : clientTop30Average;

  const triggerPrestigeUpdate = useCallback((val: number) => {
    if (val <= 0) return;
    
    // Check if we actually need to update to avoid redundant calls
    const currentStored = player.championPrestige || 0;
    if (Math.abs(val - currentStored) <= 1) return;

    fetch("/api/profile/roster/update-prestige", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ championPrestige: val }),
    }).catch(err => console.error("Failed to update prestige:", err));
  }, [player.championPrestige]);

  // Fetch Recommendations & Prestige
  useEffect(() => {

    if (lastFetchedParams.current === currentParams) {
      setIsLoadingRecommendations(false);
      setPendingSection(null);
      return;
    }

    // Skip initial fetch if we already have data from server
    if (lastFetchedParams.current === null && Object.keys(memoizedPrestigeMap).length > 0) {
      lastFetchedParams.current = currentParams;
      setIsLoadingRecommendations(false);
      setPendingSection(null);
      
      // Still trigger the update check for the initial server-provided data
      triggerPrestigeUpdate(initialTop30Average);
      return;
    }

    const controller = new AbortController();
    const fetchData = async () => {
      setIsLoadingRecommendations(true);
      setPendingSection('all');
      try {
        const res = await fetch(`/api/profile/roster/recommendations?${currentParams}`, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load recommendations");

        const data = await res.json() as ApiRosterResponse;
        setPrestigeMap(data.prestigeMap);
        setRecommendations(data.recommendations);
        setSigRecommendations(data.sigRecommendations);
        setTop30Average(data.top30Average);
        
        // Trigger background update of prestige in DB
        triggerPrestigeUpdate(data.top30Average);

        lastFetchedParams.current = currentParams;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error(error);
        toast({ title: "Warning", description: "Could not load prestige insights.", variant: "destructive" });
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingRecommendations(false);
          setPendingSection(null);
        }
      }
    };

    fetchData();
    return () => controller.abort();
  }, [currentParams, simulationTargetRank, initialSigBudget, initialRankClassFilter, initialSigClassFilter, initialRankSagaFilter, initialSigSagaFilter, initialLimit, toast, memoizedPrestigeMap]);

  const handleProfileSwitch = async (playerId: string) => {
    try {
      const response = await switchProfile(playerId);
      if (response.error) throw new Error(response.error);
      toast({ title: "Success", description: "Profile switched successfully" });
      startTransition(() => { router.refresh(); });
    } catch {
      toast({ title: "Error", description: "Failed to switch profile", variant: "destructive" });
    }
  };

  const updateUrlParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(updates).forEach(([key, value]) => { if (value) params.set(key, value); else params.delete(key); });
    startTransition(() => { router.push(`?${params.toString()}`); });
  }, [router]);

  const handleRankClassFilterChange = (classes: ChampionClass[]) => {
    setRankUpClassFilter(classes); setPendingSection('rank');
    updateUrlParams({ rankClassFilter: classes.length > 0 ? classes.join(',') : null });
  };

  const handleSigClassFilterChange = (classes: ChampionClass[]) => {
    setSigClassFilter(classes); setPendingSection('sig');
    updateUrlParams({ sigClassFilter: classes.length > 0 ? classes.join(',') : null });
  };

  const handleRankSagaFilterChange = (val: boolean) => {
    setRankUpSagaFilter(val); setPendingSection('rank');
    updateUrlParams({ rankSagaFilter: val ? 'true' : null });
  };

  const handleAddChampion = async () => {
    if (newChampion.championId === null) { toast({ title: "Error", description: "Please select a champion", variant: "destructive" }); return; }
    try {
      const response = await fetch("/api/profile/roster/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ championId: newChampion.championId, stars: newChampion.stars, rank: newChampion.rank, sigLevel: newChampion.sigLevel, isAwakened: newChampion.isAwakened, isAscended: newChampion.isAscended, ascensionLevel: newChampion.ascensionLevel }),
      });
      if (!response.ok) throw new Error("Failed to add champion");
      const addedItem = await response.json();
      setRoster(prev => {
        const filtered = prev.filter(p => !(p.championId === addedItem.championId && p.stars === addedItem.stars));
        return [...filtered, addedItem];
      });
      toast({ title: "Success", description: "Champion added to roster" });
      setIsAddingChampion(false);
      setNewChampion({ championId: null, stars: 6, rank: 1, sigLevel: 0, isAwakened: false, isAscended: false, ascensionLevel: 0 });
      setPendingSection('all');
      startTransition(() => { router.refresh(); });
    } catch {
      toast({ title: "Error", description: "Failed to add champion. It might already exist.", variant: "destructive" });
    }
  };

  const handleSigSagaFilterChange = (val: boolean) => {
    setSigSagaFilter(val); setPendingSection('sig');
    updateUrlParams({ sigSagaFilter: val ? 'true' : null });
  };

  const handleRecommendationClick = async (rec: SigRecommendation) => {
    setLoadingChart(true);
    try {
      const res = await fetch(`/api/profile/champion-prestige?championId=${rec.championId}&rarity=${rec.stars}&rank=${rec.rank}`);
      if (!res.ok) throw new Error("Failed to fetch prestige data");
      const data = await res.json();
      setChartData({ data, rec });
    } catch {
      toast({ title: "Error", description: "Could not load prestige curve", variant: "destructive" });
    } finally {
      setLoadingChart(false);
    }
  };

  const [isPending, startTransition] = useTransition();
  const [chartData, setChartData] = useState<{ data: PrestigePoint[], rec: SigRecommendation } | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [isAddingChampion, setIsAddingChampion] = useState(false);
  const [newChampion, setNewChampion] = useState<{
    championId: number | null;
    stars: number;
    rank: number;
    sigLevel: number;
    isAwakened: boolean;
    isAscended: boolean;
    ascensionLevel: number;
  }>({
    championId: null, stars: 6, rank: 1, sigLevel: 0, isAwakened: false, isAscended: false, ascensionLevel: 0,
  });



  useEffect(() => {
    const timer = setTimeout(() => {
      if (sigBudget !== initialSigBudget) {
        setPendingSection('sig');
        updateUrlParams({ sigBudget: sigBudget > 0 ? sigBudget.toString() : null });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [sigBudget, updateUrlParams, initialSigBudget]);

  const filteredRoster = useMemo(() => {
    let baseRoster = [...roster];

    if (showUnowned) {
      const ownedChampionIds = new Set(roster.map(r => r.championId));
      const unownedChampions = allChampions.filter(c => !ownedChampionIds.has(c.id));

      const unownedEntries: ProfileRosterEntry[] = unownedChampions.map(c => ({
        id: `unowned-${c.id}`,
        playerId: roster[0]?.playerId || '',
        championId: c.id,
        stars: 0,
        rank: 0,
        sigLevel: 0,
        isAwakened: false,
        isAscended: false,
        ascensionLevel: 0,
        powerRating: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        champion: c as unknown as ProfileRosterEntry['champion'],
        isUnowned: true
      }));

      baseRoster = [...baseRoster, ...unownedEntries];
    }

    const filtered = baseRoster.filter((item) => {
      const matchesSearch = item.champion.name.toLowerCase().includes(search.toLowerCase());
      const matchesClass = filterClasses.length === 0 || filterClasses.includes(item.champion.class);
      const matchesStars = filterStars.length === 0 || item.isUnowned || filterStars.includes(item.stars);
      const matchesRank = filterRanks.length === 0 || item.isUnowned || filterRanks.includes(item.rank);

      if (!matchesSearch || !matchesClass || !matchesStars || !matchesRank) return false;

      // Pre-compute sets once per item for performance
      const abilityEntries = (item.champion.abilities || []).filter(a => a.type === 'ABILITY');
      const immunityEntries = (item.champion.abilities || []).filter(a => a.type === 'IMMUNITY');
      const champTags = (item.champion.tags || []).map(t => t.name);

      if (tagFilter.length > 0) {
        if (tagLogic === 'AND') { if (!tagFilter.every(t => champTags.includes(t))) return false; }
        else { if (!tagFilter.some(t => champTags.includes(t))) return false; }
      }

      if (abilityCategoryFilter.length > 0) {
        const championCategories = new Set(abilityEntries.flatMap(a => a.ability.categories.map(c => c.name)));
        if (abilityCategoryLogic === 'AND') { if (!abilityCategoryFilter.every(c => championCategories.has(c))) return false; }
        else { if (!abilityCategoryFilter.some(c => championCategories.has(c))) return false; }
      }

      if (abilityFilter.length > 0) {
        const champAbilities = new Set(abilityEntries.map(a => a.ability.name));
        if (abilityLogic === 'AND') { if (!abilityFilter.every(req => champAbilities.has(req))) return false; }
        else { if (!abilityFilter.some(req => champAbilities.has(req))) return false; }
      }

      if (immunityFilter.length > 0) {
        const champImmunities = new Set(immunityEntries.map(a => a.ability.name));
        if (immunityLogic === 'AND') { if (!immunityFilter.every(req => champImmunities.has(req))) return false; }
        else { if (!immunityFilter.some(req => champImmunities.has(req))) return false; }
      }

      return true;
    });

    return filtered.sort((a, b) => {
      if (sortBy === "NAME") return a.champion.name.localeCompare(b.champion.name);
      const prestigeA = prestigeMap[a.id] || 0;
      const prestigeB = prestigeMap[b.id] || 0;
      if (prestigeA !== prestigeB) return prestigeB - prestigeA;
      return a.champion.name.localeCompare(b.champion.name);
    });
  }, [roster, search, filterClasses, filterStars, filterRanks, sortBy, prestigeMap, tagFilter, tagLogic, abilityCategoryFilter, abilityCategoryLogic, abilityFilter, abilityLogic, immunityFilter, immunityLogic, showUnowned, allChampions]);

  const handleUpdate = async (updatedData: Partial<ProfileRosterEntry> & { id: string }) => {
    try {
      const response = await fetch("/api/profile/roster/manage", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });
      if (!response.ok) throw new Error("Failed to update");
      const updatedItem = await response.json();
      setRoster(prev => prev.map(item => item.id === updatedData.id ? { ...item, ...updatedItem } : item));
      toast({ title: "Success", description: "Champion updated" });
      setEditingItem(null);
      setPendingSection('all');
      startTransition(() => { router.refresh(); });
    } catch {
      toast({ title: "Error", description: "Failed to update champion", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to remove this champion from your roster?")) return;
    try {
      const response = await fetch("/api/profile/roster/manage", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Failed to delete");
      setRoster(prev => prev.filter(item => item.id !== id));
      toast({ title: "Success", description: "Champion removed" });
      setEditingItem(null);
      setPendingSection('all');
      startTransition(() => { router.refresh(); });
    } catch {
      toast({ title: "Error", description: "Failed to remove champion", variant: "destructive" });
    }
  };

  const itemContent = useCallback((index: number) => {
    const item = filteredRoster[index];
    return (
      <ChampionCard
        item={item} prestige={prestigeMap[item.id]} onClick={setEditingItem} mode={viewMode}
        filters={{ tags: tagFilter, categories: abilityCategoryFilter, abilities: abilityFilter, immunities: immunityFilter }}
      />
    );
  }, [filteredRoster, prestigeMap, viewMode, tagFilter, abilityCategoryFilter, abilityFilter, immunityFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white tracking-tight">
              {player.ingameName}'s Roster
            </h1>
            {profiles.length > 1 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 gap-1 bg-slate-900 border-slate-700">
                    Switch Profile
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 bg-slate-900 border-slate-800 text-slate-200">
                  {profiles.map((p) => (
                    <DropdownMenuItem
                      key={p.id}
                      onClick={() => handleProfileSwitch(p.id)}
                      className={cn("cursor-pointer focus:bg-slate-800", p.id === player.id && "bg-slate-800/50")}
                    >
                      <div className="flex flex-col">
                        <span className={cn("font-medium", p.id === player.id ? "text-white" : "text-slate-300")}>
                          {p.ingameName}
                        </span>
                        {p.alliance && (
                          <span className="text-xs text-slate-500">[{p.alliance.name}]</span>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <p className="text-slate-400 mt-1">
            Manage your champions, update stats, and track your progress.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {top30Average > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/20 border border-amber-900/40 rounded-lg shadow-inner h-10">
              <span className="text-amber-500/80 text-[10px] font-bold uppercase tracking-wider">Top 30 Prestige</span>
              <span className="text-amber-100 font-mono font-bold text-lg">{top30Average.toLocaleString('en-US')}</span>
            </div>
          )}

          <Button
            variant="outline"
            onClick={() => {
              const newValue = !showInsights;
              setShowInsights(newValue);
              updateUrlParams({ insights: newValue ? 'true' : null });
            }}
            className={cn(
              "h-10 px-4 gap-2 border-slate-700 transition-all",
              showInsights ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-700" : "bg-slate-900 text-slate-400 hover:text-slate-200"
            )}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Prestige Insights</span>
          </Button>

          <Button asChild className="w-full md:w-auto bg-sky-600 hover:bg-sky-700 text-white shadow-lg shadow-sky-900/20 flex items-center gap-2 h-10">
            <Link href="/profile/update">
              <Upload className="w-4 h-4" />
              Update Roster
            </Link>
          </Button>
        </div>
      </div>

      <RosterInsights
        showInsights={showInsights}
        recommendations={recommendations} sigRecommendations={sigRecommendations}
        simulationTargetRank={simulationTargetRank} onTargetRankChange={(val) => updateUrlParams({ targetRank: val })}
        sigBudget={sigBudget} onSigBudgetChange={setSigBudget}
        rankUpClassFilter={rankUpClassFilter} onRankUpClassFilterChange={handleRankClassFilterChange}
        sigClassFilter={sigClassFilter} onSigClassFilterChange={handleSigClassFilterChange}
        rankUpSagaFilter={rankUpSagaFilter} onRankUpSagaFilterChange={handleRankSagaFilterChange}
        sigSagaFilter={sigSagaFilter} onSigSagaFilterChange={handleSigSagaFilterChange}
        sigAwakenedOnly={sigAwakenedOnly} onSigAwakenedOnlyChange={(val) => { setSigAwakenedOnly(val); setPendingSection('sig'); updateUrlParams({ sigAwakenedOnly: val ? 'true' : null }); }}
        limit={limit} onLimitChange={(val) => { setLimit(val); updateUrlParams({ limit: val !== 5 ? val.toString() : null }); }}
        isPending={isLoadingRecommendations || isPending} pendingSection={pendingSection} onRecommendationClick={handleRecommendationClick}
      />

      <RosterFilters
        search={search} onSearchChange={setSearch} viewMode={viewMode} onViewModeChange={setViewMode}
        showUnowned={showUnowned} onShowUnownedChange={setShowUnowned}
        onAddClick={() => setIsAddingChampion(true)}
        sortBy={sortBy} onSortByChange={setSortBy} filterStars={filterStars} onFilterStarsChange={setFilterStars}
        filterRanks={filterRanks} onFilterRanksChange={setFilterRanks} filterClasses={filterClasses} onFilterClassesChange={setFilterClasses}
        tagFilter={tagFilter} onTagFilterChange={setTagFilter} tagLogic={tagLogic} onTagLogicChange={setTagLogic}
        abilityCategoryFilter={abilityCategoryFilter} onAbilityCategoryFilterChange={setAbilityCategoryFilter} abilityCategoryLogic={abilityCategoryLogic} onAbilityCategoryLogicChange={setAbilityCategoryLogic}
        abilityFilter={abilityFilter} onAbilityFilterChange={setAbilityFilter} abilityLogic={abilityLogic} onAbilityLogicChange={setAbilityLogic}
        immunityFilter={immunityFilter} onImmunityFilterChange={setImmunityFilter} immunityLogic={immunityLogic} onImmunityLogicChange={setImmunityLogic}
        initialTags={initialTags} initialAbilityCategories={initialAbilityCategories} initialAbilities={initialAbilities} initialImmunities={initialImmunities}
      />

      {filteredRoster.length === 0 ? (
        <div className="text-center py-12 text-slate-500 bg-slate-900/20 rounded-lg border border-slate-800 border-dashed">
          <p>No champions found matching your criteria.</p>
        </div>
      ) : (
        <VirtuosoGrid useWindowScroll totalCount={filteredRoster.length} overscan={600} computeItemKey={(index) => filteredRoster[index]?.id} components={{ List: GridList }} itemContent={itemContent} />
      )}

      <EditChampionModal item={editingItem} onClose={() => setEditingItem(null)} onUpdate={handleUpdate} onDelete={handleDelete} onItemChange={setEditingItem} />
      <AddChampionModal open={isAddingChampion} onOpenChange={setIsAddingChampion} allChampions={allChampions} onAdd={handleAddChampion} newChampion={newChampion} onNewChampionChange={setNewChampion} />
      <PrestigeChartModal chartData={chartData} loading={loadingChart} onClose={() => setChartData(null)} />
    </div>
  );
}
