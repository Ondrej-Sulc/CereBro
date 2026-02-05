import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useAnimation, useMotionValue } from "framer-motion";
import { RightPanelState } from "../hooks/use-war-planning";
import { WarDefensePlan, WarDefensePlacement, WarMapType, Tag } from "@prisma/client";
import { Champion } from "@/types/champion";
import { PlayerWithRoster, PlacementWithNode } from "@cerebro/core/data/war-planning/types";
import DefenseEditor from "../node-editor/defense-editor";
import PlanningToolsPanel from "../planning-tools-panel";
import DefenseStatsPanel from "../defense-stats-panel";

interface DefenseMobileSheetProps {
  isDesktop: boolean;
  rightPanelState: RightPanelState;
  onClose: () => void;
  // Common Props
  planId: string;
  currentBattlegroup: number;
  champions: (Champion & { tags?: { name: string }[] })[];
  players: PlayerWithRoster[];
  isReadOnly?: boolean;
  // Editor Props
  selectedNodeId: number | null;
  selectedDbNodeId: number | undefined;
  selectedPlacement: PlacementWithNode | null;
  handleSavePlacement: (placement: Partial<WarDefensePlacement>) => Promise<void>;
  handleNavigateNode: (direction: number) => void;
  mapType: WarMapType;
  activeTier: number | null;
  nodesMap: Map<number, any>;
  currentPlacements: PlacementWithNode[];
  // Tools Props
  allianceId: string;
  handleAddFromTool: (playerId: string, championId: number, starLevel?: number) => Promise<void>;
  selectedPlayerId: string | null;
  activeTag: Tag | null;
}

export function DefenseMobileSheet({
  isDesktop,
  rightPanelState,
  onClose,
  planId,
  currentBattlegroup,
  champions,
  players,
  isReadOnly,
  selectedNodeId,
  selectedDbNodeId,
  selectedPlacement,
  handleSavePlacement,
  handleNavigateNode,
  mapType,
  activeTier,
  nodesMap,
  currentPlacements,
  allianceId,
  handleAddFromTool,
  selectedPlayerId,
  activeTag
}: DefenseMobileSheetProps) {
  const controls = useAnimation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetHeight = useMotionValue(0); // Tracks current height

  // Refs for drag state
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Snap points for height (in pixels)
  const [minDragHeight, setMinDragHeight] = useState(0);
  const [collapsedHeight, setCollapsedHeight] = useState(0);
  const [expandedHeight, setExpandedHeight] = useState(0);
  
  // Recalculate heights on mount and resize
  useEffect(() => {
    const calculateHeights = () => {
      if (typeof window !== 'undefined') {
        const totalHeight = window.innerHeight;
        // Handle height around 40px for handle
        setMinDragHeight(40); 
        setCollapsedHeight(Math.max(40, totalHeight * 0.4)); // 40% of viewport height
        setExpandedHeight(Math.max(40, totalHeight * 0.85)); // 85% of viewport height
      }
    };

    calculateHeights();
    window.addEventListener('resize', calculateHeights);
    return () => window.removeEventListener('resize', calculateHeights);
  }, []);

  const isOpen = rightPanelState !== 'closed' && rightPanelState !== 'roster';

  useEffect(() => {
      if (isOpen) {
          // If opening, start at collapsed height. If already open, maintain current height.
          const target = sheetHeight.get() > 0 ? sheetHeight.get() : collapsedHeight;
          if (target > 0) {
              controls.start({ height: target });
          }
      } else {
          controls.start({ height: 0 }); // When closed, fully collapse
          sheetHeight.set(0);
      }
  }, [isOpen, controls, collapsedHeight, sheetHeight]);

  // Pointer Event Handlers for Resizing
  const handlePointerMove = useCallback((e: PointerEvent) => {
      if (!isDragging.current) return;

      const deltaY = startY.current - e.clientY; // Dragging UP (negative clientY delta) increases height
      let newHeight = startHeight.current + deltaY;

      // Clamp height between min_drag_height (handle only) and expanded height
      newHeight = Math.max(minDragHeight, Math.min(newHeight, expandedHeight));
      sheetHeight.set(newHeight);
  }, [minDragHeight, expandedHeight, sheetHeight]);

  const handlePointerUpRef = useRef<() => void>(() => {});

  const handlePointerUp = useCallback(() => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // Clean up listeners
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUpRef.current);

      const currentHeight = sheetHeight.get();
      
      // If dragged very low (near handle), close
      if (currentHeight < minDragHeight + 20) {
          onClose();
          controls.start({ height: 0 });
          sheetHeight.set(0);
          return;
      }
      // When released, animate to the current height (no snapping).
      controls.start({ height: currentHeight });
  }, [sheetHeight, minDragHeight, controls, onClose, handlePointerMove]);

  // Keep ref synced
  useEffect(() => {
    handlePointerUpRef.current = handlePointerUp;
  }, [handlePointerUp]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
      e.preventDefault(); // Prevent text selection
      isDragging.current = true;
      startY.current = e.clientY;
      startHeight.current = sheetHeight.get();

      // Attach window listeners to track drag outside the handle
      window.addEventListener('pointermove', handlePointerMove, { passive: false });
      window.addEventListener('pointerup', handlePointerUp);
  }, [sheetHeight, handlePointerMove, handlePointerUp]);

  // Cleanup on unmount
  useEffect(() => {
      return () => {
          window.removeEventListener('pointermove', handlePointerMove);
          window.removeEventListener('pointerup', handlePointerUpRef.current);
      };
  }, [handlePointerMove]);


  if (isDesktop) return null; // Hide mobile sheet on desktop

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
            key="defense-mobile-sheet"
            ref={sheetRef}
            initial={{ height: 0 }}
            animate={controls}
            exit={{ height: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full bg-slate-950 border-t border-slate-800 shadow-2xl flex flex-col shrink-0 fixed bottom-0 left-0 right-0 z-50"
            style={{ height: sheetHeight, willChange: "height" }} 
        >
            {/* Drag Handle */}
            <div 
                onPointerDown={handlePointerDown}
                className="w-full h-6 flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-900 hover:bg-slate-800 transition-colors shrink-0 touch-none rounded-t-lg"
            >
                <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative bg-slate-950">
                {rightPanelState === 'editor' && (
                     <DefenseEditor 
                        onClose={onClose}
                        planId={planId}
                        nodeId={selectedNodeId}
                        dbNodeId={selectedDbNodeId}
                        currentPlacement={selectedPlacement}
                        onSave={handleSavePlacement}
                        champions={champions}
                        players={players}
                        onNavigate={handleNavigateNode}
                        mapType={mapType}
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
                        players={players}
                        champions={champions}
                        allianceId={allianceId}
                        onClose={onClose}
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
                        onClose={onClose}
                        placements={currentPlacements}
                        activeTag={activeTag || null}
                        currentBattlegroup={currentBattlegroup}
                     />
                 )}
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
