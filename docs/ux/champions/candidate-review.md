# Candidate review and resolution

2026-11-04. Two fresh Codex reviewers independently inspected the same four paired screenshot states, the Inflicts jump capture, current source diff, domain contracts, and reader regression tests. They did not operate browsers, alter files, or read each other's reports. Models: `gpt-6.1-terra` and `gpt-6-astra`, inherited xhigh reasoning. No target score or aggregate quality threshold was provided.

## Independent conclusions

Terra found no observed blockers in the supplied packet. It preferred the candidate for landing discovery, mobile readability, and build access. Search was provisionally preferred on source/test evidence. It left interaction/accessibility comparisons unscored because end-to-end comparative observations were insufficient.

Astra also preferred the candidate's landing, overview retrieval, and Stats affordances. It found no domain-contract regression, and identified two source-level accessibility issues: removing the Search all abilities button could lose keyboard focus, and some existing source/return scroll calls still relied on global smooth scrolling under reduced motion. Those issues were not runtime browser findings in its read-only review.

Both preserved the champion-led identity as a strength, and identified tradeoffs: the persistent build row consumes reading space, Detailed-entry jump links add controls before source content, and the smaller desktop hero initially cropped the face too tightly. Both declined to claim complete keyboard, zoom, physical-device, clipboard/history, or catalog-wide coverage.

## Direct fixes after review

- Search all abilities now transfers focus to the surviving search input after scope changes. The query is retained. Both ordinary chapter and linked-target regression tests assert the focus destination after the animation frame.
- Linked ability targets, Show full kit, shared-section entry, and synergy target navigation now use the same reduced-motion-aware scrolling helper. A regression test requests reduced motion and verifies immediate linked-passage scrolling and target focus.
- Desktop artwork is aligned toward the top of its frame to retain the face. The initial reviewed desktop PNG is preserved; the final framing is recorded separately as `after/01-desktop-landing-final.png`.

These were small direct corrections to review findings, without another delegated review. Tests/static checks validate the final code; the reviewers' original opinions apply to the packet they saw.

## Additional checks after the fixed review packet

- Absorbing Man at 320 x 568: full word and separated metric values remain visible (`after/11-small-mobile-landing.png`). Navigation is still below this short stress viewport; the earlier-navigation criterion applies to 1280 x 800 and 390 x 844, where all sections are visible.
- Abomination (Immortal) at 320 x 568: ABOMINATION remains whole and IMMORTAL is visible as a separate variant label (`after/13-long-name-320.png`).
- Ms. Marvel at 320 x 568: smaller kit, default 6-star R5 Sig 200, with appropriate available group links and no Inflicts jump (`after/14-sparse-kit-320.png`). A read-only catalog count query selected this low-density case: seven ability links and eight ability-text records before display grouping. No game data was changed. This is sparse-data coverage, not a claim that every missing-data condition was exercised.

Final validation: 95 tests across six files; targeted ESLint and web TypeScript checks passed. The original screenshot manifest is unchanged. Candidate captures use the documented native Firefox fallback and do not support pixel-perfect comparison with the Chromium baseline.
