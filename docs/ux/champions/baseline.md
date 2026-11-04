# Champion UX baseline and experiment backlog

2026-11-04. Audit-only pass at product revision `eef079255376a0905913442568b5a71ab1804ec1`. **No product UI changed, no candidate has been evaluated, and no UX improvement is claimed.**

The [evaluation loop](../../champion-ux-hill-climb.md) is ready for bounded candidate rounds. The [frozen packet](evidence.md) contains 11 screenshots and recorded observations of Absorbing Man at desktop, mobile, and a small mobile stress size. This is a useful initial audit of a dense champion, with partial task coverage; it is not a full catalog or accessibility audit.

## Findings to act on

| Priority | Finding and evidence | Evidence class | Proposed next experiment |
| --- | --- | --- | --- |
| 1 | Health and Attack values run together at 390px. [Mobile landing](baseline/07-mobile-landing.png), [build panel](baseline/10-mobile-build.png). | Visible defect; both reviewers agree. | E1: reflow only the metric strip at narrow widths. |
| 2 | ABSORBING wraps within a word at 390px and 320px. [390px](baseline/07-mobile-landing.png), [320px](baseline/11-small-mobile-landing.png). | Visible readability problem; both reviewers agree. | E2: adjust narrow-screen wordmark sizing/wrapping independently. |
| 3 | Stats entry has no visible rank/signature editor; Adjust build is above the viewport at y=-58. [Stats](baseline/06-desktop-stats.png). | Position/affordance observed; full change-and-return cost not yet measured. | E3: one nearby build entry point using the same state/editor. |
| 4 | Detailed mobile categories are far apart: Gains and Inflicts follow long protection/source content. [Detailed overview](baseline/08-mobile-overview.png), packet observation 6. | Layout distance observed; task failure not established. | E4: jump links to existing categories, preserving full conditions. |
| 5 | Hero puts desktop section navigation below the initial 800px viewport; mobile navigation also starts low. [Desktop landing](baseline/01-desktop-landing.png). | Position observed; first-visit discovery impact and brand tradeoff need evaluation. | E5: expose section navigation earlier with a smaller desktop hero. |

Start with **E1**, the smallest well-supported defect. Keep title sizing and hero height as separate experiments so a win or regression has an identifiable cause. Extra metric height must not silently worsen navigation access. Run only the declared pilot round limit; the backlog can span later pilots.

## Preregistered checks

| Experiment | Acceptance criterion | Regression checks |
| --- | --- | --- |
| E1: metrics | At 320px and 390px, all complete values and labels occupy distinct boxes, with no overlap, clipping, or horizontal scroll; repeat after a build change. | Record tab-list document position against the incumbent; preserve values, prestige curve, editor access, and desktop layout. Reject or explicitly reassess a navigation regression. |
| E2: wordmark | ABSORBING stays intact at both mobile sizes, full identity remains visible, and no title clips. | Freeze/test short, long, and parenthesized champion names; keep variant text and artwork legible. |
| E3: build access | From a deep rating and linked passage, open editing without scrolling to the hero; change rank/signature including Sig 0; values update and reading target remains visible after closing. | Keyboard focus return, one shared build state, unique control IDs, URL restoration, and no extra mobile obstruction. |
| E4: category access | From the overview heading, one activation reaches each available group's visible heading and first item below sticky UI. | All native/synergy conditions, immunity/resistance distinctions, Compact/Detailed behavior, DOM/focus order, empty groups. |
| E5: entry hierarchy | At fresh no-`tab` desktop entry, all four section tabs are visible without scrolling at 1280 x 800. | Identity/art/build legibility, mobile layout and long names; compare visual identity against the unchanged landing capture. |

These are proposed checks, not passing results. Establish incumbent measurements for the missing sequences before implementing their candidate.

## Independent Codex reviews

- [gpt-6.1-terra review](review-terra.md): identified metric/title collisions, low landing navigation, distant build access, Detailed traversal, and potential search-scope ambiguity.
- [gpt-6-astra review](review-astra.md): separately identified metric collisions, title wrapping, distant build access, Detailed traversal, and low landing navigation.

Both received the same rubric, packet, source revision, fresh contexts, and inherited xhigh reasoning. Neither received a target score, the coordinator's ranking, or the other review. They made no file changes and did not operate the browser. Usage/cost was not reported; no cost comparison is available. This single pilot does not establish which model is the better reviewer.

They agree on the major visible problems and on preserving the champion-led identity. They differ on search: Terra suggests explicit scope naming/direct recovery; Astra considers the existing scoped empty state meaningful and does not prioritize it. Filtering itself worked. Keep search as a lower-confidence discovery experiment: show the active chapter and test an All abilities action that preserves the query, only if a task replay or user feedback supports the need.

Terra leaves the combined responsive/accessibility score unobserved; Astra assigns a low score to the visible responsive evidence and explicitly excludes conformance claims. Do not average these into an accessibility rating. Both leave keyboard breadth, screen readers, zoom and reduced motion unverified. Review scores remain in their reports; there is no aggregate quality score or before/after improvement claim.

## Coordinator source follow-up

The wordmark helper passes `leading-[.74]` before an arbitrary `text-[clamp(...)]` size to `cn`, which uses `tailwind-merge`. A local read-only reproduction with the installed package returned `block text-[clamp(4rem,10vw,9rem)]` from those classes: the explicit line-height class is removed. In the captured 390px DOM, the primary wordmark was 64px with 96px computed line height. This supports checking the intended line height during E2; it does not establish the entire cause of mid-word wrapping, and no fix was applied. This follow-up was not supplied as an initial reviewer finding.

## Coverage and validation

Observed: desktop overview/abilities/synergy/stats entry, chapter-scoped search and recovery to All abilities, display preference persistence, mobile layouts, and popover focus entry/Escape/focus return. Build state traveled in section URLs.

Still required before retaining relevant candidates: another long/parenthesized-name champion, a sparse-data champion, complete source round trips, build changes, shared-link reopen/Back/Forward, clipboard/duel actions, star requirements, keyboard traversal, zoom, reduced motion, and physical-device checks when available. Lack of document-level horizontal overflow did not detect the visible metric collision; future checks must examine internal text geometry and screenshots.

Existing baseline verification passed: **5 Vitest files, 91 tests** covering champion page state, kit projection, synergies, synergy display, and ability search. No new tests or test dependencies were added. These do not validate the visual task hypotheses. The [packet](evidence.md) records exact commands, coverage gaps, and capture artifacts; its [manifest](baseline-manifest.json) hashes the retained PNGs.

Decision: **baseline established; implementation deferred to a subsequent pass as requested.**
