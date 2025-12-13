"use client";

import { useState, useEffect, useCallback } from "react";
import { WarDefensePlan, WarDefensePlacement, WarMapType, Tag } from "@prisma/client";
import { Champion } from "@/types/champion";
import { cn } from "@/lib/utils";
import { PlayerWithRoster, FightWithNode } from "@cerebro/core/data/war-planning/types";
import { useDefensePlanning } from "./hooks/use-defense-planning";
import { WarTabs } from "./details/war-tabs";
import DefenseEditor from "./node-editor/defense-editor";
import { DefensePlayerListPanel } from "./details/defense-player-list-panel";
import PlanningToolsPanel from "./planning-tools-panel";
import { DefenseRosterView } from "./roster-view/defense-roster-view";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Shield, Users, Wrench, LayoutGrid, Map as MapIcon, Target } from "lucide-react";
import Link from "next/link";
import { PlayerColorProvider } from "./player-color-context";
import { useToast } from "@/hooks/use-toast";
import { updateDefensePlanHighlightTag } from "@/app/planning/defense-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getBattlegroupColor } from "@/lib/battlegroup-colors";

interface DefenseDetailsClientProps {
  plan: WarDefensePlan;
  planId: string;
  updatePlacement: (updatedPlacement: Partial<WarDefensePlacement>) => Promise<void>;
  champions: (Champion & { tags?: { name: string }[] })[];
  players: PlayerWithRoster[];
  availableTags: Tag[];
}

export default function DefenseDetailsClient(props: DefenseDetailsClientProps) {
  const { toast } = useToast();
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
    error,
    
    handleNodeClick,
    handleNavigateNode,
    handleEditorClose,
    handleSavePlacement,
    toggleTools
  } = useDefensePlanning(props);

  const [isDesktop, setIsDesktop] = useState(true);
  const [isPlayerPanelOpen, setIsPlayerPanelOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'roster' | 'map'>('roster');
  const [activeTagId, setActiveTagId] = useState<number | null>(props.plan.highlightTagId);

  const activeTag = props.availableTags.find(t => t.id === activeTagId);

  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.innerWidth >= 768);
    checkDesktop();
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);
  
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
      const tagId = val === "none" ? null : parseInt(val);
      setActiveTagId(tagId);
      try {
          await updateDefensePlanHighlightTag(props.planId, tagId);
          toast({ title: "Highlight Tag Updated" });
      } catch (e) {
          console.error(e);
          toast({ title: "Failed to update tag", variant: "destructive" });
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

  const handleAddForPlayer = useCallback((playerId: string) => {
      setSelectedPlayerId(playerId);
      setRightPanelState('tools');
  }, [setSelectedPlayerId, setRightPanelState]);

  const handleAddFromTool = useCallback(async (playerId: string, championId: number, starLevel?: number) => {
    // Determine Target Player: Explicitly passed playerId (from dropdown) OR currently selected player (from Roster View context)
    const targetPlayerId = playerId || selectedPlayerId;
    const championLimit = props.plan.mapType === WarMapType.BIG_THING ? 1 : 5;

    let targetNodeId: number | undefined;
    let targetNodeNumber: number | undefined;
    let targetPlacementId: string | undefined;

    // 1. Explicit Node Selection (Map Mode)
    if (selectedPlacement) {
        targetNodeId = selectedPlacement.nodeId;
        targetNodeNumber = selectedPlacement.node.nodeNumber;
        targetPlacementId = selectedPlacement.id;
    } else {
        // 2. Auto-Targeting (Roster Mode / No Node Selected)
        const sorted = [...currentPlacements].sort((a, b) => a.node.nodeNumber - b.node.nodeNumber);
        
        // Priority A: Find a node ALREADY assigned to this targetPlayer but has NO defender
        // We prioritize the specific player we are adding for.
        if (targetPlayerId) {
            const playerOpenSlot = sorted.find(p => p.playerId === targetPlayerId && !p.defenderId);
            if (playerOpenSlot) {
                targetNodeId = playerOpenSlot.nodeId;
                targetNodeNumber = playerOpenSlot.node.nodeNumber;
                targetPlacementId = playerOpenSlot.id;
            }
        }

        // Priority B: Find first completely empty node
        if (!targetNodeId) {
             const empty = sorted.find(p => !p.playerId && !p.defenderId);
             if (empty) {
                targetNodeId = empty.nodeId;
                targetNodeNumber = empty.node.nodeNumber;
                targetPlacementId = empty.id;
             }
        }
    }

    if (!targetNodeId) {
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
            p.nodeId !== targetNodeId 
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
        id: targetPlacementId,
        planId: props.planId,
        battlegroup: currentBattlegroup,
        nodeId: targetNodeId,
        playerId: targetPlayerId || playerId, // Ensure we assign to the correct player
        defenderId: championId,
        starLevel: finalStarLevel
    });

    toast({
        title: "Defender Assigned",
        description: `Assigned ${champName} to Node ${targetNodeNumber}.`
    });

  }, [selectedPlacement, selectedPlayerId, currentPlacements, handleSavePlacement, props.planId, currentBattlegroup, props.champions, props.players, props.plan.mapType, toast]);

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
  }, [currentPlacements, handleSavePlacement, props.planId, currentBattlegroup, toast]);

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
            />
        )}

        {/* Main Content Area */}
        <div className={cn(
            "flex-1 flex flex-col min-w-0 min-h-0",
        )}>
          {/* Header */}
          <div className={cn(
              "flex-none flex items-center justify-between p-3 sm:px-4 border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm z-10",
              isFullscreen && "hidden"
          )}>
             <div className="flex items-center gap-4 overflow-hidden">
                <Link href="/planning/defense">
                  <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                </Link>
                <div className="flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2">
                     <Shield className="h-5 w-5 text-indigo-500" />
                     <h1 className="text-lg font-bold text-slate-100 truncate">{props.plan.name}</h1>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                     <span>{props.plan.mapType === WarMapType.BIG_THING ? 'Big Thing' : 'Standard'}</span>
                  </div>
                </div>
             </div>

             {/* Center Controls */}
             <div className="flex items-center gap-2 md:gap-4">
                 {/* Tactic Selector */}
                 <div className="w-32 md:w-48 hidden md:block">
                     <Select value={activeTagId ? String(activeTagId) : "none"} onValueChange={handleTagChange}>
                        <SelectTrigger 
                            className={cn(
                                "h-7 text-xs border-slate-700",
                                activeTagId ? "bg-teal-950/30 border-teal-500/50 text-teal-100" : "bg-slate-900"
                            )}
                        >
                            <SelectValue placeholder="Highlight Tag" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No Highlight</SelectItem>
                            {props.availableTags.map(t => (
                                <SelectItem key={t.id} value={String(t.id)}>
                                    <span className="truncate">{t.name}</span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                     </Select>
                 </div>

                 {/* BG Toggle (Header Integrated) */}
                 <div className="flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800">
                    <button
                        onClick={() => setActiveTab('bg1')}
                        className={cn(
                            "px-3 py-1 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded transition-all border border-transparent",
                            activeTab === 'bg1' 
                                ? "bg-red-500/10 text-red-400 border-red-500/20 ring-1 ring-red-500/20 shadow-sm"
                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                        )}
                    >
                        BG 1
                    </button>
                    <button
                        onClick={() => setActiveTab('bg2')}
                        className={cn(
                            "px-3 py-1 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded transition-all border border-transparent",
                            activeTab === 'bg2' 
                                ? "bg-blue-500/10 text-blue-400 border-blue-500/20 ring-1 ring-blue-500/20 shadow-sm"
                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                        )}
                    >
                        BG 2
                    </button>
                    <button
                        onClick={() => setActiveTab('bg3')}
                        className={cn(
                            "px-3 py-1 text-[10px] md:text-xs font-bold uppercase tracking-wider rounded transition-all border border-transparent",
                            activeTab === 'bg3' 
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20 ring-1 ring-yellow-500/20 shadow-sm"
                                : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"
                        )}
                    >
                        BG 3
                    </button>
                 </div>

                 {/* View Toggle */}
                 <div className="flex items-center bg-slate-900/50 p-1 rounded-lg border border-slate-800">
                    <Button
                        variant={viewMode === 'roster' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('roster')}
                        className="h-7 px-3 gap-2 text-xs"
                    >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Roster</span>
                    </Button>
                    <Button
                        variant={viewMode === 'map' ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setViewMode('map')}
                        className="h-7 px-3 gap-2 text-xs"
                    >
                        <MapIcon className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Map</span>
                    </Button>
                 </div>
             </div>

             <div className="flex items-center gap-2">
                 <Button
                    variant={rightPanelState === 'tools' ? "secondary" : "outline"}
                    size="sm"
                    onClick={toggleTools}
                    className="hidden md:flex gap-2"
                 >
                    <Wrench className="h-4 w-4" />
                    <span className="hidden md:inline">Tools</span>
                 </Button>
                 {viewMode === 'map' && (
                     <Button
                        variant={isPlayerPanelOpen ? "secondary" : "outline"}
                        size="sm"
                        onClick={handleTogglePlayerPanel}
                        className="hidden md:flex gap-2"
                     >
                        <Users className="h-4 w-4" />
                        {isPlayerPanelOpen ? "Hide" : "Show"}
                     </Button>
                 )}
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
                  currentFights={currentPlacements as unknown as FightWithNode[]}
                  warId={props.planId}
                  mapType={props.plan.mapType}
                  selectedNodeId={selectedNodeId}
                  historyFilters={{ onlyCurrentTier: false, onlyAlliance: false, minSeason: undefined }}
                  // activeTactic={activeTactic || null} // WarTabs expects Tactic object. We have Tag. 
                  // WarTabs highlighting logic needs update if we want map highlighting.
                  // For now, pass null or update WarTabs later.
                  activeTactic={null} 
                  onNodeClick={handleNodeClick}
                  onToggleFullscreen={handleToggleFullscreen}
                  rightPanelState={rightPanelState}
                  highlightedPlayerId={selectedPlayerId}
                  onTogglePlayerPanel={handleTogglePlayerPanel}
                  isPlayerPanelOpen={isPlayerPanelOpen}
                  hideTabsList={true}
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
                  />
              </div>
          )}
        </div>

        {/* Editor Sidebar */}
        <div className={cn(
            "bg-slate-950 border-l border-slate-800 transition-all duration-300 ease-in-out z-20 flex flex-col",
            (rightPanelState === 'editor' || rightPanelState === 'tools') ? "w-full md:w-[400px]" : "w-0 overflow-hidden"
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
                    // activeTactic={activeTactic || null} // DefenseEditor expects Tactic. Pass null for now.
                    activeTactic={null}
                    currentBattlegroup={currentBattlegroup}
                 />
             )}
             {rightPanelState === 'tools' && (
                 <PlanningToolsPanel
                    players={props.players}
                    champions={props.champions}
                    allianceId={props.plan.allianceId}
                    onClose={handleEditorClose}
                    currentBattlegroup={currentBattlegroup}
                    onAddExtra={handleAddFromTool}
                    initialPlayerId={selectedPlayerId}
                    currentPlacements={currentPlacements}
                    activeTag={activeTag || null}
                 />
             )}
        </div>

      </div>
    </PlayerColorProvider>
  );
}