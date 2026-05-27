"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useRouteConnectorGeometry(selectedRoutePathIds: string[]) {
    const routeMapRef = useRef<HTMLDivElement>(null);
    const routeStartRef = useRef<HTMLDivElement>(null);
    const routeEndRef = useRef<HTMLDivElement>(null);
    const routeCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const [routeConnectorPaths, setRouteConnectorPaths] = useState<string[]>([]);
    const [routeMapSize, setRouteMapSize] = useState({ width: 0, height: 0 });

    const updateRouteConnectorGeometry = useCallback(() => {
        const mapEl = routeMapRef.current;
        const startEl = routeStartRef.current;
        const endEl = routeEndRef.current;
        if (!mapEl || !startEl || !endEl || selectedRoutePathIds.length === 0) {
            const nextSize = { width: mapEl?.scrollWidth || 0, height: mapEl?.scrollHeight || 0 };
            setRouteConnectorPaths(prev => prev.length === 0 ? prev : []);
            setRouteMapSize(prev => prev.width === nextSize.width && prev.height === nextSize.height ? prev : nextSize);
            return;
        }

        const mapRect = mapEl.getBoundingClientRect();
        const toPoint = (rect: DOMRect, side: "left" | "right") => ({
            x: side === "left" ? rect.left - mapRect.left + mapEl.scrollLeft : rect.right - mapRect.left + mapEl.scrollLeft,
            y: rect.top - mapRect.top + mapEl.scrollTop + rect.height / 2,
        });

        const selectedRects = selectedRoutePathIds
            .map(id => routeCardRefs.current[id]?.getBoundingClientRect())
            .filter((rect): rect is DOMRect => Boolean(rect));

        if (selectedRects.length !== selectedRoutePathIds.length) return;

        const startRect = startEl.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();
        const segments = [
            { from: toPoint(startRect, "right"), to: toPoint(selectedRects[0], "left") },
            ...selectedRects.slice(0, -1).map((rect, index) => ({
                from: toPoint(rect, "right"),
                to: toPoint(selectedRects[index + 1], "left"),
            })),
            { from: toPoint(selectedRects[selectedRects.length - 1], "right"), to: toPoint(endRect, "left") },
        ];

        const nextPaths = segments.map(({ from, to }) => {
            const controlOffset = Math.min(96, Math.max(24, Math.abs(to.x - from.x) / 2));
            return `M ${from.x} ${from.y} C ${from.x + controlOffset} ${from.y}, ${to.x - controlOffset} ${to.y}, ${to.x} ${to.y}`;
        });
        const nextSize = { width: mapEl.scrollWidth, height: mapEl.scrollHeight };

        setRouteConnectorPaths(prev =>
            prev.length === nextPaths.length && prev.every((path, index) => path === nextPaths[index])
                ? prev
                : nextPaths
        );
        setRouteMapSize(prev => prev.width === nextSize.width && prev.height === nextSize.height ? prev : nextSize);
    }, [selectedRoutePathIds]);

    useEffect(() => {
        const animationFrameId = window.requestAnimationFrame(updateRouteConnectorGeometry);
        window.addEventListener("resize", updateRouteConnectorGeometry);
        return () => {
            window.cancelAnimationFrame(animationFrameId);
            window.removeEventListener("resize", updateRouteConnectorGeometry);
        };
    }, [updateRouteConnectorGeometry]);

    const setRouteCardRef = useCallback((pathId: string, node: HTMLDivElement | null) => {
        routeCardRefs.current[pathId] = node;
    }, []);

    return {
        routeMapRef,
        routeStartRef,
        routeEndRef,
        routeConnectorPaths,
        routeMapSize,
        setRouteCardRef,
    };
}
