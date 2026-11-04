# Full abilities — effect icons beside their explanations

2026-11-04. Replaces repeated effect headings with icons in the bullet position of their corresponding ability passages. [Open the before/after gallery](comparison.html).

## Retained candidate

The existing imported group title supplies the effect association. Its existing kit/glossary icon and color move into a 24px marker beside a passage that explicitly names that effect. A line mentioning multiple effects keeps only the icon established by its group; other mentions may describe conditions or immunities.

The repeated heading is removed when every visible passage in the group already names the effect and can display its icon. Headings that supply context, including continuation-only search results, remain visible. Unknown or unavailable icons keep the diamond marker. Meaningful section headings remain.

Adjacent simplified effect groups use paragraph spacing rather than a separate heading and divider. Body typography, complete text, numeric formatting, source IDs, glossary/value popovers, section navigation and linked-passage focus are preserved. The icons are decorative and do not add keyboard stops or repeat the accessible effect name.

## Matched evidence

Five before/after pairs show The Overseer's Special 2 at 1280, 390 and 320px, plus contextual base abilities for The Overseer and Absorbing Man. Builds are 7★ R6 Sig 200, ascension 0.

The incumbent includes the previous local stat-icon pass. Before and after use the same local app, shared T3 preview browser, anonymous session, DPR 1 and viewport dimensions. Fonts and paint were awaited. The reported user agent is recorded in each evidence file. Reduced motion was not emulated. Screenshots are unretouched; they include the development indicator and native scrollbar. A shorter page may reach the bottom scroll limit sooner, so the panel's screen position can differ.

[Before evidence](before/evidence.json) and [after evidence](after/evidence.json) match every rendered passage ID, complete passage text, glossary/value button label, and chapter option exactly in all five cases.

The Special 2 card measures 323 → 236px on desktop, 506.5 → 427.5px at 390px, and 608.5 → 555px at 320px. The contextual base panels retain their original heights and headings. The gallery includes a height comparison for each case.

## Validation

- Four new reader cases failed before implementation and pass afterward. They cover duplicate-heading removal, decorated text/glossary interaction, contextual continuations and search, multi-effect ambiguity, missing icons, source anchors and linked focus.
- 76 tests pass across reader interaction (12), champion navigation/build behavior (14), ability search (6), ability rendering (41) and the prior stats panel (3).
- Web TypeScript and changed UI ESLint pass. ESLint emits the existing baseline-browser-mapping freshness notice.
- Browser checks confirm the Energize deep link focuses the original passage, preserves the icon association, and searches to one highlighted matching passage.
- Layout checks at 320, 390, 768 and 1280px show no horizontal document overflow or clipped ability text.

[Structured check results](checks.json) accompany the screenshots. No imported text, effect assets or database rows were changed. All changes remain local and uncommitted; no deployment was requested in this pass.
