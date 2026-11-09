# Champion attack breakdown

Implementation candidate from deployed main `a90cb03ce2235b05113d4153bd31818d5a1acfaa`, 9 November 2026. The parent owns review and release.

## Presentation

The Stats & attacks panel now uses a compact move ledger and visible Special hit sequences. Move names, hit positions, damage types and delivery properties align in columns. The distribution bar, property badges, hover hit tiles and duplicate sequence summaries are removed. At a content width of 900px the basic and Special ledgers sit beside each other; narrower views stack in reading order. Property labels remain visible on touch screens. Ability actions have a minimum 44px height and a visible keyboard focus indicator.

Every Light and Medium variant remains a separate move. Heavy hits stay within Heavy. Adjacent hits with identical complete property sets share an explicit numbered range; a property change always starts a new row, including a return to an earlier property set. Extra recorded tags appear once beside their exact hit range. No total implies a universal combo, attack frequency or damage contribution.

The existing Stats panel already hosts `ChampionAttackProfile`; its API and placement are retained without editing the Stats panel, client, global navigation, banner or shared dossier stylesheet. Styles are isolated in a new CSS module. No runtime dependency is added.

## Evidence and limits

- The unchanged DTO supplies only attack type, ordered hits, IDs and property strings. Hit order follows the existing loader's `id asc` order. This increment does not claim frame timing or independently verified animation order.
- Physical and Energy are independent of Contact and Projectile. Both values can coexist within either dimension. Missing damage or delivery is displayed as **Not recorded** in that column. An empty move displays **Hits not recorded**; an absent move is not invented. Blank property strings provide no classification. Other source tags, including Punch, Weapon and Psychic, remain visible without assigning them to a dimension.
- There are no hit damage amounts, coefficients, Attack-stat substitutions, percentages, or S3 entries. The DTO ends at S2. One quiet footer explains that amounts are unavailable.
- Existing ability matching, including shared chapter aliases, is preserved. Actions call the matched panel's original `group`. A missing panel does not get a fabricated target. For example, the current Madelyne Pryor source has an S1 chapter but no S2 panel, so only S1 offers Read ability.
- No catalog rows, observations, source provenance, identity, permissions, auth, calculation or acquisition rules were modified. No extraction refresh or static-data improvement was made.
- The saved catalog was inspected read-only to choose representative champions. Madelyne Pryor matches the supplied screenshot: S1 hits 1–3 Energy/Projectile, hit 4 Physical/Projectile; S2 hit 1 Physical/Contact, hits 2–3 Energy/Projectile. Bastion's Heavy changes Physical/Contact → Energy/Projectile → Physical/Contact. Annihilus S1 hit 3 is unclassified. These are existing records, not new collection.

## Changed files and CI registration

Production files:

- `web/src/app/champions/[slug]/champion-attack-profile.tsx` — replaces the attack presentation.
- `web/src/app/champions/[slug]/champion-attack-profile.module.css` — new isolated styles.
- `web/src/lib/champion-attack-profile.ts` — adds pure dimension/range presentation helpers; existing summary calculations remain intact.

Attack suites registered in CI alongside the existing champion-page checks:

- `web/src/app/champions/[slug]/champion-attack-profile.test.tsx` — 6 component/interaction cases: exact hit associations, combined/unknown properties, missing/empty moves, long names, shared chapter navigation and additional tags.
- `web/src/lib/champion-attack-sequence.test.ts` — 4 domain cases: dimension independence, unknown tags, adjacency/order/immutability and long sequences.

Documentation: `docs/ux/champion-attack-breakdown.md`.

## Checks

From this worktree root:

```powershell
pnpm exec vitest run 'web/src/app/champions/[slug]/champion-attack-profile.test.tsx' 'web/src/app/champions/[slug]/champion-stats-panel.test.tsx' web/src/lib/champion-attack-sequence.test.ts web/src/lib/champion-attack-profile.test.ts --maxWorkers=1
pnpm exec vitest run web/src/lib/combat-ascension-regression.test.ts web/src/lib/prestige-ascension-regression.test.ts 'web/src/app/champions/[slug]/champion-ascension-interaction.test.tsx' --maxWorkers=1
pnpm exec tsc -p temp/attack-review/tsconfig.json --noEmit --incremental false
pnpm --dir web exec eslint 'src/app/champions/[slug]/champion-attack-profile.tsx' 'src/app/champions/[slug]/champion-attack-profile.test.tsx' src/lib/champion-attack-profile.ts src/lib/champion-attack-sequence.test.ts
git diff --check
node temp/attack-review/capture.cjs final all
node temp/attack-review/capture.cjs final madelyne-pryor,absorbing-man,bastion 320
node temp/attack-review/capture.cjs final chee-ilth
node temp/attack-review/navigation.cjs
```

18 attack/Stats tests and 28 existing A2/combat/prestige/interaction tests pass. Scoped TypeScript, scoped ESLint and diff whitespace checks pass. ESLint emits the pre-existing baseline-browser-mapping freshness advisory. No full web typecheck, build, migration, database write or release command was run. The scoped temporary tsconfig extends the web configuration and includes only the attack component/helpers/tests plus Next declarations and their transitive dependencies; it is a local review artifact, not a new CI configuration.

## Actual browser review

Preview was attempted first. The initial navigation returned `ERR_CONNECTION_REFUSED` while the server started. Two subsequent current attempts at the same navigation step returned `Preview automation navigate timed out after 15000ms.` These errors were quoted before falling back to headless Chromium. No native browser or game window was opened. All three owned Preview tabs and all headless contexts were closed.

The final matrix contains **42 actual page captures**: Madelyne Pryor, Absorbing Man, Bastion, Annihilus, Thanos (Deathless), Ares and Chee'ilth at 320, 375, 390, 768, 1280 and 1440 CSS pixels. The matrix reports no page errors, horizontal document overflow or overflowing attack cells. Touch navigation exercises 7 existing Special chapter links, preserving build query parameters and browser Back restoration. The first navigation harness attempt ran before React hydration and timed out; the final harness waits for hydrated event props and passes all 7 actions.

Visual inspection used the real PNGs, not generated mockups or test assertions. Desktop review confirmed the removal of the dominant bar/badge clutter and direct reading of mixed types. Initial 320px review showed Medium labels wrapping; the final narrow-column adjustment keeps them on one line while preserving 14px property labels. Chee'ilth's long source names wrap naturally, Annihilus's missing dimensions stay explicit, Bastion's Heavy keeps its return to Physical/Contact, and the 21-hit Deathless Thanos S2 remains an exact two-range sequence. Mobile places Specials below basics, so seeing the full breakdown requires vertical scrolling. This is intentional; there is no horizontal slider.

Review URLs, server left running on its own port:

- <http://127.0.0.1:3010/champions/madelyne-pryor?tab=stats#champion-attacks>
- <http://127.0.0.1:3010/champions/absorbing-man?tab=stats#champion-attacks>
- <http://127.0.0.1:3010/champions/bastion?tab=stats#champion-attacks>
- <http://127.0.0.1:3010/champions/annihilus?tab=stats#champion-attacks>
- <http://127.0.0.1:3010/champions/thanos-deathless?tab=stats#champion-attacks>
- <http://127.0.0.1:3010/champions/ares?tab=stats#champion-attacks>
- <http://127.0.0.1:3010/champions/chee-ilth?tab=stats#champion-attacks>

Local review directory (ignored by Git): `C:/Users/ossul/.t3/worktrees/CereBro/t3-7e51f4c4/temp/attack-review/`.

- `preview.html`: minimal parent-ready gallery using absolute image paths, without an outer frame, side padding or viewport-height sizing. Includes the supplied previous view for comparison.
- `final/evidence.json`: all 42 viewport, source-row, overflow and page-error records.
- `final/navigation.json`: seven successful touch navigation targets.
- `final/{slug}-{width}.png`: ordinary viewport screenshots with existing site navigation.
- `final/{slug}-{width}-breakdown.png`: actual full-page screenshot crops of the complete top-level breakdown; pixels are not redrawn. The initial locator screenshot method allowed the sticky header to cover the section heading, so final crops come from full-page captures.
- `final/madelyne-pryor-{1440,390}-page-top.png`: real banner/navigation/Stats context, visually inspected.

Explicitly inspected final breakdown PNGs: `madelyne-pryor-1280`, `madelyne-pryor-375`, `madelyne-pryor-320`, `absorbing-man-1440`, `absorbing-man-375`, `bastion-1280`, `bastion-768`, `bastion-320`, `annihilus-390`, `annihilus-320`, `thanos-deathless-768`, `ares-1280`, `chee-ilth-1280`, `chee-ilth-375`, `chee-ilth-320` (all with `-breakdown.png`). Initial desktop, tablet and phone captures were also inspected before refinement. The four supplied references were all opened with `view_image`.

The development server runs via `pnpm --dir web dev --port 3010 --hostname 127.0.0.1` (exec session `29912`). Local dependency junctions and an ignored `.env.local` reuse the existing environment; no credentials are included in the review packet. Existing ports 3000–3003 were untouched. No commits, pushes, PRs, deployments, posts, logins or new game collection were performed.
