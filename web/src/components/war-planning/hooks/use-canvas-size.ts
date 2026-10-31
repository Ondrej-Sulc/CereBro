import { useEffect, useState, type RefObject } from 'react';

export function useCanvasSize(containerRef: RefObject<HTMLElement | null>, fullscreen: boolean) {
  const [size, setSize] = useState({ width: 1000, height: 800 });
  useEffect(() => {
    if (!containerRef.current) return;
    let active = true;
    let frame: number | null = null;
    let pending: typeof size | null = null;
    const observer = new ResizeObserver(entries => {
      if (!active) return;
      for (const entry of entries) {
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        // Canvas dimensions truncate subpixels. Preserve the last drawable size
        // while a panel is hidden or transitioning instead of destroying its stage.
        if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) continue;
        pending = { width, height };
      }
      if (!pending || frame !== null) return;
      // React writes run outside observer delivery, with one update per frame.
      frame = requestAnimationFrame(() => {
        frame = null;
        const next = pending;
        pending = null;
        if (!active || !next) return;
        setSize(previous => previous.width === next.width && previous.height === next.height ? previous : next);
      });
    });
    observer.observe(containerRef.current);
    return () => {
      active = false;
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [containerRef, fullscreen]);
  return size;
}
