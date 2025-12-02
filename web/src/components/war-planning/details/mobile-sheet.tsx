import { useEffect, useState } from "react";
import { motion, AnimatePresence, useDragControls, useAnimation, PanInfo } from "framer-motion";
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
  const [currentY, setCurrentY] = useState<number | string>(0);
  
  // Snap points (y offsets)
  // 0 = Expanded (Full height)
  // "60%" = Collapsed (Pushed down by 60% of its height)
  const EXPANDED_Y = 0;
  const COLLAPSED_Y = "60%";

  useEffect(() => {
      if (rightPanelState === 'editor') {
          // Default to collapsed view on open for better map visibility
          controls.start({ y: COLLAPSED_Y });
          setCurrentY(COLLAPSED_Y);
      }
  }, [rightPanelState, controls]);

  const handleDragEnd = (event: any, info: PanInfo) => {
      const offset = info.offset.y;
      const velocity = info.velocity.y;

      // Logic for snapping based on drag direction and velocity
      if (velocity > 500 || offset > 250) {
           // Dragged down fast or far -> Close
           onClose();
      } else if (velocity < -500) {
           // Dragged up fast -> Expand
           controls.start({ y: EXPANDED_Y });
           setCurrentY(EXPANDED_Y);
      } else {
           // Snap to nearest state
           // If we are currently collapsed (string "60%"), we check if dragged up significantly
           if (currentY === COLLAPSED_Y) {
               if (offset < -50) {
                   controls.start({ y: EXPANDED_Y });
                   setCurrentY(EXPANDED_Y);
               } else {
                   controls.start({ y: COLLAPSED_Y });
               }
           } else {
               // If expanded (0), check if dragged down
               if (offset > 50) {
                   controls.start({ y: COLLAPSED_Y });
                   setCurrentY(COLLAPSED_Y);
               } else {
                   controls.start({ y: EXPANDED_Y });
               }
           }
      }
  };

  if (isDesktop) return null;

  return (
    <AnimatePresence>
      {rightPanelState === 'editor' && (
        <motion.div
            key="mobile-node-editor-sheet"
            initial={{ y: "100%" }}
            animate={controls}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            className="fixed left-0 right-0 bottom-0 z-50 h-[85vh] bg-slate-950 border-t border-slate-800 rounded-t-xl shadow-2xl flex flex-col"
            style={{ willChange: "transform" }}
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
