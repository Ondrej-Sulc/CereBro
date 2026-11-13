# Public effect glossary

Standalone, read-only `/glossary` and `/glossary/[id]` pages. Effect glossary is a secondary public catalog in the deployed direct-navigation Header: desktop More and the phone menu's More catalogs group. Champions, Relics and Crystals retain their primary row and collection behavior. No schema, migration, manifest, auth, roster or saved-observation changes are required.

## Category-first browsing (12 November 2026)

All actual effect categories are exposed as direct, counted navigation cards above secondary search on phones and desktop. Category links reset pagination, retain the current search, and jump to the results; Change category returns to the cards. All effects removes only the category, and Clear search retains it. Counts remain full-catalog membership counts (which can overlap), while the result total reflects both active filters. No category, definition, palette or champion-source data is inferred or changed.

Search uses a compact native GET form below the chosen category, preserving its category in an enabled hidden field. Its small client wrapper restores the text from the URL after pageshow, Back/Forward and in-app navigation, preventing a restored typed draft from contradicting the actual results. The existing effect details, source/partner semantics, bounded readers and links remain unchanged.

## Identity and reading

- URLs use the existing positive PostgreSQL `Ability.id` (for example `/glossary/706`, Bleed). IDs survive name edits and avoid normalized-name collisions without new slugs. Noncanonical numeric forms, text slugs, unsafe integers and missing records show the glossary's not-found state. Ability names are currently unique in Prisma; the projection still matches IDs, never names.
- Browse uses `Ability` and its actual `AbilityCategory` relations. Definition and artwork fallback only to the explicitly bound `gameGlossaryTerm`, never a name-derived game ID. Missing definitions/artwork get neutral fallbacks. Imported colors use the existing `getGameEffectColors` convention. Icons are direct Next Image SVGs, avoiding CSS-mask cross-origin failures observed in Preview.
- Search covers effect names and recorded definitions. Category totals cover the full catalog and can overlap; result totals cover the active search and category. GET parameters preserve bookmark/back behavior. Browse reads at most 24 effect rows after counting and clamping the page.
- Detail queries only links whose ability ID or recorded incoming resistance target is this effect. It selects compact public champion identities, source metadata, required partners, overview receipts and resistance receipts. It reads only referenced resistance evidence, then calls shared `projectChampionEffects` for classification. It does not import Discord command/rendering code.
- That shared projection validates overview source hashes (including form, direction and partner IDs) and resistance source/evidence hashes. Drift suppresses stale metadata. Ordinary applications remain ordinary; a current classified resistance replaces the corresponding ordinary mitigation entry just as in roster/Kit/search readers. A 100% resistance remains Resistant.
- Each actual source link remains a separate application and render key. No glossary-level consolidation of synergy variants, partners or multiple applications occurs. Counts are unique champions in each group; the source count on a champion is its matching applications. One champion can be in multiple groups.
- Source form and direction filter the **same** ability application. They do not filter immunity/resistance sources. Champion name, class and obtainable stars filter all three counts. Immunity is always accompanied by source conditions, including conditional or synergy requirements.
- Public rarity selection uses shared `getObtainableStarLevels`, not roster ownership or imported stat-template availability. Each application must also have at least one obtainable owner star at which shared `isChampionKitSourceAvailableAtRarity` permits it. Selecting a star applies both checks. The champion identity shows its name and class, without a general rarity list. A selected rarity appears once in active filter context and stays on champion/source navigation; material synergy owner/partner stars remain printed at that exact source.
- Detail renders 12 champions at a time. Hash/evidence validation and counts run over this effect's scoped applications; this avoids invalid classifications leaking into counts or pages. The query is scoped rather than hard-truncated, so totals stay correct. It does not fetch the whole champion/effect catalog. Text passages and game synergies are loaded only for the visible champion page, in batches.

## Source navigation and presentation

`findChampionKitAbilityTarget` reuses Kit's native passage matching and yields existing `?tab=abilities&ability=...&chapter=...#ability-record-...` destinations. The target effect name is tried first for resistances, then the original mitigation ability. Missing matches link to Full abilities instead of inventing a record ID.

For each individual synergy application, `buildChampionKitOverviewEffects` and `groupChampionKitSources` reuse Kit's canonical header parser. Owner stars, complete partner-star alternatives and non-stacking requirements remain correlated. Partner names link inline to their exact champion pages. `buildChampionSynergyView` and Kit's matching resolve an exact `?tab=synergies&synergy=...#champion-synergy-...` destination when unique. Ambiguous all-star variants link to the full Synergies tab; choosing a matching star can resolve the exact card. No header is parsed independently by glossary rules.

Reviewed summaries replace source prose only after current hash validation. Unparseable legacy synergy headers retain their full recorded requirements. Unreviewed placeholders/internal audit text are not presented as gameplay descriptions; the page directs the reader to the full source. The stored source is untouched. Champion cards keep direct links to their full source instead of repeating its prose in a Recorded source disclosure. Main champion portraits use the shared champion-class color palette for their border and a subtle background tint, independently of the effect palette. Additional applications use native keyboard-accessible details disclosures. No critical content depends on hover. General provenance appears once under About this catalog.

Ordinary source conditions reuse Kit's `EffectSourceCondition`: the form badge and ability reference sit inside the condition paragraph. Existing source phrases (including Special 2, Charging Heavy and signature) become links in place; when no phrase matches, the reference prefixes the condition. Glossary source destinations and selected rarity remain intact. The shared `SynergySourceBadge` contains compact partner portraits on both pages, with accessible champion names and individual champion links. Synergy names/levels still link to the actual synergy; partner names are not repeated as separate visible chips.

Routes include loading, empty, unmatched, invalid/missing and retryable-error states. Champion search stays inline with a native Filters disclosure on phones and desktop. Advanced class/star/form/direction controls expand only on request; applied filters stay visible outside the disclosure, and search/Apply use the same native GET form. Form controls are keyed by URL scope to reset correctly on in-app navigation. Group caveats are native info disclosures; individual source conditions and parsed owner/partner requirements remain visible. Phone effect cards use compact rows; category navigation is a responsive card grid at every width, with the full effect grid below it. Components and CSS are local to the glossary.

## Focused validation

Four glossary suites are registered in the existing CI command **Verify champion data, UI and Discord rendering**, alongside the existing Discord glossary suite. All preexisting CI coverage, including both attack releases, is retained:

- `web/src/lib/effect-glossary.test.ts`
- `web/src/lib/data/effect-glossary.test.ts`
- `web/src/app/glossary/glossary-views.test.tsx`
- `web/src/app/glossary/glossary-search-form.test.tsx`

Run from the checkout root:

```powershell
pnpm exec vitest run web/src/lib/effect-glossary.test.ts web/src/lib/data/effect-glossary.test.ts web/src/app/glossary/glossary-views.test.tsx web/src/app/glossary/glossary-search-form.test.tsx --maxWorkers=1
```

These cover canonical/invalid IDs, duplicate-name isolation, same-source form/direction matching, separate applications/partners, current vs stale overview and resistance receipts, 100% resistance, conditional immunity, owner-star filtering, public identities, bounded browse reads, count/pagination scope, visible-page text reads, exact synergy navigation, labeled GET forms and unmatched recovery.

Related shared suites also exercised:

```powershell
pnpm exec vitest run web/src/lib/champion-resistance.test.ts web/src/lib/data/champion-resistances.test.ts web/src/lib/champion-kit-source-display.test.ts --maxWorkers=1
```

Scoped lint from `web`:

```powershell
pnpm exec eslint src/app/glossary src/lib/effect-glossary.ts src/lib/effect-glossary.test.ts src/lib/data/effect-glossary.ts src/lib/data/effect-glossary.test.ts --max-warnings=0
```

Scoped TypeScript uses the review-only `temp/effect-glossary/tsconfig.json`, extending `web/tsconfig.json` with incremental disabled and only glossary routes, projections and suites as entrypoints:

```powershell
pnpm exec tsc --project temp/effect-glossary/tsconfig.json --noEmit
git diff --check
```

Full integration preparation also runs `pnpm exec tsc --project web/tsconfig.json --noEmit --incremental false` and the native production `next build --webpack` in this checkout's `web` directory, with own dev server stopped. The ignored local launcher supplies only existing local database/auth configuration; it performs no migrations, imports, source-map publication or release actions. Exact results, local commit/base/main identities and environmental limits are recorded in the preparation handoff under `temp/effect-glossary/preparation/`. Database-write tests are outside this read-only feature's preparation. Root remains responsible for release.

## Local review

Dev server: `http://localhost:3012`, started in this prepared checkout with `node temp/effect-glossary/start.cjs`. The ignored launcher reads the existing local web environment, passes only database/auth provider settings, and does not run migrations, log in or start a game session. Keep that server available for parent review.

Useful URLs:

- `/glossary` — all recorded effects
- `/glossary?category=50` — the real Damage Over Time category
- `/glossary?category=50&page=2` — category-preserving pagination
- `/glossary?q=Bleed` — name/definition search
- `/glossary/706` — Bleed, all source groups
- `/glossary/706?group=RESISTANCE&q=Bastion` — recorded 100% resistance
- `/glossary/706?group=IMMUNITY&q=Black` — Claire's conditional immunity
- `/glossary/837?group=IMMUNITY&q=Absorbing&stars=6` — Poison synergy, exact source navigation
- `/glossary/837?group=IMMUNITY&q=Absorbing&stars=5` — obtainable champion, inapplicable source, empty result
- `/glossary/not-an-id` and `/glossary/2147483647` — invalid and missing records

Actual PNGs and compact screenshot selectors are saved under ignored `temp/effect-glossary/`. The parent handoffs there record exact inspected images, routes, viewport widths and validation results. Browse and representative details were reviewed at 320, 375, 390, 768 and 1280 CSS pixels. Preview is attempted first for each requested browser review; a permitted headless fallback and its exact current failures are recorded when needed. No synthetic screenshots or native browser/game window is used. Data is the existing local public catalog; missing coverage is not proof a champion cannot have an effect.

## Parent integration

Effect glossary discovery is implemented in the actual shared Header, with exact-route/current-state regressions in `web/src/components/Header.test.tsx`. The existing `isCurrent` segment matching highlights `/glossary` and `/glossary/{Ability.id}`, without matching similarly prefixed unrelated routes. Guest access, Account behavior, alliance gates and remembered collection intent are unchanged. Optional future integration can link existing champion Kit effect definitions to `/glossary/{Ability.id}` when that identity is available. Node/game modifier and quest effect IDs are unrelated to these Ability IDs; no unpublished `/nodes` or `/quests` links are added.

Feature files are this document, `web/src/lib/effect-glossary{,.test}.ts`, `web/src/lib/data/effect-glossary{,.test}.ts`, the new `web/src/app/glossary/` route/component/style/test files, `web/src/components/Header{,.test}.tsx`, `docs/ux/site-header.md` and the three suite registrations in `.github/workflows/ci.yml`. All release actions remain with the parent.

## Product layout refinement

The browse header now contains one title, one description and catalog totals. Missing-definition cards use a quiet concise label. Category-count explanations live in About this catalog. Detail removes the repeated group heading and permanent caveat paragraph, places compact champion search and Filters directly after the group controls, and shows a small result count plus an optional About sources/immunity/resistance disclosure. Canonical parsed synergy requirements render owner stars and individual partner alternatives on separate readable lines, retaining every exact star token and OR/AND connector. No projection, database reader, source identity, count or source destination changed in this refinement.

Fresh actual viewport captures and a single-image case selector are under `temp/effect-glossary/refinement/`. The selector keeps phone captures readable at their native widths and lets reviewers pan desktop captures instead of shrinking a whole page into a gallery.

## Canonical color and compact champion polish

The view reuses `getGameEffectColors` on the explicitly bound `GameGlossaryTerm.raw`. The audited local catalog records primary/secondary palettes such as Bleed and Poison `#f71817` / `#fbc6c6`, Fury `#fc9335` / `#ffc3b3`, and Regeneration `#00e13f` / `#cbffd8`. `AbilityCategory` has no color/icon fields, and the Discord command's category/effect colors are container themes. Category membership therefore receives neutral text labels rather than a newly invented palette. Missing effect colors keep the shared neutral fallback, including when another effect with a similar name has colors.

Imported primary colors accent effect artwork frames, browse names/rules and selected detail source-group controls. The secondary palette adds a restrained inner artwork frame; neutral surfaces and lightened primary-derived text keep the interface readable. Shared form/direction/protection labels remain explicit and color-independent. No ability form, direction, polarity or protection is inferred from color. Existing bound artwork is preserved.

Generic obtainable rarity lists are removed from every champion header, including accessibility text. Rarity eligibility and filters still use the complete public domain data. Selected stars appear once in active scope and remain on exact links. Actual synergy owner-star and partner-star conditions stay visible and separate; those are material source requirements and are not converted into guessed ranges. Champion headers now emphasize portrait, name, class and source count; source paragraphs have larger readable type.

Current proof and portable preview: `temp/effect-glossary/color-polish/`. The HTML embeds actual PNG data with inline CSS/JS and offers one native-size viewport at a time. Preview was attempted first; two current snapshot attempts failed with `Preview snapshot failed: Preview automation snapshot timed out after 15000ms.` before the permitted headless Chromium fallback. No native browser window opened. Fresh screenshots cover browse/detail, conditional immunity and resistance at desktop/phone sizes, plus imported Fury color, exact Poison requirements, filters and empty recovery. All owned Preview tabs and headless browser contexts were closed. Full checks and exact current files are recorded in that directory's handoff.
