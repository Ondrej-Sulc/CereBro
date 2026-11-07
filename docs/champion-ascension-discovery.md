# Champion ascension discovery

The crystal catalog has one prominent 7-star Ascension action beside search and champion
stars. It uses the existing `reward=ascension` filter, clears champion-only star
restrictions, and toggles off without losing search or sort. Clear all also clears
Ascension. There is no additional Main pools / All recorded scope switch.

Find a champion has a **7★ Ascension** focus at
`/crystals/champions?champion=gwenom&rarity=7&reward=ascension`. Champion identity, explicit seven-star scope and pagination remain in shareable
URLs and crystal-detail return links. Omitted, invalid and lower-star legacy
Ascension URLs redirect to `rarity=7` before loading, retaining identity, legacy
search, pagination and return context. Normal lookup retains all its star choices.
All sources shows normal champion acquisition plus the complete shared seven-star
Ascension section for an eligible selected identity at omitted/All or explicit 7
stars. Explicit 1-6 normal lookup omits that section; its requested rarity and
complete champion picker are retained. Other recorded
champion acquisition methods remain available under a collapsed disclosure in
Ascension focus. Reviewed ascension methods and shared material paths appear
beside the exact crystal results in the same Ascension sources section.

## Reusable champion eligibility attribute

`@cerebro/core/data/game-ascension` exports server-side
`getChampionAscensionEligibility(gameId)` and `listChampionAscensionEligibility()`.
The first returns `{ ascendableRarities: number[], recordedRarities: number[] }`;
the list adds exact `gameId` and source `name` to each summary. Arrays are descending
and defensive copies of a projection indexed once with the immutable catalog.
No costs, tier lists, resources or blueprint payloads are included.

`ascendableRarities` contains only collectible blueprint paths with `maxLevel > 0`:
non-event rows plus exact reviewed playable-event identities. The sole current
exception is `carina_white_t7` (7-star, max A1); non-collectible six-star Carina
and unreviewed events remain excluded. Both extraction and validation use the
same reviewed classification registry; see the [domain follow-up](champion-ascension-investigation.md#reviewed-playable-event-follow-up-7-november-2026).
`recordedRarities` also includes known empty/no-tier paths. An absent
star is unknown metadata, not evidence that a champion cannot ascend. Neither
global rarity bounds, crystal membership, token rewards nor current owned levels
grant eligibility. The client-safe type `ChampionAscensionEligibility` and predicate
`hasRecordedAscensionPath(eligibility, rarity?)` are exported from
`@cerebro/core/domain/champion-ascension-eligibility`; omitted rarity means any
recorded eligible star. Catalog and roster consumers can reuse this field without
importing the complete game dataset into clients or adding database columns.

The finder attaches both arrays to its existing compact `championOptions` and
selected champion, including collectible identities missing from crystal rewards.
It retains the complete options projection across modes/stars; only Ascension
focus filters choices against canonical positive **seven-star** paths. The star
picker is available only in normal lookup; there is no All-stars ascension mode. Local typed search therefore cannot restore an excluded
choice, and an earlier server response cannot replace the current star filter.
Normal acquisition and the shared ChampionCombobox behavior remain unchanged.

Explicit champion IDs and unique legacy name searches retain their identity even
outside the filter. Known empty paths and missing metadata receive different
explanations and normal-lookup recovery. Hulk remains explicitly selected at 7-star
with a known-empty path, never replaced by another champion or a lower-star path. Ambiguous legacy
search choices and welcome examples respect eligibility. Pending results are
hidden until their champion/star/focus matches the latest navigation. Clearing
removes the champion and legacy search while preserving the current star/focus.
An eligible seven-star champion without crystal bindings remains selectable.
Seven-star sources show reviewed non-crystal methods when present, otherwise a
neutral unverified-material-source statement. Costs retain the exact A1/A2
recipes, including A2 dust and gold. Lower-star canonical data remains available
to exact-rule consumers; it is not projected in these discovery views.

Eligibility retains **3 November 2026** provenance in
`ascensionEligibilityObservedAt`; exact crystal sources retain **5 November 2026**
in `observedAt`. No account unlock, inventory, affordability or current-sale
inference is performed. The source reader below remains independent and unchanged.

Historical verification before the seven-star scope correction on 7 November 2026 passed 130 tests across 11 focused
suites, followed by 27 tests across the three changed eligibility/finder suites
after adding legacy-search recovery coverage. Web TypeScript passed; scoped ESLint
had no errors and six existing test-mock warnings. Browser review used an isolated
tab at 1440px desktop and 375px/320px mobile: supported 7-star Gwenom retained its
exact bonus link, 7-star Hulk retained its unsupported selection and supported-star
recovery, 6-star Hulk remained selectable despite having no recorded source, and
normal lookup retained Gwenom's two crystal families. No horizontal overflow was
observed. Preview navigation was slow and sometimes timed out before completing;
the fallback browser host was unavailable. The owned Preview tab recovered, the
remaining checks completed there, and the tab was closed.

## Shared server reader

The non-crystal reader and reusable presentation are documented in
[Ascension acquisition UI](champion-ascension-acquisition-ui.md) and
[Ascension acquisition data](champion-ascension-acquisition-data.md). The finder
projects only its selected champion in dedicated focus and eligible All/7-star
normal lookup. It does not widen the unselected or lower-star normal payload. The existing lazy
selected-star endpoint adds a separate `acquisition` payload without widening
the crystal reader's source-specific types. No extra eager request is introduced.

`web/src/lib/data/champion-crystal-ascension.ts` exports the synchronous
`getChampionCrystalAscensionSources(gameId, rarity?)` and the result/source types.
Clients import types from `champion-crystal-ascension-types.ts` and receive only a
selected champion's bounded projection. The finder additionally uses the small
`getChampionCrystalAscensionChampions()` server projection to include source-only
champions missing from older membership data.

The reader builds one lazy, server-side index from `listCrystalOpenings` and
`getCrystalOpening`. It does not load complete crystal detail pages per request.
Each returned source preserves the exact crystal ID, category, reward index,
bonus identity in its stable key, quantities, conditions and original autoAscend
flag. Callers receive defensive copies. Published artwork is resolved through
`getRewardArtwork` and `getCrystalPresentation`.

Two kinds remain separate:

- `champion-bonus`: the exact direct hero/First Edition outcome has this champion
  game ID and star, and a bound ascension-material bonus or autoAscend flag. A
  different champion's bonus, or a bonus at another star, cannot establish this
  source. Recording the bonus does not establish player eligibility.
- `champion-token`: a direct inventory outcome is exactly
  `ascension_token_champion_<gameId>`. Its stars come from matching costs in
  `game-ascension`, or an exact `tN:<gameId>` resource usage tag. A token name alone
  never establishes stars. A token reward does not establish a champion drop.

Shared class tokens and dust do not establish a champion-specific crystal source.
Selectors, bundles, nested crystals and preview montages are not expanded into
champion-specific sources. Ordinary Hero/Titan pools remain in normal lookup.

## Evidence and limits

Crystal bindings use the **5 November 2026** opening snapshot; token applicability
uses the independently dated **3 November 2026** ascension snapshot. The older hero
membership snapshot is not evidence for current bonus bindings. No matches means
no source recorded in these snapshots, not impossibility. These records establish
neither individual champion probabilities, current shop stock, guaranteed results
nor personal inventory or ascension eligibility. Details retain exact opening
rules; different source categories/stars are not merged into an assumed result.

The integration audit checked all 1,078 source bindings across 81 champion
identities against their exact opening outcomes and the older ascension paths.
There were no missing or zero-level applicability paths for these current
bindings. Direct-token stars also retain exact cost or resolved usage-tag
evidence. The different observation dates are not a provenance mismatch; neither
snapshot was replaced or relabeled. The exhaustive regression deliberately checks
both current snapshots so a future refresh must review any new disagreement.

## Regression suites

The eligibility change adds
`web/src/lib/data/crystal-finder-eligibility.test.ts`; include this suite in the
explicit CI crystal command. It uses exact shipped rule examples and an injected
newer reward-only identity to keep eligibility independent of reward records.
Existing `src/domain/champion-ascension.test.ts` and
`web/src/app/crystals/crystal-tools.test.tsx` additionally cover the compact
projection, excluded variants, source gaps, draft stars/focus, local search,
clear/reset, stale responses and unsupported explicit/legacy selections.

CI explicitly includes the source reader and binding suites:

- `web/src/lib/data/champion-crystal-ascension.test.ts`
- `web/src/lib/data/champion-crystal-ascension-bindings.test.ts`

The catalog artwork projection/component, champion ascension-source component,
champion source API and two-choice crystal-tools navigation suites are also
included in the existing crystal/acquisition CI commands. The source-component
regressions cover same-star champion changes, out-of-order success and failure,
network retry and removal while an unsupported star is selected. Champion-page
navigation verifies that sources are requested only after How to obtain opens.

Updated existing suites cover loader integration, filter toggling, live search,
sorting, clear/reset, finder focus, exact-source return links, unsupported stars,
direct-token distinction, non-crystal routes and keyboard champion selection:
`web/src/lib/data/crystals.test.ts`,
`web/src/app/crystals/crystal-filters.test.tsx`,
`web/src/app/crystals/crystal-tools.test.tsx`, and
`web/src/lib/crystal-catalog-state.test.ts`. The exact-source return/scroll path
also has coverage in `web/src/app/crystals/crystal-browse-navigation.test.tsx`.

## Historical integration verification, 7 November 2026

The consolidated run passed **298 tests in 44 files** with `--maxWorkers=1`.
It includes the crystal UI, navigation, source APIs, acquisition and ascension
contracts. Full web TypeScript passed using `web/tsconfig.tsbuildinfo`.
The final artwork assertion was additionally verified by rerunning the seven
source-reader tests; these are already part of the consolidated count.
Scoped ESLint passed with zero errors and 19 existing test-mock/unused-field
warnings. The consolidated run also emitted an existing React `act` warning in
the champion-grid suite; no test failures or five-second timeouts occurred.

Browser checks covered the five-artwork catalog and Ascension action on desktop,
the catalog and Adam Warlock finder at 320px, equal-width primary navigation,
exact source links and quantities, and the detail Compare pool action retaining
the selected pool and seven-star filter. Neither primary link was current on
comparison; the detail return link retained `category=main`. No horizontal
overflow was observed in these cases. Review tabs were closed.

Adam Warlock's actual `/champions/adam-warlock?tab=crystals&rarity=7` multi-source
visual check remains incomplete: Preview stalled while streaming the champion
page and timed out; the permitted fallback browser host was unavailable.
The source binding audit and component expansion/distinct-key regressions passed,
but they do not substitute for that visual check. No production behavior or
artwork manifest was changed by the integration review.

## Seven-star discovery scope correction, 7 November 2026

The Finder identity trial retains the existing discovery/navigation contracts:
selected identity is consolidated into the banner (with a quiet Find a champion
label), the picker trigger is name-only in this host, and source jumps are shown
only for rendered sections beside the results heading. Clear restores the
original page title/collage; source-only and unsupported selections retain their
identity and recovery guidance. No new request or persisted preference is added.
See [the trial and validation record](champion-ascension-acquisition-ui.md#finder-identity-trial-2026-11-07).

The finder loader and URL builder normalize `reward=ascension` to explicit
`rarity=7`; saved crystal return URLs receive the same migration. Normal lookup
URLs retain selected lower stars or omitted rarity. Focus transitions retain
champion identity, typed picker search, selected artwork and clear behavior.
Pending responses cannot restore an older focus, champion, or source list.

The shared acquisition component filters generic payloads to seven stars, and
How to obtain omits both the ascension panel and lazy ascension request at lower
selected rarities. Its normal acquisition sources, piece collections, crystal
groups and actual stat/ascension controls retain their separate behavior. The
selected-star API and canonical readers remain general for compatibility.

New CI suite for parent integration (no workflow edit in this task):
`web/src/app/crystals/champions/page.test.tsx` covers redirect migration before
loading, identity/search/return preservation and normal-lookup isolation.
Updated existing suites cover exact-seven picker eligibility and source gaps,
unsupported Hulk, focus transitions, keyboard selection, stale responses,
seven-star A2 dust costs, lower-star request suppression and normal lookup.
Validation and browser observations are recorded with the scope correction in
[Ascension acquisition UI](champion-ascension-acquisition-ui.md); earlier counts
and browser observations above are historical.

## All sources reuse and results layout, 7 November 2026

The complete source renderer now lives in
`web/src/components/champion-ascension-source-content.tsx`; both finder modes and
the lazy champion host consume it. The former finder-specific crystal-source
renderer was removed. Normal source counts stay separate from Ascension-purpose
counts, and full All-sources bindings are independent of normal result pagination.
The assembled finder and champion How to obtain host now each use one closed
**About this data** disclosure for general provenance and dates. Empty crystal
categories and redundant per-fact caveats are omitted; piece conditions, links,
source-specific statuses and the visible A1/A2 recipes remain. See the copy cleanup
validation in the UI document below.

The focused results put material sources immediately below one selected context,
with ordinary acquisition below in a compact disclosure. All sources keeps normal
methods/pieces and pools open before the complete seven-star section. Singleton
cards span the grid; incremental A1/A2 recipe costs are visible separately from
payouts, while evidence and qualifications use progressive disclosures. The
independent November 3/5/7 provenance dates remain available together. Exact host
return links preserve the finder or champion context; source gaps and unsupported
seven-star recovery retain their existing contracts. See the final validation and
screenshot record in [Ascension acquisition UI](champion-ascension-acquisition-ui.md).
