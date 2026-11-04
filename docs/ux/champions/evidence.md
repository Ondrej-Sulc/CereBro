# Champion page baseline evidence

Frozen packet: 2026-11-04, revision `eef079255376a0905913442568b5a71ab1804ec1`. Product source was clean and unchanged. Only audit documentation/artifacts were added during capture. No candidate implementation exists in this packet.

## Environment

- Local Next.js development server, started with `pnpm --filter web dev`.
- T3 shared preview browser; anonymous public catalog session, 100% browser zoom, desktop user agent. Mobile captures emulate CSS viewport size only.
- Champion: Absorbing Man (`absorbing-man`), available local imported catalog data. Build: 7-star, Rank 6, Sig 200, ascension 0. Data was read, not edited or imported. This packet is a one-champion pilot, not cross-catalog coverage.
- Desktop 1280 x 800, mobile 390 x 844, stress viewport 320 x 568. Browser scrollbar consumes 8 pixels of content width in these captures.
- Initial `cerebro:champion-kit-display` preference absent: Detailed. The app persisted Compact after selecting it; Detailed was restored for the final capture. No broad storage reset.
- Champion artwork was loaded for the retained landing captures. Below-viewport lazy images were not all forced to load. The development indicator at lower left is not product UI.

## Captures

| File | State |
| --- | --- |
| [01-desktop-landing.png](baseline/01-desktop-landing.png) | 1280 x 800, scroll 0, loaded artwork. `?tab=overview`; scroll manually reset after entry restoration. |
| [02-desktop-overview.png](baseline/02-desktop-overview.png) | 1280 x 800, scroll 751, Detailed overview. |
| [03-desktop-abilities.png](baseline/03-desktop-abilities.png) | 1280 x 800, all chapters, no query, entered using Full abilities tab. |
| [04-desktop-scoped-search.png](baseline/04-desktop-scoped-search.png) | 1280 x 800, Signature Ability selected, search `Bleed`, zero passages. |
| [05-desktop-synergies.png](baseline/05-desktop-synergies.png) | 1280 x 800, scroll 751, All synergies. Sticky tab bar missing from raster capture: see limitation below. |
| [06-desktop-stats.png](baseline/06-desktop-stats.png) | 1280 x 800, scroll 751, Stats & attacks. |
| [07-mobile-landing.png](baseline/07-mobile-landing.png) | 390 x 844, scroll 0, Stats tab selected below fold, artwork and metrics loaded. |
| [08-mobile-overview.png](baseline/08-mobile-overview.png) | 390 x 844, scroll 785, Detailed. |
| [09-mobile-compact.png](baseline/09-mobile-compact.png) | 390 x 844, scroll approximately 670, Compact. |
| [10-mobile-build.png](baseline/10-mobile-build.png) | 390 x 844, scroll 500, open build popover, focus on Rarity. |
| [11-small-mobile-landing.png](baseline/11-small-mobile-landing.png) | 320 x 568, scroll 0, Compact preference, overview selected below fold. |

Captures are viewport screenshots, not full-page montages. Query parameters in 03-11 carry `rarity=7&rank=6&sig=200&ascension=0` after section navigation. Section state is `tab=overview|abilities|synergies|stats`. 04 additionally carries `chapter=signature`; the search itself is local component state.

## Action and DOM observations

These are observations supplied equally to both reviewers, without a coordinator ranking.

1. At desktop scroll 0, the hero's box begins at y=94 and is 700 pixels tall. The section tab list begins at document y=825. Kit overview heading is at document y approximately 966. The hero's Adjust build button is at document y=693.
2. At desktop scroll 751, the tab bar sticks below the 64-pixel app header. Tab top is viewport y=81. Detailed overview has Gains count 12, Inflicts count 7, and Immunities & resistances count 10. At this width Gains/Inflicts stack in the main column and protections occupy the sidebar.
3. Full abilities -> All abilities shows `33 passages in this view`. Click Signature Ability, enter `Bleed`: `0 passages found` and `No passages match “Bleed” in this section.` Click All abilities, leaving the query intact: `1 passage found`. Chapter selection and filtering work as implemented; comprehension/discoverability must be assessed separately. Snapshot 04 also records the scroll position after chapter navigation.
4. Section clicks preserve the selected build in the URL. At the Stats section start (scroll 751), Adjust build is at viewport y=-58. Stats shows Level 75 and Challenger rating 250. At Synergies entry, headings contain six From this champion and five From teammates families. The underlying build control remains in the hero.
5. At mobile scroll 0, the tab list starts at document y=785. Adjust build begins at y=665. No document-level horizontal overflow was reported at 390 x 844 or 320 x 568; this does not rule out text overlap or internal clipping.
6. In mobile Detailed overview at scroll 670, measured heading positions were Kit overview y=293, Immunities & resistances y=497, Gains y=3083.5, Inflicts y=8221.4, Duel targets y=10915.6. These positions belong to this champion/build/display; Compact produces a different page length. Capture 08 was later taken at scroll 785.
7. Selecting Compact persists `cerebro:champion-kit-display=compact`. Selecting Detailed restores `detailed`. This preference differs from a fresh session's default and must be specified for future comparisons.
8. At 390 x 844, open Adjust build: focus moves to the Rarity select, and Rarity/Rank/Signature/Ascension controls and Copy link/Done are visible. Press Escape; after the next animation frames, the popover is closed and focus is back on Adjust build. No signature/rank change or clipboard write was performed in this packet.

## Verification and gaps

Existing tests: `pnpm exec vitest run web/src/lib/champion-page-state.test.ts web/src/lib/champion-kit.test.ts web/src/lib/champion-synergies.test.ts web/src/lib/champion-synergy-display.test.ts web/src/lib/champion-ability-search.test.ts` -> 5 files / 91 tests passed. These are domain/state baseline checks, not rendered accessibility or usability tests.

Not exercised: full source-link round trip, clipboard contents, duel copy, history restoration, rarity/rank/signature changes, expanded star requirements, physical touch interaction, screen reader, browser zoom, reduced motion, production performance, a second/third champion, or all missing-data states. Do not score these behaviors as passing. The pilot has no measured human completion times, wrong-turn rates, or candidate comparisons.

## Capture limitations

The first two shared-preview snapshots timed out. Reopening recovered capture. A native browser fallback showed an OS firewall overlay that the user could not see; no security settings were changed, and none of those desktop screenshots are in this packet.

Some preview raster captures omit composited sticky/backdrop-filter layers immediately after a transition/resize, despite DOM hit testing reporting them visible. Most were recaptured after settling/repainting. In 05 the upper content band still omits the sticky tab bar; DOM confirmed it at y=81, with `display:flex`, `visibility:visible`, and a tab returned by `elementFromPoint(100,120)`. Do not report that omission as a product defect. Use 02, 03, 06, and 08/09 to assess the actual tabs. A candidate comparison must recapture any affected layer cleanly.

## Source scope for verification

- `web/src/app/champions/[slug]/champion-details-client.tsx`
- `web/src/app/champions/[slug]/champion-dossier.module.css`
- `web/src/app/champions/[slug]/champion-kit-overview.tsx`
- `web/src/app/champions/[slug]/champion-ability-reader.tsx`
- `web/src/app/champions/[slug]/champion-synergies-panel.tsx`
- `web/src/app/champions/[slug]/champion-stats-panel.tsx`
- `web/src/lib/champion-page-state.ts`

Use `CONTEXT.md` for protected game semantics. Read-only reviewers should not read each other's reports or `baseline.md` before submitting their independent findings.
