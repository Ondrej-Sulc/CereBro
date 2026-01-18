"use client";

import { useState, useEffect, useCallback } from "react";
import { WarDefensePlan, WarDefensePlacement, WarMapType, Tag } from "@prisma/client";
import { Champion } from "@/types/champion";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, PlacementWithNode } from "@cerebro/core/data/war-planning/types";
import { useDefensePlanning } from "./hooks/use-defense-planning";
import { WarTabs } from "./details/war-tabs";
import DefenseEditor from "./node-editor/defense-editor";
import { DefensePlayerListPanel } from "./details/defense-player-list-panel";
import PlanningToolsPanel from "./planning-tools-panel";
import { DefenseRosterView } from "./roster-view/defense-roster-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Shield, Wrench, LayoutGrid, Map as MapIcon, PieChart } from "lucide-react";
import Link from "next/link";
import { PlayerColorProvider } from "./player-color-context";
import { useToast } from "@/hooks/use-toast";
import { updateDefensePlanHighlightTag, updateDefensePlanTier } from "@/app/planning/defense-actions";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import DefenseStatsPanel from "./defense-stats-panel";

interface DefenseDetailsClientProps {
  plan: WarDefensePlan;
  planId: string;
  updatePlacement: (updatedPlacement: Partial<WarDefensePlacement>) => Promise<void>;
  champions: (Champion & { tags?: { name: string }[] })[];
  players: PlayerWithRoster[];
  availableTags: Tag[];
  isOfficer?: boolean;
  bgColors?: Record<number, string>;
}

interface WarNodeWithAllocations {
    id: number;
    nodeNumber: number;
    // ... other props if needed
}

function findTargetNode(
  targetPlayerId: string | undefined,
  currentPlacements: PlacementWithNode[],
  nodesMap: Map<number, WarNodeWithAllocations>, // Using any or specific type if imported
): { nodeId: number; nodeNumber: number; placementId?: string } | null {
  const sorted = [...currentPlacements].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);
  
  // Priority A: Player's open slot
  if (targetPlayerId) {
    const playerOpenSlot = sorted.find(p => p.playerId === targetPlayerId && !p.defenderId);
    if (playerOpenSlot) {
      return {
        nodeId: playerOpenSlot.nodeId,
        nodeNumber: playerOpenSlot.node.nodeNumber,
        placementId: playerOpenSlot.id
      };
    }
  }
  
  // Priority B: First empty node (No Player, No Defender)
  const empty = sorted.find(p => !p.playerId && !p.defenderId);
  if (empty) {
    return {
      nodeId: empty.nodeId,
      nodeNumber: empty.node.nodeNumber,
      placementId: empty.id
    };
  }

  // Priority C: Steal empty slot from another player (Has Player, No Defender)
  // This handles the case where all nodes have a player assigned (e.g., initialized plan),
  // but some players have > 5 nodes assigned with no defenders on them.
  const stealable = sorted.find(p => p.playerId && !p.defenderId);
  if (stealable) {
      return {
          nodeId: stealable.nodeId,
          nodeNumber: stealable.node.nodeNumber,
          placementId: stealable.id
      };
  }
  
  // Priority D: Unoccupied node from map (Fallback for empty/incomplete placements)
  if (sorted.length < nodesMap.size) {
    const occupiedNodeNumbers = new Set(sorted.map(p => p.node.nodeNumber));
    const freeNodeNumber = Array.from(nodesMap.keys())
      .sort((a, b) => a - b)
      .find(n => !occupiedNodeNumbers.has(n));
    
    if (freeNodeNumber) {
      const node = nodesMap.get(freeNodeNumber);
      if (node) {
        return {
          nodeId: node.id,
          nodeNumber: freeNodeNumber
        };
      }
    }
  }
  
  return null;
}

export default function DefenseDetailsClient(props: DefenseDetailsClientProps) {
  const { toast } = useToast();
  const isReadOnly = !props.isOfficer;
  const {
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
    currentPlacements,
    allPlacements,
    currentBattlegroup,
    loadingPlacements,
    
    handleNodeClick,
    handleNavigateNode,
    handleEditorClose,
    handleSavePlacement,
    toggleTools,
    nodesMap, // Destructure nodesMap
  } = useDefensePlanning(props);

  const [isDesktop, setIsDesktop] = useState(true);
  const [isPlayerPanelOpen, setIsPlayerPanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'roster' | 'map'>('roster');
  const [activeTagId, setActiveTagId] = useState<number | null>(props.plan.highlightTagId);
  const [activeTier, setActiveTier] = useState<number | null>(props.plan.tier ?? null);

  // Sync state with props during render
  const [prevHighlightTagId, setPrevHighlightTagId] = useState(props.plan.highlightTagId);
  if (props.plan.highlightTagId !== prevHighlightTagId) {
    setPrevHighlightTagId(props.plan.highlightTagId);
    setActiveTagId(props.plan.highlightTagId);
  }

  const [prevTier, setPrevTier] = useState(props.plan.tier);
  if (props.plan.tier !== prevTier) {
    setPrevTier(props.plan.tier);
    setActiveTier(props.plan.tier ?? null);
  }

  const activeTag = props.availableTags.find(t => t.id === activeTagId);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const handleViewModeChange = (mode: 'roster' | 'map') => {
      setViewMode(mode);
      handleEditorClose(); // Clear selection when switching views
  };

  const getButtonStyle = (bgId: number, isActive: boolean) => {
      const color = props.bgColors?.[bgId];
      if (color && isActive) {
          return {
              backgroundColor: `${color}1A`, // 10% opacity
              color: color,
              borderColor: `${color}33`, // 20% opacity
              boxShadow: `0 0 0 1px ${color}33`
          };
      }
      return {};
  };
  
  const handleToggleFullscreen = useCallback(() => {
    setIsFullscreen((prev: boolean) => !prev);
  }, [setIsFullscreen]);

  const handleTogglePlayerPanel = useCallback(() => {
    if (isDesktop) {
        setIsPlayerPanelOpen(prev => !prev);
    } else {
        setRightPanelState(prev => prev === 'roster' ? 'closed' : 'roster');
    }
  }, [isDesktop, setRightPanelState]);

  const handleTagChange = async (val: string) => {
      const tagId = val === "none" ? null : parseInt(val, 10);
      setActiveTagId(tagId);
      try {
          await updateDefensePlanHighlightTag(props.planId, tagId);
          toast({ title: "Highlight Tag Updated" });
      } catch (e) {
          console.error(e);
          toast({ title: "Failed to update tag", variant: "destructive" });
      }
  };

  const handleTierChange = async (val: string) => {
      const tier = val === "none" ? null : parseInt(val, 10);
      setActiveTier(tier);
      try {
          await updateDefensePlanTier(props.planId, tier);
          toast({ title: "Tier Updated" });
      } catch (e) {
          console.error(e);
          toast({ title: "Failed to update tier", variant: "destructive" });
      }
  };

  const handleRemovePlacement = useCallback(async (placementId: string) => {
      const placement = currentPlacements.find(p => p.id === placementId);
      if (!placement) return;

      await handleSavePlacement({
          id: placementId,
          planId: props.planId,
          battlegroup: currentBattlegroup,
          nodeId: placement.nodeId,
          defenderId: null,
          starLevel: null,
      });
      toast({ title: "Defender Removed" });
  }, [handleSavePlacement, currentPlacements, props.planId, currentBattlegroup, toast]);

  const handleEditPlacement = useCallback((nodeNumber: number) => {
      handleNodeClick(nodeNumber);
      setRightPanelState('editor');
  }, [handleNodeClick, setRightPanelState]);

  const toggleStats = useCallback(() => {
    setRightPanelState((prev) => prev === 'stats' ? 'closed' : 'stats');
  }, [setRightPanelState]);

  const handleAddForPlayer = useCallback((playerId: string) => {
      setSelectedPlayerId(playerId);
      setRightPanelState('tools');
  }, [setSelectedPlayerId, setRightPanelState]);

  const handleAddFromTool = useCallback(async (playerId: string, championId: number, starLevel?: number) => {
    // Determine Target Player: Explicitly passed playerId (from dropdown) OR currently selected player (from Roster View context)
    const targetPlayerId = playerId || selectedPlayerId;
    const championLimit = props.plan.mapType === WarMapType.BIG_THING ? 1 : 5;

    let target: { nodeId: number; nodeNumber: number; placementId?: string } | null;

    // 1. Explicit Node Selection (Map Mode)
    if (selectedPlacement) {
        target = {
            nodeId: selectedPlacement.nodeId,
            nodeNumber: selectedPlacement.node.nodeNumber,
            placementId: selectedPlacement.id
        };
    } else {
        // 2. Auto-Targeting
        target = findTargetNode(targetPlayerId ?? undefined, currentPlacements, nodesMap);
    }

    if (!target) {
        toast({ 
            title: "No available node", 
            description: "Could not find an empty slot for this player or an empty node in this battlegroup.",
            variant: "destructive" 
        });
        return;
    }

    // Limit Check
    if (targetPlayerId) {
        const otherDefendersCount = currentPlacements.filter(p => 
            p.battlegroup === currentBattlegroup && 
            p.playerId === targetPlayerId && 
            p.defenderId &&
            p.nodeId !== target.nodeId 
        ).length;

        if (otherDefendersCount >= championLimit) {
             toast({
                title: "Limit Reached",
                description: `Player already has ${championLimit} defenders assigned.`,
                variant: "destructive"
             });
             return;
        }
    }

    // Determine the champion name for the toast
    const champ = props.champions.find(c => c.id === championId);
    const champName = champ ? champ.name : "Champion";

    // Detect star level if not provided
    let finalStarLevel = starLevel;
    if (finalStarLevel === undefined) {
        // We check the player passed in arguments (the owner of the champ)
        const owner = props.players.find(p => p.id === playerId);
        const rosterEntry = owner?.roster.find(r => r.championId === championId);
        finalStarLevel = rosterEntry ? rosterEntry.stars : undefined;
    }

    await handleSavePlacement({
        id: target.placementId,
        planId: props.planId,
        battlegroup: currentBattlegroup,
        nodeId: target.nodeId,
        playerId: targetPlayerId || playerId, // Ensure we assign to the correct player
        defenderId: championId,
        starLevel: finalStarLevel
    });

    toast({
        title: "Defender Assigned",
        description: `Assigned ${champName} to Node ${target.nodeNumber}.`
    });

  }, [selectedPlacement, selectedPlayerId, currentPlacements, handleSavePlacement, props.planId, currentBattlegroup, props.champions, props.players, props.plan.mapType, toast, nodesMap]);

  const handleMoveDefender = useCallback(async (placementId: string, targetNodeId: number) => {
    if (!placementId || !targetNodeId) return;

    // 1. Get Source Data
    const sourcePlacement = currentPlacements.find(p => p.id === placementId);
    if (!sourcePlacement) return;

    // 2. Get Target Placement
    const targetPlacement = currentPlacements.find(p => 
        p.nodeId === targetNodeId && p.battlegroup === currentBattlegroup
    );

    // 3. Prepare Data for Swap
    const sourceData = {
        defenderId: sourcePlacement.defenderId,
        playerId: sourcePlacement.playerId,
        starLevel: sourcePlacement.starLevel
    };

    const targetData = targetPlacement ? {
        defenderId: targetPlacement.defenderId,
        playerId: targetPlacement.playerId,
        starLevel: targetPlacement.starLevel
    } : { defenderId: null, playerId: null, starLevel: null };

    try {
        // 4. Update Target with Source Data
        if (targetPlacement) {
            await handleSavePlacement({
                id: targetPlacement.id,
                planId: props.planId,
                battlegroup: currentBattlegroup,
                nodeId: targetNodeId,
                ...sourceData
            });
        } else {
            // Fallback: Create target placement if it doesn't exist
            await handleSavePlacement({
                planId: props.planId,
                battlegroup: currentBattlegroup,
                nodeId: targetNodeId,
                ...sourceData
            });
        }

        // 5. Update Source with Target Data (Swap)
        await handleSavePlacement({
            id: sourcePlacement.id,
            planId: props.planId,
            battlegroup: currentBattlegroup,
            nodeId: sourcePlacement.nodeId,
            ...targetData
        });

        toast({
            title: "Defenders Swapped",
            description: `Swapped placement between Node ${sourcePlacement.node.nodeNumber} and Node ${targetPlacement?.node.nodeNumber ?? 'Target'}.`
        });
    } catch (error) {
        toast({
            title: "Swap Failed",
            description: "Could not complete the swap. Please refresh and try again.",
            variant: "destructive"
        });
        throw error; // Re-throw to prevent misleading success toast
    }
  }, [currentPlacements, handleSavePlacement, props.planId, currentBattlegroup, toast]);

  const handleMoveNode = useCallback(async (placementId: string, targetNodeNumber: number) => {
      const targetNode = nodesMap.get(targetNodeNumber);
      if (!targetNode) {
          toast({ title: "Invalid Node", description: `Node ${targetNodeNumber} does not exist.`, variant: "destructive" });
          return;
      }
      await handleMoveDefender(placementId, targetNode.id);
  }, [nodesMap, handleMoveDefender, toast]);

  return (
    <PlayerColorProvider players={props.players}>
      <div className={cn(
          "flex w-full overflow-hidden bg-transparent transition-all duration-300",
          isFullscreen ? "fixed inset-0 z-[100] h-screen bg-slate-950" : "h-[calc(100dvh-65px)]", // Keep solid bg in fullscreen
          isDesktop ? "flex-row" : "flex-col"
      )}>
        
        {/* Left Panel (Player Roster) - Hide in Roster View */}
        {viewMode === 'map' && (
            <DefensePlayerListPanel 
                isOpen={isPlayerPanelOpen}
                onToggle={handleTogglePlayerPanel}
                players={props.players}
                allPlacements={allPlacements}
                highlightedPlayerId={selectedPlayerId}
                onSelectPlayer={setSelectedPlayerId}
                isDesktop={isDesktop}
                currentBattlegroup={currentBattlegroup}
                mapType={props.plan.mapType}
                selectedNodeId={selectedNodeId}
                onMoveDefender={handleMoveDefender}
                isReadOnly={isReadOnly}
            />
        )}

        {/* Main Content Area */}
        <div className={cn(
            "flex-1 flex flex-col min-w-0 min-h-0",
        )}>
          {/* Header */}
          <div className={cn(
              "flex-none flex flex-col md:flex-row md:items-center justify-between p-3 sm:px-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm z-10 gap-3 md:gap-4",
              isFullscreen && "hidden"
          )}>
             {/* Top Row on Mobile: Context & View Toggle */}
             <div className="flex items-center justify-between w-full md:w-auto gap-4">
                 {/* LEFT: Context & Metadata */}
                 <div className="flex items-center gap-4 overflow-hidden min-w-0">
                    <Link href="/planning/defense" className="flex-none">
                      <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    </Link>
                    <div className="flex flex-col overflow-hidden min-w-0">
                      <div className="flex items-center gap-2">
                         <Shield className="h-4 w-4 text-indigo-500 flex-shrink-0" />
                         <h1 className="text-base sm:text-lg font-bold text-slate-100 truncate">{props.plan.name}</h1>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 whitespace-nowrap overflow-x-auto no-scrollbar mask-linear-fade">
                         <span>{props.plan.mapType === WarMapType.BIG_THING ? 'Big Thing' : 'Standard'}</span>
                         
                         <span className="text-slate-700">•</span>

                         {/* Compact Tier Selector */}
                         <Select 
                            value={activeTier ? String(activeTier) : "none"} 
                            onValueChange={handleTierChange}
                            disabled={isReadOnly}
                         >
                            <SelectTrigger className="h-auto w-auto p-0 border-none bg-transparent text-xs text-slate-400 hover:text-indigo-300 focus:ring-0 gap-1">
                                <span className="truncate">Tier: <span className={activeTier ? "text-indigo-400 font-medium" : ""}>{activeTier ?? '-'}</span></span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Tier</SelectItem>
                                {[1, 2, 3, 4, 5, 6].map(t => (
                                    <SelectItem key={t} value={String(t)}>
                                        Tier {t}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                         </Select>

                         <span className="text-slate-700">•</span>

                         {/* Compact Tactic Selector */}
                         <Select 
                            value={activeTagId ? String(activeTagId) : "none"} 
                            onValueChange={handleTagChange}
                            disabled={isReadOnly}
                         >
                            <SelectTrigger className="h-auto w-auto p-0 border-none bg-transparent text-xs text-slate-400 hover:text-teal-300 focus:ring-0 gap-1 max-w-[150px]">
                                 <span className="truncate">Tag: <span className={activeTagId ? "text-teal-400 font-medium" : ""}>{activeTag?.name ?? '-'}</span></span>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">No Tag</SelectItem>
                                {props.availableTags.map(t => (
                                    <SelectItem key={t.id} value={String(t.id)}>
                                        <span className="truncate">{t.name}</span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                         </Select>
                      </div>
                    </div>
                 </div>

                 {/* Mobile View Toggle */}
                 <div className="flex md:hidden items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800 shrink-0">
                    <Button
                        variant={viewMode === 'roster' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleViewModeChange('roster')}
                        className="h-7 px-2 text-xs"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                        variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleViewModeChange('map')}
                        className="h-7 px-2 text-xs"
                    >
                        <MapIcon className="h-3.5 w-3.5" />
                    </Button>
                 </div>
             </div>

             {/* CENTER: BG Navigation */}
             <div className="flex items-center p-1 rounded-lg bg-slate-900 border border-slate-800 md:absolute md:left-1/2 md:-translate-x-1/2 mx-auto shrink-0">
                <button
                    onClick={() => setActiveTab('bg1')}
                    className={cn(
                        "px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all border border-transparent",
                        !props.bgColors && activeTab === 'bg1' 
                            ? "bg-red-500/10 text-red-400 border-red-500/20 shadow-sm ring-1 ring-red-500/20"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                    )}
                    style={getButtonStyle(1, activeTab === 'bg1')}
                >
                    BG 1
                </button>
                <button
                    onClick={() => setActiveTab('bg2')}
                    className={cn(
                        "px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all border border-transparent",
                        !props.bgColors && activeTab === 'bg2' 
                            ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-sm ring-1 ring-blue-500/20"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                    )}
                    style={getButtonStyle(2, activeTab === 'bg2')}
                >
                    BG 2
                </button>
                <button
                    onClick={() => setActiveTab('bg3')}
                    className={cn(
                        "px-4 py-1 text-xs font-bold uppercase tracking-wider rounded-md transition-all border border-transparent",
                        !props.bgColors && activeTab === 'bg3' 
                            ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 shadow-sm ring-1 ring-yellow-500/20"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                    )}
                    style={getButtonStyle(3, activeTab === 'bg3')}
                >
                    BG 3
                </button>
             </div>

             {/* RIGHT: View & Actions */}
             <div className="hidden md:flex items-center gap-2">
                 <div className="flex items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                    <Button
                        variant={viewMode === 'roster' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleViewModeChange('roster')}
                        className="h-7 px-2.5 gap-2 text-xs"
                        title="Roster View"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Roster</span>
                    </Button>
                    <Button
                        variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => handleViewModeChange('map')}
                        className="h-7 px-2.5 gap-2 text-xs"
                        title="Map View"
                    >
                        <MapIcon className="h-3.5 w-3.5" />
                        <span className="hidden xl:inline">Map</span>
                    </Button>
                 </div>

                 <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

                 <Button
                    variant={rightPanelState === 'stats' ? "secondary" : "outline"}
                    size="sm"
                    onClick={toggleStats}
                    className="flex gap-2 h-8"
                 >
                    <PieChart className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Stats</span>
                 </Button>

                 <Button
                    variant={rightPanelState === 'tools' ? "secondary" : "outline"}
                    size="sm"
                    onClick={toggleTools}
                    className="flex gap-2 h-8"
                 >
                    <Wrench className="h-3.5 w-3.5" />
                    <span className="hidden lg:inline">Tools</span>
                 </Button>
                 {loadingPlacements && <Loader2 className="h-4 w-4 animate-spin text-slate-500" />}
             </div>
          </div>

          {/* Main View */}
          {viewMode === 'map' ? (
              <WarTabs 
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                  isFullscreen={isFullscreen}
                  loadingFights={loadingPlacements}
                  currentFights={currentPlacements}
                  mapType={props.plan.mapType}
                  selectedNodeId={selectedNodeId}
                  historyFilters={{ onlyCurrentTier: false, onlyAlliance: false, minSeason: undefined }}
                  activeTactic={null}
                  activeTag={activeTag || null} // Pass activeTag
                  onNodeClick={handleNodeClick}
                  onToggleFullscreen={handleToggleFullscreen}
                  rightPanelState={rightPanelState}
                  highlightedPlayerId={selectedPlayerId}
                  onTogglePlayerPanel={handleTogglePlayerPanel}
                  isPlayerPanelOpen={isPlayerPanelOpen}
                  hideTabsList={true}
                  bgColors={props.bgColors}
              />
          ) : (
              <div className="flex-1 overflow-hidden flex flex-col">
                  <DefenseRosterView 
                     players={props.players}
                     placements={currentPlacements}
                     onRemove={handleRemovePlacement}
                     onEdit={handleEditPlacement}
                     onAdd={handleAddForPlayer}
                     currentBattlegroup={currentBattlegroup}
                     mapType={props.plan.mapType}
                     selectedPlayerId={selectedPlayerId}
                     onSelectPlayer={setSelectedPlayerId}
                     activeTag={activeTag || null} // Pass Tag instead of Tactic
                     onMove={handleMoveNode}
                     isReadOnly={isReadOnly}
                  />
              </div>
          )}
        </div>

        {/* Editor Sidebar */}
        <div className={cn(
            "bg-slate-950 border-l border-slate-800 transition-all duration-300 ease-in-out z-20 flex flex-col",
            (rightPanelState === 'editor' || rightPanelState === 'tools' || rightPanelState === 'stats') ? "w-full md:w-[400px]" : "w-0 overflow-hidden"
        )}>
             {rightPanelState === 'editor' && (
                 <DefenseEditor 
                    onClose={handleEditorClose}
                    planId={props.planId}
                    nodeId={selectedNodeId}
                    dbNodeId={selectedDbNodeId}
                    currentPlacement={selectedPlacement}
                    onSave={handleSavePlacement}
                    champions={props.champions}
                    players={props.players}
                    onNavigate={handleNavigateNode}
                    mapType={props.plan.mapType}
                    activeTactic={null}
                    tier={activeTier}
                    currentBattlegroup={currentBattlegroup}
                    nodeData={selectedNodeId ? nodesMap.get(selectedNodeId) : undefined}
                    isReadOnly={isReadOnly}
                    bgPlacements={currentPlacements}
                 />
             )}
             {rightPanelState === 'tools' && (
                 <PlanningToolsPanel
                    key={currentBattlegroup}
                    players={props.players}
                    champions={props.champions}
                    allianceId={props.plan.allianceId}
                    onClose={handleEditorClose}
                    currentBattlegroup={currentBattlegroup}
                    onAddExtra={handleAddFromTool}
                    initialPlayerId={selectedPlayerId}
                    assignedChampions={currentPlacements
                        .filter(p => p.playerId && p.defenderId)
                        .map(p => ({ playerId: p.playerId!, championId: p.defenderId! }))
                    }
                    activeTag={activeTag || null}
                    isReadOnly={isReadOnly}
                 />
             )}
             {rightPanelState === 'stats' && (
                 <DefenseStatsPanel
                    onClose={handleEditorClose}
                    placements={currentPlacements}
                    activeTag={activeTag || null}
                    currentBattlegroup={currentBattlegroup}
                 />
             )}
        </div>

      </div>
    </PlayerColorProvider>
  );
}