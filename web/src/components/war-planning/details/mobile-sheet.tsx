import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useDragControls, useAnimation, PanInfo, useMotionValue } from "framer-motion";
import NodeEditor from "../node-editor";
import { PlayerWithRoster, FightWithNode, SeasonBanWithChampion, WarBanWithChampion } from "../types";
import { Champion } from "@/types/champion";
import { War, WarFight, WarTactic } from "@prisma/client";
import { HistoricalFightStat } from "@/app/planning/history-actions";
import { RightPanelState, ExtraChampion } from "../hooks/use-war-planning";
import { PlayerListContent } from "./player-list-content";

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
  onHistoryFiltersChange: React.Dispatch<React.SetStateAction<HistoryFilters>>; 
  historyCache: React.MutableRefObject<Map<string, HistoricalFightStat[]>>;
  onClose: () => void;
  onNavigate: (direction: number) => void;
  onSave: (updatedFight: Partial<WarFight> & { prefightChampionIds?: number[] }) => void;
  seasonBans: SeasonBanWithChampion[];
  warBans: WarBanWithChampion[];
  // Roster props
  currentFights: FightWithNode[];
  selectedPlayerId: string | null;
  onSelectPlayer: (id: string | null) => void;
  currentBattlegroup: number;
  extraChampions: ExtraChampion[];
  onAddExtra: (playerId: string, championId: number) => void;
  onRemoveExtra: (extraId: string) => void;
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
  seasonBans,
  warBans,
  currentFights,
  selectedPlayerId,
  onSelectPlayer,
  currentBattlegroup,
  extraChampions,
  onAddExtra,
  onRemoveExtra
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
  
  // Track user preference ('collapsed' or 'expanded') to persist state across opens
  const [preferredMode, setPreferredMode] = useState<'collapsed' | 'expanded'>('collapsed');

  // Load preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('war-planning-sheet-mode');
    if (saved === 'expanded') {
        setPreferredMode('expanded');
    }
  }, []);

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

  const isOpen = rightPanelState === 'editor' || rightPanelState === 'roster';

  useEffect(() => {
      if (isOpen) {
          // Open to preferred height
          const target = preferredMode === 'expanded' ? expandedHeight : collapsedHeight;
          if (target > 0) {
              controls.start({ height: target });
              // We don't set sheetHeight here immediately to allow animation to play from 0 (if mounting)
              // or from current position.
          }
      } else {
          controls.start({ height: 0 }); // When closed, fully collapse
          sheetHeight.set(0);
      }
  }, [isOpen, preferredMode, controls, expandedHeight, collapsedHeight, sheetHeight]);

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
      let newMode = preferredMode; // Default keep current
      
      // If dragged very low (near handle), close
      if (currentHeight < minDragHeight + 20) {
          onClose();
          controls.start({ height: 0 });
          sheetHeight.set(0);
          return;
      }
      
      const SNAP_THRESHOLD = 50;
      if (Math.abs(currentHeight - expandedHeight) < SNAP_THRESHOLD) {
           targetHeight = expandedHeight;
           newMode = 'expanded';
      } else if (Math.abs(currentHeight - collapsedHeight) < SNAP_THRESHOLD) {
           targetHeight = collapsedHeight;
           newMode = 'collapsed';
      } else if (Math.abs(currentHeight - minDragHeight) < SNAP_THRESHOLD) {
           targetHeight = minDragHeight;
           // If minimized, maybe treat as collapsed preference?
           newMode = 'collapsed';
      } else {
           // If released in between, snap to closest
           const distToExpanded = Math.abs(currentHeight - expandedHeight);
           const distToCollapsed = Math.abs(currentHeight - collapsedHeight);
           if (distToExpanded < distToCollapsed) {
               targetHeight = expandedHeight;
               newMode = 'expanded';
           } else {
               targetHeight = collapsedHeight;
               newMode = 'collapsed';
           }
      }

      // Update state and storage
      if (newMode !== preferredMode) {
          setPreferredMode(newMode);
          localStorage.setItem('war-planning-sheet-mode', newMode);
      }

      controls.start({ height: targetHeight });
      // We animate to targetHeight
  }, [sheetHeight, minDragHeight, collapsedHeight, expandedHeight, controls, onClose, preferredMode]);

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
      {/* We only render the sheet if it's in open state, otherwise its height is 0 */}
      {isOpen && (
        <motion.div
            key="mobile-sheet"
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
               {rightPanelState === 'editor' ? (
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
                    seasonBans={seasonBans}
                    warBans={warBans}
                />
               ) : (
                 <PlayerListContent
                    players={players}
                    currentFights={currentFights}
                    highlightedPlayerId={selectedPlayerId}
                    onSelectPlayer={onSelectPlayer}
                    currentBattlegroup={currentBattlegroup}
                    extraChampions={extraChampions}
                    onAddExtra={onAddExtra}
                    onRemoveExtra={onRemoveExtra}
                    champions={champions}
                    onClose={onClose}
                 />
               )}
            </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
