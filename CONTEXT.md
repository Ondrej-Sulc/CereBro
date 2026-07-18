# CereBro Context

## MCOC Prestige Projection

MCOC Prestige Projection is the domain rule set for turning champion prestige endpoints, rarity, rank, signature level, and ascension into game-display prestige values and chart-ready prestige curves.

It owns max signature levels, 7-star ascension scaling, game-display rounding, and generated prestige points used by roster insights, Champion Details, and roster edit previews.

## Roster Prestige Insights

Roster Prestige Insights is the domain rule set for turning a player's roster and MCOC Prestige Projection data into Top 30 account prestige, rank-up opportunities, and signature stone allocation suggestions.

It owns Top 30 average calculation, rank-up impact simulation, signature budget allocation, max signature potential, and filter-aware prestige suggestions used by profile roster insights.

## Champion Ability Text

Champion Ability Text is the domain rule set for validating imported game ability text templates and resolving their placeholders against champion ability curves, selected signature level, and selected champion stats.

It owns template shape, curve matching, static value resolution, game-stat value conversion, unresolved placeholder reporting, and chart-ready ability curve points used by Champion Details.

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

## Battlegrounds Tournaments

Battlegrounds Tournaments is the organizer workspace for creating and running MCOC Battlegrounds events.

It owns tournament scope, status, format, registration/check-in timing, seeded participants, optional battlegroup-aware field organization, and match records used by the tournament control page. Tournament scope can be Community for open/friendly events outside an alliance or Alliance for internal alliance friendlies. Bracket generation and match reporting build on this organizer model instead of replacing it.

**Bracket Operation**:
A single atomic change to an elimination bracket, such as starting the tournament or reporting a fight result together with every resulting advancement, bye, or reset final.

**Tournament Control Projection**:
The render-ready view of one Battlegrounds Tournament, including ordered participants, bracket layout, standings, outcome, and the operations available to the current organizer or participant.

Example dialogue:

- Organizer: "I reported the winners-final result. Did the loser enter the lower bracket?"
- Developer: "Yes. That report and every downstream placement are one Bracket Operation, so they either all succeeded or none did."
- Designer: "Should the control page calculate whether the reset final is required?"
- Developer: "No. The Tournament Control Projection supplies that outcome and the operations the page may render."
