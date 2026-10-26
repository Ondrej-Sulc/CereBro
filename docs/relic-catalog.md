# Relic catalog

The public catalog at `/relics` browses game relic definitions independently of player ownership, champion bindings and prestige. Each source relic ID has its own `/relics/[slug]` page. Rarity selections are reflected in the URL.

The initial 18 October 2026 snapshot contains 145 definitions (25 Battlecasts and 120 Statcast variants), 224 socket items, 698 rarity records and 3,090 scaling contexts. The browser groups the 120 Statcasts into 24 visual families while preserving all individual variants. Together with the Battlecasts, this makes 49 browsing cards. The 98 delivered portrait PNGs are published to the same Google Cloud Storage bucket as champion images; they are not bundled under `web/public`.

## Catalog presentation

The catalog uses the selected Showcase card design: prominent portraits, class-colored backgrounds and a separate kit/attribute footer. Portraits have a CSS transparency fade along their lower edge to soften the source artwork's crop; original image bytes remain unchanged. The grid fills the available page width. The temporary Split/Index comparisons and development switcher have been removed.

Relic portraits use the shared `gcpStorageService`, `GOOGLE_CREDENTIALS_JSON` and `GCS_BUCKET_NAME` configuration (default bucket `champion-images`). Objects are namespaced as `relics/<asset-name>/<source-sha256>.png`, with immutable caching and create-only uploads. Repeated imports reuse only byte-identical objects. The database's `portraitPath` stores the public HTTPS URL. Next Image supplies responsive delivery and supported format optimization, as on champion pages; the verified source PNGs, including the differently shaped small portraits, are not cropped or blurred by the import. CSS controls the visual fade. New source bytes produce a new URL without overwriting champion objects or requiring image files in a website build.

Filters use type segments, class-colored single-selection buttons, a keyboard-accessible attribute menu, and individually removable active selections. Clicking the selected class returns to all classes. On phones, class and attribute controls collapse behind Filters while active selections remain visible. Attribute filtering applies to Statcasts; choosing Battlecasts clears that filter and disables its menu. Search still matches names, classes and attributes together with the other filters.

Attribute menu options and the selected filter button reuse the catalog's game glyphs and colors. All attributes and entries without a recorded icon use the neutral filter glyph. Icons are decorative; option labels, keyboard typeahead and the separate selection checkmark remain intact.

Statcast primary attributes reuse matching game glossary glyphs and colors as decorative accents, with exact stat labels retained. The explicit presentation mapping does not imply that a relic grants the corresponding named Buff. Missing glossary icons remain text-only.

Rune headings also use game effect glyphs and colors for clear single-effect names and Statcast primary/secondary attributes. Matching removes only recognized modifier suffixes before an explicit glossary lookup; mixed-effect names and custom abilities keep a generic rune glyph. Decorative glyphs do not change accessible names or source descriptions.

Detail pages use a class-colored portrait header, direct rarity buttons and icon-labelled Statcast variant links. Rarity stays in the URL and carries across variant navigation. Striker/innate descriptions sit beside stacked Abilities and Attributes panels, with every distinct rune's description visible at once. Repeated options across source slots are deduplicated by source item ID in first-occurrence order; distinct IDs with matching names remain distinct. Both Statcast primary and secondary bonuses appear under Attributes. These panels stack on mobile; game-recommended pairings sit below the kit. The redundant Binding reference card is omitted; source restrictions remain stored, and the catalog retains its snapshot date. Supported values display rarity-wide progression ranges, with an expandable explanation of their scope; source descriptions and scaling rules are unchanged.

## Data and import

`GameRelicImport` retains an immutable source bundle keyed by the SHA-256 of its manifest. Its snapshot includes the original normalized definitions, all 14 raw typed tables, scaling contexts, dependencies, asset metadata, data contract and validation report. Current projections live in `GameRelic`, `GameRelicRarity` and `GameRelicSocketItem`; the full raw snapshot is not sent to the browser. Each detail query reads its relic, related socket definitions and scaling projection, plus a bounded JSON projection of only its tiered modifiers' display dependencies from that same import. These read-only formatter dependencies are cached by immutable import and selected IDs; ranges require no reimport or database mutation.

The source package is external to the repository. For the initial local import it is `D:/CodexArtifacts/mcoc-relic-data-2026-10-18`, with manifest hash `33e10798f68e8976bf5fc5d3aba91aceba077cb64eb71e3ed2f53e278418ba47`.

Run from the repository root against the intended `DATABASE_URL`:

```powershell
pnpm exec prisma migrate deploy
pnpm prisma:generate

# Read-only preview; validates the complete package before querying the catalog.
pnpm import:mcoc-relics --directory=D:/CodexArtifacts/mcoc-relic-data-2026-10-18

# Upload/reuse and publicly verify all portraits, then import into the selected DB.
pnpm import:mcoc-relics --directory=D:/CodexArtifacts/mcoc-relic-data-2026-10-18 --write --upload-assets
```

The importer checks manifest hashes and sizes, source references, complete scaling-context coverage, original rarity indexes and portrait bindings. Imports use one database transaction with an importer advisory lock. Repeating a source snapshot reuses its import record and stable source IDs. Definitions absent from a later complete snapshot require an explicit `--allow-retire`; retired projections are retained with `isCurrent=false`. No champion, player, roster or prestige tables are written. `--write` requires `--upload-assets`: local hashes are checked before upload, and every public response must match its source hash before any database reference is published. Upload or verification failure leaves the database unchanged; a retry reuses existing identical objects. A preview without these flags never uploads images or needs Google credentials. The old `--copy-assets` flag is rejected.

Deployment requires the additive migrations, the verified import into the target database, and the website code. Portraits are already accessible through shared cloud storage and are verified/reused during the target import. The website and relic database changes have only been applied locally so far; publishing the image objects does not deploy the application or update the production database.

### Production rollout

The repository's `main` branch deploys automatically. Complete the data steps from the reviewed feature revision before merging the UI, so the public navigation cannot point at a catalog without its tables or data:

1. Take a target database backup and verify that the release environment selects the intended database and existing champion-image bucket. Use the verified external source package identified above; do not commit credentials, raw game exports or a database dump.
2. Run `pnpm exec prisma migrate status` and review the pending migrations, then `pnpm exec prisma migrate deploy`. The two relic migrations only add four relic tables and a scaling projection; existing champion/player tables are untouched.
3. Run the importer without write flags and check the initial counts: 145 definitions, 224 socket items, 698 rarity rows, 458 selectable rarity views and no unexpected retired IDs. Then run the same command with `--write --upload-assets`; it verifies/reuses the 98 cloud portraits before one transactional catalog import. No production import is run by CI or by a website request.
4. Deploy the reviewed code. Check `/relics`, a Battlecast (for example `/relics/hulkbuster-movie-offense?rarity=6`), a Statcast and its secondary variants, and an unknown slug returning 404. Check mobile filtering, rarity switching and optimized image delivery. Confirm that normal champion and roster pages still work.

If validation or import fails, stop before merging; the upload-before-transaction flow leaves database publication unchanged on an image failure. If the UI must be rolled back, redeploy the previous application revision and leave the additive relic tables, immutable imports and cloud portraits intact. Do not reset the database or drop shared assets to roll back this feature.

## Rarity and identity

- Statcast controls expose only the user-confirmed 5★–7★ range. All 240 lower-rarity Statcast template records remain stored. Filtering does not reindex the source arrays: a 5★ Statcast still uses original source index 2.
- Battlecasts retain their recorded rarity choices. Do not apply a blanket 6★ cap: The Cosmic Egg has source-backed 6★ and 7★ records.
- A cached rarity template or definition does not establish current crystal availability. The catalog states its snapshot date.
- Statcast families group by source class, model asset and primary attribute for browsing. Secondary variants retain distinct source IDs, URLs, rarity data and abilities. Filters match one variant's fields together.
- Family labels may use an exact case-insensitive champion-name match for presentation. This does not establish a binding or modify source identities.

## Descriptions and eligibility

Game markup is rendered using the existing safe description parser. Supported placeholders display the recorded minimum–maximum endpoints for the selected rarity across its full progression, not a selected rank/build. Equal endpoints display once, with at most two decimal places. Original source rarity indexes remain intact.

The formatter follows the source's `SocketItemsTiereds.StatModId` to modifier and display-formula metadata. Chance parameters and `mod_x_vara` percentages are converted through that metadata; a `%` in prose alone never implies multiplication by 100. Duration and other direct numeric parameters retain their units. Negative modifiers become positive magnitudes only when the template explicitly supplies a reduction or minus sign; otherwise both signed endpoints remain visible. Resolution runs before markup parsing so color tags cannot hide the relevant wording or units.

For `standard` and `standard_critdam`, the client provides unbound percentage previews when champion attributes are absent. The page explicitly explains this: those percentages are not final champion-specific rating amounts. The `mod_x_atk` display formula (`formulaType: mod_x_attk`) and `mod_x_hp` likewise support relative percentages of the bound champion's Attack and Health. These are coefficients, not calculated flat damage, Attack or healing amounts. Relative units identify the stat basis; existing Attack Rating/Health units are retained without duplication. Challenge Rating conversions, missing dependencies and unsupported expressions remain **Build-dependent**. The detail loader marks missing/unsupported formatting explicitly, so a raw constant cannot bypass that fallback. No combat calculator or rank interpolation is claimed.

For example, 6★ Iron Fist's Brooklyn Headbutt records Attack coefficients of `0.0060`–`0.0120`, displayed as **0.6–1.2% of Attack**. This follows the shared formula metadata, without a relic-specific override or data rewrite. Juggernaut's constant `0.015` Health coefficient displays as **1.5% Health**.

Direct `ChanceSource` parameters also display their recorded chance ranges when the legacy Challenge Rating flag is set. In the verified 18 October client, `GetStatModValue` interpolates the selected rarity endpoints without reading its CR flag or CR arguments; `GetStatModValNumberStr` then multiplies a matching chance parameter by 100. This supports Mr. Sinister's two 6★ repeat-trigger ranges, **11.76–23.53%** and **23.53–47.06%**, through shared metadata rules. Other CR-marked parameter types still fail closed. The source flags and arrays are preserved.

Evidence: the immutable source package's `scaling-method-evidence.txt`, particularly `GetStatModValue` and `GetStatModValNumberStr`, and its `mcoc_relics.dependencies.json`. For 6★ Hulkbuster the full-progression preview is 4–8% Shock Vulnerability, 6–12% Energy Resistance reduction and 40–80% Shock duration/potency. A rank-specific third-party screenshot shows narrower ranges and uses slightly different interpolation; those screenshot numbers are not copied into the source data or renderer.

Rune panels list available options rather than an equipped loadout. Original slot positions and ordered option IDs stay unchanged in the data; the page does not claim all options are simultaneously equipped or unlocked at the selected rarity.

Game-recommended champions are presented as source suggestions, not best-pairing rankings. Links require exact game IDs. Class and extra restriction selectors are reference data only: selector inclusion/exclusion semantics have not been established, so the catalog does not assert eligibility. Owned relics, binding validation, loadouts and relic prestige are later features.

## Verification

`pnpm test:relics` runs the portable relic suite without a database, external package or cloud credentials and is required by CI alongside the existing champion regressions and both builds. The full external-package and HTTP audits below are separate release checks.

CI also runs `relicCatalogImportService.postgres.test.ts` against a disposable PostgreSQL service. For local runs, set `RELIC_TEST_DATABASE_URL` to a loopback test database; the test creates and removes only its own random schema. It exercises the real importer, exact high-precision source numbers, repeat imports and rejection of conflicting immutable snapshots. Source snapshots are inserted through parameterized JSON text casts because Prisma's JSON write protocol can round the last digits of source doubles; existing snapshots must match exactly and are never silently overwritten.

`src/domain/relic-catalog.test.ts` covers source identities, rarity indexes, family filtering, reference failures and conservative numeric rendering. `src/domain/relic-values.test.ts` covers metadata-driven units, signed ranges, equal bounds, rounding and fail-closed dependencies. `src/services/relicCatalogImportService.test.ts` covers package tampering, traversal, source-index drift, source preservation and required cloud references. `relicPortraitService.test.ts` and `gcpStorageService.test.ts` cover pre-upload hashes, public verification, namespacing, immutable-object reuse and refusal of conflicting or inaccessible objects.

The local full-catalog render check covers all 145 definitions across 458 selectable rarity views: 2,130 descriptions, 224 distinct socket items and 3,012 formatted values. Source endpoints were checked against the verified raw arrays, all 98 installed portraits matched their source hashes, and every HTTP-rendered card, rarity selection and Statcast variant link matched its expected source-backed output. No unresolved values, missing/duplicate cards, raw markup or Binding reference panels remained. Desktop/mobile spot-checks covered Battlecast, Statcast and 7★ Cosmic Egg layouts plus interactive rarity switching. All 43 scoped tests, web typecheck and scoped lint passed. Audit scripts and results are retained at `D:/CereBro-artifacts/relic-render-audit-20261025`; these checks validate rendering against the imported snapshot, not changes made to the game after that snapshot.

Initial local-import fingerprints verified that 21 existing champion, ability, synergy, player, roster and prestige tables stayed unchanged. Import receipts and fingerprints are under `D:/CereBro-artifacts/relic-catalog-20261025-r1`.

The 26 October image migration publicly verified all 98 cloud objects against their source SHA-256 hashes before switching all 145 local relic records to cloud URLs. Before/after fingerprints matched for every non-portrait relic field, immutable source imports, socket items, rarity projections and champion image references. All 49 full-size portraits passed Next Image HTTP/decode checks and loaded through the optimized URLs in the catalog; representative Battlecast and Statcast detail responses retained responsive image sizes. The CSS fade remains unchanged. The 98 matching bundled copies (4,954,087 bytes) were archived outside the repository, leaving the source package untouched. All 51 scoped tests, root/web typechecks and scoped web lint passed. Receipts, verification results and the local-copy archive are under `D:/CereBro-artifacts/relic-cloud-images-20261026`. This does not represent an application deployment or production database import.

Release preparation on 26 October passed all 51 relic tests and the 316 existing CI regressions, the bot TypeScript build, the optimized Next.js production build and scoped web lint. Both migrations were replayed in a uniquely named isolated local PostgreSQL schema; the full verified package imported with the expected counts, a second import produced identical rows, retirement without approval was refused, and an injected database constraint violation rolled back all import writes. Live catalog fingerprints were unchanged. The built production server passed all 458 source-backed rarity views (2,130 descriptions), plus catalog, unknown-slug 404 and existing champion/roster smoke checks. Mobile catalog checks verified filtering and no horizontal overflow. Results and the isolated rehearsal script are retained at `D:/CereBro-artifacts/relic-release-20261026`.
