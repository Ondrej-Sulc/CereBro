# Compact rows — quieter controls and mobile refinement

2026-11-04. The user approved the compact list, questioned Partners & stars wording repeated on every row, and requested continued improvements. This is the second candidate of the compact-row pilot. Before-edit source hashes are in `incumbent-manifest.json`; local snapshots are under `temp/champion-compact-refinement-incumbent/`.

## Retained changes

- Removed the repeated visible button phrase. Each row keeps its contextual accessible name, expanded state and panel relationship.
- Added one short expansion guide per list group and an on-demand tooltip on each arrow for mouse and keyboard focus. Exact names and star rules remain available through the same panel on touch.
- On mobile, the arrow shares the portrait line. The title uses the full line and no longer inherits an extra 40px control's height.
- Below 360px, section tabs hide decorative icons so their existing 14px labels stay on one line. Larger layouts retain the icons.
- Group headings and explanatory text now share a quieter, consistent layout.

The production changes are limited to `champion-synergies-panel.tsx` and `champion-dossier.module.css`. No imported data, math, grouping, filtering, link state or description text was changed.

## Matched evidence

[Open the comparison gallery](comparison.html). Ten fresh before/after pairs cover the reference champion's rows and section entry on desktop/mobile, 320px tabs and text, expanded rules, multiple recipients and leveled families. Main reference: Star-Lord (Kitty Pryde), 7★ R6 Sig 200 A0. Additional cases: Absorbing Man at that build and Hulk (Ragnarok), 6★ R5 Sig 200 A0.

Both sides use anonymous local Chromium, 100% browser zoom, DPR 1 and reduced motion. Fonts and visible images are awaited. Target positions align below sticky navigation. The shared preview twice returned “Preview automation evaluate timed out after 15000ms,” so local Chromium supplied the packet. Captures are real and unretouched.

| Reference result | Approved compact rows | Refinement |
| --- | --- | --- |
| Mobile six-row list height, 390px | 997px | 877px — 12% less |
| Complete rows visible, 390 × 844 | 3 | 4 |
| Complete rows visible, 320 × 568 | 1 | 2 |
| Desktop six-row list height, 1280px | 521px | 521px |
| Complete desktop rows visible | 6 | 6 |

These are rendered geometry and screenshot observations, not human task times. Main bonus type remains at least 14px. Ten semantic snapshots match exactly for titles, partner names/destinations, recipient labels, bonus bodies, exact star rules, stacking notes and original targets.

## Review and checks

Fresh-context routine reviewer: `gpt-6-astra`, read-only PNG/evidence/source comparison. It preferred the refinement in all ten pairs and found no blockers. It identified the shared guide as visible and the mobile/320px improvement as meaningful. It did not run browser or screen-reader tests.

- **131 tests in nine champion suites passed.** No extra tests were added solely to mirror reversible copy or CSS changes.
- Web TypeScript, targeted ESLint and tracked diff whitespace checks passed. The existing dependency browser-mapping notice remains.
- **18 browser layout cases** across three champions and six widths passed: no document/control clipping, nonempty partner-link names, expected control sizes, and main bonus text at least 14px.
- Real keyboard checks passed for portrait-name tooltips, the arrow's explanatory tooltip, panel expansion/collapse and retained focus. The shared guide appears once in the reference group, with no visible per-row phrase remaining.
- Touch panel access and original grouped-alias focus/highlighting below the sticky bar passed. Full names and exact ranges remain accessible.
- `before/evidence.json`, `after/evidence.json` and `browser-smoke.json` record the results. Local helpers: `temp/champion-compact-refinement-capture.cjs` and `temp/champion-compact-refinement-smoke.cjs`. The gallery preview reported no console messages; final hashes are in `manifest.json`.

Decision: retain locally. Physical-device, screen-reader, production-performance and full-catalog coverage are not established. Changes remain uncommitted; no push or deployment was performed.
