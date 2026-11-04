# Full abilities reader refinement

2026-11-04. The user approved the local overview/ratings improvements and requested further champion-page work. This is the second candidate of the post-release pilot. The approved local UI remains the incumbent; production remains the earlier release.

## Retained changes

The [experiment](experiment.md) was recorded before editing. Its hypothesis was that removing duplicate scope surfaces and compounded separators would bring complete text into view sooner without changing its reading measure or paragraph rhythm.

- Scoped passage counts and the existing Search all abilities action now share the search-control surface. The separate repeated scope banner is removed. Status text, polite live-region semantics and the query/focus-preserving handler are unchanged. The action has a minimum 44px height and wraps naturally on narrow screens.
- Ability groups use one divider and a deliberate spacing budget. The grid gap, second heading underline and compounded padding are removed. Paragraph gaps, type, line height, widths, markers and imported content remain unchanged.
- Unscoped tool layout, chapter selection, original record IDs, linked and unavailable-target recovery, signature-zero explanation, value/glossary controls and charts retain their behavior.

Production changes in this pass are limited to `champion-ability-reader.tsx` and reader-only selectors in `champion-dossier.module.css`. A parallel agent implemented the feedback markup while the coordinator handled group spacing and browser evidence. No domain helpers or shared rendering components were changed. The prior approved overview and ratings source files match their recorded hashes.

## Matched evidence and acceptance

[Open the comparison gallery](comparison.html). Thirteen real pairs cover unscoped and scoped entry, 320px controls, group transitions, an exact linked passage, signature zero, sparse signature data, a long champion name, no results and biography. References: Absorbing Man and Star-Lord (Kitty Pryde), 7★ R6 Sig 200 A0; Ms. Marvel, 6★ R5 Sig 200 A0. The signature-zero case explicitly selects Sig 0.

Captures use anonymous local Chromium, 100% zoom, DPR 1 and reduced motion. Fonts and visible images are awaited; URL-derived chapter state settles before measurement. Shared browser snapshots twice returned “Preview automation snapshot timed out after 15000ms,” so local Playwright Chromium supplied the packet. Screenshots are unretouched. Source snapshots are under `temp/champion-reader-refinement-incumbent/`; their hashes are in `incumbent-manifest.json`.

| Acceptance measurement | Before | After | Result |
| --- | --- | --- | --- |
| Scoped Base: section start to first passage, 390px | 482.7px | 409.7px | 73px sooner; required at least 48px |
| Scoped Base: section start to first passage, 1280px | 402.4px | 305.4px | 97px sooner |
| Scoped Base: section start to first passage, 320px | 557.7px | 456.7px | 101px sooner |
| First dense Base group transition, 390px | 82px | 51px | 31px less; required at least 20px and at most 60px remaining |
| First dense Base group transition, 1280px | 94px | 55px | 39px less |

All thirteen comparisons preserve complete recorded article text, passage IDs, controls/destinations, chapter options and result-status text. Every recorded paragraph has identical width and height, so the improvement does not come from tighter text wrapping or smaller body type. Main paragraph text remains 15px. The screenshots and geometry describe layout, not human task times or full-catalog coverage.

## Independent review

Fresh-context Codex `gpt-6-astra` reviewed a neutral packet at `temp/champion-reader-refinement-review/`: A was the candidate and B the incumbent. It preferred A for scoped entry, group structure, signature/no-result states and biography; linked-passage appearance was a tie. It found no functional blocker in A. It did not operate a browser or independently establish screen-reader/focus behavior.

The reviewer treated B's double divider as conflicting with the experiment's one-divider criterion. That is a visual preference against the chosen experiment, not a game-domain violation or a functional blocker in the approved incumbent. The reviewer also returned 1–5 scores rather than the evaluation loop's 1–10 scale; those scores are not used or compared. Retention rests on the preregistered measurements, preserved contracts and coordinator verification.

## Verification

- **37 tests across four relevant reader, navigation, page-state and ability-search suites passed.** Existing behavioral tests cover scope/query recovery, clear focus, unavailable targets, exact navigation and history. No new tests were added solely to mirror reversible markup/CSS changes.
- Web TypeScript, targeted ESLint and diff whitespace checks passed. Lint emitted only the existing browser-mapping data notice.
- **18 browser layout cases** passed: three champions at widths 320, 390, 640, 768, 1024 and 1536px. No document, feedback or paragraph clipping was found. Main paragraphs stayed at least 15px and the scoped action stayed at least 44px tall.
- Keyboard Search all abilities preserved a scoped Bleed query, restored search focus and revealed matching highlighted text. Clear search retained focus. Chapter Back/Forward restored the expected selection.
- The exact linked passage `79022` still receives visible focus below sticky navigation. Show full kit and unavailable-target recovery clear the target and return focus to search.
- Glossary help opens with keyboard and touch emulation. Value details open and close. Signature zero displays its unawakened explanation, and the opened signature chart still supports arrow-key inspection.
- Touch-emulated scoped recovery retained the query. No page errors were observed.
- `before/evidence.json`, `after/evidence.json`, `layout-checks.json` and `browser-smoke.json` contain the checks. Local helpers are `temp/champion-reader-refinement-capture.cjs` and `temp/champion-reader-refinement-smoke.cjs`. The comparison preview reported no console messages. Final hashes are in `manifest.json`.

Decision: retain locally. Physical-device, zoomed-browser, screen-reader, production-performance and full-catalog coverage are not established. This candidate and the prior approved overview/ratings work remain uncommitted. No commit, push or deployment was performed in this pass.
