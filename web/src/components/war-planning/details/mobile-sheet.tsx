import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useDragControls, useAnimation, PanInfo, useMotionValue } from "framer-motion";
import NodeEditor from "../node-editor";
import { PlayerWithRoster, FightWithNode } from "../types";
import { Champion } from "@/types/champion";
import { War, WarFight, WarTactic } from "@prisma/client";
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { RightPanelState } from "../hooks/use-war-planning";

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
  historyFilters: any;
  onHistoryFiltersChange: any;
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
  const dragControls = useDragControls();
  const sheetRef = useRef<HTMLDivElement>(null);
  const sheetHeight = useMotionValue(0); // Tracks current height

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

  // Manually handle drag to update height
  const handleDrag = useCallback((event: any, info: PanInfo) => {
    // If dragging down (positive delta.y), height should decrease.
    // If dragging up (negative delta.y), height should increase.
    let newHeight = sheetHeight.get() - info.delta.y; // Correctly adjusts height from drag

    // Clamp height between min_drag_height (handle only) and expanded height
    newHeight = Math.max(minDragHeight, Math.min(newHeight, expandedHeight));
    sheetHeight.set(newHeight);
  }, [sheetHeight, minDragHeight, expandedHeight]);

  const handleDragEnd = useCallback((event: any, info: PanInfo) => {
      const currentHeight = sheetHeight.get();
      const velocity = info.velocity.y; // Velocity in Y direction

      let targetHeight = currentHeight; // Default: stay where it was dragged

      // Determine target snap height based on velocity (flick gesture)
      if (velocity < -300) { // Flicked up significantly
          targetHeight = expandedHeight;
      } else if (velocity > 300) { // Flicked down significantly
          targetHeight = minDragHeight;
      }
      // No 'else' block for proximity snapping - allows for continuous adjustment

      // Check if we should close the sheet
      // If target is min drag height and velocity was strongly down, consider closing
      if (targetHeight <= minDragHeight + 10 && velocity > 200) { // +10 buffer
          onClose(); // Close the sheet completely
          controls.start({ height: 0 });
          sheetHeight.set(0);
      } else {
          // Clamp targetHeight just in case (though handleDrag should already do this)
          targetHeight = Math.max(minDragHeight, Math.min(targetHeight, expandedHeight));
          controls.start({ height: targetHeight });
          sheetHeight.set(targetHeight); // Ensure motion value is synced after animation
      }
  }, [sheetHeight, minDragHeight, expandedHeight, controls, onClose]);


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
                    onDrag={handleDrag} // Manual drag event for height manipulation
                    onDragEnd={handleDragEnd} // Pass dragEnd to the handle as well
                    dragControls={dragControls} // Link dragControls to this motion div
                    dragListener={false} // Important: we initiate drag from the handle
                    // Dummy constraints. Real constraints handled in handleDrag/handleDragEnd
                    dragConstraints={{ top: 0, bottom: 0 }} 
                    className="w-full bg-slate-950 border-t border-slate-800 rounded-t-xl shadow-2xl flex flex-col shrink-0"
                    style={{ height: sheetHeight, willChange: "height" }} // Use motion value for height
                >
                    {/* Drag Handle */}
                    <div 
                        onPointerDown={(e) => dragControls.start(e)}
                        className="w-full h-9 flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-900 hover:bg-slate-800 transition-colors rounded-t-xl shrink-0 touch-none"
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
