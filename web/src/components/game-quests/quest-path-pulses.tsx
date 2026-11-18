"use client";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from "react";
import type { Coordinate } from "@cerebro/core/domain/game-quests";
import { createQuestPathPulseGeometry, questPathPulseSubcurve, visitQuestPathPulseIntervals, type QuestPathPulseGeometry, type QuestPathPulseMotion } from "./quest-path-pulse-geometry";
import styles from "./quest-board.module.css";

export type QuestPathPulsesProps = {
  edges: readonly { from: Coordinate; to: Coordinate; portal: boolean }[];
  point: (coordinate: Coordinate) => Coordinate;
  distances: ReadonlyMap<string, number>;
  selectedEdges: ReadonlySet<string>; highlightRoute: boolean;
  width: number; height: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  sceneRef: RefObject<SVGSVGElement | null>;
  onRendererChange?: (renderer: "canvas" | "svg") => void;
};

const categories = ["normal-active", "normal-quiet", "portal-active", "portal-quiet"] as const;
const layers = [{ length: 26, width: 4.6 }, { length: 13, width: 3 }, { length: 4, width: 1.8 }] as const;

function paint(context: CanvasRenderingContext2D, geometry: readonly QuestPathPulseGeometry[], highlight: boolean,
  view: { left: number; top: number; width: number; height: number; scale: number; ratio: number }, motion: QuestPathPulseMotion) {
  const { left, top, width, height, scale, ratio } = view, margin = 5 / scale;
  const visible = geometry.filter(edge => edge.bounds.maxX >= left - margin && edge.bounds.minX <= left + width + margin &&
    edge.bounds.maxY >= top - margin && edge.bounds.minY <= top + height + margin);
  context.setTransform(scale * ratio, 0, 0, scale * ratio, -left * scale * ratio, -top * scale * ratio);
  context.lineCap = "round";
  // Batch disconnected strokes by style; a large map needs at most 12 strokes.
  layers.forEach((layer, index) => {
    for (const category of categories) {
      const portal = category.startsWith("portal"), quiet = category.endsWith("quiet");
      let drawn = false; context.beginPath();
      for (const edge of visible) {
        if (edge.category !== category) continue;
        visitQuestPathPulseIntervals(edge, motion, scale, layer.length, (start, end) => {
          const segment = questPathPulseSubcurve(edge, start, end);
          context.moveTo(...segment.from);
          if (segment.control) context.quadraticCurveTo(...segment.control, ...segment.to);
          else context.lineTo(...segment.to);
          drawn = true;
        });
      }
      if (!drawn) continue;
      context.lineWidth = layer.width / scale;
      context.strokeStyle = index === 0 ? portal ? "#d2a4ff" : "#8dd9ff" : index === 1 ? portal ? "#d5b6fa" : "#9fe5ff" : portal ? "#fff4ff" : "#f4ffff";
      context.globalAlpha = index === 0 ? quiet ? .09 : highlight ? .28 : .18 : index === 1 ? quiet ? .32 : highlight ? .7 : .55 : quiet ? .72 : highlight ? 1 : .98;
      context.stroke();
    }
  });
}

/** Only moving light is rasterized. The SVG owns all map geometry and hit targets. */
export const QuestPathPulses = memo(function QuestPathPulses({ edges, point, distances, selectedEdges, highlightRoute, width, height, viewportRef, sceneRef, onRendererChange }: QuestPathPulsesProps) {
  const surfaceRef = useRef<SVGForeignObjectElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const geometry = useMemo(() => createQuestPathPulseGeometry({ edges, point, distances, selectedEdges, highlightRoute }), [edges, point, distances, selectedEdges, highlightRoute]);
  const latest = useRef({ geometry, highlightRoute, onRendererChange });
  const reportedRenderer = useRef<"canvas" | "svg" | null>(null);
  useLayoutEffect(() => { latest.current = { geometry, highlightRoute, onRendererChange }; }, [geometry, highlightRoute, onRendererChange]);

  useEffect(() => {
    let disposed = false;
    const reportRenderer = (renderer: "canvas" | "svg") => {
      if (disposed || reportedRenderer.current === renderer) return;
      reportedRenderer.current = renderer;
      latest.current.onRendererChange?.(renderer);
    };
    const canvas = canvasRef.current, surface = surfaceRef.current, viewport = viewportRef.current, scene = sceneRef.current;
    if (!canvas || !surface || !viewport || !scene || typeof CanvasRenderingContext2D !== "function" || typeof window.matchMedia !== "function") {
      reportRenderer("svg"); return;
    }
    let context: CanvasRenderingContext2D | null;
    let motion: MediaQueryList;
    try { context = canvas.getContext("2d"); motion = window.matchMedia("(prefers-reduced-motion: reduce)"); } catch { reportRenderer("svg"); return; }
    if (!context) { reportRenderer("svg"); return; }
    let frame: number | null = null, visible = true, lost = false;
    let clock: (QuestPathPulseMotion & { time: number }) | null = null;
    const stop = () => { if (frame !== null) cancelAnimationFrame(frame); frame = null; };
    const hide = () => { surface.style.visibility = "hidden"; scene.removeAttribute("data-pulse-renderer"); };
    const fallback = () => { stop(); hide(); reportRenderer("svg"); };
    const allowed = () => !disposed && !lost && visible && !document.hidden && !motion.matches && viewport.clientWidth > 0 && viewport.clientHeight > 0;
    const attribute = (name: string, value: number) => { const text = String(value); if (surface.getAttribute(name) !== text) surface.setAttribute(name, text); };
    const draw = (time: number) => {
      frame = null;
      if (!allowed() || !context) return;
      const scale = Number(scene.getAttribute("data-zoom")), w = viewport.clientWidth, h = viewport.clientHeight;
      if (!(scale > 0) || !Number.isFinite(scale)) return;
      // Anchor spacing to the map once. Integrate only the new frame's travel:
      // dividing the entire timeline by each new zoom retimes every pulse.
      clock = {
        time,
        period: clock?.period ?? 60 / scale,
        distance: clock ? clock.distance + Math.max(0, time - clock.time) * .025 / scale : time * .025 / scale,
      };
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
      const left = (viewport.scrollLeft - Math.max(0, (w - width * scale) / 2)) / scale;
      const top = (viewport.scrollTop - Math.max(0, (h - height * scale) / 2)) / scale;
      attribute("x", left); attribute("y", top); attribute("width", w / scale); attribute("height", h / scale);
      const pixelWidth = Math.round(w * ratio), pixelHeight = Math.round(h * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
      try {
        context.setTransform(1, 0, 0, 1, 0, 0); context.clearRect(0, 0, pixelWidth, pixelHeight);
        paint(context, latest.current.geometry, latest.current.highlightRoute, { left, top, width: w / scale, height: h / scale, scale, ratio }, clock);
        if (surface.style.visibility !== "visible") surface.style.visibility = "visible";
        if (scene.getAttribute("data-pulse-renderer") !== "canvas") scene.setAttribute("data-pulse-renderer", "canvas");
      } catch { lost = true; fallback(); return; }
      reportRenderer("canvas");
      if (!disposed) frame = requestAnimationFrame(draw);
    };
    const update = () => {
      if (disposed) return;
      if (motion.matches) { surface.style.visibility = "hidden"; scene.removeAttribute("data-pulse-renderer"); }
      if (allowed()) { if (frame === null) frame = requestAnimationFrame(draw); }
      else stop();
    };
    const onLost = (event: Event) => { event.preventDefault(); lost = true; fallback(); };
    const onRestored = () => { try { context = canvas.getContext("2d"); lost = !context; } catch { lost = true; } if (lost) fallback(); else update(); };
    const resize = new ResizeObserver(update); resize.observe(viewport);
    const intersection = typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting); update();
    }) : null;
    intersection?.observe(viewport);
    canvas.addEventListener("contextlost", onLost); canvas.addEventListener("contextrestored", onRestored);
    motion.addEventListener("change", update); document.addEventListener("visibilitychange", update); update();
    return () => {
      disposed = true; stop(); hide(); resize.disconnect(); intersection?.disconnect();
      canvas.removeEventListener("contextlost", onLost); canvas.removeEventListener("contextrestored", onRestored);
      motion.removeEventListener("change", update); document.removeEventListener("visibilitychange", update);
    };
  }, [width, height, viewportRef, sceneRef]);

  return <foreignObject ref={surfaceRef} className={styles.pulseSurface} x="0" y="0" width="0" height="0" aria-hidden="true" pointerEvents="none" data-path-pulses>
    <canvas ref={canvasRef} className={styles.pulseCanvas}/>
  </foreignObject>;
});
