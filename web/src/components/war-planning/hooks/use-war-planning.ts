import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { War, WarFight, WarStatus, WarTactic } from "@prisma/client";
import { Champion } from "@/types/champion";
import { warNodesData } from '../nodes-data';
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { getActiveTactic } from "@/app/planning/actions";
import { FightWithNode, PlayerWithRoster } from "../types";

export type RightPanelState = 'closed' | 'tools' | 'editor';

interface UseWarPlanningProps {
  war: War;
  warId: string;
  champions: Champion[];
  players: PlayerWithRoster[];
  updateWarFight: (updatedFight: Partial<WarFight>) => Promise<void>;
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
  
  // Data State
  const [currentFights, setCurrentFights] = useState<FightWithNode[]>([]);
  const [status, setStatus] = useState<WarStatus>(war.status);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [loadingFights, setLoadingFights] = useState(false);
  const [fightsError, setFightsError] = useState<string | null>(null);
  const [activeTactic, setActiveTactic] = useState<WarTactic | null>(null);
  
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

  // Fetch Fights
  useEffect(() => {
    async function fetchFights() {
      setLoadingFights(true);
      setFightsError(null);
      try {
        const response = await fetch(`/api/war-planning/fights?warId=${warId}&battlegroup=${currentBattlegroup}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fetchedFights: FightWithNode[] = await response.json();
        setCurrentFights(fetchedFights);
      } catch (err) {
        console.error("Failed to fetch fights:", err);
        setFightsError("Failed to load war data.");
      } finally {
        setLoadingFights(false);
      }
    }
    fetchFights();
  }, [warId, currentBattlegroup]);

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
    
    const currentIndex = warNodesData.findIndex(n => {
       const nid = typeof n.id === 'string' ? parseInt(n.id) : n.id;
       return nid === selectedNodeId;
    });

    if (currentIndex === -1) return;

    let newIndex = currentIndex;
    let attempts = 0;
    const maxAttempts = warNodesData.length;

    do {
        newIndex += direction;
        if (newIndex < 0) newIndex = warNodesData.length - 1;
        if (newIndex >= warNodesData.length) newIndex = 0;
        attempts++;
    } while (warNodesData[newIndex].isPortal && attempts < maxAttempts);

    const newNode = warNodesData[newIndex];
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

  const handleSaveFight = useCallback(async (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => {
    // Optimistic Update
    setCurrentFights(prev => prev.map(f => {
      if (f.id === updatedFight.id || (f.warId === updatedFight.warId && f.battlegroup === updatedFight.battlegroup && f.nodeId === updatedFight.nodeId)) {
        const newAttacker = updatedFight.attackerId ? champions.find(c => c.id === updatedFight.attackerId) : (updatedFight.attackerId === null ? null : f.attacker);
        const newDefender = updatedFight.defenderId ? champions.find(c => c.id === updatedFight.defenderId) : (updatedFight.defenderId === null ? null : f.defender);
        const newPlayer = updatedFight.playerId ? players.find(p => p.id === updatedFight.playerId) : (updatedFight.playerId === null ? null : f.player);
        
        let newPrefights = f.prefightChampions;
        if (updatedFight.prefightChampionIds) {
             newPrefights = champions
                .filter(c => updatedFight.prefightChampionIds?.includes(c.id))
                .map(c => ({ id: c.id, name: c.name, images: c.images }));
        }

        const updatedNode = {
            ...f,
            ...updatedFight,
            attacker: newAttacker ? { name: newAttacker.name, images: newAttacker.images } : null,
            defender: newDefender ? { name: newDefender.name, images: newDefender.images } : null,
            player: newPlayer ? { ingameName: newPlayer.ingameName } : null,
            prefightChampions: newPrefights
        } as FightWithNode;

        if (selectedFight && f.node.nodeNumber === selectedFight.node.nodeNumber) {
            setSelectedFight(updatedNode);
        }

        return updatedNode;
      }
      return f;
    }));

    await updateWarFight(updatedFight);
  }, [updateWarFight, champions, players, selectedFight]);

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
    currentFights,
    status,
    isUpdatingStatus,
    loadingFights,
    fightsError,
    activeTactic,
    historyFilters,
    setHistoryFilters,
    historyCache,
    currentBattlegroup,

    // Handlers
    handleToggleStatus,
    handleNodeClick,
    handleNavigateNode,
    handleEditorClose,
    toggleTools,
    handleSaveFight
  };
}
