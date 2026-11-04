# Champion UX candidate evidence

2026-11-04. Candidate is the local product diff against `eef079255376a0905913442568b5a71ab1804ec1`; no game data changes. User authorized implementing all audit findings, including the lower-confidence search refinement, in this pass. This extends the initial single-experiment pilot; the focused code changes are evaluated together here.

## Paired captures

All screenshots use Absorbing Man, 7-star Rank 6, Sig 200, ascension 0. Before PNGs remain immutable in `baseline/`; candidate PNGs are in `after/`.

| State | Before | Candidate |
| --- | --- | --- |
| Desktop landing, 1280 x 800, scroll 0 | `baseline/01-desktop-landing.png` | `after/01-desktop-landing.png` |
| Mobile landing, 390 x 844, scroll 0 | `baseline/07-mobile-landing.png` | `after/07-mobile-landing.png` |
| Stats at section entry, 1280 x 800 | `baseline/06-desktop-stats.png` | `after/06-desktop-stats.png` |
| Detailed overview near section start, 390 x 844 | `baseline/08-mobile-overview.png` | `after/08-mobile-overview.png` |

Candidate capture fallback: native Zen/Firefox Responsive Design Mode, DPR 1. Its preset user agent was iPhone; width/height are explicit CSS viewport sizes. Public champion page within an existing signed-in session. Baseline used anonymous Chromium with a desktop user agent. The native browser is necessary because shared preview opening stalled and status repeatedly timed out. Browser/font rasterization, scrollbar, and global-header authentication differences are confounders; compare layout and task affordances, not pixel-level rendering or header account controls. Section-entry screenshots match the semantic reading location, not absolute document scroll distance after changing hero height. No screenshot content is generated or retouched.

## Recorded actions

- Desktop landing renders all four section labels within the first 800px viewport.
- At desktop Stats entry, current build and Adjust build are visible in persistent navigation.
- Opened Adjust build from Stats, changed signature 200 -> 0; URL reflected `tab=stats&rarity=7&rank=6&sig=0&ascension=0`, build readout updated to Sig 0. Escape closed the panel with the Combat ratings section still in view. The native accessibility provider reports focus from hidden tabs unreliably, so full focus return is not claimed from that provider. Existing Radix focus behavior is retained.
- Reloaded the clean champion URL to restore the reference Sig 200 for mobile captures.
- At 390px, the whole word ABSORBING remains on one line, MAN wraps at a word boundary, and all three metric values/labels are separated.
- In Detailed mobile overview, activated Inflicts once from the category list. Inflicts heading and first source card appeared below persistent navigation: `after/12-mobile-inflicts-jump.png`.
- Native AX controls from cached page documents were sometimes stale. The final Detailed selection and Inflicts activation used fresh screenshot coordinates; screenshots verify actual visible state.

## Automated checks

Type checking: `pnpm --filter web exec tsc --noEmit` passed.

Targeted ESLint passed for the three modified components, new reader test, and navigation helper. An existing synchronous local-storage preference effect in the touched overview component initially failed the current lint rule; restoration now runs in a cancellable animation-frame callback after hydration.

Six Vitest files / 94 tests passed: original five baseline suites plus three new reader interaction tests. The new tests first failed on absent full-kit search recovery and stale queries hiding newly linked passages, then passed after implementation. They cover normal chapter and linked-target recovery while preserving the query.

Screen reader, physical devices, production performance, all clipboard/duel actions, and exhaustive catalog coverage are not established by this packet. Additional stress/long-name captures may be recorded separately; the four pairs above are the fixed review packet.

## Final follow-up

See [review resolutions and cross-champion checks](candidate-review.md) and the [six-state comparison gallery](comparison.html). Final code passes 95 tests, targeted lint, and web TypeScript checks. The baseline manifest still matches every original PNG.

The final desktop artwork framing and aligned mobile overview are saved under separate `-final` filenames; the original reviewed captures remain intact. Additional final pairs include scoped search and the 320px stress view. The gallery's images are real viewport PNGs at their labeled dimensions, with before/after section views aligned to the reading location.

The full-kit recovery was also exercised in the native browser: Signature Ability + Bleed showed zero passages and the named scope. Selecting Search all abilities retained Bleed, removed the chapter parameter, displayed one matching Base Abilities passage, and visibly focused the search input. Automated tests additionally cover this recovery from a linked target.
