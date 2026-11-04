# Compact synergy rows — reference-driven redesign

2026-11-04. The user supplied Khonshu and CereBro screenshots, identified the excessive space used by our cards, explicitly welcomed larger visual changes, and questioned the repeated Bonuses labels. This starts a new, focused redesign against the approved card incumbent.

Earlier model reviews favored the card polish but did not establish that its density met the user's needs. This pass uses the supplied reference and concrete checks: complete synergies visible at fixed zoom, list height, full readable descriptions, and direct access to partner names and exact requirements.

## Result and previews

[Open the comparison gallery](comparison.html). Full-resolution examples: [desktop before](before/01-reference-desktop.png), [desktop after](after/01-reference-desktop.png), [mobile after](after/02-reference-mobile.png), [expanded names and stars](after/04-reference-requirements.png).

The reference was matched to **Star-Lord (Kitty Pryde)** using the local catalog's WAY WAY BACK IN THE 1980S synergy. The paired captures use its same six own synergies at 7★ R6 Sig 200 A0.

| Measure | Card incumbent | Compact rows |
| --- | --- | --- |
| Six-synergy list height at 1280px | 1,105px | 521px — 53% less |
| Complete own synergies visible at 1280 × 900 | 2 of 6 | 6 of 6 |
| Six-synergy list height at 390px | 2,584px | 997px — 61% less |
| Complete own synergies visible at 390 × 844 | 1 | 3 |

These are rendered geometry measurements at **100% browser zoom and DPR 1**, not user task-time measurements. Main bonus text remains at least 14px. The reduced height comes primarily from the continuous list, shared title/portrait row, inline recipients, and removed framing and labels.

## Retained design

- Single-column, alternating rows replace the separate masonry cards. DOM reading order and catalog grouping remain unchanged.
- Titles and compact partner portraits share the desktop header. Mobile gives portraits a second compact line. Portrait links retain their destinations, accessible names and hover/focus name tooltips.
- Removed Bonuses labels and repeated Unique badges. Complete descriptions stay visible, recipients read inline with their effects, and full uniqueness/stacking notes remain below.
- A visible Partners & stars button controls an associated panel. It exposes full names, activation wording and exact correlated star rules on touch or keyboard. Panels begin closed; the bonus is never inside the collapsed panel.
- Families retain every level and its complete bonus. Exact partner stars remain visible with each level; the expanded panel names the partners. Original catalog aliases remain focusable and highlighted at their own rows.
- Portrait targets are 32px on desktop and 40px on mobile, with spacing; the labeled disclosure is 32px/40px tall. This is a deliberate density tradeoff from the previous 44px chips. Main descriptions were not truncated or summarized.

The production redesign is limited to the synergy component and stylesheet. Imported game data, grouping, search semantics, numeric bindings and bonuses are unchanged.

## Evidence and review

Eight matched pairs cover the reference champion at 1280, 1600, 390 and 320px, expanded requirements, Absorbing Man's multiple recipients, and Hulk (Ragnarok)'s leveled families. Browser configuration, URLs, viewport and card alignment match within each pair. Before/after evidence records semantic fields separately so inline formatting whitespace does not count as a text change. All article titles, partner names/destinations, recipient labels, bonus bodies, exact requirements, stacking notes and source targets match in all eight cases.

The screenshots are real and unretouched. Local headless Chromium was used after the shared preview twice returned “Preview automation evaluate timed out after 15000ms.” Capture staging waits for hydration/layout and explicitly realigns the target after any section restoration; preliminary misaligned captures were replaced, not used as comparison evidence. Helpers: `temp/champion-compact-capture.cjs` and `temp/champion-compact-smoke.cjs`.

Fresh-context read-only reviews by `gpt-6.1-terra` and `gpt-6-astra` both preferred the compact version and found it substantially closer to the supplied reference. Terra flagged the unlabeled chevron's discoverability for touch users; Astra accepted the name-access tradeoff. The control was given the visible Partners & stars label without increasing row height. No further review was requested to obtain a different judgment. Final captures include that correction.

## Touch finding and correction

A touch-enabled browser check uncovered a late section-entry scroll during hydration. Pointer-down/up hit the intended row control, but the page moved before the click and the click instead hit From teammates, leaving no own rows. The page-entry restoration logic predates the compact redesign.

The champion client now restores section entry only while the page is still at scroll 0 and no exact ability/synergy or fragment target owns navigation. It preserves a user/browser position already established before hydration. Test-first page integration cases reproduced the problem and cover fresh entry, an existing position and an exact source target. The touch event trace then stayed on the intended control, and the named panel opened correctly. This adds the champion client and its navigation test to the card scope; their incumbents were preserved before editing. Independent visual reviews preceded this small correction.

## Verification and limits

- **131 tests in nine champion suites passed.** Three new disclosure/SSR assertions initially failed, then passed with the new controls. Two new entry-restoration cases initially failed, then passed with the navigation correction. A fresh-entry case preserves normal section restoration.
- Web TypeScript, targeted ESLint and tracked diff whitespace checks passed. The existing dependency browser-mapping freshness notice remains.
- **18 layout cases** across three champions at 320, 390, 640, 768, 1024 and 1536px passed: no horizontal document/control clipping, nonempty partner-link names, adequate control sizes, and main bonus text at least 14px.
- Real Chromium checks passed for keyboard portrait-name tooltips, Enter/Space panel toggling with retained focus, exact named star ranges, touch panel access, and the original grouped alias's focus/selected level below sticky navigation.
- `browser-smoke.json` records results. The gallery's HTML preview reported no console messages. Final source, screenshot and evidence hashes are in `manifest.json`; incumbent source hashes are in `incumbent-manifest.json` and local `.snapshot` copies are under `temp/champion-compact-incumbent/`.

This establishes the specified viewport and input-emulation behavior, not physical-device, screen-reader, production-performance or full-catalog coverage. Decision: retain the compact redesign locally. No commit, push or deployment was performed.
