'use client';

import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import { Stage, Layer } from 'react-konva';
import { Maximize2, Minimize2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBatchHistoricalCounters, HistoricalFightStat } from '@/app/planning/history-actions';
import { WarTactic, War } from '@prisma/client';
import { LAYOUT, warNodesData } from '../nodes-data';
import { FightWithNode } from '../types';
import { WarMapBackground } from './map-background';
import { CanvasNode } from './canvas-node';
import Konva from 'konva';

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
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 800 });

  // Responsive Stage Size
  useEffect(() => {
      const updateSize = () => {
          if (containerRef.current) {
              setStageSize({
                  width: containerRef.current.offsetWidth,
                  height: containerRef.current.offsetHeight
              });
          }
      };
      updateSize();
      window.addEventListener('resize', updateSize);
      return () => window.removeEventListener('resize', updateSize);
  }, [isFull]);

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

  // Center on selected node or init
  useEffect(() => {
    if (selectedNodeId && stageRef.current) {
        const targetNode = warNodesData.find(n => n.id == selectedNodeId);
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
  }, [selectedNodeId]);

  // Initial Centering (Once)
  useEffect(() => {
      if (stageRef.current) {
          const stage = stageRef.current;
          const initialScale = 0.6;
          const newPos = {
              x: (stage.width() - LAYOUT.WIDTH * initialScale) / 2,
              y: (stage.height() - LAYOUT.HEIGHT * initialScale) / 2
          };
          stage.scale({ x: initialScale, y: initialScale });
          stage.position(newPos);
      }
  }, []); 

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
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
    >
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
            <WarMapBackground />
        </Layer>

        {/* Interactive Nodes Layer */}
        <Layer>
            {warNodesData.map(node => {
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
                />
              );
            })}
        </Layer>
      </Stage>
    </div>
  );
});

export default WarMap;
