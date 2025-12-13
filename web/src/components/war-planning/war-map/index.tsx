'use client';

import React, { useEffect, useState, useMemo, useRef, memo, useContext } from 'react';
import { Stage, Layer } from 'react-konva';
import { Maximize2, Minimize2, History, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBatchHistoricalCounters, HistoricalFightStat } from '@/app/planning/history-actions';
import { WarTactic, War, WarMapType } from '@prisma/client';
import { LAYOUT, LAYOUT_BIG, warNodesData, warNodesDataBig } from "@cerebro/core/data/war-planning/nodes-data";
import { WarPlacement } from "@cerebro/core/data/war-planning/types";
import { WarMapBackground } from './map-background';
import { CanvasNode } from './canvas-node';
import Konva from 'konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { PlayerColorContext } from '../player-color-context';

interface WarMapProps {
  warId?: string;
  battlegroup?: number;
  onNodeClick: (nodeId: number, fight?: WarPlacement) => void;
  selectedNodeId?: number | null;
  mapType: WarMapType;
  currentWar?: War;
  historyFilters: {
    onlyCurrentTier: boolean;
    onlyAlliance: boolean;
    minSeason: number | undefined;
  };
  fights: WarPlacement[];
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
  mapType,
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
  const playerColorContextValue = useContext(PlayerColorContext);
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<Map<number, HistoricalFightStat[]>>(new Map());

  const isFull = isFullscreen !== undefined ? isFullscreen : internalFullscreen;
  const stageRef = useRef<Konva.Stage>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 1000, height: 800 });

  // Refs for touch events (pinch-to-zoom)
  const lastTwoFingerDistance = useRef<number | null>(null);
  const lastCenter = useRef<{ x: number; y: number } | null>(null);

  // Determine Map Data based on War Type
  const isBigThing = mapType === WarMapType.BIG_THING;
  const currentNodesData = isBigThing ? warNodesDataBig : warNodesData;
  const currentLayout = isBigThing ? LAYOUT_BIG : LAYOUT;

  // Calculate dynamic minimum zoom
  const minScale = useMemo(() => {
    if (stageSize.width === 0 || stageSize.height === 0) return 0.5;
    const scaleToFitWidth = stageSize.width / currentLayout.WIDTH;
    const scaleToFitHeight = stageSize.height / currentLayout.HEIGHT;
    const fitScale = Math.min(scaleToFitWidth, scaleToFitHeight);
    return Math.max(0.5, fitScale * 0.9);
  }, [stageSize.width, stageSize.height, currentLayout.WIDTH, currentLayout.HEIGHT]);

  // Constrain position for pan limits
  const constrainPosition = (pos: { x: number; y: number }, scale: number) => {
    const mapWidth = currentLayout.WIDTH * scale;

    // Calculate content bounds dynamically from actual node positions
    let minNodeY = Infinity;
    let maxNodeY = -Infinity;
    currentNodesData.forEach(node => {
      minNodeY = Math.min(minNodeY, node.y);
      maxNodeY = Math.max(maxNodeY, node.y);
    });

    const contentTop = minNodeY * scale;
    const contentBottom = maxNodeY * scale;
    const contentHeight = contentBottom - contentTop;

    const visibleRatio = 0.5;
    const minVisibleWidth = stageSize.width * visibleRatio;
    const minVisibleHeight = stageSize.height * visibleRatio;

    // X constraints (use full canvas width)
    const minX = minVisibleWidth - mapWidth;
    const maxX = stageSize.width - minVisibleWidth;

    // Y constraints (use content bounds)
    // maxY: when panning down, content top can go down to (viewport - minVisible)
    // minY: when panning up, content bottom must stay at least minVisible from top
    const maxY = (stageSize.height - minVisibleHeight) - contentTop;
    const minY = minVisibleHeight - contentBottom;

    const result = {
      x: Math.min(maxX, Math.max(minX, pos.x)),
      y: Math.min(maxY, Math.max(minY, pos.y)),
    };

    // Debug
    if (pos.y !== result.y) {
      console.log('Y CONSTRAINED:', {
        input: pos.y.toFixed(0),
        output: result.y.toFixed(0),
        minY: minY.toFixed(0),
        maxY: maxY.toFixed(0),
        contentTop: contentTop.toFixed(0),
        contentBottom: contentBottom.toFixed(0),
        minNodeY,
        maxNodeY,
        which: pos.y < minY ? '🔺 UP (hit minY)' : '🔻 DOWN (hit maxY)'
      });
    }

    return result;
  };
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
    if (newScale < minScale) newScale = minScale;

    stage.scale({ x: newScale, y: newScale });

    const newPos = constrainPosition({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    }, newScale);
    stage.position(newPos);
  };

  // Touch handlers for pinch-to-zoom and pan
  const getDistance = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  const getCenter = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  };

  const handleMultiTouchStart = (e: KonvaEventObject<TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const touches = e.evt.touches;
    if (touches.length === 2) {
      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };
      lastTwoFingerDistance.current = getDistance(p1, p2);
      lastCenter.current = getCenter(p1, p2);
    }
  };

  const handleMultiTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const stage = e.target.getStage();
    if (!stage) return;

    const touches = e.evt.touches;
    if (touches.length === 2) {
      e.evt.preventDefault(); // Prevent page scroll

      const p1 = { x: touches[0].clientX, y: touches[0].clientY };
      const p2 = { x: touches[1].clientX, y: touches[1].clientY };

      const newDistance = getDistance(p1, p2);
      const newCenter = getCenter(p1, p2);

      const oldScale = stage.scaleX();

      // Zoom
      if (lastTwoFingerDistance.current) {
        const scale = newDistance / lastTwoFingerDistance.current;
        let newScale = oldScale * scale;

        if (newScale > 4) newScale = 4;
        if (newScale < minScale) newScale = minScale;

        stage.scale({ x: newScale, y: newScale });

        // Adjust position to zoom around the center of the pinch
        const stagePos = stage.position();
        const clientRect = stage.container().getBoundingClientRect();

        const tx = newCenter.x - clientRect.left;
        const ty = newCenter.y - clientRect.top;

        const newX = tx - ((tx - stagePos.x) / oldScale) * newScale;
        const newY = ty - ((ty - stagePos.y) / oldScale) * newScale;

        stage.position({ x: newX, y: newY });
      }

      // Pan (single finger drag is handled by Konva draggable, this is for two-finger pan while pinching)
      if (lastCenter.current) {
        const dx = newCenter.x - lastCenter.current.x;
        const dy = newCenter.y - lastCenter.current.y;
        stage.move({ x: dx, y: dy });
      }

      lastTwoFingerDistance.current = newDistance;
      lastCenter.current = newCenter;
      stage.batchDraw();
    }
  };

  const handleMultiTouchEnd = (e: KonvaEventObject<TouchEvent>) => {
    lastTwoFingerDistance.current = null;
    lastCenter.current = null;
  };

  const fightsByNode = useMemo(() => {
    const map = new Map<number, WarPlacement>();
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
        dragBoundFunc={(pos) => constrainPosition(pos, stageRef.current?.scaleX() ?? 1)}
        onWheel={handleWheel}
        onTouchStart={handleMultiTouchStart}
        onTouchMove={handleMultiTouchMove}
        onTouchEnd={handleMultiTouchEnd}
        ref={stageRef}
        style={{ cursor: 'grab' }}
        onDragStart={() => {
          if (stageRef.current) stageRef.current.container().style.cursor = 'grabbing';
        }}
        onDragEnd={() => {
          if (stageRef.current) stageRef.current.container().style.cursor = 'grab';
        }}
      >
        <PlayerColorContext.Provider value={playerColorContextValue}>
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
        </PlayerColorContext.Provider>
      </Stage>
    </div>
  );
});

export default WarMap;

