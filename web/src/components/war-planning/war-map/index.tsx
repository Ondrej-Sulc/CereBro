'use client';

import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import { Maximize2, Minimize2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBatchHistoricalCounters, HistoricalFightStat } from '@/app/planning/history-actions';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { WarTactic, War } from '@prisma/client';
import { LAYOUT, warNodesData } from '../nodes-data';
import { FightWithNode } from '../types';
import { WarMapBackground } from './map-background';
import { WarNodeGroup } from './map-node';

interface WarMapProps {
  warId: string;
  battlegroup: number;
  onNodeClick: (nodeId: number, fight?: FightWithNode) => void;
  selectedNodeId?: number | null;
  currentWar?: War;
  historyFilters: {
    onlyCurrentTier: boolean;
    onlyAlliance: boolean;
    minSeason: number | undefined;
  };
  fights: FightWithNode[];
  activeTactic?: WarTactic | null;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const WarMap = memo(function WarMap({ 
  warId, 
  battlegroup, 
  onNodeClick, 
  selectedNodeId,
  currentWar,
  historyFilters,
  fights,
  activeTactic,
  isFullscreen,
  onToggleFullscreen
}: WarMapProps) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<Map<number, HistoricalFightStat[]>>(new Map());
  
  const isFull = isFullscreen !== undefined ? isFullscreen : internalFullscreen;
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  const handleToggleFullscreen = () => {
      if (onToggleFullscreen) {
          onToggleFullscreen();
      } else {
          setInternalFullscreen(!internalFullscreen);
      }
  };

  // Fetch history when toggle is enabled (Batch optimized)
  useEffect(() => {
    async function fetchAllHistory() {
      if (!showHistory || fights.length === 0) return;

      const nodesWithDefenders = fights.filter(f => f.defenderId);
      if (nodesWithDefenders.length === 0) return;

      const requests = nodesWithDefenders.map(f => ({
          nodeNumber: f.node.nodeNumber,
          defenderId: f.defenderId!
      }));

      try {
          // Prepare batch options
          const options = {
            minTier: historyFilters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
            maxTier: historyFilters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
            allianceId: historyFilters.onlyAlliance && currentWar?.allianceId ? currentWar.allianceId : undefined,
            minSeason: historyFilters.minSeason,
          };

          const batchResults = await getBatchHistoricalCounters(requests, options as any);
          const historyMap = new Map<number, HistoricalFightStat[]>();
          Object.entries(batchResults).forEach(([nodeNumStr, stats]) => {
              historyMap.set(Number(nodeNumStr), stats);
          });
          setHistoryData(historyMap);
      } catch (err) {
          console.error("Failed to fetch history batch:", err);
      }
    }

    if (showHistory) {
        fetchAllHistory();
    }
  }, [showHistory, fights, historyFilters, currentWar]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFull) {
        handleToggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFull, onToggleFullscreen, internalFullscreen]); // Dependencies for effect

  // Auto-pan to selected node
  useEffect(() => {
    if (selectedNodeId && transformRef.current) {
        const timer = setTimeout(() => {
            const state = transformRef.current?.instance.transformState;
            const currentScale = state ? state.scale : 1;
            
            // "node-g-{id}" is the ID we assign to the group
            transformRef.current?.zoomToElement(
                `node-g-${selectedNodeId}`, 
                currentScale, 
                600, 
                "easeOut"
            );
        }, 50); 
        return () => clearTimeout(timer);
    }
  }, [selectedNodeId]);

  const fightsByNode = useMemo(() => {
    const map = new Map<number, FightWithNode>();
    fights.forEach(fight => {
      map.set(fight.node.nodeNumber, fight);
    });
    return map;
  }, [fights]);

  return (
    <div className={cn(
      "relative border rounded-md overflow-hidden bg-slate-950 transition-all duration-300",
      // If not controlled, we handle fullscreen styles here.
      // If controlled, parent handles it.
      !onToggleFullscreen && isFull ? "fixed inset-0 z-50 w-screen h-screen rounded-none" : "w-full h-full"
    )}>
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button
          variant={showHistory ? "default" : "secondary"}
          size="icon"
          onClick={() => setShowHistory(!showHistory)}
          title="Toggle Historical Counters"
          className={cn(
            "border border-slate-700",
            showHistory ? "bg-indigo-600 hover:bg-indigo-700 text-white" : "bg-slate-900/80 hover:bg-slate-800 text-slate-200"
          )}
        >
          <History className="h-5 w-5" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleToggleFullscreen}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200"
        >
          {isFull ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </Button>
      </div>

      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.5}
        maxScale={4}
        limitToBounds={false}
        centerOnInit
      >
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{ width: '100%', height: '100%' }}
        >
          <svg 
            viewBox={`0 0 ${LAYOUT.WIDTH} ${LAYOUT.HEIGHT}`} 
            className="w-full h-full overflow-visible" 
            style={{ backgroundColor: '#020617' }}
          >
            <style>
              {`
                @keyframes twinkle {
                  0%, 100% { opacity: 0.2; }
                  50% { opacity: 1; }
                }
                .star-anim {
                  animation: twinkle infinite ease-in-out;
                }
              `}
            </style>
            
            <WarMapBackground />

            {/* Nodes */}
            {warNodesData.map(node => {
              const numericId = typeof node.id === 'number' ? node.id : parseInt(node.id as string);
              const fight = fightsByNode.get(numericId);
              const history = showHistory && fight?.defender ? historyData.get(numericId) : null;
              const isSelected = selectedNodeId === numericId;

              return (
                <WarNodeGroup
                    key={node.id}
                    node={node}
                    fight={fight}
                    isSelected={isSelected}
                    onNodeClick={onNodeClick}
                    showHistory={showHistory}
                    history={history}
                    activeTactic={activeTactic}
                />
              );
            })}
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
});

export default WarMap;