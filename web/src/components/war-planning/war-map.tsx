'use client';

import { useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { WarFight, WarNode } from '@prisma/client';
import { warNodesData, WarNodePosition } from './nodes-data';
import { prisma } from '@/lib/prisma';
import { getChampionImageUrl } from '@/lib/championHelper';
import { Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

  useEffect(() => {
    async function fetchFights() {
      try {
        const response = await fetch(`/api/war-planning/fights?warId=${warId}&battlegroup=${battlegroup}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const fetchedFights: FightWithNode[] = await response.json();
        setFights(fetchedFights);
      } catch (err) {
        console.error("Failed to fetch fights:", err);
        setError("Failed to load war data.");
      } finally {
        setLoading(false);
      }
    }
    fetchFights();
  }, [warId, battlegroup]);

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
      <div className="absolute top-4 right-4 z-10">
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

              return (
                <g key={node.id} className="cursor-pointer group" onClick={() => onNodeClick(numericId, fight)}>
                  {/* Hover Glow Effect */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={28}
                    fill="url(#node-glow)"
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  />
                  
                  {/* --- DEFENDER / MAIN NODE --- */}
                  {hasDefender && defenderImgUrl ? (
                    <g>
                      <defs>
                        <clipPath id={`clip-def-${node.id}`}>
                          <circle cx={node.x} cy={node.y} r={20} />
                        </clipPath>
                      </defs>
                      {/* Background for image (border color) */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={22}
                        fill="#7f1d1d" // Dark Red background
                      />
                      {/* The Image */}
                      <image
                        href={defenderImgUrl}
                        x={node.x - 20}
                        y={node.y - 20}
                        width="40"
                        height="40"
                        clipPath={`url(#clip-def-${node.id})`}
                      />
                      {/* Border Ring Overlay */}
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={20}
                        fill="none"
                        stroke="#ef4444"
                        strokeWidth="2"
                      />
                    </g>
                  ) : (
                    // Empty Node State
                    <g>
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={18}
                        fill="#172554" // Dark Blue
                        stroke="#3b82f6" // Blue Border
                        strokeWidth="2"
                        className="transition-colors duration-200"
                      />
                      <circle 
                        cx={node.x} 
                        cy={node.y} 
                        r={14} 
                        fill="transparent" 
                        stroke="#93c5fd" 
                        strokeWidth="1" 
                        opacity="0.5"
                      />
                    </g>
                  )}

                  {/* --- ATTACKER BADGE (Bottom Right) --- */}
                  {hasAttacker && attackerImgUrl && (
                    <g>
                      <defs>
                        <clipPath id={`clip-atk-${node.id}`}>
                          <circle cx={node.x + 14} cy={node.y + 14} r={10} />
                        </clipPath>
                      </defs>
                      {/* Background/Border */}
                      <circle
                        cx={node.x + 14}
                        cy={node.y + 14}
                        r={11}
                        fill="#000000"
                        stroke="#3b82f6"
                        strokeWidth="1.5"
                      />
                      {/* Image */}
                      <image
                        href={attackerImgUrl}
                        x={node.x + 4} // (x+14) - 10
                        y={node.y + 4} // (y+14) - 10
                        width="20"
                        height="20"
                        clipPath={`url(#clip-atk-${node.id})`}
                      />
                    </g>
                  )}

                  {/* --- NODE NUMBER TAG (Top Center) --- */}
                  <g transform={`translate(${node.x}, ${node.y - 26})`}>
                    <rect
                      x="-10"
                      y="-8"
                      width="20"
                      height="16"
                      rx="4"
                      fill="rgba(15, 23, 42, 0.8)" // Slate-900 with opacity
                      stroke={hasDefender ? "#ef4444" : "#3b82f6"}
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="3" // Vertically centered approximation
                      textAnchor="middle"
                      fill="#FFFFFF"
                      fontSize="10"
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
