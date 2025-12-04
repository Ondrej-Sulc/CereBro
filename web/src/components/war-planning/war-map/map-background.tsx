import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Shape } from 'react-konva';
import { LAYOUT, LAYOUT_BIG, warNodesData, warNodesDataBig } from '../nodes-data';
import Konva from 'konva';

interface Star {
  id: number;
  x: number;
  y: number;
  r: number;
  opacity: number;
  twinkleSpeed: number;
  twinkleDir: number;
}

interface WarMapBackgroundProps {
    isBigThing?: boolean;
}

export const WarMapBackground = React.memo(function WarMapBackground({ isBigThing }: WarMapBackgroundProps) {
    const [stars, setStars] = useState<Star[]>([]);
    // Cache the static background (nebulas + paths)
    const staticBgCanvasRef = useRef<HTMLCanvasElement | null>(null);

    const currentLayout = isBigThing ? LAYOUT_BIG : LAYOUT;
    const currentNodesData = isBigThing ? warNodesDataBig : warNodesData;

    // Generate stars once
    useEffect(() => {
        const starCount = 400;
        const generatedStars = Array.from({ length: starCount }).map((_, i) => ({
          id: i,
          x: Math.random() * currentLayout.WIDTH,
          y: Math.random() * currentLayout.HEIGHT,
          r: Math.random() * 1.5 + 0.5,
          opacity: Math.random() * 0.7 + 0.3,
          twinkleSpeed: Math.random() * 0.02 + 0.005,
          twinkleDir: Math.random() > 0.5 ? 1 : -1
        }));
        setStars(generatedStars);

        // Pre-render static background
        const canvas = document.createElement('canvas');
        canvas.width = currentLayout.WIDTH;
        canvas.height = currentLayout.HEIGHT;
        const ctx = canvas.getContext('2d');
        if (ctx) {
             // 1. Draw Nebulas (Scaled for 2800x3200)
             // Use simple scaling factor if BigThing has different aspect ratio
             const scaleX = currentLayout.WIDTH / LAYOUT.WIDTH; 
             const scaleY = currentLayout.HEIGHT / LAYOUT.HEIGHT;

             const nebulas = [
                { cx: 400 * scaleX, cy: 1600 * scaleY, r: 1200 * scaleX, color: "rgba(76, 29, 149, 0.15)" },  // Left-Mid Violet
                { cx: 1600 * scaleX, cy: 800 * scaleY, r: 1400 * scaleX, color: "rgba(30, 58, 138, 0.15)" },  // Top-Right Blue
                { cx: 2000 * scaleX, cy: 2400 * scaleY, r: 1000 * scaleX, color: "rgba(190, 24, 93, 0.15)" }, // Bottom-Right Pink
                { cx: 1200 * scaleX, cy: 200 * scaleY, r: 1200 * scaleX, color: "rgba(15, 118, 110, 0.15)" }, // Top-Mid Teal
            ];
            nebulas.forEach(nebula => {
                const gradient = ctx.createRadialGradient(nebula.cx, nebula.cy, 0, nebula.cx, nebula.cy, nebula.r);
                gradient.addColorStop(0, nebula.color);
                gradient.addColorStop(1, "rgba(0,0,0,0)");
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, currentLayout.WIDTH, currentLayout.HEIGHT);
            });

            // 2. Draw Paths
            ctx.save(); // Save state to isolate shadow/glow effects
            ctx.strokeStyle = "#22d3ee"; // Cyan-400
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 10]);
            ctx.globalAlpha = 0.6;
            
            // Add Energy Glow
            ctx.shadowColor = "#0891b2"; // Cyan-600
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

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
            ctx.restore(); // Restore state (removes shadow, resets alpha/color)
            
            // 3. Vignette Mask (Alpha Fade)
            // Use destination-in to fade the canvas content to transparent at the edges.
            // This reveals the solid bg-slate-950 of the parent div perfectly.
            ctx.globalCompositeOperation = 'destination-in';
            
            const cx = currentLayout.WIDTH / 2;
            const cy = currentLayout.HEIGHT / 2;
            // Radius to cover most of the map but fade corners. 
            // Width 2800, Height 3200. Center is (1400, 1600).
            // We want to keep the center 60% fully opaque.
            const fadeStartRadius = Math.min(currentLayout.WIDTH, currentLayout.HEIGHT) * 0.4; // ~1100px
            const fadeEndRadius = Math.max(currentLayout.WIDTH, currentLayout.HEIGHT) * 0.8;   // ~2500px (reaches corners)

            const maskGradient = ctx.createRadialGradient(cx, cy, fadeStartRadius, cx, cy, fadeEndRadius);
            maskGradient.addColorStop(0, "rgba(0, 0, 0, 1)"); // Fully Opaque (Content kept)
            maskGradient.addColorStop(1, "rgba(0, 0, 0, 0)"); // Fully Transparent (Content removed)
            
            ctx.fillStyle = maskGradient;
            ctx.fillRect(0, 0, currentLayout.WIDTH, currentLayout.HEIGHT);

            // Reset composite operation for future draws (though we don't draw more on static)
            ctx.globalCompositeOperation = 'source-over';
        }
        staticBgCanvasRef.current = canvas;
    }, [isBigThing, currentLayout, currentNodesData]);

    const sceneFunc = useMemo(() => {
        return (context: Konva.Context, shape: Konva.Shape) => {
            const ctx = context._context;
            ctx.clearRect(0, 0, currentLayout.WIDTH, currentLayout.HEIGHT);

            // 1. Draw Cached Static Background
            if (staticBgCanvasRef.current) {
                ctx.drawImage(staticBgCanvasRef.current, 0, 0);
            }

            // 2. Draw Stars (Dynamic)
            ctx.fillStyle = "white";
            ctx.globalAlpha = 1.0; // Reset alpha
            
            stars.forEach(star => {
                // Update state for animation (mutation is okay inside render loop for visual effects)
                /*
                star.opacity += star.twinkleSpeed * star.twinkleDir;
                if (star.opacity > 1) {
                    star.opacity = 1;
                    star.twinkleDir = -1;
                } else if (star.opacity < 0.2) {
                    star.opacity = 0.2;
                    star.twinkleDir = 1;
                }

                ctx.globalAlpha = star.opacity;
                */
                ctx.globalAlpha = star.opacity; // Use initial random opacity
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.globalAlpha = 1.0;
        };
    }, [stars, isBigThing, currentLayout]);

    const shapeRef = useRef<Konva.Shape>(null);

    useEffect(() => {
        if (!shapeRef.current) return;
        
        // const anim = new Konva.Animation(() => {
        //      // Trigger redraw
        // }, shapeRef.current.getLayer());

        // anim.start();
        // return () => {
        //     anim.stop();
        // };
        
        // Just draw once?
        // The sceneFunc is called automatically by Konva on first render.
        // If we want to re-draw when stars change (initial load), it happens via React prop update -> Konva update.
    }, []);

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