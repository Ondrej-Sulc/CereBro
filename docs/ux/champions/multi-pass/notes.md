# Three-iteration champion UX pilot

2026-11-04. The user approved the earlier local changes and explicitly requested multiple iterations. This pilot completed three sequential candidates, with fresh source snapshots and before captures for each round. Earlier approved overview, ratings, reader and synergy improvements remain intact. No deployment was requested for this pilot.

[Open the comparison gallery](comparison.html). The iteration buttons switch between selected comparisons; complete evidence for all 24 retained pairs lives in the three round folders. Each round compares against its own incumbent, including previously retained changes.

## Iterations and decisions

The [experiment](experiment.md) recorded acceptance criteria before implementation. Root coordinated evidence and implemented the summary; separate agents audited and implemented the property-header and editor candidates. Source snapshots are under `temp/champion-multi-ux-incumbents/roundN/`. Each round has an incumbent manifest, semantic/geometry verification, review mapping and retained source hashes.

| Round | Retained change | Observed result | Decision |
| --- | --- | --- | --- |
| 1 | A tighter recorded-hit summary with explicit damage-type wording, 12px legend/contact text instead of 11px, and less structural padding | 390px summary: **181 → 128px**, 29% less; first move begins 57px sooner. Desktop: 88 → 72px. | Keep; exceeded 20% mobile criterion |
| 2 | Full-width property lines for four-or-more-property headers below 640px, and three-property headers below 360px | Ms. Marvel at 390px: both specials' property lines **2 → 1**. At 320px: Special 1 **3 → 2**, Special 2 **2 → 1**. Three-property Star-Lord header at 320px: 3 → 1 lines, 133 → 104px. | Keep; ordinary header heights and wider three-property reference unchanged |
| 3 | Rarity, Rank and Ascension align in one row for 7★ editors from 380px upward; Signature follows across the full width | 390px and desktop editor: **441 → 363px**, 78px less. At 320px both remain 461px; 6★ remains 363px. | Keep; exceeded 48px criterion |

Round 1 preserves recorded damage-category counts and independent contact/projectile totals; it does not reinterpret hits as damage percentages. Round 2 preserves every chip in source order, all move/hit text, special titles and ability controls, sequences and disclosure defaults. Round 3 changes grid layout/order only: exact controls, options, values, help associations, slider and signature draft handlers, bounds and footer actions are retained.

The final production scope is `champion-attack-profile.tsx`, the field grid in `champion-details-client.tsx`, and dedicated attack/editor selectors in `champion-dossier.module.css`. Imported data, calculation helpers and shared UI components were not changed.

## Matched packet

References: Absorbing Man and Star-Lord (Kitty Pryde), 7★ R6 Sig 200 A0; Ms. Marvel, 6★ R5 Sig 200 A0. The editor packet also includes an explicit Sig 0 case. Captures cover 390 × 844, 320 × 568 and 1280 × 900.

Anonymous local Chromium uses 100% browser zoom, DPR 1 and reduced motion. Fonts and visible images are awaited; targets align below sticky navigation. Editor captures additionally await actual popup animations before measuring, avoiding transient scale/height differences. The shared browser twice returned “Preview automation snapshot timed out after 15000ms”; local Playwright Chromium supplied the packet. Screenshots are real and unretouched.

All **8 + 10 + 6 = 24** retained before/after semantic comparisons match: recorded move/hit/property content, category/contact totals and bar data, ability-control labels, disclosure state, rating/context values and editor control/option/value data. Editor controls are compared by accessible name because their visual and keyboard order deliberately changes. Actual tab order is separately verified below. All captured document widths fit their viewports.

An initial round-1 fixture labeled “special collapsed” actually toggled Heavy because it selected the first disclosure. Review caught that mismatch; the fixture was excluded and its screenshots removed. The corrected round-2 fixture explicitly targets a special and waits for closed state. A PowerShell JSON round-trip during fixture removal also changed UTF-8 symbols; the semantic gate caught it and the original baseline was restored from the frozen review packet. Canonical packet JSON is written through Node as UTF-8. These corrections do not represent product changes or game-data writes.

The unaffected references remain in the packet: ordinary attack rows for the summary change, the summary and ordinary/wider three-property rows for round 2, and 6★/narrow editors for round 3. No pixel-identity claim is made for screenshots whose scroll/background or development chrome differs.

## Independent review

Each round received a fresh-context Codex `gpt-6.1-terra` review of neutral A/B files and PNGs. A final fresh-context `gpt-6-astra` assessment reviewed all three paired packets without other reviewers' findings. Mapping: round 1 A=candidate, round 2 B=candidate, round 3 A=candidate. Neither review operated a browser or established assistive-technology behavior.

- Round 1: Terra preferred the compact candidate for scanability and attack access, but preferred the incumbent's explicit explanation. Root adopted its wording suggestion as the single-line “Recorded hits by damage type,” recaptured the candidate and confirmed the same 128px height and preserved semantics. Terra also identified the mislabeled collapse fixture described above. Astra preferred the clarified final candidate.
- Round 2: Terra and Astra preferred the candidate's rich-property scanning. Normal rows, wider three-property reference and disclosure/content presentation were ties. No material blocker was found.
- Round 3: Terra and Astra preferred the aligned compact editor. Terra noted that the incumbent gives selects more width; current displayed values remained readable. The final browser matrix measured every current option using the rendered font and padding and found it fit. Narrow and 6★ layouts were ties. No material blocker was found.

Reviewer agreement supports the decisions; the recorded task criteria and verified data contracts determine retention. No human usability times, model prices, score targets or full-catalog conclusions are inferred.

## Verification

- **61 tests in seven relevant suites passed**: recorded attack summaries, exact champion navigation/signature editing, reader behavior, synergy interaction/rendering, page state and ability search.
- Web TypeScript, targeted ESLint and diff whitespace checks passed. ESLint emitted only the existing browser-mapping freshness notice.
- **18 combined browser layout cases passed**: three champions at widths 320, 390, 640, 768, 1024 and 1536px. Each case checks the attack summary/chips and opens the build editor. No document, profile, chip or field-label clipping was found; profile legend/contact type stayed at least 12px. Every current select option fits the measured font-plus-padding width. Popup bounds fit the viewport.
- A real keyboard replay collapses and reopens a specifically selected special, opens hit help by focus, closes it with Escape, and follows Read Special 1 to the correct `special1` reader chapter. Hit help also opens through touch emulation.
- Editor keyboard order is Rarity → Rank → Ascension → signature slider → signature number. Rank and Ascension update the URL. Signature draft replacement waits for Enter/blur, Sig 0 commits, and an out-of-range value clamps correctly. Switching rarity hides/shows Ascension and preserves remembered rank.
- The clipboard check reads the actual copied URL and verifies section, rank, ascension and committed signature. Its copy notification is dismissed before testing Escape on the editor. Escape returns focus to Adjust build. A touch-emulated flow commits Sig 0 through Done and closes the editor.
- Matrix fixtures explicitly align the Stats starting position before opening the editor, avoiding a click during initial section-entry scrolling. Popup captures await animation completion. No page errors were observed in the retained packets or final interaction runs.

Evidence: each round's `before/evidence.json`, `after/evidence.json`, `verification.json` and manifests; `round2/browser-interactions.json`; root `layout-checks.json` and `browser-smoke.json`. Helpers: `temp/champion-multi-ux-capture.cjs`, `temp/champion-multi-ux-verify.cjs`, `temp/champion-multi-ux-interactions.cjs` and `temp/champion-multi-ux-smoke.cjs`. The gallery preview reported no console messages; final hashes and sequential source checks are in `manifest.json`.

All three iterations are retained locally, and this pilot stops at its declared three-round limit. Physical-device, zoomed-browser, screen-reader, production-performance, cold-load interaction timing and full-catalog coverage are not established. This pilot and previously approved local changes remain uncommitted and undeployed; no commit or push was performed.
