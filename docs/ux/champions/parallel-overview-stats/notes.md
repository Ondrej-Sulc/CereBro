# Detailed overview and combat ratings

2026-11-04. The user requested deploying the approved work and continuing champion-page UX/UI improvements in parallel. The coordinator handled release and browser evidence while two agents independently audited and implemented Kit overview and Stats & attacks.

## Release

The approved state was committed as `2443380c61911c499d2efc13ede361f68d22ec6d` and pushed to `main`, after incorporating the newer November champion-data commit. Both production Railway services completed successfully. Public champion responses returned HTTP 200 and that exact `x-app-version`; the synergy page included the native icon references. No migration or database write was required.

Git checkout initially converted the extracted SVGs to Windows line endings, invalidating their verified byte hashes. An explicit LF rule for these icons fixed the reproducibility check before release.

The first GitHub CI run passed all checks preceding its final web build, then exhausted Node's approximately 2GB default heap during Next.js TypeScript checking. The CI-only correction `58e871facc94469147c395efc95d7c78fd6c927f` matches the existing Railway build's 4GB heap setting. [The corrected CI run passed](https://github.com/Ondrej-Sulc/CereBro/actions/runs/41849495763). The local full web build and root TypeScript build also passed. [Release verification](release.json) records the production IDs and HTTP checks.

## Local candidate

The next visual candidate remains uncommitted and is not part of that release. Production edits are limited to `champion-kit-overview.tsx`, `champion-stats-panel.tsx` and their dedicated selectors in `champion-dossier.module.css`.

- Detailed effect sections share one rounded border with clear dividers. Smaller effect headers and tighter structural padding leave all source conditions visible. Main source paragraphs stay at least 14px; definition buttons retain a minimum 54px header height. Explicit Immunity/Resistance labels and form badges remain.
- Compact mode and shared effect/source components are unchanged. The Compact control screenshots are byte-identical.
- Combat ratings use a smaller heading, inline Level/Challenger context and shorter card spacing. The redundant introductory sentence is removed. All ten rating labels and values, original label sizes, rounding, exact multiplier and zero/unavailable formatting remain intact.
- Attack breakdown follows sooner. Its data, hit sequence, disclosure defaults and ability links are unchanged.

## Matched evidence

[Open the comparison gallery](comparison.html). Twelve pairs cover protections, long champion names, a small protection set, the wide Gains/Inflicts split, Compact mode and combat ratings. References: Absorbing Man, Star-Lord (Kitty Pryde), and Ms. Marvel, all 7★ R6 Sig 200 A0. Viewports include 320 × 568, 390 × 844, 1280 × 900 and 1536 × 900.

The before packet uses the released UI. After captures use the local candidate with the same catalog and builds. Anonymous Chromium runs at 100% zoom, DPR 1 and reduced motion; fonts and visible images are awaited, display-mode updates settle before measurement, and targets align below sticky navigation. The shared browser returned “Preview automation evaluate timed out after 15000ms” and “Preview automation snapshot timed out after 15000ms”; local Playwright Chromium supplied the packet. Screenshots are unretouched.

| Rendered measurement | Before | After | Reduction |
| --- | --- | --- | --- |
| Absorbing Man protections section, 390px | 2506.5px | 2089.5px | 17% |
| Absorbing Man protections section, 1280px | 2670.5px | 2205.5px | 17% |
| Stats heading to attacks, 390px | 931.1px | 673.8px | 28% |
| Stats heading to attacks, 1280px | 492.8px | 358.9px | 27% |

All twelve recorded semantic comparisons match for effect source text, protection/form labels, source destinations/controls, context and rating pairs, attack descriptions and disclosure defaults. The Compact branch is additionally checked through identical PNG hashes. These measurements describe layout rather than human task times; no claim is made that every complete row count improved.

## Review and checks

Independent fresh-context `gpt-6.1-terra` review recommended retaining both candidates and found no material blocker. It found the 320px wrapped critical-damage label legible. Its assessment used source, supplied PNGs and recorded semantics; it did not independently run browser, zoom or screen-reader tests.

- **120 tests in eight relevant suites passed**, covering kit composition, source display, synergy bonuses, attack summaries, shared Compact/source rendering, champion navigation and synergy interactions.
- Web TypeScript, targeted ESLint and diff whitespace checks passed. Only the existing browser-mapping dependency notice appeared during lint.
- **36 browser tab layouts passed**: both tabs for three champions at widths 320, 390, 640, 768, 1024 and 1536px. Checks found no document overflow or clipped effect/rating labels, no main source paragraphs below 14px, no definition buttons below 44px, and preserved all twelve rating/context pairs.
- A keyboard section jump restored visible focus below sticky navigation. Definition help opened from keyboard focus, closed with Escape, and also opened by touch emulation.
- Both ability-source and synergy-source controls reached their corresponding full-text target below the sticky bar.
- Changing rank through Adjust build updated the rating/context values and URL; Escape returned focus to Adjust build. An attack disclosure still toggled through the keyboard.
- No page errors were observed. `before/evidence.json`, `after/evidence.json`, `layout-checks.json` and `browser-smoke.json` contain the observations. Local helpers are `temp/champion-parallel-ux-capture.cjs` and `temp/champion-parallel-ux-smoke.cjs`. The gallery preview reported no console messages. `manifest.json` records final file hashes and released source blob IDs.

Decision: retain the candidate locally for user review. Physical-device, screen-reader, zoomed-browser and full-catalog coverage are not established. No new UI candidate commit, push or deployment was performed.
