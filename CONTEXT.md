# CereBro Context

## War Fight Recordings

A War Fight is one recorded matchup and retains one attacker, defender, player and total death count. Videos are recordings of that fight, not additional attempts or outcomes for statistics. One fight can have multiple ordered recordings, and one recording can cover several fights.

WarFightVideo owns recording order and the distinct fight/video association. Adding a recording appends it without replacing earlier recordings or creating another fight. A repeated video link is idempotent. Removing an association preserves the fight, its other recordings and the video wherever else it is used. Each recording retains its own uploader, visibility and moderation state; public access to one recording does not expose private or pending recordings attached to the same fight.

WarFight.videoId remains the first recording for compatibility during deployment. The additive migration backfills its associations and preserves additions made by old application instances. New readers use the recording collection and deduplicate the legacy link. Concurrent appends lock fight rows in stable ID order. Historical statistics aggregate fights separately from recordings, so video count never multiplies fight or death totals. Batch uploads resolve a new fight once and reuse its saved ID for further recordings and retries.

Recording persistence and historical SQL integration tests use a disposable local database whose name contains recordings_test. Set WAR_RECORDINGS_TEST_DATABASE_URL, run node scripts/setup-war-recordings-test-db.cjs, then run the warRecordingService.integration and history-actions.recordings Vitest suites. The setup script decodes the historical UTF-16 baseline without changing its deployed checksum and applies all subsequent migrations normally.

## MCOC Prestige Projection

MCOC Prestige Projection is the domain rule set for turning champion prestige endpoints, rarity, rank, signature level, and ascension into game-display prestige values and chart-ready prestige curves.

It owns max signature levels, 7-star ascension scaling, game-display rounding, and generated prestige points used by roster insights, Champion Details, and roster edit previews.

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

## Game Relics

Game Relics are imported Battlecast and Statcast catalog definitions, separate from player-owned items and champion bindings. Each source ID and original rarity index remains distinct. Statcast visual families group secondary variants for browsing; they do not merge those definitions. Public controls expose Statcasts at 5★–7★ while lower-rarity templates remain in the source snapshot. Battlecast rarities follow their individual records.

The catalog retains the complete verified source bundle and projects current definitions, socket items and rarities into dedicated tables. Portraits use the champion-image GCS bucket with a separate content-addressed `relics/` prefix, public URLs in the database and Next Image delivery. Numeric descriptions show fixed values and metadata-supported, rarity-wide progression ranges. Rating effects use explicit unbound percentage previews; supported Attack/Health coefficients show percentages of the bound champion's respective stat rather than flat amounts. Unsupported conversions remain marked Build-dependent. These are not selected-build combat calculations. Rune options are inspectable reference data, game recommendations are hints, and raw restriction selectors do not imply supported eligibility checks. See `docs/relic-catalog.md`.

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
