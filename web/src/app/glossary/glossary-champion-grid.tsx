'use client';

import { Children, useLayoutEffect, useRef, type ReactNode } from 'react';
import styles from './glossary-champion-grid.module.css';

/** Keep source order while allowing the next card to use the first free column. */
export function GlossaryChampionGrid({ children }: { children: ReactNode }) {
  const container = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const grid = container.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const items = Array.from(grid.children).filter((item): item is HTMLElement => item instanceof HTMLElement);
    const contents = items.map(item => item.firstElementChild).filter((content): content is HTMLElement => content instanceof HTMLElement);
    if (!items.length || contents.length !== items.length) return;
    let frame: number | null = null;
    let observedWidth: number | undefined;
    let disposed = false;

    const measure = () => {
      if (disposed) return;
      const configuredGap = Number.parseFloat(getComputedStyle(grid).getPropertyValue('--champion-card-gap'));
      const gap = Number.isFinite(configuredGap) ? configuredGap : 16;
      // Read every intrinsic card height before changing any grid tracks.
      const heights = contents.map(content => content.getBoundingClientRect().height);
      if (heights.some(height => !Number.isFinite(height) || height <= 0)) {
        grid.removeAttribute('data-masonry-ready');
        items.forEach(item => item.style.removeProperty('grid-row-end'));
        return;
      }
      items.forEach((item, index) => {
        const span = `span ${Math.ceil(heights[index] + gap)}`;
        if (item.style.gridRowEnd !== span) item.style.gridRowEnd = span;
      });
      grid.setAttribute('data-masonry-ready', '');
    };
    const schedule = () => {
      if (disposed || frame !== null) return;
      frame = requestAnimationFrame(() => { frame = null; measure(); });
    };
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target !== grid) { schedule(); continue; }
        // Height changes are caused by packing itself; only grid width requires a new layout.
        if (observedWidth !== entry.contentRect.width) {
          observedWidth = entry.contentRect.width;
          schedule();
        }
      }
    });
    contents.forEach(content => observer.observe(content));
    observer.observe(grid);
    measure();

    return () => {
      disposed = true;
      observer.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
      grid.removeAttribute('data-masonry-ready');
      items.forEach(item => item.style.removeProperty('grid-row-end'));
    };
  }, [children]);

  return <div ref={container} className={styles.grid} data-champion-grid>
    {Children.map(children, child => <div className={styles.item} data-champion-grid-item>{child}</div>)}
  </div>;
}
