# Champion visual pilot — first candidate

2026-11-04. User-approved incumbent: the completed third functional UX round. The user requested a new pass focused on visual improvements and matched before/after previews. This begins a new bounded pilot with fresh browser evidence.

## Visual hypothesis and scope

The incumbent title dominated the artwork, while large navigation and stacked overview controls delayed the first source card. The candidate adjusts composition and spacing: a smaller, opaque wordmark and portrait; a shorter, rounded hero with grouped metrics; slimmer section tabs; a more compact overview heading/control arrangement; clearer jump counts; wider desktop protection cards; and subtle card-header accents using each effect's existing color.

Acceptance: desktop art and title remain readable together, mobile exposes useful source content sooner, control labels remain present, and long names, sparse data and 320px layouts remain usable. Preserve the original effect/source colors and full conditions. Imported data, grouping, filtering, numeric bindings and URL behavior are outside the mutation scope.

The three production files are `champion-details-client.tsx`, `champion-kit-overview.tsx`, and `champion-dossier.module.css` under `web/src/app/champions/[slug]/`. Before-edit source hashes are in `incumbent-manifest.json`; local snapshots use `.snapshot` suffixes in `temp/champion-visual-1-incumbent/`.

## Evidence and previews

[Open the interactive comparison](comparison.html). Seven real screenshot pairs cover:

| State | CSS viewport | Champion |
| --- | --- | --- |
| Landing and overview | 1280 × 800 | Absorbing Man |
| Landing and overview | 390 × 844 | Absorbing Man |
| Small-screen landing | 320 × 568 | Absorbing Man |
| Long name and variant | 320 × 568 | Abomination (Immortal) |
| Sparse overview | 390 × 844 | Ms. Marvel |

The Absorbing Man reference build is 7-star Rank 6, Sig 200, A0. Other cases use the page's available build normalization. Exact requested URLs, viewport sizes, scroll positions, headings and browser user agent are recorded in `before/evidence.json` and `after/evidence.json`.

Both versions use the same local Playwright Chromium configuration, anonymous context, DPR 1, reduced motion, Detailed preference and data source. Landing views start at scroll 0. Overview views align the persistent navigation to its normal sticky position; their absolute scroll positions differ with hero height. Fonts and visible images are awaited. The screenshots are not generated or retouched. The development indicator may appear in captures; it is outside the product changes.

Shared-preview status initially timed out. Opening the local page succeeded, but two consecutive snapshot calls returned “Preview automation snapshot timed out after 15000ms.” Captures therefore use local headless Chromium rather than the shared preview. Local helpers are `temp/champion-visual-capture.cjs` and `temp/champion-visual-smoke.cjs`.

## Review and retained result

Independent fresh-context screenshot/source reviews by `gpt-6.1-terra` and `gpt-6-astra` both preferred the candidate landing and overview. They identified the same small regression: the existing title mask faded the final letters against the art after narrowing the wordmark area. The mask was removed, preserving the title shadow and artwork shading; the final screenshots were then recaptured. Neither reviewer identified another material visual regression in the seven pairs. Their reviews preceded this small fix; no repeated review was requested to obtain a different judgment.

Coordinator inspected the final desktop hero after the contrast correction and the responsive comparison gallery. The mobile overview now fits the display controls beside its title at 390px, with explicit labels; at narrower widths the controls wrap below the description. Card accents reinforce existing effect colors while retaining every source paragraph.

## Checks and limits

- **126 tests in nine champion suites passed**, including the prior reader, history, synergy and source/grouping contracts.
- Web TypeScript and targeted component ESLint passed. The only lint console notice concerns stale dependency browser-mapping data.
- Local Chromium checks at 320, 390, 768, 1024 and 1536px found no document horizontal overflow or clipped tab contents; tab targets remain at least 44px tall.
- Browser interaction checks passed for Compact/Detailed switching, an Inflicts jump focused below sticky navigation, Signature 0 entry, and Escape returning focus from the build editor. The smoke runner was corrected to await hydration/state and the closing animation before asserting; its initial immediate assertions did not establish product failures. Final results are in `browser-smoke.json`.
- HTML preview of the gallery reported no console messages. Screenshot/source hashes are in `manifest.json`.

Decision: retain the candidate locally. These checks cover viewport emulation and specified interactions, not physical devices, a screen reader, production performance or the entire champion catalog. No commit, push or deployment was performed.
