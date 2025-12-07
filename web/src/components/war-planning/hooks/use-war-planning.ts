import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { War, WarFight, WarStatus, WarTactic, ChampionClass, WarMapType, WarNode, WarNodeAllocation, NodeModifier } from "@prisma/client";
import { Champion } from "@/types/champion";
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { getActiveTactic, addExtraChampion, removeExtraChampion, getExtraChampions, addWarBan, removeWarBan } from "@/app/planning/actions";
import { FightWithNode, PlayerWithRoster, SeasonBanWithChampion, WarBanWithChampion } from "../types";
import { warNodesData } from "../nodes-data";

export type RightPanelState = 'closed' | 'tools' | 'editor' | 'roster';

export interface ExtraChampion {
  id: string;
  warId: string;
  playerId: string;
  championId: number;
  battlegroup: number;
  champion: { id: number; name: string; images: any };
}

interface OptimisticPrefight {
  id: number;
  name: string;
  images: any;
  class: ChampionClass;
  fightPrefightId: string;
  player: { id: string; ingameName: string; avatar: string | null } | null;
}

interface WarNodeWithAllocations extends WarNode {
    allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
}

interface UseWarPlanningProps {
  war: War;
  warId: string;
  champions: Champion[];
  players: PlayerWithRoster[];
  updateWarFight: (updatedFight: Partial<WarFight> & {
    prefightUpdates?: { championId: number; playerId?: string | null }[]
  }) => Promise<void>;
  updateWarStatus: (warId: string, status: WarStatus) => Promise<void>;
  seasonBans: SeasonBanWithChampion[];
  warBans: WarBanWithChampion[];
}

export function useWarPlanning({
  war,
  warId,
  champions,
  players,
  updateWarFight,
  updateWarStatus,
  seasonBans,
  warBans: initialWarBans,
}: UseWarPlanningProps) {
  const router = useRouter();

  // UI State
  const [rightPanelState, setRightPanelState] = useState<RightPanelState>('closed');
  const [activeTab, setActiveTab] = useState("bg1");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Selection State
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Data State
  const [currentFights, setCurrentFights] = useState<FightWithNode[]>([]);
  const [nodesMap, setNodesMap] = useState<Map<number, WarNodeWithAllocations>>(new Map());
  const currentFightsRef = useRef(currentFights);
  const pendingSaveNodeIds = useRef<Set<number>>(new Set());

  // Sync ref
  useEffect(() => {
    currentFightsRef.current = currentFights;
  }, [currentFights]);
  
  // Derived Selection
  const selectedFight = useMemo(() => {
    if (!selectedNodeId) return null;
    return currentFights.find(f => f.node.nodeNumber === selectedNodeId) || null;
  }, [currentFights, selectedNodeId]);

  const [extraChampions, setExtraChampions] = useState<ExtraChampion[]>([]);
  const [warBans, setWarBans] = useState<WarBanWithChampion[]>(initialWarBans);
  const [status, setStatus] = useState<WarStatus>(war.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [loadingFights, setLoadingFights] = useState(false);
  const [fightsError, setFightsError] = useState<string | null>(null);
  const [activeTactic, setActiveTactic] = useState<WarTactic | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // History State
  const [historyFilters, setHistoryFilters] = useState({
    onlyCurrentTier: true,
    onlyAlliance: true,
    minSeason: undefined as number | undefined,
  });
  const historyCache = useRef(new Map<string, HistoricalFightStat[]>());

  const currentBattlegroup = parseInt(activeTab.replace("bg", ""));

  // Fetch Active Tactic
  useEffect(() => {
    async function fetchTactic() {
      if (!war.season || !war.warTier) return;
      const tactic = await getActiveTactic(war.season, war.warTier);
      setActiveTactic(tactic);
    }
    fetchTactic();
  }, [war.season, war.warTier]);

  // Fetch Static Node Data ONCE
  useEffect(() => {
    async function fetchNodes() {
        try {
            const res = await fetch(`/api/war-planning/nodes?warId=${warId}`);
            if (res.ok) {
                const nodes: WarNodeWithAllocations[] = await res.json();
                const map = new Map(nodes.map(n => [n.nodeNumber, n]));
                setNodesMap(map);
            }
        } catch (e) {
            console.error("Failed to fetch node data", e);
        }
    }
    fetchNodes();
  }, [warId]);

  // Fetch Fights & Extras
  useEffect(() => {
    async function fetchData() {
      // Don't fetch fights until we have the nodes map to hydrate them
      if (nodesMap.size === 0) return;

      setLoadingFights(true);
      setFightsError(null);
      try {
        const [fightsRes, extrasData] = await Promise.all([
            fetch(`/api/war-planning/fights?warId=${warId}&battlegroup=${currentBattlegroup}`),
            getExtraChampions(warId, currentBattlegroup)
        ]);

        if (!fightsRes.ok) {
          throw new Error(`HTTP error! status: ${fightsRes.status}`);
        }
        const rawFights: any[] = await fightsRes.json();
        
        // Merge static node data into fights
        const hydratedFights: FightWithNode[] = rawFights.map(f => {
            const nodeData = nodesMap.get(f.node.nodeNumber);
            return {
                ...f,
                node: nodeData || { ...f.node, allocations: [] } // Fallback if missing (shouldn't happen)
            };
        });

        setCurrentFights(hydratedFights);
        setExtraChampions(extrasData);
      } catch (err: any) {
        console.error("Failed to fetch war data:", err);
        setFightsError(err.message || "Failed to load war data.");
      } finally {
        setLoadingFights(false);
      }
    }
    fetchData();
  }, [warId, currentBattlegroup, nodesMap]); // Added nodesMap dependency

  // Polling Logic
  useEffect(() => {
    if (nodesMap.size === 0) return;

    const pollInterval = setInterval(async () => {
        try {
            const [fightsRes, extrasData] = await Promise.all([
                fetch(`/api/war-planning/fights?warId=${warId}&battlegroup=${currentBattlegroup}`),
                getExtraChampions(warId, currentBattlegroup)
            ]);

            if (fightsRes.ok) {
                const rawFights: any[] = await fightsRes.json();
                
                 // Merge static node data into fights
                const newFights: FightWithNode[] = rawFights.map(f => {
                    const nodeData = nodesMap.get(f.node.nodeNumber);
                    return {
                        ...f,
                        node: nodeData || { ...f.node, allocations: [] }
                    };
                });
                
                // Merge Logic: Use currentFightsRef to check for changes and respect pending saves
                setCurrentFights(prev => {
                    const current = prev;
                    
                    // Map new fights, preserving optimistic updates for pending nodes
                    const mergedFights = newFights.map(newFight => {
                        const pending = pendingSaveNodeIds.current.has(newFight.node.nodeNumber);
                        if (pending) {
                            // Keep our local optimistic version if we are currently saving this node
                            return current.find(f => f.id === newFight.id) || newFight; 
                        }
                        return newFight;
                    });

                    // Check if anything actually changed vs current state
                    if (JSON.stringify(current) !== JSON.stringify(mergedFights)) {
                        return mergedFights;
                    }
                    return prev;
                });
            }
            
            // Sync extras (less critical race condition here usually)
            setExtraChampions(prev => {
                 if (JSON.stringify(prev) !== JSON.stringify(extrasData)) {
                     return extrasData;
                 }
                 return prev;
            });

        } catch (error) {
            console.error("Polling failed", error);
        }
    }, 5000);

    return () => clearInterval(pollInterval);
  }, [warId, currentBattlegroup, nodesMap]); // Added nodesMap dependency

  const validatePlayerAssignment = useCallback((playerId: string, newChampionId: number, nodeId: number) => {
    // 1. Check Bans
    const isSeasonBanned = seasonBans.some((b: SeasonBanWithChampion) => b.championId === newChampionId);
    if (isSeasonBanned) {
      return { isValid: false, error: "This champion is globally banned for this season." };
    }

    const isWarBanned = warBans.some((b: WarBanWithChampion) => b.championId === newChampionId);
    if (isWarBanned) {
      return { isValid: false, error: "This champion is banned for this war." };
    }

    // 2. Check Champion Limit (2 for Big Thing, 3 for Standard)
    const limit = war.mapType === WarMapType.BIG_THING ? 2 : 3;

    const playerFights = currentFights.filter((f: FightWithNode) => f.player?.id === playerId && f.node.nodeNumber !== nodeId);
    const usedChampionIds = new Set(playerFights.map((f: FightWithNode) => f.attacker?.id).filter((id: number | undefined | null) => id !== undefined && id !== null));

    // Also include prefight and extra champions for the limit
    currentFights.forEach((f: FightWithNode) => f.prefightChampions?.forEach((pf: NonNullable<FightWithNode['prefightChampions']>[number]) => {
      if (pf.player?.id === playerId) usedChampionIds.add(pf.id);
    }));
    extraChampions.forEach((ex: ExtraChampion) => {
      if (ex.playerId === playerId && ex.battlegroup === currentBattlegroup) usedChampionIds.add(ex.championId);
    });

    if (usedChampionIds.size >= limit && !usedChampionIds.has(newChampionId)) {
      return { isValid: false, error: `Player already has ${limit} unique champions assigned.` };
    }
    return { isValid: true };
  }, [currentFights, extraChampions, currentBattlegroup, seasonBans, warBans, war.mapType]);

  // Handlers
  const handleToggleStatus = useCallback(async () => {
    try {
      setIsUpdatingStatus(true);
      const newStatus = status === 'PLANNING' ? 'FINISHED' : 'PLANNING';
      await updateWarStatus(warId, newStatus);
      setStatus(newStatus);
      router.refresh();
    } catch (error) {
      console.error("Failed to update war status:", error);
      setFightsError("Failed to update war status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [status, warId, updateWarStatus, router]);

  const handleNodeClick = useCallback((nodeId: number, fight?: FightWithNode) => {
    setSelectedNodeId(nodeId);
    setRightPanelState('editor');
  }, []);

  const handleNavigateNode = useCallback((direction: number) => {
    if (!selectedNodeId) return;

    const validNodes = warNodesData.filter(n => !n.isPortal);

    const currentIndex = validNodes.findIndex(n => {
      const nid = typeof n.id === 'string' ? parseInt(n.id) : n.id;
      return nid === selectedNodeId;
    });

    if (currentIndex === -1) return;

    let newIndex = currentIndex + direction;

    const count = validNodes.length;
    if (newIndex < 0) {
      newIndex = (newIndex % count + count) % count;
    } else if (newIndex >= count) {
      newIndex = newIndex % count;
    }

    const newNode = validNodes[newIndex];
    const newNodeId = typeof newNode.id === 'string' ? parseInt(newNode.id) : newNode.id;

    const newFight = currentFights.find(f => f.node.nodeNumber === newNodeId);

    handleNodeClick(newNodeId, newFight);
  }, [selectedNodeId, currentFights, handleNodeClick]);

  const handleEditorClose = useCallback(() => {
    setRightPanelState('closed');
    setSelectedNodeId(null);
  }, []);

  const toggleTools = useCallback(() => {
    setRightPanelState((prev: RightPanelState) => prev === 'tools' ? 'closed' : 'tools');
  }, []);

  const handleAddExtra = useCallback(async (playerId: string, championId: number) => {
    const champ = champions.find(c => c.id === championId);
    if (!champ) return;

    const tempId = "temp-" + Date.now();
    const newExtra: ExtraChampion = {
      id: tempId,
      warId,
      battlegroup: currentBattlegroup,
      playerId,
      championId,
      champion: { id: champ.id, name: champ.name, images: champ.images }
    };

    setExtraChampions((prev: ExtraChampion[]) => [...prev, newExtra]);

    try {
      const created = await addExtraChampion(warId, currentBattlegroup, playerId, championId);
      setExtraChampions((prev: ExtraChampion[]) => prev.map((x: ExtraChampion) => x.id === tempId ? { ...x, id: created.id } : x));
    } catch (e: any) {
      console.error("Failed to add extra champion", e);
      setExtraChampions((prev: ExtraChampion[]) => prev.filter((x: ExtraChampion) => x.id !== tempId));
      setFightsError(e.message || "Failed to add extra champion.");
    }
  }, [warId, currentBattlegroup, champions]);

  const handleRemoveExtra = useCallback(async (extraId: string) => {
    const toRemove = extraChampions.find((x: ExtraChampion) => x.id === extraId);
    if (!toRemove) return;

    setExtraChampions((prev: ExtraChampion[]) => prev.filter((x: ExtraChampion) => x.id !== extraId));

    try {
      await removeExtraChampion(extraId);
    } catch (e: any) {
      console.error("Failed to remove extra champion", e);
      setExtraChampions((prev: ExtraChampion[]) => [...prev, toRemove]);
      setFightsError(e.message || "Failed to remove extra champion.");
    }
  }, [extraChampions]);

  const handleAddWarBan = useCallback(async (championId: number) => {
    const champ = champions.find(c => c.id === championId);
    if (!champ) return;

    // Optimistic
    const tempId = "temp-" + Date.now();
    const newBan: WarBanWithChampion = {
      id: tempId,
      warId,
      championId,
      createdAt: new Date(),
      champion: { id: champ.id, name: champ.name, images: champ.images }
    };

    setWarBans((prev: WarBanWithChampion[]) => [...prev, newBan]);

    try {
      const created = await addWarBan(warId, championId);
      setWarBans((prev: WarBanWithChampion[]) => prev.map((x: WarBanWithChampion) => x.id === tempId ? { ...x, id: created.id } : x));
    } catch (e: any) {
      console.error("Failed to add war ban", e);
      setWarBans((prev: WarBanWithChampion[]) => prev.filter((x: WarBanWithChampion) => x.id !== tempId));
      setFightsError(e.message || "Failed to add war ban.");
    }
  }, [warId, champions]);

  const handleRemoveWarBan = useCallback(async (banId: string) => {
    const toRemove = warBans.find((x: WarBanWithChampion) => x.id === banId);
    if (!toRemove) return;

    setWarBans((prev: WarBanWithChampion[]) => prev.filter((x: WarBanWithChampion) => x.id !== banId));

    try {
      await removeWarBan(banId);
    } catch (e: any) {
      console.error("Failed to remove war ban", e);
      setWarBans((prev: WarBanWithChampion[]) => [...prev, toRemove]);
      setFightsError(e.message || "Failed to remove war ban.");
    }
  }, [warBans]);

  const handleSaveFight = useCallback(async (updatedFight: Partial<WarFight> & {
    prefightUpdates?: { championId: number; playerId?: string | null }[]
  }) => {
    setValidationError(null);

    // Capture previous state for rollback
    const previousFights = currentFights;
    // const previousSelectedFight = selectedFight; // No longer needed as derived

    // Validation Check (existing logic)
    const fightToUpdate = currentFights.find((f: FightWithNode) =>
      f.id === updatedFight.id ||
      (f.warId === updatedFight.warId && f.battlegroup === updatedFight.battlegroup && f.nodeId === updatedFight.nodeId)
    );

    if (fightToUpdate) {
      pendingSaveNodeIds.current.add(fightToUpdate.node.nodeNumber);
      
      const targetPlayerId = updatedFight.playerId !== undefined ? updatedFight.playerId : fightToUpdate.player?.id;
      const targetAttackerId = updatedFight.attackerId !== undefined ? updatedFight.attackerId : fightToUpdate.attacker?.id;

      if (targetPlayerId && targetAttackerId) {
        const validation = validatePlayerAssignment(targetPlayerId, targetAttackerId, fightToUpdate.node.nodeNumber);
        if (!validation.isValid) {
          setValidationError(validation.error || "Invalid assignment");
          pendingSaveNodeIds.current.delete(fightToUpdate.node.nodeNumber);
          return;
        }
      }
    }

    // Optimistic Update
    setCurrentFights((prev: FightWithNode[]) => prev.map((f: FightWithNode) => {
      if (f.id === updatedFight.id || (f.warId === updatedFight.warId && f.battlegroup === updatedFight.battlegroup && f.nodeId === updatedFight.nodeId)) {
        const newAttacker = updatedFight.attackerId ? champions.find(c => c.id === updatedFight.attackerId) : (updatedFight.attackerId === null ? null : f.attacker);
        const newDefender = updatedFight.defenderId ? champions.find(c => c.id === updatedFight.defenderId) : (updatedFight.defenderId === null ? null : f.defender);
        const newPlayer = updatedFight.playerId ? players.find(p => p.id === updatedFight.playerId) : (updatedFight.playerId === null ? null : f.player);

        let newPrefights = f.prefightChampions;

        if (updatedFight.prefightUpdates) {
          newPrefights = updatedFight.prefightUpdates.map((update: { championId: number; playerId?: string | null }) => {
            const champ = champions.find(c => c.id === update.championId);
            const player = update.playerId ? players.find(p => p.id === update.playerId) : null;

            if (!champ) return null;

            return {
              id: champ.id,
              name: champ.name,
              images: champ.images,
              class: champ.class,
              fightPrefightId: 'temp-' + champ.id,
              player: player ? { id: player.id, ingameName: player.ingameName, avatar: player.avatar } : null
            };
          }).filter((x: OptimisticPrefight | null): x is OptimisticPrefight => Boolean(x));
        }

        const updatedNode = {
          ...f,
          ...updatedFight,
          attacker: newAttacker ? { id: newAttacker.id, name: newAttacker.name, images: newAttacker.images, class: newAttacker.class } : null,
          defender: newDefender ? { id: newDefender.id, name: newDefender.name, images: newDefender.images, class: newDefender.class } : null,
          player: newPlayer ? { id: newPlayer.id, ingameName: newPlayer.ingameName, avatar: newPlayer.avatar } : null,
          prefightChampions: newPrefights
        } as FightWithNode;

        return updatedNode;
      }
      return f;
    }));

    // Auto-convert Extra Assignment to Normal Assignment
    if (updatedFight.attackerId && fightToUpdate) {
        const targetPlayerId = updatedFight.playerId ?? fightToUpdate.player?.id;
        if (targetPlayerId) {
            const extra = extraChampions.find(e => e.playerId === targetPlayerId && e.championId === updatedFight.attackerId && e.battlegroup === currentBattlegroup);
            if (extra) {
                handleRemoveExtra(extra.id);
            }
        }
    }

    if (updatedFight.prefightUpdates && fightToUpdate) {
        updatedFight.prefightUpdates.forEach(update => {
            if (update.playerId) {
                const extra = extraChampions.find(e => e.playerId === update.playerId && e.championId === update.championId && e.battlegroup === currentBattlegroup);
                if (extra) {
                    handleRemoveExtra(extra.id);
                }
            }
        });
    }

    try {
      await updateWarFight(updatedFight);
    } catch (error: any) {
      console.error("Failed to save fight:", error);
      // Rollback
      setCurrentFights(previousFights);
      setFightsError(error.message || "Failed to save changes. Please try again.");
    } finally {
        if (fightToUpdate) {
            pendingSaveNodeIds.current.delete(fightToUpdate.node.nodeNumber);
        }
    }
  }, [updateWarFight, champions, players, validatePlayerAssignment, currentFights]);

  return {
    // State
    rightPanelState,
    setRightPanelState,
    activeTab,
    setActiveTab,
    isFullscreen,
    setIsFullscreen,
    selectedNodeId,
    selectedFight,
    selectedPlayerId,
    setSelectedPlayerId,
    currentFights,
    extraChampions,
    status,
    isUpdatingStatus,
    loadingFights,
    fightsError,
    activeTactic,
    historyFilters,
    setHistoryFilters,
    historyCache,
    currentBattlegroup,
    validationError,
    setValidationError,
    // Bans
    seasonBans,
    warBans,

    // Handlers
    handleToggleStatus,
    handleNodeClick,
    handleNavigateNode,
    handleEditorClose,
    toggleTools,
    handleSaveFight,
    handleAddExtra,
    handleRemoveExtra,
    handleAddWarBan,
    handleRemoveWarBan,
  };
}