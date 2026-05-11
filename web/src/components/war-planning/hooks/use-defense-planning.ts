import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { WarDefensePlacement, WarNode, WarNodeAllocation, NodeModifier, WarMapType } from "@prisma/client";
import { Champion } from "@/types/champion";
import { PlacementWithNode, PlayerWithRoster } from "@cerebro/core/data/war-planning/types";
import { RightPanelState } from "./use-war-planning";
import { warNodesData, warNodesDataBig } from "@cerebro/core/data/war-planning/nodes-data";
import { reportClientError } from "@/lib/observability/client";

interface WarNodeWithAllocations extends WarNode {
    allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
}

interface UseDefensePlanningProps {
  planId: string;
  champions: (Champion & { tags?: { name: string }[] })[];
  players: PlayerWithRoster[];
  updatePlacement: (updatedPlacement: Partial<WarDefensePlacement>) => Promise<void>;
  userBattlegroup?: number | null;
  mapType: WarMapType;
}

export function useDefensePlanning({
  planId,
  champions,
  players,
  updatePlacement,
  userBattlegroup,
  mapType,
}: UseDefensePlanningProps) {
  // UI State
  const [rightPanelState, setRightPanelState] = useState<RightPanelState>('closed');
  const [activeTab, setActiveTab] = useState(userBattlegroup != null ? `bg${userBattlegroup}` : "bg1");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Selection State
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);

  // Data State
  const [currentPlacements, setCurrentPlacements] = useState<PlacementWithNode[]>([]);
  const [nodesMap, setNodesMap] = useState<Map<number, WarNodeWithAllocations>>(new Map());
  const pendingSaveNodeIds = useRef<Set<number>>(new Set());

  const currentBattlegroup = useMemo(() => {
      const match = activeTab.match(/^bg(\d+)$/);
      if (match && match[1]) {
          const num = parseInt(match[1], 10);
          if (Number.isFinite(num)) return num;
      }
      return 1; // Safe default
  }, [activeTab]);

  // Derived: Filtered Placements for current BG
  const filteredPlacements = useMemo(() => {
      return currentPlacements.filter(p => p.battlegroup === currentBattlegroup);
  }, [currentPlacements, currentBattlegroup]);

  // Derived Selection
  const selectedPlacement = useMemo(() => {
    if (!selectedNodeId) return null;
    return filteredPlacements.find(p => p.node.nodeNumber === selectedNodeId) || null;
  }, [filteredPlacements, selectedNodeId]);

  const [loadingPlacements, setLoadingPlacements] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Memoized function to fetch placements
  const fetchPlacements = useCallback(async () => {
    setLoadingPlacements(true);
    try {
      const res = await fetch(`/api/war-planning/placements?planId=${planId}`);
      if (!res.ok) throw new Error("Failed to load placements");
      const data: PlacementWithNode[] = await res.json();
      setCurrentPlacements(data);
    } catch (err: unknown) {
      reportClientError("defense_planning_fetch_placements", err, { plan_id: planId });
      const msg = err instanceof Error ? err.message : String(err);
      setError("Failed to load placements: " + msg);
    } finally {
      setLoadingPlacements(false);
    }
  }, [planId]);
  
  // Fetch Static Node Data ONCE
  useEffect(() => {
    const controller = new AbortController();
    
    async function fetchNodes() {
        try {
            const res = await fetch(`/api/war-planning/nodes?planId=${planId}`, {
                signal: controller.signal
            });
            if (!res.ok) throw new Error("Failed to load map data");
            const data: WarNodeWithAllocations[] = await res.json();
            
            const map = new Map<number, WarNodeWithAllocations>();
            data.forEach(n => map.set(n.nodeNumber, n));
            setNodesMap(map);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            reportClientError("defense_planning_fetch_nodes", err, { plan_id: planId });
            setError("Failed to load map configuration.");
        }
    }
    fetchNodes();
    
    return () => controller.abort();
  }, [planId]);

  // Initial Data Fetch
  useEffect(() => {
    fetchPlacements();
  }, [fetchPlacements]);

  // Polling (every 5s)
  useEffect(() => {
    let inFlight = false;
    const interval = setInterval(async () => {
        if (inFlight) return;
        if (document.hidden) return; // Don't poll if tab hidden
        
        inFlight = true;
        try {
             const res = await fetch(`/api/war-planning/placements?planId=${planId}`);
             if (!res.ok) return;
             const data: PlacementWithNode[] = await res.json();

             setCurrentPlacements(prev => {
                 // If data length differs significantly, simpler to just replace (unless partial update logic)
                 // Here we just map to preserve local optimistic updates
                 if (prev.length === 0) return data;

                 // If we have local optimistic updates, we want to keep them if the server hasn't confirmed them yet?
                 // Actually, usually we trust the server unless we are *currently* editing/saving.
                 // pendingSaveNodeIds tracks nodes we are saving.

                 return data.map(serverItem => {
                    const nodeNum = serverItem.node.nodeNumber;
                    if (pendingSaveNodeIds.current.has(nodeNum)) {
                         // We are saving this node, keep local version to avoid jitter
                         const local = prev.find(p => p.node.nodeNumber === nodeNum);
                         return local || serverItem;
                    }
                    return serverItem;
                 });
             });
        } catch (e) {
            reportClientError("defense_planning_poll", e, { plan_id: planId });
        } finally {
            inFlight = false;
        }
    }, 5000);
    return () => clearInterval(interval);
  }, [planId]);

  // Handlers
  const handleNodeClick = useCallback((nodeId: number) => {
    setSelectedNodeId(nodeId);
    setRightPanelState('editor');
  }, []);

  const handleNavigateNode = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (!selectedNodeId) return;

    const currentNodesData = mapType === WarMapType.BIG_THING ? warNodesDataBig : warNodesData;
    const currentNode = currentNodesData.find(n => n.id === selectedNodeId);
    
    if (!currentNode) return;

    // Filter nodes in the general direction
    const candidates = currentNodesData.filter(n => {
      // Only navigate to actual nodes (numeric IDs), not portals
      if (typeof n.id !== 'number') return false;
      if (n.id === selectedNodeId) return false;

      switch (direction) {
        case 'up':
          return n.y < currentNode.y;
        case 'down':
          return n.y > currentNode.y;
        case 'left':
          return n.x < currentNode.x;
        case 'right':
          return n.x > currentNode.x;
        default:
          return false;
      }
    });

    if (candidates.length === 0) return;

    // Find the one with the smallest weighted distance
    const bestNode = candidates.reduce((best, current) => {
      const dx = current.x - currentNode.x;
      const dy = current.y - currentNode.y;
      
      let score;
      if (direction === 'up' || direction === 'down') {
        score = Math.abs(dy) + Math.abs(dx) * 2; 
      } else {
        score = Math.abs(dx) + Math.abs(dy) * 2;
      }

      if (!best || score < best.score) {
        return { node: current, score };
      }
      return best;
    }, null as { node: (typeof currentNodesData)[0], score: number } | null);

    if (bestNode) {
      handleNodeClick(bestNode.node.id as number);
    }
  }, [selectedNodeId, handleNodeClick, mapType]);

  const handleEditorClose = useCallback(() => {
    setRightPanelState('closed');
    setSelectedNodeId(null);
  }, []);

  const toggleTools = useCallback(() => {
    setRightPanelState((prev: RightPanelState) => prev === 'tools' ? 'closed' : 'tools');
  }, []);

    const handleSavePlacement = useCallback(async (updatedPlacement: Partial<WarDefensePlacement>) => {
      // Identify target for optimistic update
      let placementToUpdate: PlacementWithNode | undefined;
      
      // Logic to find the placement in the current list
      if (updatedPlacement.id) {
          placementToUpdate = currentPlacements.find(p => p.id === updatedPlacement.id);
      } else if (updatedPlacement.nodeId) {
          placementToUpdate = currentPlacements.find(p => 
              p.nodeId === updatedPlacement.nodeId && 
              p.planId === planId && 
              p.battlegroup === currentBattlegroup
          );
      }
  
      if (placementToUpdate) {
        pendingSaveNodeIds.current.add(placementToUpdate.node.nodeNumber);
      } else if (updatedPlacement.nodeId) {
          // If creating new, find the node number from map to track it
          const node = Array.from(nodesMap.values()).find(n => n.id === updatedPlacement.nodeId);
          if (node) pendingSaveNodeIds.current.add(node.nodeNumber);
      }
  
      const payload = {
          ...updatedPlacement,
          battlegroup: currentBattlegroup,
          planId // Ensure planId is sent
      };
  
      // Optimistic Update
      setCurrentPlacements((prev: PlacementWithNode[]) => {
        const existingIndex = prev.findIndex(p => 
          (updatedPlacement.id && p.id === updatedPlacement.id) || 
          (updatedPlacement.nodeId && p.nodeId === updatedPlacement.nodeId && p.battlegroup === currentBattlegroup)
        );
  
        const newDefender = updatedPlacement.defenderId ? champions.find(c => c.id === updatedPlacement.defenderId) : null;
        // If setting to null explicit, use null. If undefined, keep existing (for updates), but for new it's null.
        // Logic: if updatedPlacement.defenderId is undefined, it means "no change". But if it is null, it means "remove".
        
        const newPlayer = updatedPlacement.playerId ? players.find(player => player.id === updatedPlacement.playerId) : null;
  
        if (existingIndex !== -1) {
            // Update Existing
            const p = prev[existingIndex];
            const updatedDefender = updatedPlacement.defenderId === undefined ? p.defender : (newDefender ? { 
                id: newDefender.id, 
                name: newDefender.name, 
                images: newDefender.images, 
                class: newDefender.class, 
                tags: newDefender.tags 
            } : null);
            
            const updatedPlayer = updatedPlacement.playerId === undefined ? p.player : (newPlayer ? { id: newPlayer.id, ingameName: newPlayer.ingameName, avatar: newPlayer.avatar } : null);
  
            const newArr = [...prev];
            newArr[existingIndex] = {
                ...p,
                ...updatedPlacement,
                defender: updatedDefender,
                player: updatedPlayer
            } as PlacementWithNode;
            return newArr;
        } else {
            // Create New
            if (!updatedPlacement.nodeId) return prev; // Should not happen for creation
  
            const nodeEntry = Array.from(nodesMap.values()).find(n => n.id === updatedPlacement.nodeId);
            if (!nodeEntry) return prev; // Node not found in config
  
                      const newPlacement: PlacementWithNode = {
                          id: updatedPlacement.id || `temp-${Date.now()}`,
                          planId,
                          battlegroup: currentBattlegroup,
                          nodeId: updatedPlacement.nodeId,
                          node: { ...nodeEntry }, // Assuming WarNodeWithAllocations matches WarNode shape required
                          defenderId: updatedPlacement.defenderId || null,
                          playerId: updatedPlacement.playerId || null,
                          starLevel: updatedPlacement.starLevel || null,
                          defender: newDefender ? { 
                            id: newDefender.id, 
                            name: newDefender.name, 
                            images: newDefender.images, 
                            class: newDefender.class, 
                            tags: newDefender.tags 
                          } : null,
                          player: newPlayer ? { id: newPlayer.id, ingameName: newPlayer.ingameName, avatar: newPlayer.avatar } : null,
                          createdAt: new Date(),
                          updatedAt: new Date(),
                          type: "defense", // Add the missing discriminator property
                      } as PlacementWithNode;  
            return [...prev, newPlacement];
        }
      });
  
      try {
        await updatePlacement(payload);
      } catch (error: unknown) {
        reportClientError("defense_planning_save_placement", error, {
          plan_id: planId,
          placement_id: updatedPlacement.id,
          node_id: updatedPlacement.nodeId,
        });
        const msg = error instanceof Error ? error.message : String(error);
        setError("Failed to save changes: " + msg);
        // Re-fetch placements to ensure UI is in sync with server state after error
        fetchPlacements();
      } finally {
          if (placementToUpdate) {
              pendingSaveNodeIds.current.delete(placementToUpdate.node.nodeNumber);
          } else if (updatedPlacement.nodeId) {
               const node = Array.from(nodesMap.values()).find(n => n.id === updatedPlacement.nodeId);
               if (node) pendingSaveNodeIds.current.delete(node.nodeNumber);
          }
      }
    }, [updatePlacement, champions, players, currentPlacements, currentBattlegroup, planId, fetchPlacements, nodesMap]);
  const selectedDbNodeId = selectedNodeId ? nodesMap.get(selectedNodeId)?.id : undefined;

  return {
    rightPanelState,
    setRightPanelState,
    activeTab,
    setActiveTab,
    isFullscreen,
    setIsFullscreen,
    selectedNodeId,
    selectedDbNodeId,
    selectedPlacement,
    selectedPlayerId,
    setSelectedPlayerId,
    currentPlacements: filteredPlacements, // Return filtered placements for Map
    allPlacements: currentPlacements, // Expose all for roster stats
    currentBattlegroup,
    loadingPlacements,
    error,
    
    handleNodeClick,
    handleNavigateNode,
    handleEditorClose,
    toggleTools,
    handleSavePlacement,
    nodesMap, // Expose nodesMap for robustness
  };
}
