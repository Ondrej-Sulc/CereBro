# Crystal browsing and reward presentation

This pass reduces repeated labels while preserving exact opening identities,
quantity evidence, original probability groups and the existing image bucket.

## Crystal detail page structure

Champion-pool and resource-only routes share the same illustrated header. It
combines the recorded banner, crystal artwork, readable title, edition and compact
content counts. Exact opening choices have selected states and retain browsing
context. Known event context and About this data are native disclosures in a
compact footer; unverified availability still creates no status label. Expanding
either disclosure keeps its original evidence and dates in the header flow.

Pages with multiple sections provide sticky anchor navigation. Banquet-style
openings with many resource rewards and at most eight champions put rewards in
the main desktop column, with champion and opening information beside them. The
columns stack at smaller widths. Resource-only openings with rules use the same
layout. Other crystals retain the champion pool before extra rewards.

Small, single-star champion pools have named portrait cards without redundant
search/class controls. Active filters still expose recovery controls. Large
matching pools use a bounded, keyboard-accessible portrait gallery, with an
optional expand/collapse control. The names preference remains available and all
champions remain loaded; filtering or expanding does not make a server request.
The gallery toolbar stays visible while scrolling its portraits.

When the disclosure is one unnamed, unfeatured group containing exactly the
complete, distinct star categories present in the pool, those category rates
annotate the star choices. Their source indices, qualifiers and percentages are
retained and never change with search or class filters. Named groups, featured
groups, explicit named rewards and incomplete/ambiguous star sets retain their
separate disclosure. Small named champion disclosures keep source group and
Featured context inside the compound champion card. No individual champion odds
are calculated.

The global footer stacks its copyright and wrapping link row on phones, keeping
link words intact. The full-page browser pass checked the Banquet and Paragon
compositions, navigation offsets, evidence disclosures, source counts, the portrait
gallery and the footer across desktop and phone widths. Automated checks also
cover expansion through filtering and preserved rate context.

## Cards and champion previews

Catalog cards keep a small arrow and accessible destination name. Routine
standard-opening chips and repeated action footers are omitted. Nexus selection
rules, rate availability and guarantee information remain visible.
Recorded-rate availability uses a small percent icon beside the card's arrow,
with a hover/focus explanation and an accessible description on the card link.
It creates no additional tab stop or bottom badge row.

The browse summary marks a single champion only when every direct hero/cosmetic
reward has a resolved champion identity and all identities agree. A monthly Login
group shares a champion preview only when every included star-range pool agrees.
The server enriches only the visible page's previews through the existing cached
champion identity/artwork query. Missing metadata preserves the recorded name and
an icon fallback; failure of optional portrait lookup does not break browsing.
No full champion or reward catalog is sent to the browser.

Grouped monthly Login cards put their star-range links in a compact shared
footer, with a small pool count instead of repeated arrows and helper copy.
Five pools use a balanced three-plus-two arrangement, four use two even rows,
and two or three fit one row. Each option remains a native link to its exact
recorded source opening, with the active star filter and browse-return context.
These are separate destinations with no selected-tab or current-page state.
The links retain 44-pixel touch targets and visible keyboard focus at narrow
card widths. Grouping, ordering, contents, rates and availability are unchanged.

## Combined rewards and rates

The rewards section combines category percentages, compact artwork and exact
amounts. Expandable rows hold class variants or multiple denominations beneath
one disclosed category percentage. Separate source prize groups stay separate;
guaranteed extras get their own group panels. Champion-category rates are next
to the champion pool, while resource and nested-crystal rates sit below it.
Unmatched or ambiguous rewards remain visible without an invented percentage.
The crystal header counts displayed reward categories rather than repeated raw
quantity entries. Search and prize buttons work locally without a request.
Reward cards have larger artwork and readable quantity summaries. Expanded class
options show short contextual class names and exact amounts; source labels remain
in tooltips. Separate desktop columns stay in place during expansion and stack
in source order on phones. The prize controls use even rows on narrow screens,
and a compact count beside the section title replaces the extra overline.

## Resource amount options

Repeated resource, material and inventory quantities share an expandable card
only within the same exact category, type, data identity, image and reward
conditions. Classes, full materials/fragments, conditional bonuses and separate
prize categories remain distinct. Identical displayed amounts do not create a
fake amount selector. Unknown/reversed ranges and linked crystal drops retain
their individual cards. Options preserve source order, keys and exact quantities;
they are never summed or represented as an invented continuous range. Rates and
their game-defined groups remain unchanged.

## Returning to browsing

Crystal links carry a validated `returnTo` URL containing the original filters,
query, order and pagination. Public catalog, finder and comparison destinations
are supported, along with public champion routes. External/account/API paths,
unknown query fields and recursive return parameters are rejected or omitted.
Context survives opening variants, local champion-pool filters and nested crystal
drops. A direct visit without context retains the normal browse fallback.

A tab-local position is recorded on ordinary clicks from a browsing page and
consumed once on return. Nested crystal navigation cannot overwrite the original
position. Records expire after 30 minutes; blocked storage still preserves URL
context. Restoration runs after render and tolerates React Strict Mode cleanup.
Modified/new-tab clicks do not overwrite the current tab's position.

## Data notes

Each page has one collapsed About this data disclosure with content capture dates,
optional rate capture/first-recorded dates and general evidence limitations.
Crystal detail and reward-only pages place this disclosure inside the crystal
header's footer, alongside opening information where applicable. It expands into
a full-width row in that footer, without overlapping artwork or page content.
Crystal banners remain visible outside disclosures. The compact category-rate
qualification stays above the rates; guarantees retain their own conditions.
Missing or empty disclosures omit the entire Drop rates section. Captured rows
with a disclosed zero still render as 0.00%; searching to zero matching rows
retains the existing empty-search recovery controls.

The focused regression suites cover source identity, shared previews, immutable
quantity/rate evidence, expansion, safe return URLs, nested navigation, one-time
scroll restoration, existing filters and the visible banner contract. CI includes
the new presentation/navigation suites.

## Browser layout review

Component and HTTP tests do not establish visual correctness. The follow-up
review used the actual local browser at 320, 390, 768 and 1440 CSS pixels,
including main/recorded catalogs, monthly Login groups, Banquet rewards,
champion lookup and comparison. Check collapsed and expanded disclosures,
short/long labels, card content and horizontal overflow in future visual passes.

The catalog hero gives About this data its own 16-pixel separation from the
subtitle on desktop (14 pixels including the mobile grid gap), without carrying
the shared disclosure's bottom margin into the hero. Sorting belongs to the
results header alongside its title/count; the explanation sits beneath its
controls. Browse crystals and Find a champion sit in a full-width navigation
band inside the header, below the intro/artwork and directly above the filters.
Desktop links align left with comfortable padding, a subtle active background and
an underline; phones use two equal-width, 60-pixel-tall destinations. The finder
uses the same attached composition with a compact intro and its champion picker
immediately beneath the band. These remain separate page links with `aria-current`,
without carrying crystal-name searches into champion lookup. Expanded data notes
stay in normal flow above the band, and keyboard focus is inset to remain visible.
Compare pool remains a compact secondary action on crystal details, and existing
comparison URLs remain usable without marking either primary tool current. The catalog now has one scope, with Main pools offered as a category
and placed first in the default recommended results. Resource amount cards reserve room for their text and chevron;
champion preview portraits preserve a square aspect ratio within their border.

The combined-rewards follow-up reviewed the 2024 and 2025 Superior Banquet,
Greater Banquet 2022 and Paragon pages at desktop, tablet and narrow phone widths
(1440, 768, 390 and 320 CSS pixels). It checked class and Gold expansion, visible
keyboard focus, Enter activation, source-specific shard quantities, reward
search, nested crystal destinations and horizontal overflow. Expanding a class
card kept the opposite desktop column's geometry unchanged. Missing disclosures
continued to show rewards without an empty percentage section.

## Finder header artwork

The finder uses a fixed five-portrait curation: Iron Man, Storm, Gwenom, Hulk
and Guillotine (Deathless). Class colours affect only the card framing. Full
portrait variants resolve through the existing champion image helper from the
finder's already cached metadata read; the client receives five URLs and one
selected identity, never raw image maps or the reward manifest. Secondary or
hero-only metadata remains usable without constructing image paths.

Decorative acquisition motifs resolve from the published manifests: the 7-star
hero crystal, Cosmic class ascension token and Guillotine's 7-star Cursed Handle
(`dg_t7_handle`). They do not describe a pool, probability or current offer.
Selection replaces the collage with that champion's portrait, a class token
when available, and a collection piece only from that exact champion's recorded
acquisition method at the selected stars (7 stars when no star filter is set).
Unrelated personal pieces and tokens never follow a selection. Pending or
out-of-order identities use generic crystal art until matching metadata arrives;
clearing restores the curation immediately. Source-only/missing portraits and
image-load failures retain the reserved composition with existing crystal art,
then a neutral gem icon if that artwork also fails.

Phones use three smaller cards alongside the two-line title, keeping the
subtitle, attached navigation and picker in normal flow. Decorative layers alone
have a restrained CSS drift, gated by `prefers-reduced-motion: no-preference`;
the default/SSR composition is static. No animation JavaScript or pointer effects
are added. Finder projection, SSR decoration, keyboard selection, late responses,
clear/reset and load-error fallbacks have focused regressions in the crystal CI
command.

The second visual iteration arranges the same five portraits in a shallow arc:
Gwenom is the forward focal portrait, with smaller, more gently angled supporting
portraits, quieter class framing and a shared pool of light beneath them. The
default decoration omits the Cursed Handle because overlapping portraits left
only its embedded star strip visible. Its projection and exact champion/star
binding remain intact; selected personal pieces sit fully beside the portrait.
Phones retain the three-card arc and give a selected portrait more space, omitting
its secondary class token. Artwork bounds, title, attached navigation and controls
keep their existing reserved layout, with the same CSS-only motion gate.
Missing-portrait decoration keeps only the crystal, and the final neutral gem
is centred within the reserved artwork bounds even on a 320-pixel phone.

The finder-artwork browser pass covered default/selected layouts at 1440, 768,
390 and 320 CSS pixels, All sources and Ascension focus, keyboard selection,
clear/reset, a source-only Anti-Venomoid entry, and Guillotine's associated
piece. Header assets loaded through Next Image without horizontal overflow.
The server HTML contained the composition, picker and navigation. Static CSS
was reviewed by disabling only the finder's motion media rule and confirming
all decorative animations were `none`; a native reduced-motion preference was
not emulated. The review used owned Preview tabs, which were closed afterward.

## Finder identity trial

The Finder identity trial (2026-11-07) puts the selected name, stars, existing
portrait and exact View champion link in the banner, retaining Find a champion
as a quiet context label and keeping the attached tool navigation. The cleared
state retains its original title/collage. Finder alone passes the backward
compatible `showSelectedPortrait={false}` combobox option; dropdown portraits
remain. The lower identity row is removed and real source-section jumps move
beside a compact Sources heading, tightening the gap to results. The current
category layout is preserved. See [UI validation and review screenshots](champion-ascension-acquisition-ui.md#finder-identity-trial-2026-11-07)
for checks, local PNG paths and browser automation limits.

## Large ascension bonus lists

Crystals with at least eight compatible automatic-ascension bonus bindings use
compact panels grouped by class and source rarity. Each panel shows the matching
class-token artwork and its quantity once, explicitly per listed outcome, plus
every champion-specific token's artwork, champion name and exact quantity.
This is a presentation change: the original source-category and champion-outcome
bindings remain intact. No token quantities or probabilities are combined.

Only fixed positive quantities, exact champion-token identities and the six known
class-token types qualify. Different source categories, rarities, amounts or token
metadata stay separate. Additional rewards, conditions, non-automatic bonuses or
unrecognized patterns keep the detailed fallback. The qualification explains that
other drops of the same champion can lack these bonuses; automatic ascension is
applied only when applicable. The page-section link says Bonuses when there are
no pity or box-opening rules.

Metamorphosis Valiant is the large-list regression fixture: all 30 conditional
outcomes remain visible in six class panels, with five champion tokens per panel.
The tests check exact artwork and quantities, immutable bindings, unsupported
fallbacks, distinct section IDs and separation of differing token amounts.
The visual pass checked 1440, 768, 390 and 320-pixel layouts, all 30 outcomes,
published token artwork, section navigation and horizontal overflow. Narrow
phones keep three token portraits per row; redundant navigation counts are
hidden below 360 pixels to preserve the bar's side padding.

## Compact selected Finder layout

The selected identity banner uses about 160px on desktop while retaining one
readable portrait and the exact profile action. Available panel width determines
the controls: one desktop row for champion/stars/source mode, a deliberate
picker-above-stars/mode tablet layout, then stacked phones. Ascension focus has
no star-column placeholder. The welcome collage remains unchanged.

Source jumps now share the first actual result heading, including the focused
Ascension heading; the generic Sources row is gone. Acquisition jumps open
collapsed methods and retain summary focus. See the
[Finder polish validation](champion-ascension-acquisition-ui.md#finder-polish-follow-up-2026-11-07)
for final measured states, real screenshots, combined checks and browser limits.
