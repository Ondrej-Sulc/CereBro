"use client";

import { useState, useMemo, forwardRef, HTMLAttributes, useCallback, useEffect, useTransition, useRef, type ReactNode } from "react";
import { ChampionClass } from "@prisma/client";
import { useToast } from "@/hooks/use-toast";
import { ascensionEligibilityHref } from "@/lib/roster-ascension-filter";
import { useAscensionEligibilityFilter } from "@/hooks/use-ascension-eligibility-filter";
import { useChampionScopeFilter } from "@/hooks/use-champion-scope-filter";
import { useQuestChampionFilter } from "@/hooks/use-quest-champion-filter";
import { describeQuestGateChampionFilter } from "@/lib/game-quests/gate-champion-filter";
import { championScopeHref, matchesChampionScope } from "@/lib/champion-catalog-scope";
import { useRouter } from "next/navigation";
import { VirtuosoGrid } from "react-virtuoso";
import { Champion } from "@/types/champion";
import { TrendingUp, Grid3X3, Swords } from "lucide-react";
import { cn } from "@/lib/utils";
import { Player, Alliance } from "@prisma/client";
import { CollectionHeading, useCollectionState, useIsCollectionScreen } from "@/components/collections/collection-navigation";

// Local imports
import { ProfileRosterEntry, Recommendation, SigRecommendation, PotentialRecommendation, PrestigePoint, PrestigeInsightTab, RosterSortField, SortDirection } from "./types";
import {
  defaultGlobalPrestigeRank,
  maxRankForGlobalPrestigeRarity,
  normalizeGlobalPrestigeListOptionValues,
  type GlobalPrestigeListOptions,
} from "@/lib/global-prestige-list";
import { ChampionCard } from "./components/champion-card";
import { QuickChampionDialog } from "./components/quick-champion-dialog";
import { RosterFilters } from "./components/roster-filters";
import { RosterInsights } from "./components/roster-insights";
import { RosterProfileHeader } from "./components/roster-profile-header";
import { EditChampionModal } from "./components/modals/edit-champion-modal";
import { AddChampionModal } from "./components/modals/add-champion-modal";
import { PrestigeChartModal } from "./components/modals/prestige-chart-modal";
import { useDeepMemo } from "@/hooks/use-deep-memo";
import { switchProfile } from "../actions";
import { reportClientError } from "@/lib/observability/client";
import { loadRosterAddDefaults, normalizeRosterAddDefaults, saveRosterAddDefaults } from "@/lib/roster-add-defaults";
import { createRosterFilterIndex, filterRosterWithFacets } from "@/lib/roster-filtering";
import type { RosterEffectOption, ProtectionOption } from "@/lib/roster-kit-options";
import type { EffectForm, EffectDirection } from "@cerebro/core/domain/ability-source";
import { normalizeRosterAscensionState } from "@cerebro/core/domain/roster-ascension-state";

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

function getRosterSortName(item: ProfileRosterEntry) {
  return item.champion.name;
}

function getRosterSortReleaseTime(item: ProfileRosterEntry) {
  const value = item.champion.releaseDate;
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getRosterSortPrestige(
  item: ProfileRosterEntry,
  prestigeMap: Record<string, number>,
  catalogPrestigeByChampionId: Record<number, number>
) {
  if (item.isUnowned) return catalogPrestigeByChampionId[item.championId] ?? 0;
  return prestigeMap[item.id] ?? 0;
}

function compareRosterEntries(
  a: ProfileRosterEntry,
  b: ProfileRosterEntry,
  field: RosterSortField,
  direction: SortDirection,
  maps: {
    prestigeMap: Record<string, number>;
    catalogPrestigeByChampionId: Record<number, number>;
  }
) {
  const nameTieBreak = getRosterSortName(a).localeCompare(getRosterSortName(b));

  if (field === "NAME") {
    const nameCompare = getRosterSortName(a).localeCompare(getRosterSortName(b));
    return direction === "ASC" ? nameCompare : -nameCompare;
  }

  if (field === "RELEASE_DATE") {
    const releaseA = getRosterSortReleaseTime(a);
    const releaseB = getRosterSortReleaseTime(b);
    if (releaseA == null && releaseB == null) return nameTieBreak;
    if (releaseA == null) return 1;
    if (releaseB == null) return -1;
    if (releaseA !== releaseB) {
      return direction === "ASC" ? releaseA - releaseB : releaseB - releaseA;
    }
    return nameTieBreak;
  }

  const prestigeA = getRosterSortPrestige(a, maps.prestigeMap, maps.catalogPrestigeByChampionId);
  const prestigeB = getRosterSortPrestige(b, maps.prestigeMap, maps.catalogPrestigeByChampionId);
  if (prestigeA <= 0 && prestigeB <= 0) return nameTieBreak;
  if (prestigeA <= 0) return 1;
  if (prestigeB <= 0) return -1;
  if (prestigeA !== prestigeB) {
    return direction === "ASC" ? prestigeA - prestigeB : prestigeB - prestigeA;
  }
  return nameTieBreak;
}

interface RosterViewProps {
  variant?: "roster" | "champions";
  initialRoster: ProfileRosterEntry[];
  allChampions: Champion[];
  player?: (Player & { alliance: Alliance | null }) | null;
  profiles?: (Player & { alliance: Alliance | null })[];
  top30Average: number;
  top30Cutoff: number;
  prestigeMap: Record<string, number>;
  catalogPrestigeByChampionId?: Record<number, number>;
  recommendations?: Recommendation[];
  sigRecommendations?: SigRecommendation[];
  potentialRecommendations?: PotentialRecommendation[];
  simulationTargetRank: number;
  initialSigBudget?: number;
  initialRankClassFilter: ChampionClass[];
  initialSigClassFilter: ChampionClass[];
  initialRankSagaFilter: boolean;
  initialSigSagaFilter: boolean;
  initialSigAwakenedOnly: boolean;
  initialTags: { id: string | number, name: string }[];
  initialAbilityCategories: { id: string | number, name: string }[];
  initialAbilities: RosterEffectOption[];
  initialImmunities: ProtectionOption[];
  initialLimit: number;
  initialShowInsights?: boolean;
  initialInsightTab: PrestigeInsightTab;
  initialGlobalPrestigeOptions: GlobalPrestigeListOptions;
  /** When false, hides all edit/add controls. Default: true */
  canEdit?: boolean;
  /** When set, API mutations target this player instead of the session player */
  targetPlayerId?: string;
  /** When set, shows a Share button that copies this URL to the clipboard */
  shareUrl?: string;
  canManageAttackReservations?: boolean;
  profileTools?: ReactNode;
}

const GridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
  <div ref={ref} {...props} style={style} className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2">
    {children}
  </div>
));
GridList.displayName = "GridList";

const RosterGridList = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(({ style, children, ...props }, ref) => (
  <div ref={ref} {...props} style={style} className="grid grid-cols-3 min-[420px]:grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2.5">
    {children}
  </div>
));
RosterGridList.displayName = "RosterGridList";

interface ApiRosterResponse {
  prestigeMap: Record<string, number>;
  recommendations: Recommendation[];
  sigRecommendations: SigRecommendation[];
  potentialRecommendations: PotentialRecommendation[];
  top30Average: number;
  top30Cutoff: number;
}

export function RosterView({
  variant = "roster",
  initialRoster, allChampions, player = null, profiles = [], top30Average: initialTop30Average, prestigeMap: initialPrestigeMap, catalogPrestigeByChampionId = {}, recommendations: initialRecommendations, sigRecommendations: initialSigRecommendations, potentialRecommendations: initialPotentialRecommendations,
  simulationTargetRank, initialSigBudget = 0, initialRankClassFilter, initialSigClassFilter,
  initialRankSagaFilter, initialSigSagaFilter, initialSigAwakenedOnly,
  initialTags, initialAbilityCategories, initialAbilities, initialImmunities, initialLimit,
  initialShowInsights = false,
  initialInsightTab,
  initialGlobalPrestigeOptions,
  canEdit = true,
  targetPlayerId,
  shareUrl,
  canManageAttackReservations = false,
  profileTools,
}: RosterViewProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isChampionsCatalog = variant === "champions";
  const isCollectionScreen = useIsCollectionScreen();
  const enablePrestigeInsights = !isChampionsCatalog && !!player;
  const effectiveCanEdit = canEdit && !isChampionsCatalog && !!player;
  const effectiveCanManageAttackReservations = canManageAttackReservations && !isChampionsCatalog;

  const canonicalInitialRoster = useMemo(() => initialRoster.map(entry => ({ ...entry, ...normalizeRosterAscensionState(entry) })), [initialRoster]);
  const [roster, setRoster] = useState<ProfileRosterEntry[]>(canonicalInitialRoster);
  const [search, setSearch] = useCollectionState("search", "", true);
  const [filterClasses, setFilterClasses] = useCollectionState<ChampionClass[]>("classes", [], true);
  const [filterStars, setFilterStars] = useCollectionState<number[]>("stars", []);
  const [filterRanks, setFilterRanks] = useCollectionState<number[]>("ranks", []);
  const [filterAscensionLevels, setFilterAscensionLevels] = useCollectionState<number[]>("ascension", []);
  const [ascensionEligible, setAscensionEligible] = useAscensionEligibilityFilter();
  const [sortBy, setSortBy] = useCollectionState<RosterSortField>("sort", enablePrestigeInsights ? "PRESTIGE" : "NAME");
  const [sortDirection, setSortDirection] = useCollectionState<SortDirection>("direction", enablePrestigeInsights ? "DESC" : "ASC");
  const [showUnowned, setShowUnowned] = useCollectionState("unowned", true);
  const [championScope, setChampionScope] = useChampionScopeFilter();
  const playableChampions = useMemo(() => allChampions.filter(champion => matchesChampionScope(champion)), [allChampions]);
  const [editingItem, setEditingItem] = useState<ProfileRosterEntry | null>(null);
  const [quickItem, setQuickItem] = useState<ProfileRosterEntry | null>(null);
  const [showInsights, setShowInsights] = useState(enablePrestigeInsights ? initialShowInsights : false);
  const [sigBudget, setSigBudget] = useState(initialSigBudget);
  const [sigAwakenedOnly, setSigAwakenedOnly] = useState(initialSigAwakenedOnly);
  const [limit, setLimit] = useState<number>(initialLimit || 5);
  const [pendingSection, setPendingSection] = useState<'rank' | 'sig' | 'all' | null>(null);
  const [showAttackReservationControls, setShowAttackReservationControls] = useState(false);

  // Data State (Client-Side Fetching)
  const [clientPrestigeMap, setPrestigeMap] = useState<Record<string, number>>(initialPrestigeMap);
  const [clientRecommendations, setRecommendations] = useState<Recommendation[]>(initialRecommendations || []);
  const [clientSigRecommendations, setSigRecommendations] = useState<SigRecommendation[]>(initialSigRecommendations || []);
  const [clientPotentialRecommendations, setPotentialRecommendations] = useState<PotentialRecommendation[]>(initialPotentialRecommendations || []);
  const [clientTop30Average, setTop30Average] = useState(initialTop30Average);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(enablePrestigeInsights && Object.keys(initialPrestigeMap).length === 0);
  const lastFetchedParams = useRef<string | null>(null);

  // Filter States
  const [viewMode, setViewMode] = useCollectionState<'view' | 'edit'>('editMode', 'view');
  const [abilityCategoryFilter, setAbilityCategoryFilter] = useCollectionState<string[]>('categories', []);
  const [abilityCategoryLogic, setAbilityCategoryLogic] = useCollectionState<'AND' | 'OR'>('categoryLogic', 'OR');
  const [abilityFilter, setAbilityFilter] = useCollectionState<string[]>('abilities', []);
  const [abilityLogic, setAbilityLogic] = useCollectionState<'AND' | 'OR'>('abilityLogic', 'AND');
  const [effectForms, setEffectForms] = useCollectionState<EffectForm[]>('forms', []);
  const [effectDirections, setEffectDirections] = useCollectionState<EffectDirection[]>('directions', []);
  const [immunityFilter, setImmunityFilter] = useCollectionState<string[]>('immunities', []);
  const [includeResistances, setIncludeResistances] = useCollectionState('resistances', true);
  const [immunityLogic, setImmunityLogic] = useCollectionState<'AND' | 'OR'>('immunityLogic', 'AND');
  const [minResistancePotency, setMinResistancePotency] = useCollectionState<number | null>('minPotency', null);
  const resetForQuestGate = useCallback((unowned: boolean | undefined) => {
    setSearch(""); setFilterClasses([]); setFilterStars([]); setFilterRanks([]); setFilterAscensionLevels([]);
    setAscensionEligible(false); setChampionScope("playable");
    setAbilityCategoryFilter([]); setAbilityCategoryLogic("OR"); setAbilityFilter([]); setAbilityLogic("AND");
    setEffectForms([]); setEffectDirections([]); setImmunityFilter([]); setImmunityLogic("AND");
    setIncludeResistances(true); setMinResistancePotency(null); setShowInsights(false);
    // Guests requesting a personal view see catalog candidates plus the sign-in
    // prompt; the preserved personal URL retains its ownership choice after login.
    if (unowned !== undefined) setShowUnowned(isChampionsCatalog || unowned);
  }, [setSearch, setFilterClasses, setFilterStars, setFilterRanks, setFilterAscensionLevels, setAscensionEligible, setChampionScope,
    setAbilityCategoryFilter, setAbilityCategoryLogic, setAbilityFilter, setAbilityLogic, setEffectForms, setEffectDirections,
    setImmunityFilter, setImmunityLogic, setIncludeResistances, setMinResistancePotency, setShowUnowned, isChampionsCatalog]);
  const questChampionFilter = useQuestChampionFilter(initialTags, resetForQuestGate);
  const { tags: tagFilter, setTags: setTagFilter, tagLogic, setTagLogic, questGate } = questChampionFilter;

  // Stabilize initial values to avoid unnecessary re-renders/effects
  const memoizedPrestigeMap = useDeepMemo(initialPrestigeMap);
  const memoizedRoster = useDeepMemo(canonicalInitialRoster);
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
  useEffect(() => { setShowInsights(enablePrestigeInsights ? initialShowInsights : false); }, [enablePrestigeInsights, initialShowInsights]);

  const currentParams = buildRosterQueryParams({
    simulationTargetRank, initialSigBudget, initialRankClassFilter, initialSigClassFilter, initialRankSagaFilter, initialSigSagaFilter, sigAwakenedOnly, limit: limit
  });

  const usePropsData = lastFetchedParams.current === currentParams || lastFetchedParams.current === null;
  const prestigeMap = usePropsData ? initialPrestigeMap : clientPrestigeMap;
  const recommendations = usePropsData ? (initialRecommendations || []) : clientRecommendations;
  const sigRecommendations = usePropsData ? (initialSigRecommendations || []) : clientSigRecommendations;
  const potentialRecommendations = usePropsData ? (initialPotentialRecommendations || []) : clientPotentialRecommendations;
  const top30Average = usePropsData ? initialTop30Average : clientTop30Average;

  const triggerPrestigeUpdate = useCallback((val: number) => {
    if (!enablePrestigeInsights || !player) return;
    if (val <= 0) return;
    
    // Check if we actually need to update to avoid redundant calls
    const currentStored = player.championPrestige || 0;
    if (Math.abs(val - currentStored) <= 1) return;

    fetch("/api/profile/roster/update-prestige", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ championPrestige: val }),
    }).catch(err => reportClientError("profile_roster_update_prestige", err, {
      player_id: player.id,
    }));
  }, [enablePrestigeInsights, player]);

  // Fetch Recommendations & Prestige
  useEffect(() => {
    if (!enablePrestigeInsights) {
      setIsLoadingRecommendations(false);
      setPendingSection(null);
      return;
    }

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
        const url = `/api/profile/roster/recommendations?${currentParams}${targetPlayerId ? `&playerId=${targetPlayerId}` : ''}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to load recommendations");

        const data = await res.json() as ApiRosterResponse;
        setPrestigeMap(data.prestigeMap);
        setRecommendations(data.recommendations);
        setSigRecommendations(data.sigRecommendations);
        setPotentialRecommendations(data.potentialRecommendations);
        setTop30Average(data.top30Average);
        
        // Trigger background update of prestige in DB
        triggerPrestigeUpdate(data.top30Average);

        lastFetchedParams.current = currentParams;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        reportClientError("profile_roster_fetch_recommendations", error, {
          player_id: targetPlayerId ?? player?.id,
        });
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
  }, [currentParams, enablePrestigeInsights, initialTop30Average, player?.id, targetPlayerId, toast, memoizedPrestigeMap, triggerPrestigeUpdate]);

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
    if (!playableChampions.some(champion => champion.id === newChampion.championId)) { toast({ title: "Error", description: "Only playable champions can be added to a roster", variant: "destructive" }); return; }
    try {
      const response = await fetch("/api/profile/roster/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ championId: newChampion.championId, stars: newChampion.stars, rank: newChampion.rank, sigLevel: newChampion.sigLevel, isAwakened: newChampion.isAwakened, ...(newChampion.ascensionLevel > 0 || newChampion.isAscended ? normalizeRosterAscensionState(newChampion) : {}), ...(targetPlayerId ? { targetPlayerId } : {}) }),
      });
      if (!response.ok) throw new Error("Failed to add champion");
      const addedItem = await response.json();
      setRoster(prev => {
        const filtered = prev.filter(p => !(p.championId === addedItem.championId && p.stars === addedItem.stars));
        return [...filtered, addedItem];
      });
      toast({ title: "Success", description: "Champion added to roster" });
      setIsAddingChampion(false);
      setNewChampion(current => ({ ...normalizeRosterAddDefaults(current), championId: null, sigLevel: 0, isAwakened: false, isAscended: false, ascensionLevel: 0 }));
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

  const handleGlobalPrestigeOptionsChange = (nextOptions: GlobalPrestigeListOptions) => {
    const normalized = normalizeGlobalPrestigeListOptionValues(nextOptions, simulationTargetRank);
    const defaultRank = defaultGlobalPrestigeRank(normalized.rarity, simulationTargetRank);
    const updates: Record<string, string | null> = {
      globalRarity: normalized.rarity !== 7 ? String(normalized.rarity) : null,
      globalRank: normalized.rank !== defaultRank ? String(normalized.rank) : null,
      globalSig: normalized.sig !== 200 ? String(normalized.sig) : null,
      globalAscension: normalized.ascensionLevel !== 0 ? String(normalized.ascensionLevel) : null,
      globalClassFilter: normalized.classFilter.length > 0 ? normalized.classFilter.join(",") : null,
      globalOwnership: normalized.ownership !== "all" ? normalized.ownership : null,
      globalSaga: normalized.sagaOnly ? "true" : null,
      globalSearch: normalized.search ? normalized.search : null,
      globalLimit: normalized.limit !== 100 ? String(normalized.limit) : null,
    };

    updateUrlParams(updates);
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

  const handleOpenAddChampion = () => {
    const defaults = loadRosterAddDefaults(newChampion);
    setNewChampion(current => ({ ...current, ...defaults }));
    setIsAddingChampion(true);
  };

  const handleNewChampionChange = (next: typeof newChampion) => {
    const defaults = normalizeRosterAddDefaults(next);
    const identityChanged = next.championId !== newChampion.championId || defaults.stars !== newChampion.stars;
    setNewChampion({ ...next, ...defaults, ...normalizeRosterAscensionState(identityChanged ? {} : next) });
    if (defaults.stars !== newChampion.stars || defaults.rank !== newChampion.rank) {
      saveRosterAddDefaults(defaults);
    }
  };

  useEffect(() => {
    if (!enablePrestigeInsights) return;
    const timer = setTimeout(() => {
      if (sigBudget !== initialSigBudget) {
        setPendingSection('sig');
        updateUrlParams({ sigBudget: sigBudget > 0 ? sigBudget.toString() : null });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [enablePrestigeInsights, sigBudget, updateUrlParams, initialSigBudget]);

  const filterIndex = useMemo(() => createRosterFilterIndex(roster, allChampions), [roster, allChampions]);
  const { entries: matchingRoster, counts: facetCounts } = useMemo(() => filterRosterWithFacets(filterIndex, {
    search, classes: filterClasses, stars: filterStars, ranks: filterRanks, ascension: filterAscensionLevels, ascensionEligible, eligibilityIncludesUnowned: isChampionsCatalog,
    tags: tagFilter, tagLogic, questGate, abilities: abilityFilter, categories: abilityCategoryFilter,
    immunities: immunityFilter, includeResistances, abilityLogic, categoryLogic: abilityCategoryLogic,
    immunityLogic, effectForms, effectDirections, minResistancePotency, showUnowned, championScope,
  }), [filterIndex, isChampionsCatalog, search, filterClasses, filterStars, filterRanks, filterAscensionLevels, ascensionEligible, tagFilter, tagLogic, questGate,
    abilityFilter, abilityCategoryFilter, immunityFilter, includeResistances, abilityLogic, abilityCategoryLogic,
    immunityLogic, effectForms, effectDirections, minResistancePotency, showUnowned, championScope]);

  const filteredRoster = useMemo(() => [...matchingRoster].sort((a, b) => compareRosterEntries(a, b, sortBy, sortDirection, {
      prestigeMap,
      catalogPrestigeByChampionId,
    })), [matchingRoster, sortBy, sortDirection, prestigeMap, catalogPrestigeByChampionId]);

  const visibleChampionCount = filteredRoster.length;
  const totalChampionCount = isChampionsCatalog
    ? allChampions.filter(champion => matchesChampionScope(champion, championScope)).length
    : showUnowned
      ? filteredRoster.length
      : roster.filter(entry => matchesChampionScope(entry.champion, championScope)).length;

  const countLabel = isChampionsCatalog
    ? visibleChampionCount === totalChampionCount
      ? `${totalChampionCount.toLocaleString("en-US")} champions`
      : `Showing ${visibleChampionCount.toLocaleString("en-US")} of ${totalChampionCount.toLocaleString("en-US")}`
    : showUnowned
      ? `Showing ${visibleChampionCount.toLocaleString("en-US")} champions`
      : visibleChampionCount === totalChampionCount
        ? `Showing ${totalChampionCount.toLocaleString("en-US")} roster champions`
        : `Showing ${visibleChampionCount.toLocaleString("en-US")} of ${totalChampionCount.toLocaleString("en-US")}`;

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

  const handleToggleAttackReservation = useCallback(async (item: ProfileRosterEntry) => {
    if (item.isUnowned || item.champion.isPlayable === false) return;

    const nextReserved = !item.reservedForAttack;
    const previousRoster = roster;
    setRoster(prev => prev.map(entry => entry.id === item.id ? { ...entry, reservedForAttack: nextReserved } : entry));

    try {
      const response = await fetch("/api/profile/roster/reservation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rosterId: item.id, reservedForAttack: nextReserved }),
      });
      if (!response.ok) throw new Error("Failed to update attack reservation");
      const updatedItem = await response.json() as ProfileRosterEntry;
      setRoster(prev => prev.map(entry => entry.id === item.id ? { ...entry, reservedForAttack: updatedItem.reservedForAttack } : entry));
      toast({
        title: nextReserved ? "Reserved for attack" : "Attack reservation removed",
        description: `${item.champion.name} ${nextReserved ? "will warn defense planners." : "is available for defense planning."}`,
      });
    } catch {
      setRoster(previousRoster);
      toast({ title: "Error", description: "Failed to update attack reservation.", variant: "destructive" });
    }
  }, [roster, toast]);

  const itemContent = useCallback((index: number) => {
    const item = filteredRoster[index];
    return (
      <ChampionCard
        item={item} prestige={isChampionsCatalog ? undefined : prestigeMap[item.id]} onClick={effectiveCanEdit ? setEditingItem : () => {}} mode={effectiveCanEdit ? viewMode : 'view'}
        onQuickView={setQuickItem}
        catalogMode={isChampionsCatalog}
        canManageAttackReservations={effectiveCanManageAttackReservations && showAttackReservationControls}
        onToggleAttackReservation={handleToggleAttackReservation}
      />
    );
  }, [filteredRoster, prestigeMap, viewMode, effectiveCanEdit, isChampionsCatalog, effectiveCanManageAttackReservations, showAttackReservationControls, handleToggleAttackReservation]);

  const handleShareRoster = async () => {
    if (!shareUrl) return;
    try {
      const scopedUrl = new URL(championScopeHref(shareUrl, championScope), shareUrl).toString();
      await navigator.clipboard.writeText(ascensionEligibilityHref(scopedUrl, ascensionEligible));
      toast({ title: "Roster link copied" });
    } catch {
      toast({ title: "Couldn’t copy roster link", description: "Your browser did not allow clipboard access.", variant: "destructive" });
    }
  };

  return (
    <div className={enablePrestigeInsights ? "space-y-4 sm:space-y-5" : "space-y-6"}>
      {enablePrestigeInsights && player ? (
        <RosterProfileHeader
          player={player}
          personal={isCollectionScreen}
          profiles={targetPlayerId ? [] : profiles}
          showUpload={!targetPlayerId}
          top30={top30Average}
          owned={roster.length}
          sevenStar={roster.filter(entry => entry.stars === 7).length}
          onShare={shareUrl ? handleShareRoster : undefined}
          onProfileSwitch={handleProfileSwitch}
        />
      ) : (
        <header className="mb-2">
          <CollectionHeading fallback={<h1 className="text-[28px] font-bold tracking-tight text-white sm:text-3xl">Champions</h1>} />
          <p className="mt-3 text-slate-400">Browse all playable champions, filter by class, tags, abilities, and immunities.</p>
        </header>
      )}
      {profileTools}

      {enablePrestigeInsights && (
        <>
          <div className="flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <RosterModeSwitch
              activeMode={showInsights ? "prestige" : "roster"}
              onModeChange={(mode) => {
                const nextShowInsights = mode === "prestige";
                setShowInsights(nextShowInsights);
                updateUrlParams({ insights: nextShowInsights ? "true" : null });
              }}
              rosterCount={filteredRoster.length}
              prestigeCount={potentialRecommendations.length + recommendations.length + sigRecommendations.length}
            />
            {isCollectionScreen && <CollectionHeading compact />}
          </div>

          <RosterInsights
            showInsights={showInsights}
            recommendations={recommendations} sigRecommendations={sigRecommendations}
            potentialRecommendations={potentialRecommendations}
            initialInsightTab={initialInsightTab}
            onInsightTabChange={(tab) => updateUrlParams({ insightsTab: tab === 'potential' ? null : tab })}
            targetPlayerId={targetPlayerId}
            initialGlobalPrestigeOptions={initialGlobalPrestigeOptions}
            onGlobalPrestigeOptionsChange={handleGlobalPrestigeOptionsChange}
            globalDefaultTargetRank={simulationTargetRank}
            globalMaxRankForRarity={maxRankForGlobalPrestigeRarity}
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
        </>
      )}

      {!showInsights && (
        <>
          <RosterFilters
            championScope={championScope} onChampionScopeChange={setChampionScope}
            facetCounts={facetCounts}
            search={search} onSearchChange={setSearch} viewMode={viewMode} onViewModeChange={setViewMode}
            showUnowned={showUnowned} onShowUnownedChange={setShowUnowned}
            onAddClick={handleOpenAddChampion}
            sortBy={sortBy} onSortByChange={setSortBy} sortDirection={sortDirection} onSortDirectionChange={setSortDirection} filterStars={filterStars} onFilterStarsChange={setFilterStars}
            visibleChampionCount={visibleChampionCount}
            totalChampionCount={totalChampionCount}
            countLabel={countLabel}
            filterRanks={filterRanks} onFilterRanksChange={setFilterRanks} filterClasses={filterClasses} onFilterClassesChange={setFilterClasses}
            filterAscensionLevels={filterAscensionLevels} onFilterAscensionLevelsChange={setFilterAscensionLevels}
            ascensionEligible={ascensionEligible} onAscensionEligibleChange={setAscensionEligible}
            catalogEligibility={isChampionsCatalog}
            tagFilter={tagFilter} onTagFilterChange={setTagFilter} tagLogic={tagLogic} onTagLogicChange={setTagLogic}
            additionalRules={questGate ? [{ id: "quest-gate", label: describeQuestGateChampionFilter(questGate), remove: questChampionFilter.clearQuestGate }] : []}
            onClearAdditionalFilters={questChampionFilter.clear}
            abilityCategoryFilter={abilityCategoryFilter} onAbilityCategoryFilterChange={setAbilityCategoryFilter} abilityCategoryLogic={abilityCategoryLogic} onAbilityCategoryLogicChange={setAbilityCategoryLogic}
            abilityFilter={abilityFilter} onAbilityFilterChange={setAbilityFilter} abilityLogic={abilityLogic} onAbilityLogicChange={setAbilityLogic}
            effectForms={effectForms} onEffectFormsChange={setEffectForms} effectDirections={effectDirections} onEffectDirectionsChange={setEffectDirections}
            immunityFilter={immunityFilter} onImmunityFilterChange={setImmunityFilter} immunityLogic={immunityLogic} onImmunityLogicChange={setImmunityLogic}
            includeResistances={includeResistances} onIncludeResistancesChange={setIncludeResistances}
            minResistancePotency={minResistancePotency} onMinResistancePotencyChange={setMinResistancePotency}
            initialTags={initialTags} initialAbilityCategories={initialAbilityCategories} initialAbilities={initialAbilities} initialImmunities={initialImmunities}
            canEdit={effectiveCanEdit}
            canManageAttackReservations={effectiveCanManageAttackReservations}
            showAttackReservationControls={showAttackReservationControls}
            onShowAttackReservationControlsChange={setShowAttackReservationControls}
            showOwnershipFilter={!isChampionsCatalog}
            showRankFilter={!isChampionsCatalog}
            showAscensionFilter={!isChampionsCatalog}
            showPrestigeSort={true}
          />

          {effectiveCanManageAttackReservations && showAttackReservationControls && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-100 shadow-inner">
              <Swords className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p>
                Reserve champions you want kept available for Alliance War attack. Defense planners will be warned if they try to place a reserved champion on defense.
              </p>
            </div>
          )}

          {filteredRoster.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-900/20 rounded-lg border border-slate-800 border-dashed">
              <p>No champions found matching your criteria.</p>
            </div>
          ) : (
            <VirtuosoGrid useWindowScroll totalCount={filteredRoster.length} overscan={600} computeItemKey={(index) => filteredRoster[index]?.id} components={{ List: isChampionsCatalog ? GridList : RosterGridList }} itemContent={itemContent} />
          )}
        </>
      )}

      {quickItem && <QuickChampionDialog key={quickItem.id} item={quickItem} prestige={isChampionsCatalog ? undefined : prestigeMap[quickItem.id]} open onOpenChange={open => { if (!open) setQuickItem(null); }} filters={{ tags: tagFilter, categories: abilityCategoryFilter, abilities: abilityFilter, immunities: immunityFilter, includeResistances, effectForms, effectDirections, minResistancePotency }} showUnownedState={!!quickItem.isUnowned && !isChampionsCatalog} />}
      {effectiveCanEdit && editingItem?.champion.isPlayable !== false && <EditChampionModal item={editingItem} prestige={editingItem ? prestigeMap[editingItem.id] : undefined} onClose={() => setEditingItem(null)} onUpdate={handleUpdate} onDelete={handleDelete} onItemChange={setEditingItem} />}
      {effectiveCanEdit && <AddChampionModal open={isAddingChampion} onOpenChange={setIsAddingChampion} allChampions={playableChampions} onAdd={handleAddChampion} newChampion={newChampion} onNewChampionChange={handleNewChampionChange} />}
      <PrestigeChartModal chartData={chartData} loading={loadingChart} onClose={() => setChartData(null)} />
    </div>
  );
}

function RosterModeSwitch({
  activeMode,
  onModeChange,
  rosterCount,
  prestigeCount,
}: {
  activeMode: "roster" | "prestige";
  onModeChange: (mode: "roster" | "prestige") => void;
  rosterCount: number;
  prestigeCount: number;
}) {
  return (
    <div role="group" aria-label="Roster section" className="grid w-full grid-cols-2 gap-0.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1 sm:w-auto">
      <ModeSwitchPill
        active={activeMode === "roster"}
        icon={<Grid3X3 className="size-4 shrink-0" aria-hidden="true" />}
        title="Champions"
        count={rosterCount}
        onClick={() => onModeChange("roster")}
      />
      <ModeSwitchPill
        active={activeMode === "prestige"}
        icon={<TrendingUp className="size-4 shrink-0" aria-hidden="true" />}
        title="Prestige insights"
        count={prestigeCount}
        onClick={() => onModeChange("prestige")}
      />
    </div>
  );
}

function ModeSwitchPill({
  active,
  icon,
  title,
  count,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-h-10 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:gap-2 sm:px-3 sm:text-sm",
        active
          ? "bg-indigo-400/15 text-indigo-100"
          : "text-slate-300 hover:bg-slate-800 hover:text-white"
      )}
    >
      {icon}
      <span>{title}</span>
      {count > 0 && <span aria-hidden="true" className="hidden rounded-md bg-slate-800/90 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-300 sm:inline">{count.toLocaleString("en-US")}</span>}
    </button>
  );
}
