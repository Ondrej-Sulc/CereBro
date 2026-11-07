# Champion acquisition sources

Champion pages label the existing `tab=crystals` destination **How to obtain**.
It shows reviewed acquisition methods above the existing crystal pools. Rarity,
build controls, old links, crystal grouping and on-demand archive loading remain
independent of the new records.

Ascension materials now have a separate **Ascension sources** section in How to
obtain and the finder's Ascension focus. It reuses reviewed, star-specific data
for event/quest/challenge/exchange methods and canonical shared-material costs.
Champion piece collection and champion purchase records are not ascension
objectives. See [Ascension acquisition UI](champion-ascension-acquisition-ui.md)
for the presentation, lazy endpoint, uncertainty labels and regression suites.

## Evidence and coverage

`src/data/champion-acquisition/catalog.json` is an editorial catalog reviewed on
6 November 2026. Its 43 methods cover 29 champions, including the 16 flagged in the initial
no-direct-crystal audit: Dark Phoenix, Maestro, Carina Tivan, Scarlet Witch
(Sigil), Summoned Symbiote, the four piece-assembled Deathless champions, the
three imported Stellar-Forged champions and the four Victorious variants. Deathless
Thanos was added after reviewing a misleading same-name crystal definition.

The initial audit selected whole champions with no direct crystal records. That
missed a champion whose lower stars had crystal entries but whose higher star
needed another acquisition route. The replacement audit evaluates every
champion/star pair independently. Added routes include 7-star Vision and the
other Banquet trophy-selector champions, Absorbing Man and Kingpin's original
2025 Realm selector, the CCP selector for Masacre and the two Spider-Men,
Magik's Limbo Token exchange, and 5/6-star Unstoppable Colossus store purchases.

Vision's 7-star selector is distinct from a direct champion-pool entry. Kabam
lists the Trophy selector in historical Banquet ranked rewards and among
possible Jubilant Crystal outcomes. A nested selector is not flattened into
direct crystal membership; the separate route explains that relationship.

The catalog uses exact game identities and explicit rarity bindings. It does not
infer a route from a champion's name, theme, imported stats, obtainable flags or
absence from crystals. For example, Dark Phoenix has reviewed 6/7-star event
records, while the Victorious vouchers establish only 7-star claims. Unsupported
stars retain neutral missing-evidence copy. Raw crystal membership and probabilities
are not modified, and the catalog is not an exhaustive list of acquisition routes.

Evidence comes from linked announcements, the published Sigil Store reward table,
Kabam's published livestream summaries, and exact GameStore item
descriptions. Game-item evidence retains the source filename/SHA-256, registry ID
and original description. Those descriptions directly establish separate 6/7-star
piece collections, five-item exchanges and 7-star Victorious vouchers; they do not
prove current stock or tell us every activity that awards a piece or voucher.
Where known, a separate official announcement links to that activity.

## Piece collections

The seven existing Deathless and Stellar-Forged collection routes now include
their five exact inventory items at each star level: 70 piece records across
14 matching-star collections. Names and artwork come from the reviewed GameStore
registry, including distinct 6-star and 7-star pixels. The shared reward-artwork
manifest holds the original references, image hashes and immutable bucket URLs.

Each piece has its own evidence-backed source description. Past events and mail
gifts are labeled separately from quest rewards and store records. These are
historical acquisition records, without a current-stock assertion. A timed
objective does not become permanent just because its underlying quest remains
in the game: the original Crucible/Vision and Act 9.4/Blade objectives retain
their historical labels.

Sources are recorded for 68 of the 70 items. Two exact original locations
remain unverified: 6-star Scarlet Visage and Opening Arguments.
Their artwork and item identities are still shown;
the UI explicitly says **Source unverified**. Knowing that a chase included
an activity does not by itself establish which exact item it awarded. Kabam's
Revenge of Legends and Battlegrounds Season 42 announcements explicitly name
Pumpkin Bomb and Hip Bag, respectively, resolving those two earlier gaps.

The November 6 source audit replaced 14 existing URLs with original publications
or their canonical announcement pages. With the star-specific follow-up, 27 of 35 linked sources are Kabam
announcements or Kabam-published stream summaries. Eight remaining sources are
explicitly labeled community discussions, archived screenshots or a gameplay
guide. An official forum hostname does not establish Kabam authorship.
Every URL requires a reviewed source classification; official classifications
also require Kabam author/publisher metadata. The panel shows the classification
and descriptive source title instead of generic **View source** links. Piece
links retain the activity name and show their evidence classification alongside it.

`src/data/champion-acquisition/source-review.json` records the reviewed URLs,
previous destinations, classifications, supporting scope and remaining community
fallbacks. Where recovered through Kabam's public WordPress API, the record also
retains the article ID, publication timestamp and content hash. Public links
point to the normal announcement page, not the API. General mode announcements
are not substituted for item-specific evidence when they do not establish the
piece, star level or original objective.

### Repeatable coverage audit

Run `pnpm audit:champion-acquisition <output.json>` from the repository root.
The script reads public champion metadata and imported stat rarities from the
database, then joins the existing reviewed acquisition and crystal readers.
It performs no database writes. Without an output path it prints the report.

The audit considers every valid star in a playable champion's obtainable
metadata, even when stats are missing. Each variant without direct crystals
retains its own matching-star method IDs, other crystal stars and imported-stat
flag. A stat template absent from obtainable metadata is excluded. Metadata is
an audit candidate, not independent evidence that a star was released.

`coverage-review.json` captures the November 6 result: 339 champions and 1,914
metadata variants, of which 1,864 have imported stats. Ninety variants lack
recorded direct crystal rewards; 38 have reviewed acquisition routes and 52
still need evidence or metadata review. Twenty-five of those 90 also lack
imported stats. The report preserves all unresolved cases rather than borrowing
a lower star's source or claiming the variant is unobtainable. For example,
7-star Captain America (WWII) and Morningstar remain unverified acquisition
candidates. The report is bound to the champion metadata, crystal source and
acquisition catalog hashes and must be regenerated after updates.

`piece-artwork.json` is a lightweight server projection of the shared reward
manifest. It keeps the complete crystal/reward registries out of champion-page
imports. Only the selected champion's methods and image URLs reach the client;
piece images load lazily. Validation ties each projected image to an exact
GameStore item, matching source hash, artwork role and published content hash.
No crystal membership or probabilities change when adding a collection image.

The Sigil announcement's embedded reward table was reviewed for 4/5/6/7-star
unlock tiers. Prices are deliberately not presented as current prices. Dark
Phoenix's Heart of Fire window comes from the official May 2025 announcement;
Summoned Symbiote's dated mail giveaway is the 2023 Sugar Crash event.

### Deathless Thanos review

Kabam's January 3, 2025 **Deathless Mausoleum** announcement records two difficulties, four
Deathless paths and Thanos as the exploration reward. The existing captured game
response `temp/quest-data-investigation/game-only/runtime-home-validated.json`
(SHA-256 `ebe5e7f2d5fbc759dbeb08d30ca174c7941c13ae4e2c81f545fb0b97c7694aa3`)
independently establishes the exact bindings:

- `me_mausoleum_ch01_q01` (Normal): `masteryCompletionRewards` contains
  `thanos_deathless_trophy_t6`; allowed champions are Deathless at 6 or 7 stars.
- `me_mausoleum_ch01_q02` (Hard): `masteryCompletionRewards` contains
  `thanos_deathless_trophy_t7`; allowed champions are Deathless at 7 stars only.

Neither first-completion reward list contains the champion. This is the initial
acquisition route, separate from awakening challenges. The official announcement
also establishes the Conqueror and Summoner level 40 entry requirements, which
are included in both methods. The public source link goes directly to that
announcement and is labeled **Kabam announcement**.

The raw crystal `jessies_crystal` includes 7-star Deathless Thanos but shares the
standard 7-Star Hero Crystal name and artwork despite different rewards. The
actual `7_star_hero_shard_crystal` does not include him. No player-accessible
source for `jessies_crystal` has been verified; its intended use is unknown.
`src/data/game-crystals/availability.ts` records this exact editorial exception.
The champion page and crystal finder omit it from acquisition suggestions;
recorded browse, detail and manually linked comparisons retain it with an
availability notice. Other historical crystals remain eligible. No exclusion
is inferred from dates, names, multipliers or other common game metadata.

## Availability and presentation

- Dated events have complete, ordered UTC start/end timestamps. The server
  derives Past event, Upcoming event or Event window for the page response;
  client hydration does not recompute that status against another clock.
- Quest progression, source-dependent pieces/vouchers and store access are
  distinct. No method displays an Available now assertion.
- Review dates describe evidence review, not a release date or a live-store poll.
- Methods follow the selected stars. An empty crystal list stays visible as a
  compact statement, alongside any reviewed non-crystal route.

The server reader validates and freezes the catalog once, then returns only one
champion's methods and display evidence. Raw game-item descriptions, source file
identities and hashes stay on the server. No additional client fetch is needed.
The acquisition panel does not receive the entire catalog or import it directly.

On Windows, write edited catalog text as UTF-8 files rather than piping literal
non-ASCII text through PowerShell's default stdin encoding. A previous edit turned
middle-dot separators into literal question marks. The catalog display-text check
rejects that separator corruption and Unicode replacement characters.

## Updating

Add an evidence source and a method with a unique ID, exact game ID, verified
rarities, acquisition kind, concise description and requirements. Use a dated
window only when both boundaries are established. Otherwise use progression,
source-dependent or store-access semantics. Keep evidence for different star
levels separate when the requirements differ. Update review dates after checking
the announcement or matching GameStore bytes; do not derive acquisition claims
from enabling flags or title matches alone.

For linked evidence, review the actual post and its author, assign an explicit
official/community classification, and update the source-review record. Prefer
Kabam's original announcement over player replies. When an exact claim remains
supported only by community evidence, retain that limitation in the label rather
than assigning official status from the domain name or linking an unrelated
announcement.

Tests cover exact identity, star filtering, historical status, malformed windows,
missing/duplicate evidence, immutability, bounded client projections, per-piece
source links, unverified source states and existing crystal navigation. CI runs the domain, data and acquisition-panel suites in
addition to the existing crystal checks. No database or source crystal-catalog
changes are required.

### Champion finder integration

The crystal catalog's Find a champion tab searches the union of playable
champion identities and source-only crystal champions. A champion no longer
needs a direct crystal reward to appear in the combo box or legacy name search.
The selected champion receives the same acquisition reader and source-card
component as the champion page, including requirements, exact-star collection
pieces, historical dates, evidence labels and source links.

Star filters apply to acquisition methods as well as crystal pools. All stars
shows each recorded method with its own star labels; selecting 7-star Vision
shows his reviewed selector route without borrowing lower-star crystal pools.
Only the selected champion's acquisition projection is sent to the client.
Missing records use neutral wording and do not establish unobtainability.

### Ascension sources in How to obtain

The champion page places a separate **Ascension sources** section after its
acquisition methods and crystal pools. A champion being obtainable from a crystal
does not establish an ascension reward. Only the shared server reader
`web/src/lib/data/champion-crystal-ascension.ts` supplies these rows: exact
champion/star outcome bonuses and exact champion-token rewards, preserving each
opening/category/reward binding. The reader's evidence and limitations are
documented in `docs/crystal-ascension-source-boundaries.md`.

Opening **How to obtain** requests
`/api/champions/[slug]/ascension-sources?rarity=<star>` only when the selected
champion/star has a recorded ascension path. The route resolves the slug to its
exact game ID and calls `getChampionCrystalAscensionSources(gameId, rarity)`.
Its cacheable response contains only that champion/star's projection. Client
components import the types companion; they do not import or scan the catalogs.
Initial champion-detail payloads, piece exchanges and crystal archive loading
keep their existing boundaries.

Rows link to exact opening IDs and use published game crystal and material
artwork. Six compact rows appear initially, with an accessible expansion for
the remainder. Quantities stay attached to their reward and original binding;
conditional champion outcomes, direct token outcomes and the source auto-ascend
flag receive distinct copy. Automatic ascension is conditional, without a
personal eligibility, probability, guarantee or live-sale assertion. Extra
recorded reward conditions remain inspectable. The crystal reward observation
date is shown separately from the older champion-pool snapshot.

Star changes remount the source request and abort stale responses. Unsupported
or missing ascension paths render no empty section. A supported path with no
champion-specific crystal evidence gets a concise source-gap statement and a
general `/crystals?reward=ascension` material-search link; this link deliberately
omits champion-only stars so shared tokens and dust remain discoverable. This
does not identify those generic crystals as sources for the named champion.

CI includes the focused suites `champion-ascension-sources.test.tsx` and
`api/champions/[slug]/ascension-sources/route.test.ts`. The existing acquisition,
crystal-panel, ascension-interaction and champion navigation suites cover the
surrounding integration. Navigation now also checks the ascension section across
deep links, star changes, section changes and browser Back.
