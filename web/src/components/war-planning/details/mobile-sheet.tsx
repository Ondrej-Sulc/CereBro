import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useDragControls, useAnimation, PanInfo, useMotionValue } from "framer-motion";
import NodeEditor from "../node-editor";
import { PlayerWithRoster, FightWithNode } from "../types";
import { Champion } from "@/types/champion";
import { War, WarFight, WarTactic } from "@prisma/client";
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { RightPanelState } from "../hooks/use-war-planning";

interface HistoryFilters {
  onlyCurrentTier: boolean;
  onlyAlliance: boolean;
  minSeason: number | undefined;
}

interface MobileSheetProps {
  isDesktop: boolean;
  rightPanelState: RightPanelState;
  selectedNodeId: number | null;
  selectedFight: FightWithNode | null;
  warId: string;
  war: War;
  champions: Champion[];
  players: PlayerWithRoster[];
  activeTactic: WarTactic | null;
  historyFilters: HistoryFilters;
  onHistoryFiltersChange: React.Dispatch<React.SetStateAction<HistoryFilters>>; // Changed type
  historyCache: React.MutableRefObject<Map<string, HistoricalFightStat[]>>;
  onClose: () => void;
  onNavigate: (direction: number) => void;
  onSave: (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => void;
}

export function MobileSheet({
  isDesktop,
  rightPanelState,
  selectedNodeId,
  selectedFight,
  warId,
  war,
  champions,
  players,
  activeTactic,
  historyFilters,
  onHistoryFiltersChange,
  historyCache,
  onClose,
  onNavigate,
  onSave,
}: MobileSheetProps) {
  const controls = useAnimation();
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetHeight = useMotionValue(0); // Tracks current height

  // Refs for drag state
  const isDragging = useRef(false);
  const startY = useRef(0);
  const startHeight = useRef(0);

  // Snap points for height (in pixels)
  // These need to be responsive to actual screen height.
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


  useEffect(() => {
      if (rightPanelState === 'editor') {
          // Default to collapsed view on open for better map visibility
          controls.start({ height: collapsedHeight });
          sheetHeight.set(collapsedHeight);
      } else {
          controls.start({ height: 0 }); // When closed, fully collapse
          sheetHeight.set(0);
      }
  }, [rightPanelState, controls, sheetHeight, collapsedHeight]);

  // Pointer Event Handlers for Resizing
  const handlePointerMove = useCallback((e: PointerEvent) => {
      if (!isDragging.current) return;

      e.preventDefault(); // Prevent scrolling while dragging
      const deltaY = startY.current - e.clientY; // Dragging UP (negative clientY delta) increases height
      let newHeight = startHeight.current + deltaY;

      // Clamp height between min_drag_height (handle only) and expanded height
      newHeight = Math.max(minDragHeight, Math.min(newHeight, expandedHeight));
      sheetHeight.set(newHeight);
  }, [minDragHeight, expandedHeight, sheetHeight]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;

      // Clean up listeners
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);

      const currentHeight = sheetHeight.get();
      
      // Simple snap logic based on nearest point or flick
      let targetHeight = currentHeight;
      
      // If dragged very low (near handle), close
      if (currentHeight < minDragHeight + 20) {
          onClose();
          controls.start({ height: 0 });
          sheetHeight.set(0);
          return;
      }
      
      // Determine target snap height based on position zones if not continuous
      // But user requested "move it anywhere".
      // We will only SNAP if it's close to the extremes, otherwise leave it.
      
      const SNAP_THRESHOLD = 50;
      if (Math.abs(currentHeight - expandedHeight) < SNAP_THRESHOLD) {
           targetHeight = expandedHeight;
      } else if (Math.abs(currentHeight - collapsedHeight) < SNAP_THRESHOLD) {
           targetHeight = collapsedHeight;
      } else if (Math.abs(currentHeight - minDragHeight) < SNAP_THRESHOLD) {
           targetHeight = minDragHeight;
      }
      // Otherwise targetHeight = currentHeight (Free movement)

      controls.start({ height: targetHeight });
      sheetHeight.set(targetHeight);
  }, [sheetHeight, minDragHeight, collapsedHeight, expandedHeight, controls, onClose, handlePointerMove]);

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
          window.removeEventListener('pointerup', handlePointerUp);
      };
  }, [handlePointerMove, handlePointerUp]);


  if (isDesktop) return null; // No longer needs to return null immediately

  return (
    <AnimatePresence>
      {/* We only render the sheet if it's in editor state, otherwise its height is 0 */}
      {rightPanelState === 'editor' && (
        <motion.div
            key="mobile-node-editor-sheet"
            ref={sheetRef}
            initial={{ height: 0 }}
            animate={controls}
            exit={{ height: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full bg-slate-950 border-t border-slate-800 shadow-2xl flex flex-col shrink-0"
            style={{ height: sheetHeight, willChange: "height" }} // Use motion value for height
        >
            {/* Drag Handle */}
            <div 
                onPointerDown={handlePointerDown}
                className="w-full h-6 flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-900 hover:bg-slate-800 transition-colors shrink-0 touch-none"
            >
                <div className="w-12 h-1.5 bg-slate-600 rounded-full" />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-hidden relative bg-slate-950">
                 <NodeEditor
                    key={selectedNodeId}
                    onClose={onClose}
                    warId={warId}
                    battlegroup={selectedFight?.battlegroup || 1}
                    nodeId={selectedNodeId}
                    currentFight={selectedFight}
                    onSave={onSave}
                    champions={champions}
                    players={players}
                    onNavigate={onNavigate}
                    currentWar={war}
                    historyFilters={historyFilters}
                    onHistoryFiltersChange={onHistoryFiltersChange}
                    historyCache={historyCache}
                    activeTactic={activeTactic}
                />
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
