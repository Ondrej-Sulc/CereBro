# Synergy cards — independent flow

2026-11-04. [Open the before/after gallery](comparison.html).

The desktop cards now use masonry placement: each next card can occupy the shorter column instead of waiting for the tallest card in a row. The card DOM, source order, keyboard sequence, disclosure state and native partner portraits remain in place. Single-column mobile and tablet presentation is unchanged.

A small layout component measures natural card heights and reserves one-pixel grid rows, including the existing 12px gutter. ResizeObserver updates the spans when cards expand, collapse, resize, or load fonts/images. Measurements are coalesced outside observer delivery. React handles filtered children without reparenting the cards; pending frames and observers are disposed on cleanup. Without the observer API, the existing readable grid remains available.

## Evidence

Six matched before/after pairs cover the expanded Hulk (Ragnarok) family from the user's screenshot, the complete incoming list, The Overseer at desktop/wide widths, and the same family at 390px and 320px. The incumbent includes all prior local UI work.

All rendered titles, partners/destinations, full bonuses, uniqueness notes, levels, source aliases and exact requirements/states match in [before evidence](before/evidence.json) and [after evidence](after/evidence.json).

The captured Hulk expanded-family section's largest internal vertical gap falls from 233px to 12px. Every measured desktop column has a 12px internal gap with no overlaps. The two mobile cases retain identical section heights. The gallery charts the largest gap for the selected section.

Both versions use the same shared T3 preview browser, anonymous session, viewport, DPR 1 and build. Fonts, visible images and paint are awaited; screenshots are unretouched. Reduced motion is not emulated. The development indicator is visible.

## Validation

- Two new measurement/cleanup cases fail before implementation and pass afterward.
- 73 focused tests pass across flow/disclosure interaction (18), card rendering (6), family grouping/display (18), source projection/text (17), and champion navigation (14).
- Web TypeScript and changed UI/test ESLint pass; ESLint reports only the existing baseline-browser-mapping freshness notice.
- Browser resize checks at 320, 390, 768, 1024, 1080, 1088, 1280 and 1536px show no overlaps, clipped text or horizontal document overflow. Single-column widths clear all measured row spans.
- Live filtering and clearing restore the correct cards with packed columns. A linked source alias retains focus and selection.
- Keyboard Tab reaches the family disclosure from its partner link. Enter expands it without moving its top/column; Escape closes it and returns focus. No development hydration issue is reported.

[Structured checks](checks.json) contain the measurements and interaction results. Changes remain local and uncommitted; no deployment was requested.
