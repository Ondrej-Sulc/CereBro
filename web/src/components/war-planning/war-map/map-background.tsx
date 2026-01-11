'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Shape } from 'react-konva';
import { LAYOUT, LAYOUT_BIG, warNodesData, warNodesDataBig } from "@cerebro/core/data/war-planning/nodes-data";
import Konva from 'konva';

interface Star {
    id: number;
    x: number;
    y: number;
    r: number;
    opacity: number;
}

interface WarMapBackgroundProps {
    isBigThing?: boolean;
    accentColor?: string;
}

function hexToRgba(hex: string, alpha: number) {
    if (!hex || typeof hex !== 'string') return `rgba(34, 211, 238, ${alpha})`;
    
    // Support #RGB and #RRGGBB
    let cleanHex = hex.replace('#', '');
    if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    
    if (cleanHex.length !== 6) return `rgba(34, 211, 238, ${alpha})`;

    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export const WarMapBackground = React.memo(function WarMapBackground({ isBigThing, accentColor }: WarMapBackgroundProps) {
    const shapeRef = useRef<Konva.Shape>(null);

    const currentLayout = isBigThing ? LAYOUT_BIG : LAYOUT;
    const currentNodesData = isBigThing ? warNodesDataBig : warNodesData;

    // Calculate the bounding box of all nodes with padding
    const contentBounds = useMemo(() => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        currentNodesData.forEach(node => {
            minX = Math.min(minX, node.x);
            maxX = Math.max(maxX, node.x);
            minY = Math.min(minY, node.y);
            maxY = Math.max(maxY, node.y);
        });
        // Add padding around nodes
        const padding = 250;
        return {
            minX: minX - padding,
            maxX: maxX + padding,
            minY: minY - padding,
            maxY: maxY + padding,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            width: maxX - minX + padding * 2,
            height: maxY - minY + padding * 2,
        };
    }, [currentNodesData]);

    // Pre-render static background for performance
    const staticCanvas = useMemo(() => {
        const canvas = document.createElement('canvas');
        canvas.width = currentLayout.WIDTH;
        canvas.height = currentLayout.HEIGHT;
        const ctx = canvas.getContext('2d');

        if (!ctx) return canvas;

        const W = currentLayout.WIDTH;
        const H = currentLayout.HEIGHT;
        const { centerX, centerY, width: boundW, height: boundH } = contentBounds;

        // === 1. Draw Nebulas ===
        // Scale nebulas relative to content center
        const nebulas = [
            { cx: centerX - boundW * 0.3, cy: centerY + boundH * 0.2, r: boundW * 0.5, color: "rgba(76, 29, 149, 0.15)" },   // Violet
            { cx: centerX + boundW * 0.2, cy: centerY - boundH * 0.3, r: boundW * 0.5, color: "rgba(30, 58, 138, 0.15)" },   // Blue
            { cx: centerX + boundW * 0.3, cy: centerY + boundH * 0.3, r: boundW * 0.4, color: "rgba(190, 24, 93, 0.15)" },   // Pink
            { cx: centerX, cy: centerY - boundH * 0.4, r: boundW * 0.4, color: "rgba(15, 118, 110, 0.15)" },                  // Teal
        ];

        nebulas.forEach(nebula => {
            const gradient = ctx.createRadialGradient(nebula.cx, nebula.cy, 0, nebula.cx, nebula.cy, nebula.r);
            gradient.addColorStop(0, nebula.color);
            gradient.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, W, H);
        });

        // === 2. Draw Paths ===
        ctx.save();
        ctx.strokeStyle = accentColor || "#22d3ee";
        ctx.lineWidth = 2;
        ctx.setLineDash([10, 10]);
        ctx.globalAlpha = 0.6;
        ctx.shadowColor = accentColor || "#0891b2";
        ctx.shadowBlur = 15;

        ctx.beginPath();
        currentNodesData.forEach((node) => {
            node.paths.forEach((pathToId) => {
                const targetNode = currentNodesData.find((n) => n.id === pathToId);
                if (targetNode) {
                    ctx.moveTo(node.x, node.y);
                    ctx.lineTo(targetNode.x, targetNode.y);
                }
            });
        });
        ctx.stroke();
        ctx.restore();

        // === 3. Draw Stars (only within content bounds + fade zone) ===
        const starPadding = 400; // Stars extend a bit past content
        const starCount = 300;
        ctx.fillStyle = "white";

        for (let i = 0; i < starCount; i++) {
            const x = contentBounds.minX - starPadding + Math.random() * (contentBounds.width + starPadding * 2);
            const y = contentBounds.minY - starPadding + Math.random() * (contentBounds.height + starPadding * 2);
            const r = Math.random() * 1.5 + 0.5;
            const opacity = Math.random() * 0.7 + 0.3;

            ctx.globalAlpha = opacity;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;

        // === 4. Vignette - Fade content to transparent at edges ===
        ctx.globalCompositeOperation = 'destination-in';

        // Use an elliptical vignette centered on content
        // Draw it as a radial gradient scaled to fit content bounds
        const fadeRadius = Math.max(boundW, boundH) * 0.7;
        const fadeEndRadius = Math.max(boundW, boundH) * 0.9;

        const vignetteGrad = ctx.createRadialGradient(
            centerX, centerY, fadeRadius * 0.5,
            centerX, centerY, fadeEndRadius
        );
        vignetteGrad.addColorStop(0, "rgba(0,0,0,1)");
        vignetteGrad.addColorStop(0.7, "rgba(0,0,0,0.8)");
        vignetteGrad.addColorStop(1, "rgba(0,0,0,0)");

        ctx.fillStyle = vignetteGrad;
        ctx.fillRect(0, 0, W, H);

        ctx.globalCompositeOperation = 'source-over';

        return canvas;
    }, [currentLayout, currentNodesData, contentBounds]);

    // Scene function just draws the pre-rendered canvas
    const sceneFunc = useMemo(() => {
        return (context: Konva.Context, _shape: Konva.Shape) => {
            const ctx = context._context;
            ctx.drawImage(staticCanvas, 0, 0);
        };
    }, [staticCanvas]);

    // Force redraw when canvas is ready
    useEffect(() => {
        if (shapeRef.current) {
            shapeRef.current.getLayer()?.batchDraw();
        }
    }, [staticCanvas]);

    return (
        <Shape
            sceneFunc={sceneFunc}
            width={currentLayout.WIDTH}
            height={currentLayout.HEIGHT}
            listening={false}
            ref={shapeRef}
        />
    );
});
