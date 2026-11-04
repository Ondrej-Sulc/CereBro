# Champion visual pilot — synergy-card candidate

2026-11-04. The user approved the second visual pass and requested a focused synergy-card pass. This is the third candidate of the current visual pilot. Incumbent snapshots are in `temp/champion-visual-3-incumbent/`, with hashes in `incumbent-manifest.json`.

## Hypothesis and retained layout

The previous cards put the star disclosure ahead of the bonus and gave partner chips substantial visual weight. Leveled families showed stars beside a level without a visible explanation of whose rarity they described.

The candidate makes the hierarchy title → partners → bonus → exact requirements more explicit:

- Stronger card titles, a level-count badge for families, and a quick Unique badge where the existing flag applies. Full stacking notes remain visible in their original wording.
- Calmer partner-chip surfaces and slightly smaller portraits. Full names, class colors, links and minimum 44px link targets remain.
- A Bonuses label on single cards, with stronger recipient headings and the complete bonus text.
- A separate Star requirements disclosure row below the single-card bonus. It remains closed by default and includes the same named, correlated requirements when expanded.
- Separate level badges and explicit Partner stars labels for families, with every level's exact bonus and requirements kept together. When no current rarity is selected, the caption is Star requirements because both sides' stars can be shown.

Acceptance: clearer partners/recipients/requirements hierarchy, readable 320px wrapping, keyboard-operable disclosure, and unchanged catalog IDs, links, bonuses, star rules and stacking notes. Imported data, grouping, filtering and numeric calculation logic were not edited.

## Matched previews and preservation checks

[Open the comparison gallery](comparison.html). Eight real before/after pairs cover desktop and mobile partner cards, separate recipients and uniqueness, expanded requirements, leveled families, and 320px cards/families.

Reference builds: Absorbing Man 7★ R6 Sig 200 A0; Hulk (Ragnarok) 6★ R5 Sig 200 A0. Viewports are 1280 × 900, 390 × 844 and 320 × 568. Each pair uses the same local headless Chromium configuration, anonymous session, DPR 1 and reduced motion. Fonts and visible images are awaited. Cards are aligned below the persistent navigation; the target card's viewport position matches within every pair. Screenshots are not generated or retouched.

The semantic snapshots in `before/evidence.json` and `after/evidence.json` compare every rendered article's title, partner names/destinations, complete bonus strings, star requirement rows, full stacking notes and target IDs. **All fields match exactly in all eight cases.** Whole-card raw text is intentionally not compared because labels and the order of the disclosure changed.

The shared preview opened and returned snapshots, but two capture evaluations failed with “Preview automation evaluate timed out after 15000ms.” Subsequent layout geometry was unreliable. Preliminary captures were discarded and the entire final before/after packet was captured with local Chromium. The helper is `temp/champion-visual-3-capture.cjs`.

## Independent review

Fresh-context read-only visual/source reviews by `gpt-6.1-terra` and `gpt-6-astra` preferred the candidate for both single and leveled cards. Neither found a material issue in the eight pairs. They confirmed semantic snapshot equality and preservation of aliases, level IDs and full source data. The family cards use more vertical space; both judged that a reasonable tradeoff for clearer level/star association.

Decision: retain the card candidate. This completes the visual pilot's three candidates. No additional rounds are implied without a new user request.

## Browser finding and correction

A real Chromium deep-link check then found the grouped alias `comp_009` focusing at y≈124 behind a sticky toolbar ending at y=172. The original page measured the toolbar asynchronously, so the first scroll could use its 100px default height. This timing code predates the card candidate.

The page now measures its toolbar during initial layout, before linked-target scroll effects, and retains ResizeObserver updates afterward. The same failing check passed afterward: target y≈196, toolbar bottom y=172, exact alias focused, family selected and correct level highlighted. This small correction adds `champion-details-client.tsx` to the two card source files. Its incumbent was preserved before that edit. The independent screenshot reviews preceded this correction; the correction was verified directly without another review round.

## Verification and limits

- **126 tests in nine champion suites passed** after the final source change.
- Web TypeScript, targeted ESLint and tracked diff whitespace checks passed. Lint retains the dependency browser-mapping freshness notice.
- Ten layout checks across both champions at 320, 390, 768, 1024 and 1536px found no horizontal page overflow, clipped partner links/titles/requirements summaries, or partner link targets below 44px.
- Real keyboard Enter/Space expansion and collapse of star requirements passed with focus retained. Requirements start closed and show named ranges when expanded.
- The original grouped alias, selected family and targeted level remain intact and visible below navigation on initial load.
- Browser results are in `browser-smoke.json`; the helper is `temp/champion-visual-3-smoke.cjs`. The gallery's HTML preview reported no console messages. Final source, screenshot and evidence hashes are in `manifest.json`.

These are viewport-emulation and specified interaction checks, not physical-device, screen-reader, production-performance or exhaustive catalog evidence. Changes remain local and uncommitted; no push or deployment was performed.
