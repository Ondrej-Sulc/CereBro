import React, { useMemo, useState, useEffect } from 'react';
import { Circle, Rect, Line, Group } from 'react-konva';
import { LAYOUT, warNodesData } from "@cerebro/core/data/war-planning/nodes-data";

interface Star {
    id: number;
    x: number;
    y: number;
    r: number;
    opacity: number;
}

export const CanvasBackground = React.memo(function CanvasBackground() {
    // Generate static stars in effect to avoid impure render
    const [stars, setStars] = useState<Star[]>([]);

    useEffect(() => {
        const count = 400;
        const newStars = Array.from({ length: count }).map((_, i) => ({
            id: i,
            x: Math.random() * LAYOUT.WIDTH,
            y: Math.random() * LAYOUT.HEIGHT,
            r: Math.random() * 1.5 + 0.5,
            opacity: Math.random() * 0.7 + 0.3,
        }));
        const timer = setTimeout(() => setStars(newStars), 0);
        return () => clearTimeout(timer);
    }, []);

    // Nebulas - approximations using large circles with radial gradients (simulated via multiple circles or opacity)
    // Konva supports FillRadialGradient.
    const nebulas = useMemo(() => [
        { x: 200, y: 800, r: 600, colorStart: "rgba(76, 29, 149, 0.15)", colorEnd: "rgba(76, 29, 149, 0)" }, // Violet
        { x: 800, y: 400, r: 700, colorStart: "rgba(30, 58, 138, 0.15)", colorEnd: "rgba(30, 58, 138, 0)" }, // Blue
        { x: 1000, y: 1200, r: 500, colorStart: "rgba(190, 24, 93, 0.15)", colorEnd: "rgba(190, 24, 93, 0)" }, // Pink
        { x: 600, y: 100, r: 600, colorStart: "rgba(15, 118, 110, 0.15)", colorEnd: "rgba(15, 118, 110, 0)" }, // Teal
    ], []);

    // Paths
    const paths = useMemo(() => {
        const lines: { points: number[]; key: string }[] = [];
        warNodesData.forEach(node => {
            node.paths.forEach(pathToId => {
                const target = warNodesData.find(n => n.id === pathToId);
                if (target) {
                    lines.push({
                        points: [node.x, node.y, target.x, target.y],
                        key: `${node.id}-${target.id}`
                    });
                }
            });
        });
        return lines;
    }, []);

    return (
        <Group>
            {/* Background Fill */}
            <Rect
                x={0}
                y={0}
                width={LAYOUT.WIDTH}
                height={LAYOUT.HEIGHT}
                fill="#020617"
            />

            {/* Nebulas */}
            {nebulas.map((neb, i) => (
                <Circle
                    key={`nebula-${i}`}
                    x={neb.x}
                    y={neb.y}
                    radius={neb.r}
                    fillRadialGradientStartPoint={{ x: 0, y: 0 }}
                    fillRadialGradientStartRadius={0}
                    fillRadialGradientEndPoint={{ x: 0, y: 0 }}
                    fillRadialGradientEndRadius={neb.r}
                    fillRadialGradientColorStops={[0, neb.colorStart, 1, neb.colorEnd]}
                />
            ))}

            {/* Stars */}
            {stars.map((star) => (
                <Circle
                    key={`star-${star.id}`}
                    x={star.x}
                    y={star.y}
                    radius={star.r}
                    fill="white"
                    opacity={star.opacity}
                />
            ))}

            {/* Paths */}
            {paths.map((line) => (
                <Line
                    key={line.key}
                    points={line.points}
                    stroke="#475569"
                    strokeWidth={1}
                    dash={[4, 4]}
                    opacity={0.3}
                />
            ))}
        </Group>
    );
});
