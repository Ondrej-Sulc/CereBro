# Ascension acquisition UI

Implemented 7 November 2026 in the shared working tree. No deployment, database
write, cloud write, commit or PR is part of this change.

## Presentation and shared boundary

Find a champion includes the complete **7-star Ascension** section in All sources
when rarity is omitted/All or explicitly 7 and the selected identity has a canonical
positive seven-star path. Normal acquisition keeps every champion and requested
rarity; explicit 1-6 omits the section. Unsupported identities follow the champion
page policy: omit the section in normal lookup; dedicated focus retains distinct
known-empty/unknown recovery. Source gaps remain selectable. Carina needs no
metadata/database row, keeps max A1 and the exact mastery reward binding.

`web/src/components/champion-ascension-source-content.tsx` is the single complete
presentation used by finder All sources, dedicated focus and lazy champion How to
obtain. It owns the source heading/count, crystal bonus/token rows and expansion.
Hosts assemble general provenance through `champion-acquisition-data-notes.tsx`;
the finder suppresses the nested renderer's disclosure. It accepts a typed selected-champion payload and
an explicit host return URL. Its stylesheet moved from the champion route into
components. The old independent finder crystal-source renderer was removed.

Normal champion crystal membership now uses `compact-crystal-family-grid.tsx`
in both finder and champion How to obtain, with bounded 230px desktop columns,
responsive phone cards and separate exact-opening links. Its optional counts
come only from existing finder summaries; the lean champion payload is unchanged.
This component is independent of the seven-star source renderer: normal singleton
cards stay compact while Ascension method/source rows retain their purpose-specific
layout. Category previews, expansion, full-source search and the single host data
disclosure remain in place.

`crystal-category-layout.tsx` now groups those normal crystal categories in both
hosts: a single flow below 62rem of content width, two columns above it, then
content-sized blocks from 111rem. Agatha's singleton/pair/event/pair groups fit
one row at 1920/2560px while retaining 230px cards. The finder keeps its archive
category filters and pagination around the shared groups. This layout uses only
visible families and does not change Ascension rows, costs, eligibility or data
requests. Native desktop/phone review artifacts are in
`temp/responsive-crystal-review/`.

`champion-ascension-acquisition.tsx` composes reviewed material methods and exact
canonical paths with the crystal content supplied by the complete renderer.
Source payouts appear before recipes. Singleton method and crystal rows span the
available width; multiple rows use two columns on desktop. The seven-star A0-A1
and A1-A2 incremental costs are visible in a separate, compact recipe strip,
with every canonical amount and published artwork, including A2 dust and gold.
On phones the same content stacks naturally. Long path guidance, static definitions,
exact bindings and full citations remain behind native disclosures.

The finder groups champion selection with the focus switch; normal star choices
sit on a subordinate row. One modest selected-context header replaces the large
metric banner. Purpose-specific counts stay with their sections. Focused material
sources immediately follow that header; ordinary champion acquisition follows in
one closed disclosure, with no empty How to obtain shell above it. All sources
keeps normal methods/pieces and crystal pools open, followed by the full Ascension
section, with direct in-page links between acquisition and Ascension.

Method cards keep their operative descriptions, source-specific status, date
window, official link and material payouts visible. Magik's static bundles show
exact contents and recorded purchase limits without merging them with announcement
prices. Blade (Stellar-Forged) keeps its only-Blade fight condition, awakening/A1
versus five-piece acquisition distinction and Activity-dependent status. Its
undated announcement does not establish a deadline or current access; the separate
five-piece acquisition retains its evidenced historical status. Star-scope and
reward/access uncertainties stay in source details; raw capture-gap lists remain
in data/docs. A canonical A2 recipe never implies that an A1 objective awards A2.
Definition-only records do not count as methods. Current stock, upcoming, past
and activity-dependent statuses remain supplied by the reader.

One closed **About this data** disclosure per assembled finder/How to obtain host
holds general current-access limitations and independently dated eligibility/costs
(November 3), crystal rewards (November 5), acquisition review (November 6) and
Ascension source review (November 7). Its default summary contains only the label.
Collection intros, repeated matching-star requirements, game-data footers and
per-card review paragraphs are omitted. Generic store-record caveats remain in
the catalog; exact piece conditions, artwork, activity links and source
classifications stay visible. Empty crystal categories and zero-source badges
are omitted. Source-specific limits remain on cards. A source gap receives neutral
unverified-source messaging, never an assertion that ascension is impossible.

## Copy cleanup validation, 7 November 2026

The six focused finder/navigation, normal-acquisition, crystal-panel, lazy
Ascension-host and material-method suites passed **78 tests** with one worker.
The final screen-reader status adjustment additionally passed the existing
29-test finder suite. These suites already belong to the existing crystal and
champion-acquisition CI commands; no new suite or CI coverage replacement was
introduced. Scoped TypeScript passed; scoped ESLint passed with zero errors,
eight existing fixture warnings and no production warnings. This is scoped
validation, not a full build or repository-wide typecheck.

Reviewed `/crystals/champions?champion=blade_stellar&rarity=7` in an owned Preview
tab. Live DOM checks at 1440×900, 375×1000 and 320×900 verified one closed concise
data disclosure, no quoted redundant copy or empty crystal category, all five
piece links/conditions, the only-Blade challenge and the visible A1/A2 recipes.
Phone checks reported no horizontal overflow. Keyboard Enter opened and closed
About this data; expanded source details retained star-scope/access uncertainty
and the official citation. The shared champion host's single-disclosure behavior
before and after its lazy response is covered by the component regression.

A fresh real desktop PNG was saved and opened:
`C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6chczv-b41cf0d8.png`.
The capture is **1280×800**, despite a requested 1440px viewport; it shows the
five-piece card and start of Ascension, with evidence closed. Other capture
attempts failed with `Preview automation snapshot timed out after 15000ms`;
the fallback reported `The browser access host is unavailable`. Mobile review
therefore remains DOM-only with no new mobile PNG, and no champion-page visual
smoke is claimed. The owned tab was closed.

## Fetching and navigation

`loadCrystalFinder` attaches `ascensionAcquisition` and exact seven-star crystal
bindings only for a selected eligible All/7 identity, or for dedicated focus's
existing recovery contract. The ordinary unselected/lower-star finder gets no new
source payload or request. Server indexes/readers and artwork bindings are reused;
no catalog or local route map is imported into clients. All sources receives the
complete selected-source list independently of ordinary crystal pagination and
initially displays six rows with expansion. Dedicated focus retains 24-row server
pagination and legacy omitted/lower-star migration to seven. Focus navigation
carries identity, search and the current page request; the server bounds pages to
its existing valid range.

The champion wrapper retains eligibility gating, lazy selected-star fetch, abort,
validation, stale-response protection and retry. The generic API/lower-star rules
remain available unchanged. The shared renderer uses explicit return context:
finder All sources returns to the same identity/stars/query/category/page;
dedicated focus retains its own state; champion links return to champion/star/
How to obtain. CrystalIntentLink honors explicit host context and preserves scroll.
No eager per-card or duplicate source request was added.

## Historical verification before the seven-star scope correction

The focused UI integration run passed **103 tests across six suites**:

- New: `web/src/components/champion-ascension-acquisition.test.tsx`
- Updated: `web/src/app/crystals/crystal-tools.test.tsx`
- Updated: `web/src/lib/data/crystals.test.ts`
- Updated: `web/src/app/champions/[slug]/champion-ascension-sources.test.tsx`
- Updated: `web/src/app/champions/[slug]/champion-details-navigation.test.tsx`
- Updated: `web/src/app/api/champions/[slug]/ascension-sources/route.test.ts`

Coverage includes exact selected stars, mixed crystal/non-crystal rendering,
canonical lower-star costs, dated statuses, neutral source gaps, known-empty vs
unknown recovery, stale responses, lazy loading/retry, keyboard combobox selection,
source expansion, direct source links and exact crystal return context. The shared
five-test suite was rerun after the final per-offer evidence label change and
passed. Both changed component suites were then rerun after the final source-count
adjustment: **19 tests passed**. Scoped ESLint passed with zero errors and eight test-mock/unused-field
warnings; the final production component lint passed with zero warnings.

The Carina agent's separately owned full web TypeScript run passed with no
diagnostics and is reused for integration. It preceded the final small display
label/count adjustments; those were covered by scoped lint and component tests.
The UI agent's earlier capped 3GB run
exhausted its heap without diagnostics; that failed attempt is not a type result.
No duplicate full check was launched after the successful shared result.

Browser review verified Magik's finder at 1440px desktop and 375px phone, including
expanded bundle contents, published material art, exact official links and Enter
opening/closing the disclosure. Additional narrow finder checks verified Medusa's
Upcoming November 20 method alongside an A2 recorded cap, Blade's single weekly
Reclamation method with unverified week/claimability, and Hulk's All-stars 6/5/4
dust paths. No horizontal overflow was observed at the measured phone widths.
Preview resize settings sometimes differed from the effective CSS viewport after
navigation; measured narrow viewports included 342px. One finder navigation timed
out but completed before the subsequent DOM check.

The actual Magik How to obtain page initially remained at its server-rendered
loading state for several minutes. It subsequently hydrated and displayed its
reviewed Limbo method, exact recorded path, source status and official link on
desktop and at 375px without overflow; both recovered views were visually inspected. Reading the
real selected-star endpoint in the same browser returned HTTP 200, zero crystals,
the exact 7-star A2 path and the reviewed Limbo method. Preview's slow hydration is
a verification limitation, not a claim about production loading performance.
Owned review tabs were closed.
No CI file is edited by this UI task; the new suite path above is reported for
parent integration.

## Seven-star scope correction verification, 7 November 2026

The finder now labels its focus `7-star Ascension` (rendered with the star glyph),
filters the local combobox to canonical positive seven-star identities, and hides
the normal star picker in that focus. Explicit unsupported identities stay selected
with honest empty/unknown recovery to normal acquisition. Exact crystal returns
carry `rarity=7`, selected identity, focus and pagination. The page redirects old
omitted/lower-star Ascension URLs before loading, retaining query/return context;
normal lookup URLs are unchanged. No generic reader or lower-star game data was
removed. The endpoint's exact lower-star compatibility tests still pass.

The material cost disclosure now renders exact seven-star cost items with their
published artwork. Magik's A2 includes 100,000 Gold, 500 Tier 2 Primordial Dust,
10 Mystic Ascension Tokens and 2 Magik Ascension Tokens. Source payouts and recipe
costs remain separate. Carina retains only A1 and her exact mastery reward binding.
Reviewed methods, static-definition exclusions, dates/statuses, conditional crystal
bonuses, source counts and links continue to come from the same evidence readers.
A small mobile flex-sizing fix keeps normal acquisition titles readable when a
source status badge wraps; normal acquisition data and behavior are unchanged.

Final focused validation covers **141 unique tests across 13 suites**. The grouped
run passed 140 tests and exposed one obsolete Carina lower-focus assertion; after
updating that assertion for URL normalization, the Carina suite passed separately.
No full web TypeScript or build was launched. A temporary scoped TypeScript project
covering the finder/loader, URL helpers, source/acquisition components, page and
affected focused tests passed with a 3GB heap limit. Scoped ESLint passed with
zero errors and eight existing test-mock/unused-field warnings.

Suites used for this task (only the page suite is new for CI registration):

- `web/src/app/crystals/champions/page.test.tsx` (new, 8 tests)
- `web/src/app/crystals/crystal-tools.test.tsx`
- `web/src/lib/crystal-catalog-state.test.ts`
- `web/src/lib/data/crystals.test.ts`
- `web/src/lib/data/crystal-finder-eligibility.test.ts`
- `web/src/lib/data/carina-ascension-eligibility.test.ts`
- `web/src/app/champions/[slug]/champion-acquisition-panel.test.tsx`
- `web/src/app/champions/[slug]/champion-ascension-sources.test.tsx`
- `web/src/app/champions/[slug]/champion-details-navigation.test.tsx`
- `web/src/app/api/champions/[slug]/ascension-sources/route.test.ts`
- `web/src/components/champion-ascension-acquisition.test.tsx`
- `web/src/lib/data/champion-ascension-acquisition.test.ts`
- `src/data/champion-ascension-acquisition/index.test.ts`

Actual Preview observations: Magik's legacy six-star finder focus redirected to
explicit seven-star focus; the desktop finder at 1280px and mobile finder at
375px showed only the seven-star path and retained Limbo's stock uncertainty.
Expanded A1/A2 costs retained token/dust/gold values and artwork without horizontal
overflow. The actual How to obtain page showed its seven-star ascension panel at
1440px and 375px. Its corrected normal-acquisition title wrapped in two lines at
375px. A direct six-star How to obtain visit showed the normal Navigator crystal
source, no ascension panel and zero `ascension-sources` entries in that document's
resource timing list; its measured viewport was 342px despite the 375px setting.
No horizontal overflow was measured in these cases. The owned tab was closed.

Hulk recovery, source-gap picker selection, keyboard interactions, stale-response
ordering, complete lower-star request suppression and generic API compatibility
were verified by tests, not repeated exhaustively in the browser. Preview's CSS
viewport sometimes lagged its resize setting; dimensions above are measured
values. No CI, deployment, database/cloud write or fresh game capture was made.

## Final All sources and visual-pass validation, 7 November 2026

- 216 tests passed across 20 existing suites with one worker. This includes both
  recently registered finder-page and seven-star-browse suites. Added regressions
  cover All/default and explicit 7 shared content, normal explicit 1-6 isolation,
  the complete 33-binding projection independent of ordinary pagination, source
  gaps, reward-only unsupported identities, database-free Carina, all host return
  contexts/scroll, focus/search/page transitions, stale selected identity, source
  ordering, visible recipes and reward previews. The last component recheck also
  covers the final nullable-date handling and disclosure arrangement.
- Scoped TypeScript passed with a 3GB heap cap, 30 explicit production/test/ambient
  entry files plus their transitive imports. The first post-layout check caught
  nullable eligibility dates in the new disclosures; rendering unknown dates
  explicitly fixed those diagnostics. No broad build/full-web check is claimed.
- Scoped ESLint passed across 26 files: zero errors, 22 existing test-fixture
  warnings, zero production warnings. No new suite or CI command is needed;
  every suite already occurs in the existing workflow. The two recent CI
  registrations remain present once each. This task did not edit the workflow.

Runnable manifests, scoped config and JSON results are in ignored
`temp/finder-all-ascension/`. Unrelated dirty/untracked work was preserved. There
was no commit, PR, deployment, database/cloud write, game capture or product asset.
Browser PNGs below are explicitly requested review screenshots of localhost.

The real Preview review inspected Blade (Stellar-Forged)'s challenge, Magik's
exchange and Gwenom's exact crystal bonus in normal All sources and/or focused
contexts, plus the actual lazy Gwenom How to obtain host. Desktop source cards
appear about 123 CSS pixels below Blade's selected header; singleton cards use
the full width. Tablet layouts and measured 375/320 CSS-pixel phone widths show
wrapped status/actions and no horizontal overflow. Enter/Space operate native
source, path and provenance disclosures with a visible focus outline. Adam
Warlock's 33 sources expand from six rows and collapse with keyboard activation.
The exact Broken Justice source link carries the normal finder return context;
its detail page displays Back to champion search. Champion source links retain
`/champions/gwenom?rarity=7&tab=crystals` and the selected-star endpoint returned HTTP 200. The dev browser
recorded an aborted/replayed lazy request plus the completed request during
hydration/HMR; the existing host cancellation behavior and one-request normal
mount remain covered by component tests. The shared renderer adds no fetch. No prior screenshots are being reused as evidence for this edit.

Preview sometimes reports the preceding viewport until the next snapshot and
scales captured PNGs; reviewed CSS widths were measured in the page. Shared Next
compilation/hydration made some navigation slow, including a 20-second champion
navigation timeout that subsequently completed and hydrated successfully. These
checks establish the observed layouts/interactions, not production performance
or live stock/claimability. Source dates remain independently attributed.


Final real localhost screenshots (CSS widths; PNGs may be scaled by Preview):

| View | Width | State | PNG |
| --- | --- | --- | --- |
| [/crystals/champions?champion=blade_stellar&rarity=7&reward=ascension](http://localhost:3000/crystals/champions?champion=blade_stellar&rarity=7&reward=ascension) | 1440px | Focused challenge; evidence closed | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6bd0sm-709f6128.png) |
| [/crystals/champions?champion=blade_stellar&rarity=7&reward=ascension](http://localhost:3000/crystals/champions?champion=blade_stellar&rarity=7&reward=ascension) | 375px | Focused challenge; visible A1/A2 costs | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6bdizb-9624e7c2.png) |
| [/crystals/champions?champion=magik&rarity=7](http://localhost:3000/crystals/champions?champion=magik&rarity=7) | 1440px | All sources; ordinary acquisition and full Ascension; evidence open | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6bexvo-789eaeb3.png) |
| [/crystals/champions?champion=magik&rarity=7](http://localhost:3000/crystals/champions?champion=magik&rarity=7) | 375px | All sources; exchange, costs and evidence open | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6b46tg-f1e5323c.png) |
| [/crystals/champions?champion=gwenom](http://localhost:3000/crystals/champions?champion=gwenom) | 1440px | All stars normal crystal acquisition plus exact seven-star bonus | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6b5ytj-2f3b178f.png) |
| [/crystals/champions?champion=gwenom](http://localhost:3000/crystals/champions?champion=gwenom) | 375px | All sources, omitted rarity; ordinary six-star crystals and full seven-star section | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6be6ww-eb310e34.png) |
| [/champions/gwenom?rarity=7&tab=crystals](http://localhost:3000/champions/gwenom?rarity=7&tab=crystals) | 1440px | Lazy How to obtain, selected seven-star variant | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6bbh7f-67df3046.png) |
| [/champions/gwenom?rarity=7&tab=crystals](http://localhost:3000/champions/gwenom?rarity=7&tab=crystals) | 375px | Lazy How to obtain, selected seven-star variant | [Screenshot](C:/Users/ossul/.t3/userdata/browser-artifacts/browser-screenshot-localhost-mw6bbyvo-989b022e.png) |

Additional exact states and viewport/interaction caveats are recorded in
`temp/finder-all-ascension/browser-review.json`. The owned Preview tab was closed.

## Finder identity trial (2026-11-07)

The selected champion now owns the Finder banner heading, with the selected stars,
one existing portrait and a View champion link to the loader's exact profile/star
route. A quiet Find a champion label preserves the page identity, alongside the
existing breadcrumb and attached Browse crystals / Find a champion navigation.
Clearing restores the original Find a champion H1 and curated portrait collage.
Source-only entries keep their verified name and neutral crystal decoration;
they do not acquire an invented profile link. Unresolved IDs finish with Champion
not found and the existing recovery guidance.

The draft selection drives the heading. The existing artwork consistency module
now shares `finderIdentityForSelection` between portrait and server identity
resolution. Names can immediately come from the existing picker projection;
an older response cannot restore another champion's name or portrait. Profile
links wait for the matching champion and star projection. No extra data request,
selection state, catalog payload or persisted preference was added.

Finder opts into `ChampionCombobox.showSelectedPortrait={false}`. Its default is
true, and dropdown options always retain portraits and class colors. The clear
control also has an accessible name, keyboard Enter/Space handling and a visible
focus outline. The lower identity row and Change champion button are removed.
View champion lives in the banner; acquisition/Ascension jumps sit beside a small
Sources heading only when both sections actually render. A single visible source
section needs no duplicate jump. The intro/result gap is smaller. Existing
category grouping, bounded family cards, seven-star normalization, source content,
pagination, return context and one collapsed About this data remain intact.

Validation: 152 tests passed in 13 existing suites with `--maxWorkers=1`.
New assertions live in the already-registered `crystal-tools.test.tsx` and
`crystal-finder-artwork.test.ts`; CI commands and coverage were preserved without
adding a job. The runnable suite manifest and command are
`temp/finder-identity-trial/suites.json` and `run-tests.ps1`. Scoped TypeScript
passed with a 3GB heap cap and ten explicit production/test/ambient entry files
plus transitive imports (`tsconfig.json`, empty `tsc.log`). Scoped ESLint passed
for five TS/TSX files: zero errors, six existing fixture warnings, zero production
warnings (`eslint.json`). No full web typecheck/build or hosted CI run is claimed.

The real localhost browser review measured 1280, 768, 375 and 320 CSS pixels for
Agatha at seven stars, Blade (Stellar-Forged), and the source-only
`antivenomoid_cosmic` fallback. These states had no horizontal overflow. Selected
identity uses one portrait; source-only identity uses none. The compact Sources
row begins about 23-26 CSS pixels after the filter panel. Normal All sources,
focused Ascension, clear, exact profile routes and click source jumps were
observed. Late-response and simulated broken-image behavior are covered by tests.

Accepted PNGs were opened and visually inspected, including dimensions and text
legibility. They are local review artifacts, not new product assets:

| File in `temp/finder-identity-trial/` | CSS viewport | State / URL |
| --- | --- | --- |
| `desktop.png` (1280 x 1000 PNG) | 1280 x 1000 | `/crystals/champions?champion=agathaharkness&rarity=7`, All sources |
| `phone.png` (375 x 1000 PNG) | 375 x 1000 | Same Agatha All sources state |
| `focused.png` (375 x 1000 PNG) | 375 x 1000 | Same selection with `&reward=ascension` |
| `long320.png` (320 x 1000 PNG) | 320 x 1000 | `?champion=blade_stellar&rarity=7` |
| `sourceOnly320.png` (320 x 1000 PNG) | 320 x 1000 | `?champion=antivenomoid_cosmic&rarity=7` |
| `unselected.png` (1280 x 889 PNG, scaled by Preview) | 1440 x 1000 | `/crystals/champions`, All stars |

Preview sometimes reports a scaled viewport until a snapshot; recorded CSS widths
were measured inside the page. Initial Agatha All-stars Enter selection and a
later Hulk seven-star Enter selection succeeded. Repeated key/focus delivery was
intermittent, including wait timeouts; the CUA fallback reported "The browser
access host is unavailable". The live keyboard clear/jump recheck is therefore
inconclusive, while component keyboard-selection and Enter-clear assertions pass.
The failed automation observations are not used as screenshot evidence. Details
are in `browser-review.json`; the owned Preview tab was closed. There was no
commit, PR, deployment, database/cloud write, game capture or asset generation.

The change is a reversible presentation trial. A patch against the exact dirty
tree at task start is saved as `temp/finder-identity-trial/trial-only.patch` for
review; do not restore whole files over subsequent shared work.

## Finder polish follow-up (2026-11-07)

Selected banners now measure 160px at 1024/1280/1440/1920 CSS pixels, with one
120px portrait, readable name/stars, context label and exact profile action.
The unselected collage keeps its established composition. Controls use available
panel width: picker, stars and source mode share one desktop row; at 768px the
picker sits above stars/mode, and phones stack them. Focused Ascension has no
reserved star column. Agatha's first result heading starts at about y=491 at
1280px (previously y=660). No data projection, request or source fact changed.

The generic Sources row is removed. Valid jumps belong to the first actual
heading: Crystal pools, How to obtain, or focused 7★ Ascension sources. One
section needs no jump toolbar. Jumps preserve fragments and move focus to the
destination; acquisition details open and focus their summary. Explicit history
and scroll handling avoids Chromium resetting summary focus during native
fragment navigation. The shared source renderer adds optional heading actions
and an h2 level for Finder; champion hosts retain their default h3 and fetching.

Combined validation passed 205 tests in 18 suites with one worker; a final
47-test Finder rerun covers the subsequent fragment-history integration fix.
Combined scoped TypeScript passed with a 3GB heap; scoped ESLint passed with no
errors and seven existing fixture warnings (zero production warnings). The new
`web/src/components/compact-crystal-family-grid.test.tsx` suite is registered once
in the existing matching CI command; all prior registrations/quoting/jobs remain.
No full web build/typecheck or hosted CI run is claimed.

Fresh real localhost review measured 1280/1440/1920, 1024/768, 375/320 widths:
Agatha seven-star All sources/focus/clear, Blade and source-only Anti-Venomoid at
320px. No page overflow was measured. Click and keyboard clear, typed Enter
selection, Escape, visible Tab focus, exact profile navigation and source jumps
were observed. Enter selected Agatha but left the dropdown reopened once; Escape
closed it. This does not establish consistently automatic popup dismissal.
Preview navigation timed out during shared compilation/HMR, then settled; stale
refs were refreshed. Crystal-detail return scroll restoration remains unverified
live, with semantic saving/context coverage passing.

Accepted raw PNGs were opened and dimensions checked in `temp/finder-polish/`:
`desktop.png` (1280×1000), `phone.png` (375×1000), `focused-phone.png` (375×1000),
`long320.png` and `sourceOnly320.png` (320×1000), plus `unselected.png`.
The runnable suite list, scoped config, test/lint JSON, measured browser states
and patch against this task's initial dirty files are in the same directory.
The owned Preview tab was closed. No commits, PRs, deployment, cloud/database
writes, game capture or product assets were made; unrelated shared work remains.
