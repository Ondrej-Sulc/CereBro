'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Maximize2, Minimize2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getBatchHistoricalCounters, HistoricalFightStat } from '@/app/planning/history-actions';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import { WarFight, WarNode, WarNodeAllocation, NodeModifier } from '@prisma/client';
import { warNodesData } from './nodes-data';
import { getChampionImageUrl } from '@/lib/championHelper';

import { War } from '@prisma/client';

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
}

interface FightWithNode extends WarFight {
  node: WarNode & {
      allocations: (WarNodeAllocation & { nodeModifier: NodeModifier })[];
  };
  attacker: { name: string; images: any } | null;
  defender: { name: string; images: any } | null;
  player: { ingameName: string } | null;
  prefightChampions?: { id: number; name: string; images: any }[];
}

const WarMap = React.memo(function WarMap({ 
  warId, 
  battlegroup, 
  onNodeClick, 
  selectedNodeId,
  currentWar,
  historyFilters,
  fights
}: WarMapProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<Map<number, HistoricalFightStat[]>>(new Map());
  
  const transformRef = useRef<ReactZoomPanPinchRef>(null);

  // Generate cosmic assets once
  const { stars, nebulas } = useMemo(() => {
    const starCount = 400;
    const generatedStars = Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      x: Math.random() * 4000 - 1500,
      y: Math.random() * 3000 - 1000,
      r: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.7 + 0.3,
      delay: Math.random() * 5 + 's',
      duration: Math.random() * 3 + 3 + 's'
    }));

    const generatedNebulas = [
      { cx: -500, cy: -500, r: 800, color: "#4c1d95", id: "nebula-0" }, // Violet
      { cx: 800, cy: 400, r: 900, color: "#1e3a8a", id: "nebula-1" },   // Blue
      { cx: 200, cy: 1200, r: 700, color: "#be185d", id: "nebula-2" },  // Pink
      { cx: 1500, cy: -200, r: 600, color: "#0f766e", id: "nebula-3" }, // Teal
    ];

    return { stars: generatedStars, nebulas: generatedNebulas };
  }, []);

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

          const batchResults = await getBatchHistoricalCounters(requests, options as any); // Type assertion until actions updated properly
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
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

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
        }, 50); // Small delay to ensure DOM is ready
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
      isFullscreen ? "fixed inset-0 z-50 w-screen h-screen rounded-none" : "w-full h-full"
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
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-200"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
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
          <svg viewBox="0 0 1200 900" className="w-full h-full overflow-visible" style={{ backgroundColor: '#020617' }}>
            <style>
              {`
                @keyframes twinkle {
                  0%, 100% { opacity: 0.2; }
                  50% { opacity: 1; }
                }
                .star-anim {
                  animation: twinkle infinite ease-in-out;
                }
                .selected-node-pulse {
                    animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
                }
                @keyframes pulse-ring {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
                    70% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(251, 191, 36, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
                }
              `}
            </style>
            <defs>
              <filter id="glow-selected" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                  </feMerge>
              </filter>
              
              <radialGradient id="node-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
              </radialGradient>
              
              <radialGradient id="shadow-gradient" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                  <stop offset="0%" stopColor="#000000" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
              </radialGradient>

              {nebulas.map((nebula) => (
                  <radialGradient key={nebula.id} id={nebula.id} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor={nebula.color} stopOpacity="0.3" />
                      <stop offset="100%" stopColor={nebula.color} stopOpacity="0" />
                  </radialGradient>
              ))}
            </defs>
            
            <rect x="-2000" y="-1500" width="5000" height="4000" fill="#020617" />
            
            {/* Background elements */}
            {nebulas.map((nebula) => (
                <circle 
                    key={nebula.id}
                    cx={nebula.cx} 
                    cy={nebula.cy} 
                    r={nebula.r} 
                    fill={`url(#${nebula.id})`}
                />
            ))}

            {stars.map((star) => (
                <circle
                    key={`star-${star.id}`}
                    cx={star.x}
                    cy={star.y}
                    r={star.r}
                    fill="white"
                    opacity={star.opacity}
                    className="star-anim"
                    style={{ animationDuration: star.duration, animationDelay: star.delay }}
                />
            ))}

            {/* Paths */}
            {warNodesData.map(node => {
              return node.paths.map(pathToId => {
                const pathToNode = warNodesData.find(n => n.id === pathToId);
                if (!pathToNode) return null;
                return (
                  <line
                    key={`${node.id}-${pathToId}`}
                    x1={node.x}
                    y1={node.y}
                    x2={pathToNode.x}
                    y2={pathToNode.y}
                    stroke="#475569" 
                    strokeWidth="1"
                    strokeDasharray="4 4" 
                    opacity="0.3"
                  />
                );
              });
            })}

            {/* Nodes */}
            {warNodesData.map(node => {
              if (node.isPortal) {
                return (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y + 5} r={8} fill="url(#shadow-gradient)" />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={5}
                      fill="#10B981"
                      stroke="#064e3b"
                      strokeWidth="1"
                      className="shadow-lg shadow-emerald-500/50"
                    />
                    <circle cx={node.x} cy={node.y} r={2} fill="#ecfdf5" />
                  </g>
                );
              }

              const numericId = typeof node.id === 'number' ? node.id : parseInt(node.id as string);
              const fight = fightsByNode.get(numericId);
              const defender = fight?.defender;
              const attacker = fight?.attacker;
              
              const defenderImgUrl = defender ? getChampionImageUrl(defender.images as any, 'full') : null;
              const attackerImgUrl = attacker ? getChampionImageUrl(attacker.images as any, 'full') : null;
              
              const prefightChampions = fight?.prefightChampions;
              const hasPrefight = prefightChampions && prefightChampions.length > 0;
              const history = showHistory && defender ? historyData.get(numericId) : null;

              const isSelected = selectedNodeId === numericId;

              // Dimensions
              const nodeRadius = 24; 
              const showAttacker = !!(attacker && attackerImgUrl);
              const pillWidth = showAttacker ? nodeRadius * 3.8 : nodeRadius * 2.2; // Slightly wider for comfort
              const pillHeight = nodeRadius * 2;
              
              // Colors
              const borderColor = isSelected ? "#fbbf24" : "#475569"; // Amber-400 vs Slate-600
              const borderWidth = isSelected ? 3 : 1.5;
              const pillFill = "rgba(15, 23, 42, 0.95)";

              return (
                <g 
                    key={node.id} 
                    id={`node-g-${node.id}`} // Unique ID for zoomToElement
                    className="cursor-pointer group" 
                    onClick={() => onNodeClick(numericId, fight)}
                    style={{ transition: 'all 0.3s ease' }}
                >
                  {/* Shadow */}
                  <ellipse
                    cx={node.x}
                    cy={node.y + nodeRadius + 5}
                    rx={pillWidth / 2}
                    ry={8}
                    fill="url(#shadow-gradient)"
                  />

                  {/* Node Number Tag (Visually connected) */}
                  <g transform={`translate(${node.x}, ${node.y - nodeRadius - 10})`}>
                     {/* Connecting "Neck" */}
                     <rect x="-4" y="10" width="8" height="8" fill={pillFill} />
                     
                     {/* The Tag Box */}
                     <rect
                      x="-14"
                      y="-8"
                      width="28"
                      height="18"
                      rx="4"
                      fill={pillFill}
                      stroke={borderColor}
                      strokeWidth={borderWidth}
                      filter={isSelected ? "url(#glow-selected)" : ""}
                    />
                    <text
                      x="0"
                      y="5"
                      textAnchor="middle"
                      fill={isSelected ? "#fbbf24" : "#cbd5e1"}
                      fontSize="11"
                      fontWeight="bold"
                      className="pointer-events-none select-none font-mono"
                    >
                      {node.id}
                    </text>
                  </g>

                  {/* Main Pill */}
                  <rect
                    x={node.x - pillWidth / 2}
                    y={node.y - pillHeight / 2}
                    width={pillWidth}
                    height={pillHeight}
                    rx={nodeRadius}
                    fill={pillFill}
                    stroke={borderColor}
                    strokeWidth={borderWidth}
                    className="transition-colors duration-200"
                    filter={isSelected ? "url(#glow-selected)" : ""}
                  />

                  {/* Attacker Circle */}
                  {showAttacker && (
                      <g transform={`translate(${node.x - nodeRadius * 0.9}, ${node.y})`}>
                        <defs>
                          <clipPath id={`clip-atk-${node.id}`}>
                            <circle cx={0} cy={0} r={nodeRadius - 4} />
                          </clipPath>
                        </defs>
                        <circle r={nodeRadius - 4} fill="#0f172a" stroke="#3b82f6" strokeWidth="1.5" />
                        <image
                          href={attackerImgUrl!}
                          x={-(nodeRadius - 4)}
                          y={-(nodeRadius - 4)}
                          width={(nodeRadius - 4) * 2}
                          height={(nodeRadius - 4) * 2}
                          clipPath={`url(#clip-atk-${node.id})`}
                        />
                      </g>
                  )}

                  {/* Defender Circle */}
                  <g transform={`translate(${node.x + (showAttacker ? nodeRadius * 0.9 : 0)}, ${node.y})`}>
                     {defender && defenderImgUrl ? (
                      <>
                        <defs>
                          <clipPath id={`clip-def-${node.id}`}>
                            <circle cx={0} cy={0} r={nodeRadius - 4} />
                          </clipPath>
                        </defs>
                        <image
                          href={defenderImgUrl}
                          x={-(nodeRadius - 4)}
                          y={-(nodeRadius - 4)}
                          width={(nodeRadius - 4) * 2}
                          height={(nodeRadius - 4) * 2}
                          clipPath={`url(#clip-def-${node.id})`}
                          opacity={showHistory ? 0.7 : 1}
                        />
                        {/* Red Ring Overlay */}
                        <circle r={nodeRadius - 4} fill="none" stroke="#dc2626" strokeWidth="2" />
                      </>
                     ) : (
                       <circle r={nodeRadius - 6} fill="transparent" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                     )}
                  </g>
                  
                  {/* Prefights */}
                  {hasPrefight && prefightChampions && (
                    <g transform={`translate(${node.x - (showAttacker ? pillWidth/2 : nodeRadius) + 8}, ${node.y + nodeRadius + 6})`}>
                       {prefightChampions.map((champ, index) => (
                          <g key={`${champ.name}-${index}`} transform={`translate(${index * 20}, 0)`}>
                            <defs>
                                <clipPath id={`clip-prefight-${node.id}-${index}`}>
                                    <circle cx={0} cy={0} r={9} />
                                </clipPath>
                            </defs>
                            <circle cx={0} cy={0} r={10} fill="#1e293b" stroke="#94a3b8" strokeWidth="1" />
                             <image
                                href={getChampionImageUrl(champ.images as any, '64')}
                                x={-9} y={-9}
                                width={18} height={18}
                                clipPath={`url(#clip-prefight-${node.id}-${index})`}
                             />
                          </g>
                       ))}
                    </g>
                  )}
                  
                  {/* History Bubbles */}
                  {showHistory && history && history.length > 0 && (
                    <g transform={`translate(${node.x + (showAttacker ? pillWidth/2 : nodeRadius)}, ${node.y + nodeRadius})`}>
                      {history.slice(0, 3).map((histStat, index) => (
                        <g 
                          key={histStat.attackerId} 
                          transform={`translate(${index * 18}, ${index * 4})`} 
                          onClick={(e) => {
                              e.stopPropagation();
                              if (histStat.sampleVideoInternalId) {
                                  window.open(`/war-videos/${histStat.sampleVideoInternalId}`, '_blank');
                              } else if (histStat.sampleVideoUrl) {
                                  window.open(histStat.sampleVideoUrl, '_blank');
                              }
                          }}
                          style={{ cursor: histStat.sampleVideoUrl ? 'pointer' : 'default' }}
                        >
                          <g className="transition-transform hover:scale-110 origin-center" style={{ transformBox: 'fill-box' }}>
                            <defs>
                              <clipPath id={`clip-hist-atk-${node.id}-${histStat.attackerId}`}>
                                <circle cx={0} cy={0} r={10} />
                              </clipPath>
                            </defs>
                            <circle 
                              cx={0} cy={0} 
                              r={12} 
                              fill="#0f172a" 
                              stroke={histStat.sampleVideoUrl ? "#fbbf24" : "#64748b"} 
                              strokeWidth="1.5" 
                            />
                            <image
                              href={getChampionImageUrl(histStat.attackerImages as any, '128')}
                              x={-10} y={-10}
                              width="20" height="20"
                              clipPath={`url(#clip-hist-atk-${node.id}-${histStat.attackerId})`}
                            />
                            <g transform={`translate(6, -6)`}>
                                <rect x="-5" y="-5" width="10" height="10" rx="3" fill={histStat.solos > 0 ? "#10b981" : "#ef4444"} /> 
                                <text y="3" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold">{histStat.solos}</text>
                            </g>
                          </g>
                        </g>
                      ))}
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
});

export default WarMap;