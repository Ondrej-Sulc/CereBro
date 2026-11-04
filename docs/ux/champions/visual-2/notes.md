# Champion visual pilot — second candidate

2026-11-04. The user approved the first visual pass, explicitly requested removal of “Champion dossier,” and asked for more changes in the same direction. Incumbent: `visual-1`, with all prior functional improvements retained. Source snapshots were preserved before editing in `temp/champion-visual-2-incumbent/`; hashes are in `incumbent-manifest.json`.

## Scope and visual hypothesis

The reader and synergy pages still used larger headings, scattered controls and nested framing than the approved overview. The candidate brings their heading rhythm and control surfaces into line with that overview, while retaining the full game text and source destinations.

- Removed the requested hero wording. The portrait, class, short name when present, title and artwork remain.
- Grouped reader search, chapter selection and result feedback. Removed the repeated build readout inside the reader header; the persistent build toolbar remains visible above it.
- Gave desktop chapter navigation a clear selected edge and flattened the nested source boxes. Complete paragraphs retain their type size, numeric values, markers and game-text colors.
- Grouped synergy search, direction filters and result feedback. All three labels and counts remain visible on mobile; selected styling follows the page's existing class accent.
- Matched section headings to the approved overview and refined the neutral synergy-card header surface.

Acceptance: reader text appears sooner without losing chapter clarity; synergy filters and search read as a coherent group; 320px labels remain readable; no source paragraphs, bonuses, requirements, record IDs or numeric bindings change. No imported data or game calculation helper was edited.

## Matched evidence

[Open the comparison gallery](comparison.html). Ten pairs are saved in `before/` and `after/`:

| State | CSS viewport | Champion / applied build |
| --- | --- | --- |
| Hero, abilities, synergies | 1280 × 800 | Absorbing Man, 7★ R6 Sig 200 A0 |
| Hero, abilities, synergies | 390 × 844 | Absorbing Man, 7★ R6 Sig 200 A0 |
| Abilities, synergies | 320 × 568 | Absorbing Man, 7★ R6 Sig 200 A0 |
| Sparse abilities | 390 × 844 | Ms. Marvel, normalized 6★ R5 Sig 200 A0 |
| Long-name hero | 320 × 568 | Abomination (Immortal), 7★ R6 Sig 200 A0 |

Captures use the same anonymous local Chromium configuration, DPR 1 and reduced motion. Fonts and visible images are awaited. Hero pairs start at scroll 0; section pairs align persistent navigation to its normal sticky position. Both versions use identical scroll positions for each case. Requested URLs, applied build readouts, user agent, viewport/document widths and complete article text are in the two `evidence.json` files. Screenshots are real and unretouched; the development indicator may appear outside the product changes.

Shared preview opened the page but failed twice with “Preview automation snapshot timed out after 15000ms.” Local headless Chromium supplied the matched captures. Helpers are `temp/champion-visual-2-capture.cjs` and `temp/champion-visual-2-smoke.cjs`.

## Review and decision

Fresh-context read-only screenshot/source reviews by `gpt-6.1-terra` and `gpt-6-astra` both preferred the candidate reader and synergies. Neither identified a material visual regression in the ten pairs. They noted the smaller result status text and wrapped mobile direction labels as reasonable tradeoffs. Both confirmed the requested wording was removed cleanly and the complete recorded article text was unchanged.

Observed in the 390px reader pair: the first panel begins around y=500 instead of y=589. In the 390px synergy pair, the first card begins around y=642 instead of y=686. These are screenshot positions, not human task-time measurements. The sparse-reader pair shows the complete signature passage and signature-curves control within the captured viewport.

Decision: retain the candidate locally. This is the second candidate in the new visual pilot, not an extension of the completed initial functional pilot.

## Verification and limits

- **126 tests across nine champion suites passed.** Prior search, focus, history, exact-target, grouping and game-domain contracts remain covered.
- Web TypeScript, targeted ESLint and tracked diff whitespace checks passed. Lint emits the existing dependency browser-mapping freshness notice.
- Complete article text matches exactly before/after in **all ten captures**. Document width equals viewport width in each capture; no page errors were recorded.
- Browser checks for both tabs at 320, 390, 768, 1024 and 1536px passed: no horizontal document or filter-button overflow, and direction controls remain at least 44px tall.
- Real Chromium interaction checks passed for chapter selection, scoped zero-result search, query-preserving Search all abilities recovery, reader clear-focus recovery, and synergy reset restoring focus and scope. Results are in `browser-smoke.json`.
- The interactive gallery's HTML preview reported no console messages. Source, screenshot and evidence hashes are in `manifest.json`.

Physical devices, screen-reader announcements, production performance and the full champion catalog remain outside this evidence. Changes are local and uncommitted; no push or deployment was performed.
