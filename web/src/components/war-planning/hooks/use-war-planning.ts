import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { War, WarFight, WarStatus, WarTactic, ChampionClass } from "@prisma/client";
import { Champion } from "@/types/champion";
import { warNodesData } from '../nodes-data';
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { getActiveTactic, addExtraChampion, removeExtraChampion, getExtraChampions } from "@/app/planning/actions";
import { FightWithNode, PlayerWithRoster } from "../types";

export type RightPanelState = 'closed' | 'tools' | 'editor';

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

interface UseWarPlanningProps {
  war: War;
  warId: string;
  champions: Champion[];
  players: PlayerWithRoster[];
  updateWarFight: (updatedFight: Partial<WarFight> & { 
      prefightUpdates?: { championId: number; playerId?: string | null }[] 
  }) => Promise<void>;
  updateWarStatus: (warId: string, status: WarStatus) => Promise<void>;
}

export function useWarPlanning({
  war,
  warId,
  champions,
  players,
  updateWarFight,
  updateWarStatus,
}: UseWarPlanningProps) {
  const router = useRouter();
  
  // UI State
  const [rightPanelState, setRightPanelState] = useState<RightPanelState>('closed');
  const [activeTab, setActiveTab] = useState("bg1");
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Selection State
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedFight, setSelectedFight] = useState<FightWithNode | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  
  // Data State
  const [currentFights, setCurrentFights] = useState<FightWithNode[]>([]);
  const [extraChampions, setExtraChampions] = useState<ExtraChampion[]>([]);
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

  // Fetch Fights & Extras
  useEffect(() => {
    async function fetchData() {
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
        const fetchedFights: FightWithNode[] = await fightsRes.json();
        setCurrentFights(fetchedFights);
        setExtraChampions(extrasData);
      } catch (err: any) {
        console.error("Failed to fetch war data:", err);
        setFightsError(err.message || "Failed to load war data.");
      } finally {
        setLoadingFights(false);
      }
    }
    fetchData();
  }, [warId, currentBattlegroup]);

  const validatePlayerAssignment = useCallback((playerId: string, newChampionId: number, nodeId: number) => {
    const playerFights = currentFights.filter(f => f.player?.id === playerId && f.node.nodeNumber !== nodeId);
    const usedChampionIds = new Set(playerFights.map(f => f.attacker?.id).filter(id => id !== undefined && id !== null));
    
    // Also include prefight and extra champions for the 3-champion limit
    currentFights.forEach(f => f.prefightChampions?.forEach(pf => {
        if (pf.player?.id === playerId) usedChampionIds.add(pf.id);
    }));
    extraChampions.forEach(ex => {
        if (ex.playerId === playerId && ex.battlegroup === currentBattlegroup) usedChampionIds.add(ex.championId);
    });

    if (usedChampionIds.size >= 3 && !usedChampionIds.has(newChampionId)) {
        return false;
    }
    return true;
  }, [currentFights, extraChampions, currentBattlegroup]);

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
    setSelectedFight(fight || null);
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
    setSelectedFight(null);
  }, []);

  const toggleTools = useCallback(() => {
    setRightPanelState(prev => prev === 'tools' ? 'closed' : 'tools');
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

      setExtraChampions(prev => [...prev, newExtra]);

      try {
          const created = await addExtraChampion(warId, currentBattlegroup, playerId, championId);
          setExtraChampions(prev => prev.map(x => x.id === tempId ? { ...x, id: created.id } : x));
      } catch (e: any) {
          console.error("Failed to add extra champion", e);
          setExtraChampions(prev => prev.filter(x => x.id !== tempId));
          setFightsError(e.message || "Failed to add extra champion.");
      }
  }, [warId, currentBattlegroup, champions]);

  const handleRemoveExtra = useCallback(async (extraId: string) => {
      const toRemove = extraChampions.find(x => x.id === extraId);
      if (!toRemove) return;

      setExtraChampions(prev => prev.filter(x => x.id !== extraId));

      try {
          await removeExtraChampion(extraId);
      } catch (e: any) {
          console.error("Failed to remove extra champion", e);
          setExtraChampions(prev => [...prev, toRemove]);
          setFightsError(e.message || "Failed to remove extra champion.");
      }
  }, [extraChampions]);

  const handleSaveFight = useCallback(async (updatedFight: Partial<WarFight> & { 
      prefightUpdates?: { championId: number; playerId?: string | null }[] 
  }) => {
    setValidationError(null);

    // Capture previous state for rollback
    const previousFights = currentFights;
    const previousSelectedFight = selectedFight;

    // Validation Check (existing logic)
    const fightToUpdate = currentFights.find(f => 
        f.id === updatedFight.id || 
        (f.warId === updatedFight.warId && f.battlegroup === updatedFight.battlegroup && f.nodeId === updatedFight.nodeId)
    );

    if (fightToUpdate) {
        const targetPlayerId = updatedFight.playerId !== undefined ? updatedFight.playerId : fightToUpdate.player?.id;
        const targetAttackerId = updatedFight.attackerId !== undefined ? updatedFight.attackerId : fightToUpdate.attacker?.id;

        if (targetPlayerId && targetAttackerId) {
             const isValid = validatePlayerAssignment(targetPlayerId, targetAttackerId, fightToUpdate.node.nodeNumber);
             if (!isValid) {
                 setValidationError("Player already has 3 unique champions assigned.");
                 return;
             }
        }
    }

    // Optimistic Update
    setCurrentFights(prev => prev.map(f => {
      if (f.id === updatedFight.id || (f.warId === updatedFight.warId && f.battlegroup === updatedFight.battlegroup && f.nodeId === updatedFight.nodeId)) {
        const newAttacker = updatedFight.attackerId ? champions.find(c => c.id === updatedFight.attackerId) : (updatedFight.attackerId === null ? null : f.attacker);
        const newDefender = updatedFight.defenderId ? champions.find(c => c.id === updatedFight.defenderId) : (updatedFight.defenderId === null ? null : f.defender);
        const newPlayer = updatedFight.playerId ? players.find(p => p.id === updatedFight.playerId) : (updatedFight.playerId === null ? null : f.player);
        
        let newPrefights = f.prefightChampions;
        
        if (updatedFight.prefightUpdates) {
             newPrefights = updatedFight.prefightUpdates.map(update => {
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
             }).filter((x): x is OptimisticPrefight => Boolean(x));
        }

        const updatedNode = {
            ...f,
            ...updatedFight,
            attacker: newAttacker ? { id: newAttacker.id, name: newAttacker.name, images: newAttacker.images, class: newAttacker.class } : null,
            defender: newDefender ? { id: newDefender.id, name: newDefender.name, images: newDefender.images, class: newDefender.class } : null,
            player: newPlayer ? { id: newPlayer.id, ingameName: newPlayer.ingameName, avatar: newPlayer.avatar } : null,
            prefightChampions: newPrefights
        } as FightWithNode;

        if (selectedFight && f.node.nodeNumber === selectedFight.node.nodeNumber) {
            setSelectedFight(updatedNode);
        }

        return updatedNode;
      }
      return f;
    }));

    try {
        await updateWarFight(updatedFight);
    } catch (error: any) {
        console.error("Failed to save fight:", error);
        // Rollback
        setCurrentFights(previousFights);
        if (previousSelectedFight) {
            setSelectedFight(previousSelectedFight);
        }
        setFightsError(error.message || "Failed to save changes. Please try again.");
    }
  }, [updateWarFight, champions, players, selectedFight, validatePlayerAssignment, currentFights]);

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

    // Handlers
    handleToggleStatus,
    handleNodeClick,
    handleNavigateNode,
    handleEditorClose,
    toggleTools,
    handleSaveFight,
    handleAddExtra,
    handleRemoveExtra,
  };
}