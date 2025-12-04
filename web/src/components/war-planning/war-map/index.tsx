'use client';

import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import { Stage, Layer } from 'react-konva';
import { Maximize2, Minimize2, History, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBatchHistoricalCounters, HistoricalFightStat } from '@/app/planning/history-actions';
import { WarTactic, War, WarMapType } from '@prisma/client';
import { LAYOUT, LAYOUT_BIG, warNodesData, warNodesDataBig } from '../nodes-data';
import { FightWithNode } from '../types';
import { WarMapBackground } from './map-background';
import { CanvasNode } from './canvas-node';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';

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
  highlightedPlayerId: string | null;
  onTogglePlayerPanel?: () => void;
  isPlayerPanelOpen?: boolean;
}

const WarMap = memo(function WarMap({
  onNodeClick,
  selectedNodeId,
  currentWar,
  historyFilters,
  fights,
  activeTactic,
  isFullscreen,
  onToggleFullscreen,
  highlightedPlayerId,
  onTogglePlayerPanel,
  isPlayerPanelOpen
}: WarMapProps) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<Map<number, HistoricalFightStat[]>>(new Map());
  
  const isFull = isFullscreen !== undefined ? isFullscreen : internalFullscreen;
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 800 });

  // Determine Map Data based on War Type
  const isBigThing = currentWar?.mapType === WarMapType.BIG_THING;
  const currentNodesData = isBigThing ? warNodesDataBig : warNodesData;
  const currentLayout = isBigThing ? LAYOUT_BIG : LAYOUT;

  // Responsive Stage Size via ResizeObserver
  useEffect(() => {
      if (!containerRef.current) return;

      const resizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
              const { width, height } = entry.contentRect;
              setStageSize({ width, height });
          }
      });

      resizeObserver.observe(containerRef.current);

      return () => {
          resizeObserver.disconnect();
      };
  }, [isFull]); // Re-bind if fullscreen state changes container ref logic (though ref is stable)

  const handleToggleFullscreen = () => {
      if (onToggleFullscreen) {
          onToggleFullscreen();
      } else {
          setInternalFullscreen(!internalFullscreen);
      }
  };

  // Fetch history
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
          const options = {
            minTier: historyFilters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
            maxTier: historyFilters.onlyCurrentTier && currentWar?.warTier ? currentWar.warTier : undefined,
            allianceId: historyFilters.onlyAlliance && currentWar?.allianceId ? currentWar.allianceId : undefined,
            minSeason: historyFilters.minSeason,
          };

          const batchResults = await getBatchHistoricalCounters(requests, options);
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

  // Center on selected node or init
  useEffect(() => {
    if (selectedNodeId && stageRef.current) {
        const targetNode = currentNodesData.find(n => n.id === selectedNodeId);
        if (targetNode) {
            const stage = stageRef.current;
            const scale = stage.scaleX();
            
            const newPos = {
                x: -targetNode.x * scale + stage.width() / 2,
                y: -targetNode.y * scale + stage.height() / 2
            };
            
            stage.to({
                x: newPos.x,
                y: newPos.y,
                duration: 0.5,
                easing: Konva.Easings.EaseInOut
            });
        }
    }
  }, [selectedNodeId, currentNodesData]);

  // Initial Centering (Once per layout)
  useEffect(() => {
      if (stageRef.current) {
          const stage = stageRef.current;
          const initialScale = isBigThing ? 0.5 : 0.6; // Slightly zoomed out for Big Thing if needed, or consistent
          const newPos = {
              x: (stage.width() - currentLayout.WIDTH * initialScale) / 2,
              y: (stage.height() - currentLayout.HEIGHT * initialScale) / 2
          };
          stage.scale({ x: initialScale, y: initialScale });
          stage.position(newPos);
      }
  }, [isBigThing, currentLayout]); // Re-run if map type changes

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();

    if (!stage) return;

    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition();

    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy;
    
    if (newScale > 4) newScale = 4;
    if (newScale < 0.2) newScale = 0.2;

    stage.scale({ x: newScale, y: newScale });

    const newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      // Prevent page scrolling/zooming when interacting with the map
      e.preventDefault();
  };

  const fightsByNode = useMemo(() => {
    const map = new Map<number, FightWithNode>();
    fights.forEach(fight => {
      map.set(fight.node.nodeNumber, fight);
    });
    return map;
  }, [fights]);

  return (
    <div 
        className={cn(
            "relative border rounded-md overflow-hidden bg-slate-950 transition-all duration-300",
            !onToggleFullscreen && isFull ? "fixed inset-0 z-50 w-screen h-screen rounded-none" : "w-full h-full"
        )}
        ref={containerRef}
        style={{ touchAction: 'none' }} // Critical for preventing page scroll/zoom on mobile
        onTouchMove={handleTouchMove}
    >
      {/* Top Left: Player Panel Toggle */}
      {onTogglePlayerPanel && (
        <div className="absolute top-4 left-4 z-10">
           <Button
             variant={isPlayerPanelOpen ? "default" : "secondary"}
             size="icon"
             onClick={onTogglePlayerPanel}
             title="Toggle Roster"
             className={cn(
               "border border-slate-700",
               isPlayerPanelOpen 
                 ? "bg-indigo-600 hover:bg-indigo-700 text-white" 
                 : "bg-slate-900/80 hover:bg-slate-800 text-slate-200"
             )}
           >
             <Users className="h-5 w-5" />
           </Button>
        </div>
      )}

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

      <Stage 
        width={stageSize.width} 
        height={stageSize.height} 
        draggable
        onWheel={handleWheel}
        ref={stageRef}
        style={{ cursor: 'grab' }}
        onDragStart={() => {
            if (stageRef.current) stageRef.current.container().style.cursor = 'grabbing';
        }}
        onDragEnd={() => {
            if (stageRef.current) stageRef.current.container().style.cursor = 'grab';
        }}
      >
        {/* Background Layer */}
        <Layer listening={false}>
            <WarMapBackground isBigThing={isBigThing} />
        </Layer>

        {/* Interactive Nodes Layer */}
        <Layer>
            {currentNodesData.map(node => {
              const numericId = typeof node.id === 'number' ? node.id : parseInt(node.id as string);
              const fight = fightsByNode.get(numericId);
              const history = showHistory && fight?.defender ? historyData.get(numericId) : null;
              const isSelected = selectedNodeId === numericId;

              return (
                <CanvasNode
                    key={node.id}
                    node={node}
                    fight={fight}
                    isSelected={isSelected}
                    onNodeClick={onNodeClick}
                    showHistory={showHistory}
                    history={history}
                    activeTactic={activeTactic}
                    highlightedPlayerId={highlightedPlayerId}
                />
              );
            })}
        </Layer>
      </Stage>
    </div>
  );
});

export default WarMap;

