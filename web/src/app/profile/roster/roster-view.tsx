"use client";

import { useState, useMemo, forwardRef, HTMLAttributes, useCallback, useEffect, useTransition } from "react";
import { ChampionClass } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { VirtuosoGrid } from "react-virtuoso";
import { Champion } from "@prisma/client";

// Local imports
import { ProfileRosterEntry, Recommendation, SigRecommendation, PrestigePoint } from "./types";
import { ChampionCard } from "./components/champion-card";
import { RosterFilters } from "./components/roster-filters";
import { RosterInsights } from "./components/roster-insights";
import { EditChampionModal } from "./components/modals/edit-champion-modal";
import { AddChampionModal } from "./components/modals/add-champion-modal";
import { PrestigeChartModal } from "./components/modals/prestige-chart-modal";

interface RosterViewProps {
  initialRoster: ProfileRosterEntry[];
  allChampions: Champion[];
  top30Average: number;
  prestigeMap: Record<string, number>;
  recommendations?: Recommendation[];
  sigRecommendations?: SigRecommendation[];
  simulationTargetRank: number;
  initialSigBudget?: number;
  initialRankClassFilter: ChampionClass[];
  initialSigClassFilter: ChampionClass[];
  initialTags: { id: string | number, name: string }[];
  initialAbilityCategories: { id: string | number, name: string }[];
  initialAbilities: { id: string | number, name: string }[];
  initialImmunities: { id: string | number, name: string }[];
}

const GridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
    <div ref={ref} {...props} style={style} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
        {children}
    </div>
));
GridList.displayName = "GridList";

export function RosterView({
    initialRoster, allChampions, top30Average, prestigeMap, recommendations, sigRecommendations,
    simulationTargetRank, initialSigBudget = 0, initialRankClassFilter, initialSigClassFilter,
    initialTags, initialAbilityCategories, initialAbilities, initialImmunities
}: RosterViewProps) {
  const [roster, setRoster] = useState<ProfileRosterEntry[]>(initialRoster);
  const [search, setSearch] = useState("");
  const [filterClasses, setFilterClasses] = useState<ChampionClass[]>([]);
  const [filterStars, setFilterStars] = useState<number[]>([]);
  const [filterRanks, setFilterRanks] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<"PRESTIGE" | "NAME">("PRESTIGE");
  const [editingItem, setEditingItem] = useState<ProfileRosterEntry | null>(null);
  const [showInsights, setShowInsights] = useState(true);
  const [sigBudget, setSigBudget] = useState(initialSigBudget);
  const [pendingSection, setPendingSection] = useState<'rank' | 'sig' | 'all' | null>(null);
  
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

  const [rankUpClassFilter, setRankUpClassFilter] = useState<ChampionClass[]>(initialRankClassFilter);
  const [sigClassFilter, setSigClassFilter] = useState<ChampionClass[]>(initialSigClassFilter);
  
  const [isPending, startTransition] = useTransition();
  const [chartData, setChartData] = useState<{data: PrestigePoint[], rec: SigRecommendation} | null>(null);
  const [loadingChart, setLoadingChart] = useState(false);
  const [isAddingChampion, setIsAddingChampion] = useState(false);
  const [newChampion, setNewChampion] = useState<{
      championId: number | null;
      stars: number;
      rank: number;
      sigLevel: number;
      isAwakened: boolean;
      isAscended: boolean;
  }>({
      championId: null, stars: 6, rank: 1, sigLevel: 0, isAwakened: false, isAscended: false,
  });

  const router = useRouter();
  const { toast } = useToast();

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

  const handleAddChampion = async () => {
      if (newChampion.championId === null) { toast({ title: "Error", description: "Please select a champion", variant: "destructive" }); return; }
      try {
        const response = await fetch("/api/profile/roster/add", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ championId: newChampion.championId, stars: newChampion.stars, rank: newChampion.rank, sigLevel: newChampion.sigLevel, isAwakened: newChampion.isAwakened, isAscended: newChampion.isAscended }),
        });
        if (!response.ok) throw new Error("Failed to add champion");
        toast({ title: "Success", description: "Champion added to roster" });
        setIsAddingChampion(false);
        setNewChampion({ championId: null, stars: 6, rank: 1, sigLevel: 0, isAwakened: false, isAscended: false });
        setPendingSection('all');
        startTransition(() => { router.refresh(); });
      } catch (error) {
          toast({ title: "Error", description: "Failed to add champion. It might already exist.", variant: "destructive" });
      }
  };

  const handleRecommendationClick = async (rec: SigRecommendation) => {
      setLoadingChart(true);
      try {
        const res = await fetch(`/api/profile/champion-prestige?championId=${rec.championId}&rarity=${rec.stars}&rank=${rec.rank}`);
        if (!res.ok) throw new Error("Failed to fetch prestige data");
        const data = await res.json();
        setChartData({ data, rec });
      } catch (error) {
        toast({ title: "Error", description: "Could not load prestige curve", variant: "destructive" });
      } finally {
        setLoadingChart(false);
      }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
        setPendingSection('sig');
        updateUrlParams({ sigBudget: sigBudget > 0 ? sigBudget.toString() : null });
    }, 500);
    return () => clearTimeout(timer);
  }, [sigBudget, updateUrlParams]);

  const filteredRoster = useMemo(() => {
    const filtered = roster.filter((item) => {
      const matchesSearch = item.champion.name.toLowerCase().includes(search.toLowerCase());
      const matchesClass = filterClasses.length === 0 || filterClasses.includes(item.champion.class);
      const matchesStars = filterStars.length === 0 || filterStars.includes(item.stars);
      const matchesRank = filterRanks.length === 0 || filterRanks.includes(item.rank);
      
      if (!matchesSearch || !matchesClass || !matchesStars || !matchesRank) return false;

      // Pre-compute sets once per item for performance
      const abilityEntries = item.champion.abilities.filter(a => a.type === 'ABILITY');
      const immunityEntries = item.champion.abilities.filter(a => a.type === 'IMMUNITY');
      const champTags = item.champion.tags.map(t => t.name);
      
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
  }, [roster, search, filterClasses, filterStars, filterRanks, sortBy, prestigeMap, tagFilter, tagLogic, abilityCategoryFilter, abilityCategoryLogic, abilityFilter, abilityLogic, immunityFilter, immunityLogic]);

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
    } catch (error) {
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
      } catch (error) {
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
      <RosterInsights 
        showInsights={showInsights} onToggleInsights={() => setShowInsights(!showInsights)}
        recommendations={recommendations} sigRecommendations={sigRecommendations}
        simulationTargetRank={simulationTargetRank} onTargetRankChange={(val) => updateUrlParams({ targetRank: val })}
        sigBudget={sigBudget} onSigBudgetChange={setSigBudget}
        rankUpClassFilter={rankUpClassFilter} onRankUpClassFilterChange={handleRankClassFilterChange}
        sigClassFilter={sigClassFilter} onSigClassFilterChange={handleSigClassFilterChange}
        isPending={isPending} pendingSection={pendingSection} onRecommendationClick={handleRecommendationClick}
      />

      <RosterFilters 
        search={search} onSearchChange={setSearch} viewMode={viewMode} onViewModeChange={setViewMode}
        onAddClick={() => setIsAddingChampion(true)} top30Average={top30Average}
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
