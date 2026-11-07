# Reviewed non-crystal ascension acquisition data

This data layer implements the evidence dispositions in the completed
[acquisition audit](ascension-acquisition-source-audit.md) and
[eligibility audit](ascension-eligibility-confidence-audit.md), reviewed
**7 November 2026**. It does not establish live coverage or player access.

## Stable selected-champion API

The synchronous server reader is
`getChampionAscensionAcquisitionSources(gameId: string, rarity?: number, asOf?: string)`.
Bot/server consumers import it from
`@cerebro/core/data/champion-ascension-acquisition`. Web server consumers import
`web/src/lib/data/champion-ascension-acquisition.ts`; that wrapper adds exact
metadata names and already-published artwork. Clients import types only from
`web/src/lib/data/champion-ascension-acquisition-types.ts`.

```ts
const sources = getChampionAscensionAcquisitionSources("magik", 7, "2026-11-07")
// {
//   gameId: "magik", reviewedAt: "2026-11-07", evaluatedAsOf: "2026-11-07",
//   accountStatus: "unverified",
//   paths: [{ rarity: 7, state: "recorded_path", blueprintId: "magik_t7",
//     maxLevel: 2, materialKind: "champion_specific", observedAt, steps, guidance,
//     materialFinderHref }],
//   routes: [{ id: "magik-limbo", gameId: "magik", rarity: 7,
//     availability: "current_stock_unverified",
//     periodStatus: "start_passed_end_unknown", window, conditions,
//     missingEvidence, offers, sources, ... }],
//   definitions: []
// }
```

The full DTO is in
`src/domain/champion-ascension-acquisition-types.ts`. Omitted rarity returns
seven explicitly associated path rows, descending 7–1. A selected rarity returns
exactly one path row. `recorded_empty` has a canonical blueprint and max zero;
`unknown` has no blueprint and max null. Neither becomes eligible from a route.
Routes always preserve exact game ID and star; the reviewed mechanism schema is
currently seven-star only. The reader rejects invalid stars and reference dates.

`paths[].steps[].costs` comes directly from the selected canonical blueprint,
with incremental costs per ascension level. It does not duplicate generic dust
tables. Lower-star paths use shared materials, so absence of a personal-token
route is expected. The wrapper names `res/sc` Gold using the existing shared
reward display rule. Missing metadata, including Medusa's token display name,
stays null. Artwork resolves exact reward type/ID through the published manifest;
missing art is null. No artwork is generated or uploaded.

The material link is `/crystals?reward=ascension`. The current browse search
matches crystal names/source IDs, not exact reward IDs; a dust-ID query would
hide valid shared-material sources. The generic link therefore remains until
reward-specific search exists. It does not promise a named champion token.

## Catalog boundaries and evidence

`src/data/champion-ascension-acquisition/catalog.json` contains **29 evidence
records**: the audit's **26 published/scheduled mechanism dispositions**, two
definition-only dispositions, and one separately guarded Carina quest record.
These are not 26 complete routes or 26 live offers. The 26 mechanisms cover the
audited exchanges, challenges, historical sale, future Medusa offer, Magneto
announcement and nine weekly Reclamation champions. The original audit's
112/81/31 join remains a dated pre-Carina scope result, not a new live metric.

There are **19 citation/provenance sources**, including the official forum
announcement and Kabam-published summaries credited to Ackbar67. Publication
dates, publisher, credited author, review date, original public URLs and game
file hashes survive into selected route DTOs. Date-only publication metadata is
retained as a date; the Thor forum publication date remains null. Blade's May 29
summary was published June 1. Reviews and captures do not refresh availability.

All **22 exact static GameStore definitions** from the audit are retained as
offer evidence. Bindings retain decoded registry path, array index, exact
`Name` and `Redeemers` field. Rewards retain exact type, ID and quantity; `hero`
rewards are separately marked `champion`, while tokens/dust are
`ascension_material`. Rank-up gems are `other`. Gate counters (`gsi/v4b`, other
purchase markers and refresh instructions) are excluded from material rewards.
Static purchase limits describe definition limits, not remaining account stock.

The pinned store file is `5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin`, SHA-256
`1b56c68c34813a40647a559f4e3b130cd26f080d2ffd063c9db417ac97603c55`.
Its `fileModifiedAt` is filesystem provenance, not an observation or offer start.
The audited decoded registry hash is
`8c172594c08e11a326d816d4f4bbc6c352d318b789fb1848c68369e2adfe5cdd`.
Ignored research captures are useful reproduction aids; they are not runtime
inputs. The checked-in subset is the durable input and must be reviewed when
source evidence changes.

Each offer has one `sourceId`. Published price records and static pack contents
remain separate evidence versions. In particular Chavez's older 50 Action
Figure exchange has one Mystic token; the November static pack has five and
**no verified price**. Magik's announced 10/15 Limbo Token prices likewise have
their own official price rows, alongside exact static content rows. Thor's
50 Observance initial champion price is not assigned to an ascension bundle.
Doom's ordinary champion-acquisition currency is not an ascension recipe.

`requiredTokenIds` identifies canonical upgrade costs; it is never an objective
payout. Challenges and Reclamation rows have no invented reward tuples. Only
independently established item quantities appear in `offers[].rewards`.
Medusa's announced five champion tokens are retained without an inferred price,
end date or A3 recipe. Neither her A3 announcement nor Doom's A3/A4 rewards
changes the canonical caps. Victorious offers preserve the two-purchase limits
and milestone gates without inventing the missing initial champion/A1 grant or
a complete A0-to-A2 budget. Reclamation records never assign a champion to a
week or claim that all nine can be earned simultaneously.

Arnim Zola and Sigil Witch static evidence is returned only in `definitions`,
with `definition_only` confidence/status. Cable, original Deadpool and Scream
have no verified route rows. Names, cosmetics, normal champion acquisition,
enabled flags, unresolved selectors and community discussion are insufficient
to add one. Classic Witch and other same-name variants remain isolated.

## Date and availability evaluation

`asOf` accepts an ISO date or an ISO timestamp with offset; the default is the
current clock. Timestamp references normalize to UTC. Date-only windows compare
calendar dates against that reference's UTC calendar date without assigning a
timezone or midnight timestamp to the source. Their end day is inclusive; exact
timestamp end boundaries are exclusive. A date-only reference acts as UTC
midnight when compared with an exact timestamp window. Retained `window` values
and `timeZone` communicate source precision independently of status evaluation.

`periodStatus` distinguishes `past`, `upcoming`, `within_announced_period`,
`start_passed_end_unknown` and `not_dated`. A passed start with unknown end never
becomes an active window. Historical activity evidence can be marked past
without inventing its exact end date. The Spider-Ham sale retains exact
June 26/July 6 11 AM Pacific timestamps; Magneto's dates retain unspecified time
and timezone. Medusa's November 20 start has no inferred end. Maestro's First
Appearance deadline does not expire his ascension rewards. Shuri's coarse
November–January and Reclamation's unbound multiweek schedules remain text,
without invented endpoints.

`availability` distinguishes historical, upcoming, activity-dependent,
current-stock-unverified and definition-only evidence. No state means available
now. A future dated record becomes `upcoming`; after an unknown end it remains
activity-dependent. Neither a start date, review date, enabled static bundle nor
canonical path proves stock. Independent player unlocks, progression gates,
inventory, affordability and server acceptance remain unverified for every row.

## Exact Carina guard

The Carina source is emitted only if the canonical reader independently returns
`carina_white_t7`, max A1, one step, and the exact same two quantities as the
mastery reward: one `inv/ascension_token_champion_carina_white` and one
`inv/ascension_token_class_cosmic`. No eligibility is synthesized here.
Six-star Carina, event NPCs and other variants do not acquire this route.

Its single binding is `epilogue_ch04_q04.masteryCompletionRewards`, captured
`2026-11-05T06:49:32.001200+00:00` in `runtime-home-validated.json`, SHA-256
`ebe5e7f2d5fbc759dbeb08d30ca174c7941c13ae4e2c81f545fb0b97c7694aa3`.
Minimum and maximum reward quantities are each one. The quest summary repeats
the same grant; it is not included as an additional source/payout. Current access
and personal completion remain unverified.

## Validation, tests and integration ownership

The domain schema is strict: unique identities/references, official URL hosts,
publisher/summary attribution, hash/filename provenance, exact token/champion
identity, reward roles, positive quantities, ordered windows and source-bound
offers are checked. Static evidence cannot claim a price. Definition-only
records cannot enter the obtainable-method array. The immutable parsed catalog
is indexed once per server process; every result is a deep defensive copy.
Clients receive one selected champion, never the catalog. Tests bound the
representative selected payload to 16 KB, including evidence and all-star paths.

New suites for parent CI integration (no workflow changes in this task):

- `src/domain/champion-ascension-acquisition.test.ts`
- `src/data/champion-ascension-acquisition/index.test.ts`
- `web/src/lib/data/champion-ascension-acquisition.test.ts`

Run those suites with Vitest and `--maxWorkers=1`. They cover exact identity/star
isolation, unknown versus empty, all-star association, all 26 dispositions and
22 static bindings, lower-star canonical recipes, five unresolved cases,
quantity/source boundaries, precise/undated/future periods, Carina's canonical
guard, defensive copies and published artwork projection. Existing crystal
reader behavior, rates, source binding rules and token distinctions are
unchanged. Finder/page/endpoint wiring and UI verification belong to the separate
integration task; this document claims only the data layer.

Verification: the three new suites passed **16 tests**; the root TypeScript
check passed, followed by a focused core TypeScript check covering the final
data/domain files and tests. A separate read-only comparison against the independent research
capture confirmed every one of the 22 static offers' reward tuples, limits and
paths. The canonical-fix agent also confirmed a successful full web TypeScript
check of the shared integration snapshot. No duplicate full web check was
started here. Production/UI verification remains owned by the integration task.
