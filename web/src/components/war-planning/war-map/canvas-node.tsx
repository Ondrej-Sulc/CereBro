import React, { memo, useState, useEffect } from 'react';
import { Group, Rect, Circle, Text, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import { WarTactic, ChampionClass } from '@prisma/client';
import { WarNodePosition } from '../nodes-data';
import { FightWithNode } from '../types';
import { getChampionImageUrl } from '@/lib/championHelper';
import { HistoricalFightStat } from '@/app/planning/history-actions';
import { Swords, Shield } from 'lucide-react'; // Import Lucide icons
import { svgToDataUrl } from '@/lib/svgHelper'; // Import the SVG helper

const CLASS_COLORS: Record<ChampionClass, string> = {
  SCIENCE: '#4ade80',
  SKILL: '#ef4444',
  MUTANT: '#facc15',
  COSMIC: '#22d3ee',
  TECH: '#3b82f6',
  MYSTIC: '#a855f7',
  SUPERIOR: '#d946ef',
};

// Custom hook to load Lucide icons as Konva Images
const useIconImage = (IconComponent: React.ElementType, size: number, color: string) => {
    const [imageUrl, setImageUrl] = useState<string | null>(null);
    const [image] = useImage(imageUrl || '', 'anonymous');

    useEffect(() => {
        // Ensure this effect only runs on the client-side
        if (typeof window === 'undefined') return; 

        const fetchSvg = async () => {
            const dataUrl = await svgToDataUrl(IconComponent, {}, size, color);
            setImageUrl(dataUrl);
        };
        fetchSvg();
    }, [IconComponent, size, color]);

    return image;
};

// TacticBadge Component (defined outside CanvasNode)
interface TacticBadgeProps {
    type: "attacker" | "defender";
    nodeRadius: number; // Passed as prop
}

const TacticBadge = memo(function TacticBadge({ type, nodeRadius }: TacticBadgeProps) {
    const iconSize = 10; // Smaller icon
    const circleRadius = 8;
    
    // Style matches War Archive:
    // Attacker: bg-emerald-950/90, border-emerald-500, text-emerald-400
    // Defender: bg-red-950/90, border-red-500, text-red-400
    
    const isAttacker = type === "attacker";
    
    const bgColor = isAttacker ? "#022c22" : "#450a0a"; // emerald-950 : red-950
    const strokeColor = isAttacker ? "#10b981" : "#ef4444"; // emerald-500 : red-500
    const iconColor = isAttacker ? "#34d399" : "#f87171"; // emerald-400 : red-400

    const IconComponent = isAttacker ? Swords : Shield;
    const iconImage = useIconImage(IconComponent, iconSize, iconColor);
    
    // Position: Top-Left of the image ring.
    // nodeRadius is ~24. We want it at -45 degrees or just top-left offset.
    // The previous offset was -nodeRadius + 4. 
    // Let's nudge it slightly more "out" to overlap the border nicely.
    const offset = Math.floor(nodeRadius * 0.7); // approx 45 deg coordinate
    
    const xPos = isAttacker ? -offset - 6 : offset + 6; 
    const yPos = -offset - 6;

    return (
        <Group x={xPos} y={yPos}>
            {/* Fake Shadow (Performance friendly) */}
            <Circle radius={circleRadius} fill="rgba(0,0,0,0.6)" x={1} y={1} />
            
            {/* Badge Background & Border */}
            <Circle 
                radius={circleRadius} 
                fill={bgColor} 
                stroke={strokeColor} 
                strokeWidth={1} 
            />
            
            {/* Icon */}
            {iconImage && (
                <KonvaImage
                    image={iconImage}
                    x={-iconSize / 2}
                    y={-iconSize / 2}
                    width={iconSize}
                    height={iconSize}
                />
            )}
        </Group>
    );
});


// Use Group + Clip for reliable circular masking
const CircularImage = ({ src, x, y, radius, border, borderColor, opacity = 1, glowColor }: any) => {
    const [image] = useImage(src, 'anonymous');
    
    return (
        <Group x={x} y={y} opacity={opacity}>
            {/* Class Color Background (Glow/Tint) */}
            {glowColor && (
                <Circle
                    radius={radius}
                    fill={glowColor}
                    opacity={0.4} // Subtle tint behind the transparent PNG
                    listening={false}
                />
            )}

            <Group
                clipFunc={(ctx) => {
                    // Clip to circle
                    ctx.arc(0, 0, radius - (border ? border : 0), 0, Math.PI * 2, false);
                }}
            >
                <KonvaImage
                    image={image}
                    // Center the image. 
                    x={-radius}
                    y={-radius}
                    width={radius * 2}
                    height={radius * 2}
                />
                {/* Fallback background if image is loading */}
                {!image && (
                    <Rect 
                        x={-radius} y={-radius} 
                        width={radius*2} height={radius*2} 
                        fill="#0f172a" 
                    />
                )}
            </Group>
            
            {/* Border Ring */}
            {border && (
                <Circle
                    radius={radius}
                    stroke={borderColor || 'white'}
                    strokeWidth={border}
                    listening={false}
                />
            )}
        </Group>
    );
};

interface CanvasNodeProps {
    node: WarNodePosition;
    fight: FightWithNode | undefined;
    isSelected: boolean;
    onNodeClick: (nodeId: number, fight?: FightWithNode) => void;
    showHistory: boolean;
    history: HistoricalFightStat[] | undefined | null;
    activeTactic: WarTactic | null | undefined;
}

export const CanvasNode = memo(function CanvasNode({
    node,
    fight,
    isSelected,
    onNodeClick,
    showHistory,
    history,
    activeTactic
}: CanvasNodeProps) {
    const numericId = typeof node.id === 'number' ? node.id : parseInt(node.id as string);

    // --- PORTAL RENDERING ---
    if (node.isPortal) {
        return (
            <Group 
                x={node.x} 
                y={node.y} 
                onClick={() => {}}
            >
                {/* Glow */}
                <Circle radius={8} fill="#10B981" opacity={0.3} />
                <Circle radius={5} fill="#10B981" stroke="#064e3b" strokeWidth={1} />
                <Circle radius={2} fill="#ecfdf5" />
            </Group>
        );
    }

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
    const pillWidth = showAttacker ? nodeRadius * 3.8 : nodeRadius * 2.2;
    const pillHeight = nodeRadius * 2;
    
    // Colors
    const borderColor = isSelected ? "#fbbf24" : "#475569"; 
    const borderWidth = isSelected ? 3 : 1.5;
    const pillFill = "rgba(15, 23, 42, 0.95)";

    return (
        <Group 
            x={node.x} 
            y={node.y}
            onClick={() => onNodeClick(numericId, fight)}
            onTap={() => onNodeClick(numericId, fight)} // Touch support
            onMouseEnter={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'pointer';
            }}
            onMouseLeave={(e) => {
                const container = e.target.getStage()?.container();
                if (container) container.style.cursor = 'default';
            }}
        >
            {/* Node Tag (Top) */}
            <Group y={-nodeRadius - 12}>
                <Rect
                    x={-14}
                    y={-9}
                    width={28}
                    height={18}
                    cornerRadius={4}
                    fill={pillFill}
                    stroke={borderColor}
                    strokeWidth={borderWidth}
                />
                <Text
                    text={String(node.id)}
                    fontSize={11}
                    fontFamily="monospace"
                    fontStyle="bold"
                    fill={isSelected ? "#fbbf24" : "#cbd5e1"}
                    align="center"
                    width={28}
                    y={-9 + 4} // Vertical center adjustment
                    x={-14}
                />
                {/* Connector REMOVED per request */}
            </Group>

            {/* Main Pill */}
            <Rect
                x={-pillWidth / 2}
                y={-pillHeight / 2}
                width={pillWidth}
                height={pillHeight}
                cornerRadius={nodeRadius}
                fill={pillFill}
                stroke={borderColor}
                strokeWidth={borderWidth}
                // Shadows are expensive, disabling for performance
            />

            {/* Attacker Image */}
            {showAttacker && attackerImgUrl && (
                <Group x={-nodeRadius * 0.9}>
                    <CircularImage 
                        src={attackerImgUrl} 
                        x={0} y={0} 
                        radius={nodeRadius - 4} 
                        border={1.5}
                        borderColor={attacker?.class ? CLASS_COLORS[attacker.class] : '#3b82f6'}
                        glowColor={attacker?.class ? CLASS_COLORS[attacker.class] : undefined}
                    />
                    {isAttackerTactic && (
                        <TacticBadge type="attacker" nodeRadius={nodeRadius} />
                    )}
                </Group>
            )}

            {/* Defender Image */}
            <Group x={showAttacker ? nodeRadius * 0.9 : 0}>
                {defender && defenderImgUrl ? (
                    <>
                        <CircularImage 
                            src={defenderImgUrl} 
                            x={0} y={0} 
                            radius={nodeRadius - 4} 
                            border={1.5}
                            borderColor={defender?.class ? CLASS_COLORS[defender.class] : '#ef4444'}
                            opacity={showHistory ? 0.7 : 1}
                            glowColor={defender?.class ? CLASS_COLORS[defender.class] : undefined}
                        />
                        {isDefenderTactic && (
                            <TacticBadge type="defender" nodeRadius={nodeRadius} />
                        )}
                    </>
                ) : (
                    <Circle 
                        radius={nodeRadius - 6} 
                        stroke="#334155" 
                        strokeWidth={1} 
                        dash={[3, 3]} 
                    />
                )}
            </Group>

            {/* Prefights */}
            {hasPrefight && prefightChampions && (
                <Group y={nodeRadius + 8} x={-(prefightChampions.length * 10) + 10}>
                    {prefightChampions.map((champ, i) => (
                        <CircularImage
                            key={`pf-${i}`}
                            src={getChampionImageUrl(champ.images as any, '64')}
                            x={i * 20}
                            y={0}
                            radius={9}
                            border={1}
                            borderColor="#94a3b8"
                        />
                    ))}
                </Group>
            )}

            {/* History Bubbles */}
            {showHistory && history && history.length > 0 && (
                <Group y={nodeRadius + (hasPrefight ? 25 : 5)} x={showAttacker ? pillWidth / 4 : nodeRadius}>
                    {history.slice(0, 3).map((stat, i) => (
                        <Group 
                            key={stat.attackerId} 
                            x={i * 18} 
                            y={i * 4}
                            onClick={(e) => {
                                e.cancelBubble = true; // Prevent node select
                                if (stat.sampleVideoInternalId) {
                                    window.open(`/war-videos/${stat.sampleVideoInternalId}`, '_blank');
                                } else if (stat.sampleVideoUrl) {
                                    window.open(stat.sampleVideoUrl, '_blank');
                                }
                            }}
                        >
                            <CircularImage
                                src={getChampionImageUrl(stat.attackerImages as any, '64')}
                                x={0} y={0}
                                radius={10}
                                border={1.5}
                                borderColor={stat.sampleVideoUrl ? '#fbbf24' : '#64748b'}
                            />
                            {/* Solo/Death Badge */}
                            <Rect x={6} y={-6} width={10} height={10} cornerRadius={3} fill={stat.solos > 0 ? "#10b981" : "#ef4444"} />
                            <Text 
                                text={String(stat.solos)}
                                x={6} y={-5} width={10} align="center"
                                fontSize={7} fill="white" fontStyle="bold"
                            />
                        </Group>
                    ))}
                </Group>
            )}
        </Group>
    );
});