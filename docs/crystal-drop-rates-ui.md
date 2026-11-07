# Crystal rate presentation

Crystal pages combine resource and nested-crystal rewards with their rates in
one Rewards & drop rates section. Compact rows show artwork, a reward category,
its quantity or variant count, and the disclosed percentage. Numbered PRIZE groups are shown
in numeric reading order. Each row retains its original source group and row
index; its percentage, prefix and raw tooltip value are unchanged.

All prize groups are visible initially. Larger disclosures provide immediate
local reward search and prize-group buttons, with a clear-filter recovery state.
Filtering never combines groups, changes a rate, or renormalizes the remaining
rows. A crystal-route change resets these local filters. Short standard-crystal
disclosures omit the large-table controls.

A single unqualified 100-percent category uses a compact guaranteed-category
summary, retaining its exact label, artwork/link, source indices and raw-rate
tooltip. Named group and Featured context are retained. This shortcut never
combines multiple groups or treats a prefixed percentage as guaranteed. A lone
uncertain rate keeps the full rate layout with singular outcome wording.

Prize groups contain compact illustrated cards, with reward names, amount
summaries and aligned percentages. Two independent columns on larger screens
become one column on mobile. Each column keeps its entries when a card expands,
so opening class or amount options cannot rebalance the other column. Guaranteed
extras retain their separate panels with a subtle green emphasis.
The controls use native buttons, pressed states, a labeled search input and a
live result count. There is no extra server request when filtering.

## Game artwork

The server projects a small `oddsVisuals` map keyed by the original group/row
indices. It reuses the same published reward/crystal assets as the reward cards;
no new assets or bucket objects are created. Images are lazy and render at a
small size. The client never imports the artwork registries or source catalogs.

Most disclosures contain only English category labels. Matching is confined to
the exact source opening's direct reward entries. Type/data identity takes
precedence when the disclosure supplies it. Otherwise punctuation/case and
singular/plural shard labels are normalized for an exact label match. Fragment
labels can match only material-fragment rewards, and shard labels can match
only shard rewards. Full materials cannot borrow fragment artwork.

Repeated quantities of the same resource may share its icon. Multiple reward
identities with the same label remain ambiguous, even if they share an image.
An ambiguous class category does not select an arbitrary class-colored asset.
These rows use a neutral category icon or an explicit stack of the recorded
class artwork. A percentage belongs to its category once; expanding it shows
the exact class variants and denominations without repeating that percentage.
Class-only options use short class names in the context of their parent reward;
the original full label remains available as a tooltip. Other variants retain
their full names. Artwork, text and amount chips have larger display sizes than
the original table. Prize filters and search share one control area, with an even
three-column button layout for larger prize lists on narrow phones. The category
rate qualification appears once after the reward list.

## Joining rewards and rates

The server creates a bounded presentation for the exact source opening. Exact
type/data identity wins; otherwise matching uses normalized category labels,
reviewed inventory identities and explicit class-material aliases. Fragment and
full-material rewards stay separate. Category membership and complete matching
sets can disambiguate repeated labels across prize groups. Source-array order,
PRIZE numbering, quantities and probability magnitudes are never matching rules.
Contradictory or ambiguous bindings remain under Other recorded rewards without
an assigned percentage; no per-option probability is calculated.

An amount list only combines entries with the same source category, identity,
artwork, destination and reward conditions. Amounts remain exact options, never
summed or converted to an invented continuous range. Repeated shard rewards in
different prize groups keep their own quantities and rates. Guaranteed extras
keep their separate original prize panels. Conditional bonuses and Grace/box
rules remain outside the rate join.

Ordinary star-category rates annotate the star choices when the source is exactly
one unnamed, unfeatured group with the complete distinct set of pool rarities.
Only whole champion-only source groups move beside the pool. Mixed groups retain
all their champion, material and nested-crystal categories together in Rewards &
drop rates, in original row order; a champion subset cannot qualify for star-filter
annotations. This keeps each source disclosure understandable as one group without
renormalizing rates. See [the Elder Web of Corruption review](crystal-rate-total-review.md).
Explicit reward-data bindings, named champion labels, missing/duplicate stars or
multiple/named/featured groups retain the separate disclosure. Raw keys, prefixes
and percentages remain unchanged; search and class filters never alter them.
For champion-only groups, small named pools keep their rate and source context
below the named portrait in the same card. Other rates, including complete mixed
disclosures, appear below the pool alongside their corresponding rewards, with
no second full reward-card catalog. Missing disclosures show the recorded rewards
without an empty rate section.
Reward-heavy Banquet pages prioritize the combined rewards in the main column,
with the compact champion pool and opening rules beside them on larger screens.

Only a unique, exact nested-crystal identity gets a crystal-page link. The link
keeps that source ID and disables automatic prefetch. Neither artwork nor a
shared name establishes individual champion probabilities or shared odds across
crystal openings. The immutable odds evidence and raw catalogs remain unchanged.

Tests cover gold, full/fragment separation, ambiguous class/crystal labels,
nested links, preserved percentages while filtering, zero and tiny rates,
prefixes, numeric group order and missing disclosures. Combined-view tests also
cover class artwork/amount expansion, local prize and reward filters, repeated
2025 Banquet shard prizes and exact preservation of source rates and rewards.
