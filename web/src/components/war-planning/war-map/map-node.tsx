import React, { memo } from 'react';
import { Swords, Shield } from 'lucide-react';
import { WarTactic, ChampionClass } from '@prisma/client';
import { WarNodePosition } from '../nodes-data';
import { FightWithNode } from '../types';
import { getChampionImageUrl } from '@/lib/championHelper';
import { HistoricalFightStat } from '@/app/planning/history-actions';

const CLASS_COLORS: Record<ChampionClass, string> = {
  SCIENCE: '#4ade80',  // Green-400
  SKILL: '#ef4444',    // Red-500
  MUTANT: '#facc15',   // Yellow-400
  COSMIC: '#22d3ee',   // Cyan-400
  TECH: '#3b82f6',     // Blue-500
  MYSTIC: '#a855f7',   // Purple-500
  SUPERIOR: '#d946ef', // Fuchsia-500
};

interface WarNodeGroupProps {
    node: WarNodePosition;
    fight: FightWithNode | undefined;
    isSelected: boolean;
    onNodeClick: (nodeId: number, fight?: FightWithNode) => void;
    showHistory: boolean;
    history: HistoricalFightStat[] | undefined | null;
    activeTactic: WarTactic | null | undefined;
}

export const WarNodeGroup = memo(function WarNodeGroup({ 
    node, 
    fight, 
    isSelected, 
    onNodeClick,
    showHistory,
    history,
    activeTactic 
}: WarNodeGroupProps) {

    if (node.isPortal) {
        return (
          <g>
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
    const defender = fight?.defender;
    const attacker = fight?.attacker;
    
    const defenderImgUrl = defender ? getChampionImageUrl(defender.images as any, '128') : null;
    const attackerImgUrl = attacker ? getChampionImageUrl(attacker.images as any, '128') : null;
    
    const prefightChampions = fight?.prefightChampions;
    const hasPrefight = prefightChampions && prefightChampions.length > 0;

    // Tactic Logic
    const activeTacticAny = activeTactic as any;
    const isAttackerTactic = activeTacticAny?.attackTag && attacker?.tags?.some((t: any) => t.name === activeTacticAny.attackTag.name);
    const isDefenderTactic = activeTacticAny?.defenseTag && defender?.tags?.some((t: any) => t.name === activeTacticAny.defenseTag.name);

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
              <g 
                transform={`translate(${node.x - nodeRadius * 0.9}, ${node.y})`}
              >
                <defs>
                  <clipPath id={`clip-atk-${node.id}`}>
                    <circle cx={0} cy={0} r={nodeRadius - 4} />
                  </clipPath>
                </defs>
                <image
                  href={attackerImgUrl!}
                  x={-(nodeRadius - 4)}
                  y={-(nodeRadius - 4)}
                  width={(nodeRadius - 4) * 2}
                  height={(nodeRadius - 4) * 2}
                  clipPath={`url(#clip-atk-${node.id})`}
                />
                <circle 
                    r={nodeRadius - 4} 
                    fill="none" 
                    stroke={attacker?.class ? CLASS_COLORS[attacker.class] : "#3b82f6"} 
                    strokeWidth="1.5" 
                    filter={attacker?.class ? `url(#glow-${attacker.class.toLowerCase()})` : ""}
                />
                {/* Tactic Icon - Top Left */}
                {isAttackerTactic && (
                     <foreignObject x={-nodeRadius} y={-nodeRadius} width="14" height="14" className="overflow-visible pointer-events-none">
                        <div className="bg-emerald-950/90 rounded-full border border-emerald-500 flex items-center justify-center w-3.5 h-3.5 shadow-lg shadow-black">
                            <Swords className="w-2 h-2 text-emerald-400" />
                        </div>
                     </foreignObject>
                )}
              </g>
          )}

          {/* Defender Circle */}
          <g 
            transform={`translate(${node.x + (showAttacker ? nodeRadius * 0.9 : 0)}, ${node.y})`}
          >
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
                {/* Class Ring Overlay */}
                <circle 
                    r={nodeRadius - 4} 
                    fill="none" 
                    stroke={defender?.class ? CLASS_COLORS[defender.class] : "#dc2626"} 
                    strokeWidth="1.5" 
                    filter={defender?.class ? `url(#glow-${defender.class.toLowerCase()})` : ""}
                />
                {/* Tactic Icon - Top Right */}
                {isDefenderTactic && (
                     <foreignObject x={nodeRadius - 14} y={-nodeRadius} width="14" height="14" className="overflow-visible pointer-events-none">
                        <div className="bg-red-950/90 rounded-full border border-red-500 flex items-center justify-center w-3.5 h-3.5 shadow-lg shadow-black">
                            <Shield className="w-2 h-2 text-red-400" />
                        </div>
                     </foreignObject>
                )}
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
});
