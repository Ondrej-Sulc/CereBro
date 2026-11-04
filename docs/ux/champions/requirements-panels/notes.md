# Synergy partner requirements

2026-11-04. Continued the approved champion-page improvements after the separate native-icon extraction thread completed. The incumbent includes that thread's verified game glyphs and the approved compact rows. Source snapshots and hashes are recorded in `incumbent-manifest.json` and `temp/champion-requirements-incumbent/`.

## Retained changes

- Expanded single-variant panels align a portrait and full-name champion link with the exact star range. Names wrap, ranges stay together, and links have a minimum 44px row height. Desktop panels use two columns; narrow panels use one.
- Separate current-champion/partner rarity rules remain separate groups. Missing star metadata says “Not recorded”; partners without a destination remain text.
- Family legends now offer full-name champion links. Exact stars remain beside each original level; no family-wide range is invented.
- Escape closes either panel and restores visible focus to its arrow below sticky navigation. The rounded list uses `overflow: clip` to avoid an intermediate scrollport interfering with that alignment.
- Closed-row layout, native icons, complete bonuses, recipients, stacking notes and original navigation targets remain intact. Repeated visible expander wording was not reintroduced.

Production changes in this pass are limited to `champion-synergies-panel.tsx` and `champion-dossier.module.css`. Native-icon assets, extraction, mappings, grouping and read projection were retained without changes.

## Matched evidence

[Open the comparison gallery](comparison.html). Ten real before/after pairs cover closed and expanded rows on desktop and mobile, 320px text, multiple recipients, leveled families and a wide desktop. Main reference: Star-Lord (Kitty Pryde), 7★ R6 Sig 200 A0. Additional cases: Absorbing Man at that build and Hulk (Ragnarok), 6★ R5 Sig 200 A0.

Captures use anonymous local Chromium at 100% browser zoom, DPR 1 and reduced motion, after awaiting fonts and visible images. The shared preview twice returned “Preview automation evaluate timed out after 15000ms”; local Playwright Chromium supplied the packet. Screenshots are unretouched and align the reference row below sticky navigation.

| Reference result | Before | After |
| --- | --- | --- |
| Closed six-row list, 1280px | 521px | 521px |
| Complete rows visible, 1280 × 900 | 6 | 6 |
| Closed six-row list, 390px | 877px | 877px |
| Complete rows visible, 390 × 844 | 4 | 4 |
| First panel expanded, 390px list height | 976px | 1126px |
| First panel expanded, 1280px list height | 596px | 670px |

The expanded panel deliberately uses more space for readable names and useful touch targets. The closed list retains its density. These are rendered geometry observations, not human task times.

All ten semantic comparisons preserve titles, partner names/destinations, recipient labels, full bonus bodies, correlated star rules, stacking notes and original target IDs. Duplicate destinations from the new full-name links are normalized for that comparison. Native title glyphs remain present in the captures.

## Review and verification

Fresh-context reviewer `gpt-6.1-terra` recommended the candidate after reviewing source, PNGs and evidence. It found no blockers and judged the taller expanded mobile panel a reasonable tradeoff for clearer, direct champion links. It did not run browser or screen-reader tests. The final `overflow: clip` focus correction was made after that review and directly verified in the browser.

- **145 tests across 12 relevant champion, import and icon suites passed.** Three new interaction tests failed before implementation and passed afterward: named destinations with exact ranges, family Escape/focus recovery, and distinct correlated rarity pairs.
- Web TypeScript, targeted ESLint and diff whitespace checks passed. The existing dependency browser-mapping notice remains.
- **18 browser layout cases**, each with a closed and expanded panel, passed across three champions and widths 320, 390, 640, 768, 1024 and 1536px. No document/control overflow, missing title icons, clipped names, undersized expanded links or main bonus text below 14px was found.
- Keyboard checks passed for portrait and arrow tooltips, expansion, names/ranges and Escape recovery. A touch-emulated browser opened the panel and navigated through its full-name Angela link to the correct champion page.
- **Six final visible-focus recoveries** passed: single and family panels at 320, 390 and 1280px. Escape returned focus below the sticky bar in every case.
- Original grouped alias `comp_009` still receives focus and selected/targeted styling below the sticky bar.
- `before/evidence.json`, `after/evidence.json`, `browser-smoke.json` and `escape-focus.json` record the checks. Local helpers are `temp/champion-requirements-capture.cjs`, `temp/champion-requirements-smoke.cjs` and `temp/champion-requirements-focus.cjs`. The gallery preview reported no console messages; final hashes are in `manifest.json`.

Decision: retain locally. Physical-device, screen-reader, production-performance and full-catalog coverage are not established. Changes remain uncommitted; no push or deployment was performed.
