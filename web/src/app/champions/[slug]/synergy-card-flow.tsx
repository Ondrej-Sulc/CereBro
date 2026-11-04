"use client"

import { useLayoutEffect, useRef, type ReactNode } from "react"

/** Keep source/keyboard order while letting the next card use the shorter column. */
export function SynergyCardFlow({ children, className }: { children: ReactNode; className: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const grid = ref.current
    if (!grid || typeof ResizeObserver === "undefined") return
    const cards = Array.from(grid.children).filter((node): node is HTMLElement => node instanceof HTMLElement)
    let frame: number | null = null
    let disposed = false
    const measure = () => {
      const css = getComputedStyle(grid)
      const columns = css.gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length
      if (columns < 2) {
        delete grid.dataset.cardFlow
        cards.forEach(card => card.style.removeProperty("grid-row-end"))
        return
      }
      // One-pixel grid rows reserve the natural card height plus its gutter.
      // Read every height before writing, and leave the DOM nodes in place.
      const gap = parseFloat(css.columnGap) || 0
      const spans = cards.map(card => Math.ceil(card.getBoundingClientRect().height + gap))
      cards.forEach((card, index) => {
        const span = `span ${spans[index]}`
        if (card.style.gridRowEnd !== span) card.style.gridRowEnd = span
      })
      grid.dataset.cardFlow = "masonry"
    }
    const schedule = () => {
      if (disposed || frame !== null) return
      frame = requestAnimationFrame(() => { frame = null; measure() })
    }
    measure()
    const observer = new ResizeObserver(schedule)
    observer.observe(grid)
    cards.forEach(card => observer.observe(card))
    return () => {
      disposed = true
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [children])
  return <div ref={ref} className={className}>{children}</div>
}
