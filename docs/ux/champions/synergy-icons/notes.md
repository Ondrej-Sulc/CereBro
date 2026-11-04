# Native synergy icons — retained local integration

2026-11-04. [Matched comparison gallery](comparison.html). [Source, extraction and refresh documentation](../../../synergy-icons.md).

## Result

Added the actual game's synergy glyph beside each compact title, including leveled families. The 20px icon is decorative and uses a neutral tint. Missing mappings leave the title without an icon. Different icon identities stay separate during grouping; every original ID remains available as a target.

The BCG `Texture` field and serialized native tile/font references establish the mapping. The current bundle resolves all 3,335 source records: 298 exact texture strings, 296 distinct SVG assets, zero unresolved bindings. Repeated extraction into a separate output directory produced identical asset and manifest bytes. No name-based or screenshot-based matching was used.

The existing importer already retains the native field in `GameSynergy.raw` and preserves the source hash. The read path now projects it to `iconUrl`; no schema change or catalog write was required. The read-only [catalog check](catalog-verification.json) verifies all records and 45,502 member links against the current original import plan. Existing PostgreSQL/Prisma float serialization deltas are recorded and compare equally at original game float32 precision. Text, IDs and rules were not rewritten.

## Matched evidence

Ten fresh before/after pairs cover Star-Lord (Kitty Pryde), 7★ R6 Sig 200 A0, at desktop/mobile/320px/wide widths, the expanded requirements panel and section entry; Absorbing Man's multiple recipients; and Hulk (Ragnarok)'s incoming leveled family at 6★ R5 Sig 200 A0.

Captures use local anonymous Chromium, 100% zoom, DPR 1 and reduced motion. Fonts and visible images are awaited; screenshots are unretouched. The shared preview opened successfully but its evaluation and click operations timed out, so the existing local Chromium helper was reused. `before/evidence.json` and `after/evidence.json` retain viewport, position, geometry and semantic snapshots.

All ten semantic snapshots match exactly for titles, partner names/destinations, recipient labels, bonus text, correlated stars, uniqueness notes and original targets. The reference list remains 521px tall on desktop and 877px on mobile, with six and four complete visible rows respectively. At 320px it remains 983px tall with two complete visible rows. These are rendered observations, not human task-time measurements.

## Checks

- **146 tests in 12 relevant suites passed.** Tests include source-to-asset hashes for all 3,335 mappings, import refresh preservation, server projection, unknown/mismatched metadata, decorative rendering and distinct-icon grouping/aliases. The manifest-dependent tests were rerun after the final deterministic generation change.
- Root and web TypeScript checks passed. Targeted web ESLint and `git diff --check` passed. The existing browser-mapping dependency notice remains.
- **18 browser layout cases** across three champions and six widths passed: no document/control clipping, every rendered header has its native icon, partner links retain accessible names, controls retain their sizes and bonus text stays at least 14px.
- Keyboard portrait/expander tooltips, expansion/collapse, retained focus, touch access and grouped-alias focus/highlighting below sticky navigation passed. See [browser-smoke.json](browser-smoke.json).
- Before-edit snapshots/hashes of approved tracked changes are retained under `temp/synergy-icons/incumbent/`. Of those files, only the synergy panel, its two added CSS rules, its added regression test and the appended display documentation changed in this task. Other approved work was preserved. [Final source hashes](manifest.json).

No missing source inputs or unresolved current catalog mappings remain. Physical-device and screen-reader checks were not performed. Work remains local and uncommitted; no push, PR or deployment was requested or performed.

Capture and smoke helpers: `temp/synergy-icons-capture.cjs` and `temp/synergy-icons-smoke.cjs`. The database audit helper, `temp/synergy-icons-audit.ts`, is read-only and refuses non-local database hosts.
