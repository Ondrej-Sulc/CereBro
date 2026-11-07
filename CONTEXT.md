# CereBro Context

## War Map Nodes

WarNode.id is a database identity, while WarNode.nodeNumber is the number shown on a map. The map layout defines which node numbers exist: Big Thing has 1–10 and Standard has 1–50. Portal layout IDs are not placement slots. Node configuration, defense assignment, completion checks and distribution must use the plan's map type. Historical off-map defense placements are excluded from planning and distribution without deleting their saved rows.

## War Fight Recordings

A War Fight is one recorded matchup and retains one attacker, defender, player and total death count. Videos are recordings of that fight, not additional attempts or outcomes for statistics. One fight can have multiple ordered recordings, and one recording can cover several fights.

WarFightVideo owns recording order and the distinct fight/video association. Adding a recording appends it without replacing earlier recordings or creating another fight. A repeated video link is idempotent. Removing an association preserves the fight, its other recordings and the video wherever else it is used. Each recording retains its own uploader, visibility and moderation state; public access to one recording does not expose private or pending recordings attached to the same fight.

WarFight.videoId remains the first recording for compatibility during deployment. The additive migration backfills its associations and preserves additions made by old application instances. New readers use the recording collection and deduplicate the legacy link. Concurrent appends lock fight rows in stable ID order. Historical statistics aggregate fights separately from recordings, so video count never multiplies fight or death totals. Batch uploads resolve a new fight once and reuse its saved ID for further recordings and retries.

Historical recording references in shared Discord AW plans include the assigned player's own videos. References use published public or same-alliance recordings from finished wars, ranked by fight deaths then recency, with up to three links per assignment. Uploader-only access does not make private or unpublished recordings shareable in the plan thread.

Recording persistence and historical SQL integration tests use a disposable local database whose name contains recordings_test. Set WAR_RECORDINGS_TEST_DATABASE_URL, run node scripts/setup-war-recordings-test-db.cjs, then run the warRecordingService.integration and history-actions.recordings Vitest suites. The setup script decodes the historical UTF-16 baseline without changing its deployed checksum and applies all subsequent migrations normally.

## MCOC Prestige Projection

MCOC Prestige Projection is the domain rule set for turning champion prestige endpoints, rarity, rank, signature level, and ascension into game-display prestige values and chart-ready prestige curves.

It owns max signature levels, 7-star ascension scaling, game-display rounding, and generated prestige points used by roster insights, Champion Details, and roster edit previews.

Seven-star prestige compounds by 8% per ascension level from the base signature value, with one final nearest-ten display rounding. Exact champion/star rules bound new builds separately from historical owned observations and combat stat modifiers. See `docs/champion-prestige.md` for the gameplay regression, normalization contract and evidence limits.

Champion combat projections compose the exact recorded per-step Health and Attack bonuses independently into effective multipliers, then round the base stat times that multiplier once to an integer. `getAscensionEffects` exposes `healthMultiplier`/`attackMultiplier`; raw tier `healthBonus`/`attackBonus` values remain incremental. CR and Might Gain stay additive (current seven-star tiers: +15 CR each, Might only at A1); other imported ratings receive no inferred boost. See `docs/champion-combat-ascension.md` for the publisher correction, base-stat provenance and rounding limits.

## Roster Prestige Insights

Roster Prestige Insights is the domain rule set for turning a player's roster and MCOC Prestige Projection data into Top 30 account prestige, rank-up opportunities, and signature stone allocation suggestions.

It owns Top 30 average calculation, rank-up impact simulation, signature budget allocation, max signature potential, and filter-aware prestige suggestions used by profile roster insights.

## Champion Ability Text

Champion Ability Text is the domain rule set for validating imported game ability text templates and resolving their placeholders against champion ability curves, selected signature level, and selected champion stats.

It owns template shape, curve matching, static value resolution, game-stat value conversion, unresolved placeholder reporting, and chart-ready ability curve points used by Champion Details.

Numeric ability text follows the game's positional formatter contract: slot 0 is Chance ×100, slot 1 is the component's DisplayFormula applied to Modifier, slot 2 is Duration, and slot 3 is Stackable. Named protobuf fields and explicit formula/growth coefficients establish these bindings; English text, effect names and champion IDs do not. The legacy export aliases `baseVal` and `chance` refer to protobuf Chance and Modifier respectively. New `gameBinding` metadata bypasses legacy heuristics for both text and signature chart output. Missing source identity, formula or growth data is reported rather than guessed; complete description imports must include verified numeric bindings.

Ability text display metadata distinguishes combat paragraphs from HUD/glossary definitions and preserves localized trigger section headings. A Buff name is not a section heading. Full abilities groups combat paragraphs by their explicit game section and keeps glossary definitions in effect popovers. Display-only repairs bind the existing game/source identity and exact raw paragraph, retaining record IDs and value bindings.

## Champion Effect Sources

Each Champion Ability Link is a distinct application of an effect. Its form (Buff, Debuff, Passive, or Unknown) and direction (Gains on self, Inflicts on the opponent, or Unknown) are independent, source-level metadata. A champion can gain a Debuff or inflict a Buff; neither field is inferred from the effect name or beneficial/harmful polarity. Conditions keep their gameplay references to other effects. Immunities have no gain/inflict direction. Kit overview filters must match both fields on the same source, and different applications must remain separate when saving drafts or grouping effects.

Roster ability filters also qualify the same application by effect, form and direction. Multiple forms or directions use OR within that field, combined with AND between fields. Immunity selection stays independent. Matching sources expand in the roster quick overview; other effects remain compact and can be opened manually. Source details are loaded only for the selected champion and reuse current hash-bound overview summaries and full-ability links.

Champion Ability Overview is independently reviewed display copy for one existing effect source. Its separate record preserves the detailed source and prior enrichment receipts. Summaries describe activation and material restrictions without build-dependent amounts; retained constants require evidence of build independence. The source hash binds the effect, form, direction and required partners. A changed source invalidates its summary. Detailed text and ability navigation remain available independently of overview copy.

Source navigation sits inline in the preserved condition: an exact source phrase or known spelling links to its existing destination, otherwise a short linked prefix identifies it. Form badges belong to each source paragraph. Synergy variants with the same family and current-effect overview copy may share that paragraph within one form/direction group. Partner badges show names; the compact paragraph uses short level links or one named link for star-only variants, leaving activation requirements to the full Synergies tab. Unique level targets retain their original destinations; indistinguishable links with different card IDs open the full tab. Grouping metadata preserves complete, correlated owner/partner requirements; other recipients' catalog bonuses can differ. Different stacking rules, resistance classifications or displayed numeric values remain separate. Unknown activation requirements are not consolidated, and shared prose does not merge the underlying source applications.

A shared synergy duration modifier can quote one complete imported bonus paragraph when its recipient and amount bind every affected native Debuff application. Conditional wording stays intact, native trigger navigation remains available, and the original application summaries stay in Source details. The recorded bonus is display context; it does not rewrite reviewed summaries or combine application identities.

Champion Ability Resistance is separate metadata classifying an existing incoming protection by its target effect and recorded mechanism (potency, damage, duration or unspecified resistance). It does not change the original Ability Link or its reviewed Overview. A reduction, including one at or above 100%, does not establish immunity: the effect can still apply. Kit Overview and roster popups show both under Immunities & resistances with distinct labels. Roster immunity filters remain strict unless Include resistances is selected. General hit mitigation and Physical/Energy/Critical resistance ratings remain ordinary abilities.

Resistance metadata binds the current source and required partners. Fixed numeric badges additionally require an imported stat-independent game display binding; native combat bindings cannot prove a separate synergy value. Build-, signature- or stack-dependent amounts are not flattened into fixed percentages. Source or imported evidence drift invalidates the classification at read time. See `docs/champion-resistances.md` for the local snapshot/plan/apply/verify workflow.

## Game Synergies

Game Synergies are the game's imported team bonus definitions. A complete snapshot preserves the source synergy ID, localized description and numeric values, stacking flag, targeting tags, effect IDs, and original rules.

An Owner is a champion at a specific obtainable star level that brings a synergy. A Required Partner is a champion at a specific obtainable star level that can activate it. For the supported ungrouped rules, any one listed required partner is sufficient. Targeting tags describe who receives effects and are distinct from activation partners.

Game Synergy Members link these roles to collectible champions for navigation and rarity filtering. NPC definitions and unavailable template rarities remain in the raw snapshot without player-facing links. Champion Details shows outgoing synergies and incoming synergies from teammates for the selected rarity; this is a catalog, not a team activation simulator.

Champion Details offers only obtainable star levels with imported stats and defaults to the highest of those levels. Imported stat templates alone do not establish that a champion is obtainable at that rarity.

The full Synergies tab groups catalog entries independently of effect-source popovers. Equal names/levels, rendered bonus text, stacking flags, partner identities and catalog member identities share one bonus row with visible star availability. Explicit levels of the same named family, members, partners and stacking flag share a card with one partner header and distinct rows in numeric level order. Every row retains its complete bonus text, recipients, glossary semantics and owner/partner rarity pairs; a single partner's stars are combined only for the same current-champion stars and identical bonus. Every original catalog ID remains a navigation target for its level row, and the raw catalog view used for source matching is unchanged. See `docs/champion-synergy-display.md`.

Game Synergies are independent of manually curated Champion Ability Synergy links. Importing a validated full snapshot atomically replaces only the game synergy tables. Grouped activation rules are preserved in the source format but blocked from import until their semantics are supported.

## Game Crystals

Game Crystals are recorded possible reward definitions, independent of live store availability, drop rates and a champion's obtainable rarity list. Crystal names are display labels; exact source IDs and referenced reward categories identify pools. Direct `hero` rewards and verified First Edition `hcos` rewards join exact blueprint IDs to Champion.gameId and an explicit 1–7 star rarity. Cosmetic rewards preserve their original source data and tier identity; the UI shows the cosmetic only at its recorded star level. Unknown reward types/cosmetic formats stop extraction for review. Carousel/featured previews, shards, nested crystals and bonus rewards do not establish direct membership. Missing evidence does not prove unobtainability.

The versioned shared catalog preserves provenance hashes, capture time, crystal/category/blueprint identities, selection metadata and exact primary/banner artwork references. Crystal banners are the champion montages from `_backgroundImage`, distinct from holograms. Artwork is exported without recoloring or redrawing and published through the same immutable Google Cloud Storage pipeline as champion and relic images, under role-specific crystal prefixes. The verified manifest binds the same gacha snapshot; missing art remains a neutral fallback. Champion Details groups explicitly mapped variants only when their complete pools and opening rules agree, retaining individual source definitions and rarity availability. It prioritises main pools, keeps champion-page cards focused on their crystal icon and opening information, and loads the wider recorded catalog for the selected star level. Promotional banners remain on crystal detail pages. Main-pool priority is editorial, not evidence of current sale status. See `docs/champion-crystals.md` for extraction, validation and refresh.

Crystal browsing is public and independent of roster ownership. Browse crystals defaults to main pools; All recorded includes champion families, mixed openings and definitions without direct champions in one filtered grid. Reward-type filters combine with categories/search/sorting; materials clear champion stars. The old full-catalog list redirects into All recorded. Stable `/crystals/[sourceId]` routes preserve the exact opening while grouping shared champion pools for discovery. A single page shows source-matched rates, the complete filtered champion portrait grid, other possible rewards and conditional bonuses/Grace rules. Champion filters never renormalize rates or alter other outcomes. Standard/Nexus/Epoch links retain exact opening identities even when champion membership matches; legacy reward-detail URLs redirect to the same unified route. Source-only names come from BCG Character localization, while portraits and champion links join the website catalog by gameId. Reward artwork uses exact type/data bindings in a separate source-bound manifest, with real game textures in immutable GCS objects and neutral missing-art fallbacks. Missing-champion/owned filters are not implemented yet.

Recorded crystals have shared editorial browsing categories for class pools, featured rotations, champion spotlights, mode rewards, login/daily rewards, year collections, themed events and other definitions. These organize the catalog and champion archives without changing reward identities or inferring sale status. Separately extracted box-promotion champions support spotlight classification; they never establish possible reward membership or odds. Counts respect the selected search/star filters, and source edition labels distinguish recorded versions and calendar entries.

## Champion Acquisition

Crystal Availability is separate from contents, odds and named editions. Exact
opening reviews distinguish recurring pools, published current/upcoming/past
event windows and unverified sources. A current event association is not a live
stock assertion, and a past event does not make owned crystals unusable. Shared
champion pools do not transfer availability between opening variants. Browse
filters match and link to exact openings; source reviews and date evaluation
remain on the server. See docs/crystal-availability.md.

Champion Acquisition records reviewed ways to obtain a champion beyond direct crystal drops: quest rewards, event milestones, matching-star piece exchanges, store purchases and giveaways. Exact Champion.gameId plus explicit star levels identify each route; missing routes do not establish unobtainability or change Champion.obtainable. Announcements and exact in-game item descriptions are retained as separate evidence, with review dates and source links. Dated windows distinguish past, upcoming and within-window records without claiming a live offer is available. Undated piece/store routes retain variable availability. The champion's How to obtain tab combines a small per-champion projection with existing crystal pools; legacy tab=crystals URLs and archive loading remain valid. See docs/champion-acquisition.md.

## Game Relics

Game Relics are imported Battlecast and Statcast catalog definitions, separate from player-owned items and champion bindings. Each source ID and original rarity index remains distinct. Statcast visual families group secondary variants for browsing; they do not merge those definitions. Public controls expose Statcasts at 5★–7★ while lower-rarity templates remain in the source snapshot. Battlecast rarities follow their individual records.

The catalog retains the complete verified source bundle and projects current definitions, socket items and rarities into dedicated tables. Portraits use the champion-image GCS bucket with a separate content-addressed `relics/` prefix, public URLs in the database and Next Image delivery. Numeric descriptions show fixed values and metadata-supported, rarity-wide progression ranges. Rating effects use explicit unbound percentage previews; supported Attack/Health coefficients show percentages of the bound champion's respective stat rather than flat amounts. Unsupported conversions remain marked Build-dependent. These are not selected-build combat calculations. Rune options are inspectable reference data, game recommendations are hints, and raw restriction selectors do not imply supported eligibility checks. See `docs/relic-catalog.md`.

Player Relics belong to a `Player` game profile, not the Discord identity or an alliance. An owned item is unique by profile, exact relic source ID (including its Statcast secondary variant) and source rarity ID. Inventory tracks rank and signature only; unlocked runes are assumed maxed for the selected rank. Prestige is an exact, source-bound game table lookup. Personal inventory does not write catalog definitions or champion bindings. Relic Prestige Aggregation averages the highest 30 source-bound owned Battlecast/Statcast ratings. Explicit per-profile confirmation enables transactional updates of relic prestige, summoner prestige and history; incomplete or unknown-data inventories remain previews and preserve recorded values. Manual prestige edits and validated profile-prestige screenshot imports switch aggregation back off. All prestige writers share a player row lock. Retired definitions remain referenced by saved inventory. See `docs/player-relics.md`.

Relic inventory screenshots are a separate review-before-import flow. OCR reads card names and ratings; visual evidence constrains rarity, class and awakening. Statcast primary/secondary attribute glyphs use source-bound game-font masks, independent of prestige candidates; a primary/family contradiction blocks matching and uncertain icons require a choice. Exact table matches can still collide across rank/signature builds or unresolved Statcast variants, so ambiguity remains explicit. Selected entries save atomically after review, current-rating validation and an inventory revision check. Overlapping identical cards coalesce, conflicting builds reject, and unselected inventory survives. These inventory imports preserve the existing aggregation preference and use the shared screenshot allowance.

## Quest Planning

Quest Planning is the domain rule set for turning quest plans, route choices, fight restrictions, player rosters, selected counters, prefight champions, synergy champions, and revive counts into a player's saved quest plan.

It owns quest and fight restriction matching, owned and unowned champion availability, team-limit simulation, counter and prefight conflict rules, route-aware progress, and user-facing rejection reasons used by the quest timeline and quest planning server actions.

Unlimited Swaps is the Quest Planning mode represented by a quest with no team limit. It allows a player to switch champions after each fight, but a specific champion rarity can only be used once across the active quest route. That uniqueness is based on champion plus star level, not roster row identity, so roster updates keep existing plans attached to the same champion rarity.

In Unlimited Swaps, a prefight champion is not an additional team member. A prefight assignment must use the same champion plus star level as the counter selected for that fight.

Quest Planning Projection is the render-ready view of a player's route-aware plan. It owns visible route sections, active encounters, active assignments, selected team members, route summaries, and revive totals before the quest timeline renders them.

Quest Objectives are preset planning scopes layered over a base quest plan. They add objective-specific roster restrictions, route defaults and locks, optional endpoint filtering, and a separate `PlayerQuestPlan.scopeKey` so base plans and challenge-specific plans do not overwrite each other.

## Website Observability

Website Observability is the domain rule set for turning website requests, server actions, client errors, and product interactions into searchable logs, PostHog events, error reports, and dashboard metrics.

It owns correlation IDs, identity and alliance grouping, event naming, privacy-safe property shaping, slow-operation detection, and the adapter choices used by Railway logs, PostHog, Discord alerts, and admin usage views.

## Website Directory Search

Website Directory Search is the logged-in website experience for discovering Player Profiles and real Alliances in CereBro. It helps users find and inspect records; alliance membership actions happen from the destination Player Profile or Alliance pages.

Player Profile is an MCOC account/profile stored in CereBro. A Discord user may own multiple Player Profiles.

Active Player Profile is the Player Profile currently selected by its owning Discord user. It is not an activity, freshness, visibility, or status flag.

Real Alliance is an Alliance intended to represent an actual MCOC alliance. Infrastructure records and empty orphan records are not Real Alliances.
