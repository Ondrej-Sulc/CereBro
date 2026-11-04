# Synergy cards — two columns and partner portraits

2026-11-04. [Open the before/after gallery](comparison.html).

## Retained design

Synergy sections use two columns once the content area is at least 1000px wide. The cards have separate surfaces and a 12px gutter. At smaller widths they retain the compact single-column list. Cards follow the same row-major DOM and keyboard order.

Partner portraits now use 40px class-coloured frames, inset portrait windows, and the existing native game class crest. Their links and expansion controls have 44px targets on every screen size. Expanded requirements use the same treatment at 32px. Unknown classes receive a neutral frame without a fabricated crest; unlinked partners retain their focusable name tooltip.

A second visual iteration lets portraits sit beside the title once a card's content is at least 520px wide. Narrower cards put them beneath the title. Requirements use two columns and level descriptions sit beside stars only when the card itself has 640px of content space. This is based on available card width, so half-width desktop cards remain readable.

Full bonus text, native synergy icons, partner links, names, levels, source aliases, exact correlated star requirements and uniqueness notes remain. Hover lift is disabled under reduced motion.

## Sorting repair found during verification

Hulk (Ragnarok) exposed an existing hydration mismatch: the local server's default locale is cs-CZ, which sorts CH after H; the browser uses English ordering. The server emitted CROWD PLEASERS where the browser expected CHALLENGER. React then regenerated the list, which could discard a disclosure opened during hydration.

Card names, partner names and identifier tie breaks now explicitly use English collation on both sides. Regression tests simulate Czech and English hosts. Fresh server HTML and the hydrated browser now agree on all 27 card IDs, with no hydration issue reported.

## Evidence

Eight matched pairs cover The Overseer at 1280, 1536, 1024, 390 and 320px, expanded four-partner requirements, and Hulk (Ragnarok)'s three-level family at desktop and 320px. The gallery also includes an unscaled portrait-detail crop from the original desktop screenshots.

The incumbent includes the previous local stat-icon and inline-ability-icon passes. The screenshot comparison uses the same shared T3 preview browser, anonymous session, DPR 1 and viewport. Fonts, visible images and paint are awaited. Reduced motion is not emulated. Screenshots are unretouched and include the development indicator; the baseline may also show the hydration issue badge. Detail cropping is only CSS presentation of those original PNGs.

[Before evidence](before/evidence.json) and [after evidence](after/evidence.json) preserve every rendered card title, partner name/destination, complete bonus, uniqueness note, family level, requirement text/link, source ID and expanded/collapsed state in all eight cases. Actual pointer clicks and explicit open-state assertions verify the expanded captures.

The Overseer's six-card grid measures 718 → 591px at 1280px and 718 → 525px at 1536px. At 390px it grows from 1228 to 1264px because the portraits and targets are larger; the compact single-column layout remains. The gallery charts the measured grid or family height for each case.

## Validation

- 86 tests pass in seven suites: synergy interactions (16), card rendering (6), grouping/display (18), source projection/text (17), champion navigation (14), abilities (12), and stats (3).
- The new portrait cases failed before implementation and passed afterward. They verify the native class crest, decorative accessibility, preserved champion links, missing class handling and keyboard-accessible unlinked partners.
- The new Czech-host sorting case failed before the repair; both locale cases pass afterward.
- Root and web TypeScript checks pass. Changed UI/test ESLint passes with the existing baseline-browser-mapping freshness notice.
- Browser layout checks at 320, 390, 768, 1024, 1080, 1088, 1280 and 1536px find no horizontal document overflow, clipped bonus/name text or undersized portrait/disclosure targets.
- Two columns appear at 1088px in the captured browser; 1080px and narrower stay single-column. The threshold follows content width, so the exact viewport boundary depends on gutters and scrollbars.
- Portrait tooltips retain full names; visible portraits and class crests load successfully. Escape closes an expanded family and restores focus to its control.

[Structured checks](checks.json) supplement the screenshots. Imported data and image assets were not changed. Work remains local and uncommitted; no deployment was requested.
