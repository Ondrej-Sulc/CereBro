# Acquisition and ascension integration audit

Reviewed on 5 November 2026 against the current local CereBro work. This audit reads application/domain code and characterizes existing handlers with mocked database/session boundaries. It does not change production code, query personal game accounts, write real roster rows, publish assets or deploy.

The findings below describe the initial audited state. The later implementation follow-up records which issues have since been corrected locally; it does not establish a production deployment.

The parallel source investigations are [crystal drop rates](crystal-drop-rates-investigation.md) and [champion ascension](champion-ascension-investigation.md). Their source contracts and coverage should govern implementation; the findings below identify where those contracts need to enter the application.

## Findings that affect the next implementation

| Priority | Finding | Evidence and consequence |
| --- | --- | --- |
| P1 | A member pool is not an opening distribution. | `src/domain/champion-crystals.ts:163` groups aliases by name, category IDs, draw/pick, artwork and family labels. `src/domain/crystal-families.ts:29` validates families through category IDs and opening shape. Neither identity contains rates, guarantees, pity state, token rewards or prices. This is sufficient for the current membership view, but must not establish equal odds or equal total rewards. |
| P1 | An ascended legacy roster row can be rejected during an otherwise ordinary edit. | OCR stores `ascensionLevel = detectedLevel || (isAscended ? 1 : 0)` for all rarities in `src/commands/roster/ocr/process.ts:255`. The edit modal always sends that level in `web/src/app/profile/roster/components/modals/edit-champion-modal.tsx:325`. The management API rejects every positive level below 7★ in `web/src/app/api/profile/roster/manage/route.ts:69`. A mocked 6★ A1 rank edit returns 400 before any database update. |
| P1 | Boolean and numeric ascension state can contradict one another. | Add/manage APIs validate/write `isAscended` and `ascensionLevel` independently. A mocked 7★ update with `isAscended:false, ascensionLevel:2` is accepted and passed unchanged to the persistence boundary. The filter and calculations read the level; several avatar/badge views read the boolean. The same row can therefore affect calculations without displaying an ascension badge. |
| P1 | Champion ascension controls/calculation use a rarity-wide policy instead of champion blueprint rules. | `web/src/lib/mcoc-prestige.ts:34` returns a maximum of five for every 7★ and zero for every other rarity. `web/src/lib/champion-page-state.ts:47` applies that clamp; `web/src/app/champions/[slug]/champion-details-client.tsx:291` exposes A0–A5 solely for 7★. Lower-rarity health/attack boosts cannot be projected through this code, and individual 7★ eligibility cannot be represented. The source investigation must supply the precise supported champion/tier set. |
| P1 | One multiplier currently governs health, attack and prestige. | `web/src/lib/mcoc-prestige.ts:52` uses `1 + level * 0.08`; both `applyAscensionToPrestige` and `applyAscensionToStatValue` call it. The game-data contract must prove each effect and accumulation rule independently before replacing it. Legacy health/attack ascension must not automatically be applied to prestige. |
| P2 | Costs, token identity and other acquisition channels have no normalized public contract yet. | `Champion` has no ascension-rule relation, `Roster` only stores state (`prisma/schema.prisma:127`, `:648`), and the crystal schema stores only hero tiers/cosmetics. The inspected champion/crystal views have no resource catalog or cost UI to reuse. Immutable metadata sidecars can add these without putting static game rules into each roster row. |

### What the current crystal code intentionally guarantees

The extraction in `scripts/extract_mcoc_crystals.py:18` recognizes reviewed non-champion reward types but excludes their details. `build_catalog` projects only direct hero/hcos blueprint identities and the draw/pick opening shape (`:51`, `:96`). Counts of other reward types remain in coverage, but their amounts, probability, item identity, bonus/pity bindings, prices and cost currencies do not enter the application catalog.

The reader's Zod schema (`src/domain/champion-crystals.ts:11`) has no rate or cost fields. Simply adding such properties to the JSON would not create an exposed application contract; the schema/readers/projections need an explicit versioned update or a separately validated manifest.

`getCrystalDetails(id)` resolves every preserved source alias to a family, then returns the first variant's membership (`src/domain/champion-crystals.ts:225`). The detail header reduces opening rows to distinct draw/pick values (`web/src/app/crystals/crystal-views.tsx:20`). This deliberately avoids repeating the same champion pool. It also means neither API can currently answer “which exact source opening's probabilities, bonus tokens and pity rule are these?”

The comparison page's wording is currently appropriately limited: it says “same champions at N★” and its footnote explicitly describes membership without rates (`web/src/app/crystals/crystal-comparison.tsx:38`, `:45`). Retain that distinction after rates are added. Equal member sets can still have different category weights or per-item odds, and two openings can award different additional items.

The crystal investigator reports a concrete reason to retain opening identity: `super_duper_gamestore_box` uses a finite box-gacha/open-limit mechanism and hero reward contexts point to additional champion/class tokens with auto-ascend metadata. It also finds pity templates and exact shared-looking counter tags. See that investigation for verified field bindings; none of these behaviors is represented by the current “one pool / one reward” projection.

## Minimal contracts to add

Keep three identities separate:

1. **Member-pool identity:** the current exact champion/rarity set and family presentation. It supports browsing, search and member overlap comparison.
2. **Opening identity:** the exact source crystal ID, selection/box behavior, costs, additional rewards, and links to probability/pity disclosures. Two openings may share the first identity without sharing this one.
3. **Evidence identity:** source snapshot/hash, observation time, origin and verification status for the reported fact. A published game disclosure, a static contract and an observed account state are distinct evidence types.

A small `CrystalOpeningDetails` sidecar keyed by source crystal ID can preserve those boundaries. It should expose cost items, opening method, member-pool ID, rate disclosure status and typed reward/guarantee/pity references. Rate entries should preserve their denominator and scope: per opening, per candidate draw, conditional on a category, or guaranteed additional reward. Unknown rates must remain unknown, rather than zero or `1 / championCount`.

An odds disclosure model needs to preserve the exact reported decimal/string or integer numerator/denominator, reward/category IDs and whether an entry is conditional or complete. A selected champion's unconditional probability may be derived only when the source establishes every factor. Do not apply `1-(1-p)^N` to Nexus/box openings without proving replacement and draw independence. A category's percentage must not be displayed as that champion's percentage.

Do not merge source aliases for odds until opening equivalence has been proved using all rate/guarantee/pity/reward fields. Existing aliases can continue sharing a membership family. Add an opening-specific lookup, for example `getCrystalOpeningDetails(sourceId)`, alongside the current `getCrystalDetails(familyOrAliasId)`. Family pages can keep one portrait grid while showing a compact opening selector only when the rate/cost/guarantee information actually differs.

Represent additional/non-hero rewards as typed redeemer identities, not inferred champion membership. A resource/inventory identity should include both its game type and exact data ID; a token and a hero with a similar name are different things. Guaranteed token rewards, direct champion rewards, selectors, quest rewards, milestones and store exchanges should remain different acquisition source types. “Trophy champion” classification alone must not establish an acquisition route or chance.

For ascension, introduce a shared core rule lookup keyed by champion game ID/blueprint and rarity. Preserve eligible tier IDs, any rank or other predicate, ordered cost steps and separate effects (`attack`, `health`, `might/prestige`, `challenge rating` as supported). The parallel ascension investigation has found actual eligible tiers and separate `_def` tuning tiers; tuning definitions must not become blanket player eligibility merely because they exist.

Static rules can live in validated read-only game metadata as the crystal catalog does. `getChampionAscension(gameId, rarity)` should return recorded eligibility, available steps, step costs, effects and evidence, and distinguish absent data from explicit ineligibility. Resource names/artwork should be joined by exact IDs and use the existing immutable GCS publishing convention. The public UI can show required quantities and recorded acquisition sources without implying that the user owns a quantity or that an old source is currently on sale.

## Ascension changes must cover every consumer

The affected paths extend beyond a new champion-page panel:

- Champion URL/build normalization and health/attack/prestige: `web/src/lib/champion-page-state.ts:47`, `web/src/app/champions/[slug]/champion-details-client.tsx:58`, `web/src/lib/mcoc-prestige.ts:34`.
- Global prestige target normalization and projection: `web/src/lib/global-prestige-list.ts:126`, `:217`; roster prestige recommendations: `web/src/lib/roster-prestige-insights.ts:117`.
- Manual add/edit validation: `web/src/app/api/profile/roster/add/route.ts:12`, `web/src/app/api/profile/roster/manage/route.ts:12`; add/edit controls: `web/src/app/profile/roster/components/modals/add-champion-modal.tsx:266`, `web/src/app/profile/roster/components/modals/edit-champion-modal.tsx:273`.
- Screenshot upload and Discord import: `web/src/components/RosterUpdateForm.tsx:223`, `web/src/app/api/profile/roster/update/route.ts:47`, `src/commands/roster/update.ts:24`, `src/commands/roster/ocr/process.ts:253`.
- Legacy state reading/filtering/export: `web/src/lib/roster-ascension-filter.ts:6`, `src/commands/roster/export.ts:28`. Badge consumers such as `web/src/components/champion-avatar.tsx:79` and `web/src/components/UpdatedChampionItem.tsx:107` still read the boolean.

Create a shared core read/normalize/validate policy for owned state, then use it in web and bot entry points. A state like `false/A2` should not have two different meanings. Handle legacy `true/A0` compatibly, using source evidence about that rarity rather than silently erasing it. Current captured or historical owned state should not be destructively downgraded solely because today's rule snapshot lacks its eligibility entry.

The manual add dialog also carries its existing ascension fields through star changes: `handleStarChange` currently normalizes stars/rank/signature, but not ascension. An A5 choice followed by selecting 6★ can therefore reach the API with an invalid positive level. A game-backed policy should update available controls and validate the complete chosen build, instead of relying on a later 400 response.

The existing tests explicitly encode the rarity-only policy (`web/src/lib/mcoc-prestige.test.ts:29` expects a 6★ cap of zero). Passing those tests is not independent evidence of game behavior. Replace policy assertions with fixtures from the verified game contracts, and keep health/attack and prestige test expectations separate.

## Suggested implementation order

1. **Persist evidence and exact identities first.** Add source-opening acquisition metadata and an ascension-rule/resource snapshot with validation and coverage accounting. Keep the existing direct-member catalog stable. Preserve unknown odds and account-dependent rules explicitly.
2. **Correct ascension state/calculation integration.** Add shared game-backed eligibility/effect lookup; fix the legacy edit failure and boolean/level inconsistency across API, OCR, bot and UI. Show champion-specific steps/costs with real resource artwork. Do not change prestige scaling until its own source semantics are verified.
3. **Expose special crystal mechanics.** Add a compact “Opening details” area for finite box counts, selection rules, guaranteed tokens and pity disclosures, with exact source identity retained. This is useful even where numeric odds are unavailable.
4. **Expose verified odds.** Show official/disclosed category and champion odds with provenance/time/context. Where different openings share members but differ in rewards or rates, keep one champion grid and separate the opening details. Add trophy-target comparison only once those distributions are comparable.
5. **Connect acquisition sources.** Reuse exact resource/token IDs in champion acquisition views, crystal pages and the quest planner when the corresponding source joins are verified. Later roster-aware planning can combine these public rules with explicit user-owned champion/inventory state.

Required regression boundaries include same members/different odds, same draw/pick/different guaranteed rewards, unknown vs zero rates, conditional vs unconditional rates, finite box/Nexus interpretation, stale source hashes, lower-rarity health/attack ascension, champion-specific 7★ eligibility, exclusion of tuning-only tiers, independent prestige effects, OCR-to-manual-edit round trips, legacy booleans, contradictory writes and changing rarity after selecting an ascension level.

## Verification performed for this audit

Three ignored characterization probes invoke the existing management handler and pure helpers. The database, session, cache invalidation and observability boundaries are mocked; no HTTP request is sent to a running application and no real persistence occurs.

```powershell
pnpm exec vitest run --config temp/acquisition-integration-audit/probe.config.mts --maxWorkers=1
```

Result: **3 passed**. They characterize (1) a 6★ A1 edit returning 400, (2) acceptance of a contradictory 7★ boolean/level write, and (3) the existing rarity-only cap/stat multiplier. They are investigation artifacts under ignored `temp/`, not desired-behavior regression tests. The eventual fixes should add permanent public-boundary tests for the intended source-backed behavior.

## Implementation follow-up

The roster fixes now use `src/domain/roster-ascension-state.ts` as the shared read/write policy. Positive numeric observations read as ascended, legacy true/A0 reads as A1, explicit contradictory writes fail validation, and boolean/level changes update both fields. Manual new/increased levels honor a known champion-specific cap; a missing rule is distinct from an explicit zero cap. Existing owned states above or absent from the snapshot remain editable, including decreases, without being silently erased. Build simulations use the separate recorded-eligibility contract; recording an observed roster state does not manufacture a simulation rule.

The add/manage handlers validate integers and champion rules and return canonical presentation plus small per-rarity limits. Omitted ascension fields are excluded from UPDATE data so a rank-only change does not overwrite a concurrent ascension observation. Add retries preserve the authorized target player's identity. The edit modal captures its opening ascension baseline and omits unchanged ascension fields on save; add defaults also avoid resetting an existing row when no positive ascension was chosen.

Profile controls use the champion-specific limits, retain an owned historical level as an option, and synchronize both state fields. Changing the champion or rarity for an add resets ascension. Known zero eligibility is displayed distinctly from missing rules, where a numeric observed level can be recorded. Player roster and client roster reads normalize legacy contradictory state for badges/filtering; the main champion/roster server adapter is enriched separately by the root implementation.

OCR persistence, screenshot-upload parameters, Discord update input and CSV export use the shared canonical state. These observation/import flows preserve structurally valid observed levels instead of substituting a snapshot-wide cap. The Discord command now registers its previously read-but-unregistered numeric ascension-level option. The bot roster read service treats either a positive numeric level or legacy true flag as ascended and normalizes its output.

Permanent validation added for these paths: six pure-state tests, fourteen manage-route tests, six add-route tests, four shared-control tests, three real profile-modal interaction tests, two roster-service read-boundary tests and the four existing legacy-filter tests. Together these **39 focused tests pass** with mocked session/database/network boundaries and no real roster mutations. The CI game-backed ascension step includes these checks and the game-rule/projection/cache regressions from the parallel root work.

## Completed-feature integration review, 7 November 2026

Reviewed the working files for grouped crystal previews, canonical Ascension
eligibility, catalog/roster eligibility filters and finder artwork. Unrelated
changes were preserved. No commits, deployment, immutable-catalog/source-data
changes, real roster mutations or cloud publication were performed.

Two integration defects were fixed:

- Clearing `ascensionEligible=true` could re-enable the rule while Next's
  `useSearchParams` still exposed the previous URL. URL-to-memory synchronization
  now runs when the explicit URL value changes, independently of local memory
  changes. Three regressions retain the old URL snapshot during checkbox,
  active-rule and Clear all actions, then publish the new URL. All failed before
  the fix and pass afterward; view/hash context survives.
- The existing compact-payload regression found Hulk's initial crystal summary
  had grown to 16,126 bytes. An explicit projection now sends names, exact source
  IDs, stars, opening selection, primary icons and family metadata (7,040 bytes).
  Unused banners and availability evidence remain on full readers/detail pages.
  Archive counts and the original 10 KB budget are preserved.

Finder, cached champion catalog and personal/player/alliance roster DTOs use one
blueprint-derived eligibility API. Clients receive per-star arrays rather than
full blueprint costs/catalogs; enrichment adds no per-champion database queries.
Owned rows match their actual rarity before grouping, faceting and display caps.
Current ascension status/levels remain independent, including already-maxed
eligible copies. Regressions cover 7-star Gwenom, unsupported 7-star Hulk, eligible
source gaps, unknown/non-player/empty paths, composed filters, URL/browsing memory,
stale responses and ordinary lookup. Eligibility retains 3 November provenance;
reward sources retain their separate 5 November date.

CI registration adds only the three missing suites to existing commands:

- Crystal extraction/pool browsing: `web/src/lib/champion-crystal-groups.test.ts`
  and `web/src/lib/data/crystal-finder-eligibility.test.ts`.
- Game-backed ascension/roster updates:
  `web/src/app/profile/roster/components/roster-eligibility-filter.test.tsx`.

Live Preview used an owned tab at desktop 1440px and mobile 390px/320px:

- Catalog: 7-star Gwenom remains visible; 7-star Hulk search has no matches;
  switching to 6 stars includes Hulk. Mobile checkbox/help and wrapping active
  rules render correctly. Fixed rule removal at 320px clears the URL and restores
  all 340 champions. No horizontal overflow was observed in these cases.
- Hulk 6-star How to obtain: eight categories and 469 families, with initial
  cards bounded to 3/1/3/3 in the leading groups and zero in later groups. Class
  View more expands 3 to 15 of 16. Exact `sg_6star_nexus_crystal` navigation loads
  its banner; Back returns to Hulk, rarity 6, selected How to obtain.
- Finder: desktop default shows the accepted five portraits without the Handle
  piece. Selected 7-star Gwenom/Ascension at 390px retains its artwork, attached
  navigation, exact bonus link and separate eligibility/reward dates.

Populated roster visual cases remain unverified: the tab was signed out, alliance
roster redirected home, and no accessible target-player URL was supplied. Roster
evidence above is from server-boundary, matcher and UI fixtures. Preview navigate
and snapshot timed out during alliance navigation, then recovered. Fallback
inventory reported "The browser access host is unavailable"; no user browser
window was controlled. The owned Preview tab was closed. Native reduced-motion
emulation is unavailable in these Preview tools: normal preference was observed
and the static CSS/media path reviewed, without claiming a native reduced-motion
run.

Final validation: **352 tests passed in 48 files**, from one final consolidated
Vitest run using `--maxWorkers=1 --testTimeout=15000`. Full web TypeScript passed
with `pnpm exec tsc --noEmit --incremental --tsBuildInfoFile tsconfig.tsbuildinfo`.
Scoped ESLint passed for 33 web files and the two changed core files: zero errors,
six existing unused-prop/image warnings in crystal-tools test mocks. The initial
web lint invocation excluded the two core files as outside its base path; they
were then linted successfully from the repository root with the web config.
Tooling emitted baseline-browser-mapping/React/pages-path notices. Vitest emitted
two existing champion-grid React act warnings; no final failures or timeouts.
The 15-second local timeout distinguishes cold catalog loads from assertions;
CI commands retain their existing settings. No listener limits were changed.

Review changes are confined to `.github/workflows/ci.yml`,
`src/data/game-crystals/index.ts`, `src/tests/crystal-catalog.test.ts`,
`web/src/hooks/use-ascension-eligibility-filter.ts`,
`web/src/app/profile/roster/components/roster-eligibility-filter.test.tsx` and this
audit document. Local test/lint manifests and logs are preserved under ignored
`temp/latest-feature-integration-*` for the coordinating agent.
