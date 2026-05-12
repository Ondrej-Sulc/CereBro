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

Quest Planning Projection is the render-ready view of a player's route-aware plan. It owns visible route sections, active encounters, active assignments, selected team members, route summaries, and revive totals before the quest timeline renders them.

## Website Observability

Website Observability is the domain rule set for turning website requests, server actions, client errors, and product interactions into searchable logs, PostHog events, error reports, and dashboard metrics.

It owns correlation IDs, identity and alliance grouping, event naming, privacy-safe property shaping, slow-operation detection, and the adapter choices used by Railway logs, PostHog, Discord alerts, and admin usage views.
