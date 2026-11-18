"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { questZoom } from "@cerebro/core/domain/game-quests/navigation";

type Anchor = { x: number; y: number; nextX?: number; nextY?: number };
type Viewport = { x: number; y: number; width: number; height: number };
type Options = {
  width: number; height: number;
  viewportRef: RefObject<HTMLDivElement | null>;
  frameRef: RefObject<HTMLDivElement | null>;
  sceneRef: RefObject<SVGSVGElement | null>;
  overviewRef: RefObject<SVGRectElement | null>;
  onViewportChange: (viewport: Viewport) => void;
};

// Unsupported preference detection uses the immediate, motion-safe fallback.
const reducedMotion = () => typeof window.matchMedia !== "function" || window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Animate the camera, then commit detailed marker/label geometry once at rest. */
export function useQuestMapZoom({ width, height, viewportRef, frameRef, sceneRef, overviewRef, onViewportChange }: Options) {
  const [scale, setScale] = useState(1), [fitScale, setFitScale] = useState(.7);
  const [fitting, setFitting] = useState(true), [ready, setReady] = useState(false);
  const [controls, setControls] = useState({ canZoomIn: true, canZoomOut: false });
  const scaleRef = useRef(1), fitRef = useRef(.7), renderedScale = useRef(1), target = useRef(1);
  const fittingRef = useRef(true), zoomingRef = useRef(false);
  const frame = useRef<number | null>(null), lastTime = useRef<number | null>(null), anchor = useRef<Anchor | undefined>(undefined);
  const precisePan = useRef<{ left: number; top: number } | null>(null);
  const outerSize = useRef<{ width: number; height: number } | null>(null);

  const updateControls = useCallback((next: number) => {
    const canZoomIn = next < Math.max(2.5, fitRef.current * 2.5), canZoomOut = next > fitRef.current + .001;
    setControls(previous => previous.canZoomIn === canZoomIn && previous.canZoomOut === canZoomOut ? previous : { canZoomIn, canZoomOut });
  }, []);

  const syncOverview = useCallback(() => {
    const e = viewportRef.current, overview = overviewRef.current;
    if (!e || !overview) return;
    const zoom = scaleRef.current;
    const attribute = (name: string, value: number) => {
      const text = String(value);
      if (overview.getAttribute(name) !== text) overview.setAttribute(name, text);
    };
    attribute("x", e.scrollLeft / zoom); attribute("y", e.scrollTop / zoom);
    attribute("width", Math.min(width, e.clientWidth / zoom));
    attribute("height", Math.min(height, e.clientHeight / zoom));
  }, [width, height, viewportRef, overviewRef]);

  const publishViewport = useCallback(() => {
    syncOverview();
    const e = viewportRef.current;
    if (e) onViewportChange({ x: e.scrollLeft, y: e.scrollTop, width: e.clientWidth, height: e.clientHeight });
  }, [viewportRef, onViewportChange, syncOverview]);

  const syncView = useCallback((zoom: number) => {
    const canvas = frameRef.current, scene = sceneRef.current;
    if (canvas) { canvas.style.width = `${width * zoom}px`; canvas.style.height = `${height * zoom}px`; }
    if (scene) {
      scene.style.transform = zoom === renderedScale.current ? "" : `scale(${zoom / renderedScale.current})`;
      scene.setAttribute("data-zoom", String(zoom));
    }
  }, [width, height, frameRef, sceneRef]);

  const renderZoom = useCallback((next: number, at?: Anchor) => {
    const e = viewportRef.current; if (!e || !Number.isFinite(next)) return;
    const oldWidth = e.clientWidth, oldHeight = e.clientHeight;
    const x = at?.x ?? oldWidth / 2, y = at?.y ?? oldHeight / 2;
    const pan = zoomingRef.current && precisePan.current ? precisePan.current : { left: e.scrollLeft, top: e.scrollTop };
    const result = questZoom({ scale: scaleRef.current, next, min: fitRef.current, max: Math.max(2.5, fitRef.current * 2.5),
      left: pan.left, top: pan.top, anchorX: x, anchorY: y, width: oldWidth, height: oldHeight, boardWidth: width, boardHeight: height });
    scaleRef.current = result.scale;
    syncView(result.scale);
    // Resize the scroll extent before applying the anchored pan, without React
    // rebuilding hundreds of SVG markers between individual animation frames.
    const newWidth = e.clientWidth, newHeight = e.clientHeight;
    // Scrollbars can change the centered inset on the first zoom above fit.
    const offsetX = Math.max(0, (newWidth - width * result.scale) / 2) - Math.max(0, (oldWidth - width * result.scale) / 2);
    const offsetY = Math.max(0, (newHeight - height * result.scale) / 2) - Math.max(0, (oldHeight - height * result.scale) / 2);
    precisePan.current = {
      left: Math.max(0, Math.min(width * result.scale - newWidth, result.left + offsetX + x - (at?.nextX ?? x))),
      top: Math.max(0, Math.min(height * result.scale - newHeight, result.top + offsetY + y - (at?.nextY ?? y))),
    };
    e.scrollTo({ ...precisePan.current, behavior: "instant" });
    syncOverview();
    const output = e.closest('[data-quest-board]')?.querySelector('output[aria-label="Map zoom"]');
    if (output) output.textContent = `${Math.round(result.scale * 100)}%`;
  }, [width, height, viewportRef, syncOverview, syncView]);

  const cancelFrame = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null; lastTime.current = null; zoomingRef.current = false;
    if (sceneRef.current) { sceneRef.current.style.willChange = ""; sceneRef.current.removeAttribute("data-camera-moving"); }
  }, [sceneRef]);
  const interruptZoom = useCallback(() => {
    const active = zoomingRef.current || frame.current !== null || scaleRef.current !== renderedScale.current;
    cancelFrame(); precisePan.current = null; target.current = scaleRef.current;
    // A normal grab/key press has no camera animation to commit. Keep it on
    // the same imperative path as panning instead of reconciling the map.
    if (!active) { syncOverview(); return; }
    fittingRef.current = Math.abs(scaleRef.current - fitRef.current) < .0001;
    setFitting(fittingRef.current); updateControls(scaleRef.current); setScale(scaleRef.current); publishViewport();
  }, [cancelFrame, publishViewport, updateControls, syncOverview]);
  const onScroll = useCallback(() => {
    const e = viewportRef.current; if (!e) return;
    if (zoomingRef.current) {
      // Camera writes can round to device pixels. A different scroll means the
      // user, overview or a location link has taken over navigation.
      const pan = precisePan.current;
      if (!pan || (Math.abs(e.scrollLeft - pan.left) <= 1 && Math.abs(e.scrollTop - pan.top) <= 1)) return;
      interruptZoom(); return;
    }
    // Panning only moves this camera rectangle; publishing React state would
    // reconcile the entire map for every native scroll event.
    syncOverview();
  }, [viewportRef, interruptZoom, syncOverview]);

  const animate = useCallback(function advance(time: number) {
    frame.current = null;
    const elapsed = lastTime.current === null ? 16 : time - lastTime.current;
    lastTime.current = time;
    const distance = Math.log(target.current / scaleRef.current);
    const finished = Math.abs(distance) < .0005 || reducedMotion() || document.hidden;
    const next = finished ? target.current : scaleRef.current * Math.exp(distance * (1 - Math.exp(-Math.max(1, Math.min(64, elapsed)) / 45)));
    renderZoom(next, anchor.current);
    if (finished) interruptZoom();
    else frame.current = requestAnimationFrame(advance);
  }, [renderZoom, interruptZoom]);

  const zoomTo = useCallback((next: number, at?: Anchor) => {
    if (!Number.isFinite(next)) return;
    target.current = Math.max(fitRef.current, Math.min(Math.max(2.5, fitRef.current * 2.5), next));
    const e = viewportRef.current;
    anchor.current = at ?? (e ? { x: e.clientWidth / 2, y: e.clientHeight / 2 } : undefined);
    updateControls(target.current);
    fittingRef.current = Math.abs(target.current - fitRef.current) < .0001;
    setFitting(fittingRef.current);
    if (reducedMotion() || typeof requestAnimationFrame !== "function" || target.current === scaleRef.current) {
      cancelFrame(); renderZoom(target.current, at); interruptZoom(); return;
    }
    zoomingRef.current = true;
    if (sceneRef.current) { sceneRef.current.style.willChange = "transform"; sceneRef.current.setAttribute("data-camera-moving", ""); }
    if (frame.current === null) frame.current = requestAnimationFrame(animate);
  }, [animate, cancelFrame, interruptZoom, renderZoom, sceneRef, updateControls, viewportRef]);
  const zoomBy = useCallback((factor: number, at?: Anchor) => zoomTo(target.current * factor, at), [zoomTo]);
  const fitMap = useCallback(() => zoomTo(fitRef.current), [zoomTo]);
  // Pinch has no easing or delayed tail: the map stays directly under fingers.
  const pinchZoom = useCallback((next: number, at: Anchor) => {
    cancelFrame(); zoomingRef.current = true; renderZoom(next, at); target.current = scaleRef.current; updateControls(scaleRef.current);
    if (sceneRef.current) { sceneRef.current.style.willChange = "transform"; sceneRef.current.setAttribute("data-camera-moving", ""); }
    fittingRef.current = Math.abs(scaleRef.current - fitRef.current) < .0001; setFitting(fittingRef.current);
  }, [cancelFrame, renderZoom, sceneRef, updateControls]);

  useLayoutEffect(() => {
    renderedScale.current = scale;
    syncView(scaleRef.current);
    if (!zoomingRef.current) { if (sceneRef.current) sceneRef.current.style.willChange = ""; publishViewport(); }
  }, [scale, syncView, sceneRef, publishViewport]);

  useEffect(() => {
    const e = viewportRef.current; if (!e) return;
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault(); const bounds = e.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? e.clientHeight : 1);
      zoomBy(Math.exp(-Math.max(-160, Math.min(160, delta)) * .002), { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    };
    e.addEventListener("wheel", wheel, { passive: false });
    return () => e.removeEventListener("wheel", wheel);
  }, [viewportRef, zoomBy]);

  useEffect(() => {
    const e = viewportRef.current; if (!e) return;
    const update = () => {
      const fit = Math.min(e.clientWidth / width, e.clientHeight / height);
      if (!Number.isFinite(fit) || fit <= 0) return;
      const outer = { width: e.offsetWidth || e.clientWidth, height: e.offsetHeight || e.clientHeight };
      const resized = !outerSize.current || outer.width !== outerSize.current.width || outer.height !== outerSize.current.height;
      outerSize.current = outer; fitRef.current = fit; setFitScale(fit);
      // Native scrollbars change the observed content box without changing the
      // viewport itself. Follow the new fit bounds without stopping its camera.
      if (!resized && zoomingRef.current) {
        if (fittingRef.current) target.current = fit;
        else target.current = Math.max(fit, target.current);
        updateControls(target.current); return;
      }
      cancelFrame(); precisePan.current = null;
      if (fittingRef.current || scaleRef.current < fit) {
        fittingRef.current = true; setFitting(true); scaleRef.current = fit;
        syncView(fit); e.scrollTo(0, 0);
      }
      target.current = scaleRef.current; updateControls(scaleRef.current); setScale(scaleRef.current); publishViewport(); setReady(true);
    };
    const observer = new ResizeObserver(update); observer.observe(e); update();
    return () => { observer.disconnect(); cancelFrame(); };
  }, [width, height, viewportRef, syncView, cancelFrame, publishViewport, updateControls]);
  useEffect(() => cancelFrame, [cancelFrame]);

  return { scale, scaleRef, fitScale, fitting, ready, onScroll, zoomBy, fitMap, pinchZoom, interruptZoom, ...controls };
}
