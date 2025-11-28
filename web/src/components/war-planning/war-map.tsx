'use client';

import { useEffect, useState } from 'react';
import { Maximize2, Minimize2, History, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getHistoricalCounters, HistoricalFightStat } from '@/app/planning/history-actions';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { WarFight, WarNode } from '@prisma/client';
import { warNodesData, WarNodePosition } from './nodes-data';
import { prisma } from '@/lib/prisma';
import { getChampionImageUrl } from '@/lib/championHelper';

interface WarMapProps {
  warId: string;
  battlegroup: number;
  onNodeClick: (nodeId: number, fight?: FightWithNode) => void;
}

interface FightWithNode extends WarFight {
  node: WarNode;
  attacker: { name: string; images: any } | null;
  defender: { name: string; images: any } | null;
  player: { ingameName: string } | null;
}

export default function WarMap({ warId, battlegroup, onNodeClick }: WarMapProps) {
  const [fights, setFights] = useState<FightWithNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState<Map<number, HistoricalFightStat[]>>(new Map());

  useEffect(() => {
    async function fetchFights() {
      try {
        const response = await fetch(`/api/war-planning/fights?warId=${warId}&battlegroup=${battlegroup}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fetchedFights: FightWithNode[] = await response.json();
        setFights(fetchedFights);
        // Clear history when fights/bg changes to avoid stale overlays
        setHistoryData(new Map());
      } catch (err) {
        console.error("Failed to fetch fights:", err);
        setError("Failed to load war data.");
      } finally {
        setLoading(false);
      }
    }
    fetchFights();
  }, [warId, battlegroup]);

  // Fetch history when toggle is enabled
  useEffect(() => {
    async function fetchAllHistory() {
      if (!showHistory || fights.length === 0) return;

      const nodesWithDefenders = fights.filter(f => f.defenderId);
      const historyMap = new Map<number, HistoricalFightStat[]>();

      const promises = nodesWithDefenders.map(async (fight) => {
        if (!fight.defenderId) return;
        const stats = await getHistoricalCounters(fight.node.nodeNumber, fight.defenderId);
        if (stats.length > 0) {
            historyMap.set(fight.node.nodeNumber, stats);
        }
      });

      await Promise.all(promises);
      setHistoryData(historyMap);
    }

    if (showHistory && historyData.size === 0) {
        fetchAllHistory();
    }
  }, [showHistory, fights]);

  // Handle ESC key to exit fullscreen
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isFullscreen]);

  if (loading) return <div>Loading War Map...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  // Create a map for quick lookup of fight data by nodeNumber
  const fightsByNode = new Map<number, FightWithNode>();
  fights.forEach(fight => {
    fightsByNode.set(fight.node.nodeNumber, fight);
  });

  return (
    <div className={cn(
      "relative border rounded-md overflow-hidden bg-slate-950 transition-all duration-300",
      isFullscreen ? "fixed inset-0 z-50 w-screen h-screen rounded-none" : "w-full h-[600px]"
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
          <svg viewBox="0 0 1200 900" className="w-full h-full overflow-visible">
            <defs>
              <pattern id="hex-pattern" x="0" y="0" width="40" height="69.28" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
                <path d="M20 0 L40 11.54 L40 34.64 L20 46.18 L0 34.64 L0 11.54 Z" fill="none" stroke="#1e293b" strokeWidth="1" />
              </pattern>
              <radialGradient id="node-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.5)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
              </radialGradient>
            </defs>
            
            {/* Background Pattern - covering a much larger area */}
            <rect x="-1600" y="-1200" width="4000" height="3000" fill="url(#hex-pattern)" />

            {/* Render paths */}
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
                    stroke="#6ee7b7" // Always greenish for paths
                    strokeWidth="1"
                    strokeDasharray="4 4" // Always dashed
                    opacity="0.6"
                  />
                );
              });
            })}

            {/* Render nodes */}
            {warNodesData.map(node => {
              // Handle portals distinctly
              if (node.isPortal) {
                return (
                  <g key={node.id}>
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={5}
                      fill="#10B981" // Emerald
                      stroke="#064e3b"
                      strokeWidth="1"
                      className="shadow-lg shadow-emerald-500/50"
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={2}
                      fill="#ecfdf5"
                    />
                  </g>
                );
              }

              // Normal Fight Nodes
              const numericId = typeof node.id === 'number' ? node.id : parseInt(node.id as string);
              const fight = fightsByNode.get(numericId);
              const defender = fight?.defender;
              const attacker = fight?.attacker;
              
              // Determine styling based on state
              const hasDefender = !!defender;
              const hasAttacker = !!attacker;
              
              const defenderImgUrl = defender ? getChampionImageUrl(defender.images as any, '128') : null;
              const attackerImgUrl = attacker ? getChampionImageUrl(attacker.images as any, '128') : null;

              // Historical Counter Logic
              const history = showHistory && defender ? historyData.get(numericId) : null;

              // Node Dimensions
              const nodeRadius = 24; // Slightly larger for better visibility
              const showAttacker = !!(attacker && attackerImgUrl);
              const pillWidth = showAttacker ? nodeRadius * 3.5 : nodeRadius * 2;
              const pillHeight = nodeRadius * 2;
              
              // Offsets for centering
              const defenderX = showAttacker ? -nodeRadius * 0.8 : 0;
              const attackerX = showAttacker ? nodeRadius * 0.8 : 0;

              return (
                <g key={node.id} className="cursor-pointer group" onClick={() => onNodeClick(numericId, fight)}>
                  {/* Hover Glow Effect */}
                  <rect
                    x={node.x - pillWidth / 2 - 4}
                    y={node.y - pillHeight / 2 - 4}
                    width={pillWidth + 8}
                    height={pillHeight + 8}
                    rx={nodeRadius + 4}
                    fill="url(#node-glow)"
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                  
                  {/* --- MAIN PILL CONTAINER --- */}
                  <g>
                    {/* Pill Background */}
                    <rect
                      x={node.x - pillWidth / 2}
                      y={node.y - pillHeight / 2}
                      width={pillWidth}
                      height={pillHeight}
                      rx={nodeRadius}
                      fill="rgba(15, 23, 42, 0.9)" // Slate-950/90
                      stroke={hasDefender ? (showAttacker ? "#3b82f6" : "#ef4444") : "#3b82f6"} // Red if just defender, Blue if assigned
                      strokeWidth="2"
                      className="transition-colors duration-200"
                    />

                    {/* --- ATTACKER (Left) --- */}
                    {showAttacker && (
                        <g transform={`translate(${node.x - nodeRadius * 0.8}, ${node.y})`}>
                          <defs>
                            <clipPath id={`clip-atk-${node.id}`}>
                              <circle cx={0} cy={0} r={nodeRadius - 2} />
                            </clipPath>
                          </defs>
                          <circle r={nodeRadius - 2} fill="#000000" />
                          <image
                            href={attackerImgUrl!}
                            x={-(nodeRadius - 2)}
                            y={-(nodeRadius - 2)}
                            width={(nodeRadius - 2) * 2}
                            height={(nodeRadius - 2) * 2}
                            clipPath={`url(#clip-atk-${node.id})`}
                          />
                        </g>
                    )}

                    {/* --- DEFENDER (Right or Center) --- */}
                    <g transform={`translate(${node.x + (showAttacker ? nodeRadius * 0.8 : 0)}, ${node.y})`}>
                       {hasDefender && defenderImgUrl ? (
                        <>
                          <defs>
                            <clipPath id={`clip-def-${node.id}`}>
                              <circle cx={0} cy={0} r={nodeRadius - 2} />
                            </clipPath>
                          </defs>
                          <circle r={nodeRadius - 2} fill="#7f1d1d" />
                          <image
                            href={defenderImgUrl}
                            x={-(nodeRadius - 2)}
                            y={-(nodeRadius - 2)}
                            width={(nodeRadius - 2) * 2}
                            height={(nodeRadius - 2) * 2}
                            clipPath={`url(#clip-def-${node.id})`}
                            opacity={showHistory ? 0.7 : 1}
                          />
                        </>
                       ) : (
                         // Empty Defender Placeholder
                         <circle r={nodeRadius - 6} fill="transparent" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
                       )}
                    </g>
                  </g>
                  
                  {/* --- HISTORICAL COUNTERS (Bottom Right, Horizontal Stack) --- */}
                  {showHistory && history && history.length > 0 && (
                    <g transform={`translate(${node.x + (showAttacker ? pillWidth/2 : nodeRadius)}, ${node.y + nodeRadius})`}>
                      {history.slice(0, 3).map((histStat, index) => (
                        <g 
                          key={histStat.attackerId} 
                          transform={`translate(${index * 18}, ${index * 4})`} 
                          onClick={(e) => {
                              if (histStat.sampleVideoUrl) {
                                  e.stopPropagation();
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
                            {/* Solos Badge */}
                            <g transform={`translate(6, -6)`}>
                                <rect x="-5" y="-5" width="10" height="10" rx="3" fill={histStat.solos > 0 ? "#10b981" : "#ef4444"} /> 
                                <text y="3" textAnchor="middle" fill="#FFFFFF" fontSize="7" fontWeight="bold">{histStat.solos}</text>
                            </g>
                          </g>
                        </g>
                      ))}
                    </g>
                  )}
                  {/* --- NODE NUMBER TAG (Top Center) --- */}
                  <g transform={`translate(${node.x}, ${node.y - nodeRadius - 8})`}>
                    <rect
                      x="-12"
                      y="-10"
                      width="24"
                      height="18"
                      rx="6"
                      fill="rgba(2, 6, 23, 0.9)" // Slate-950
                      stroke={hasDefender ? "#ef4444" : "#3b82f6"}
                      strokeWidth="1.5"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="#e2e8f0"
                      fontSize="11"
                      fontWeight="bold"
                      className="pointer-events-none select-none font-mono"
                    >
                      {node.id}
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
