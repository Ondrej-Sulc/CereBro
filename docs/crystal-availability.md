# Crystal availability evidence

Crystal contents, named editions and acquisition availability are separate facts.
`src/data/game-crystals/availability-catalog.json` holds an editorial review of
46 exact opening IDs, reviewed on November 6, 2026. It does not modify the raw
membership, all-reward, artwork, odds or history snapshots.

The initial review covers 17 recurring Standard/shard openings, eight Empire of
Doom Saga crystals, ten announced Bounty Boxes, and eleven Banquet openings
from the 2022-2025 events. Other openings remain unverified. Main-pool priority
does not automatically assign availability, and equal champion pools do not
transfer availability between Standard, Nexus, Epoch or other aliases.

## Meaning of the labels

- **Recurring pool** is an explicit review of a regularly used Hero, Titan or
  progression opening. It does not assert that a live offer exists or that every
  account can acquire it today. Nexus openings are reviewed independently.
- **Current event** means the published event or Saga window is current. It
  identifies an event association, not verified live shop stock. For Empire of
  Doom, the linked Saga announcement establishes November 2-February 10; an
  individual crystal's acquisition source and eligible star levels still depend
  on progression and individual event rewards.
- **Upcoming event** and **Past event** describe the original reviewed event
  window. Owned crystals may remain openable after the event, and a later offer
  may reintroduce an opening. Neither label means permanently unobtainable.
- **Availability unverified** means a current acquisition source has not been
  verified. A dated ID, older revision, missing current listing, captured odds
  response, or a static enabled flag does not establish availability or retirement.

Dates are published calendar dates, evaluated on the server at UTC-day precision;
the final named date is included. They do not provide countdowns or replace the
game's exact timers. Status changes automatically as the dates pass. The 2022
Kabam announcement prints a contradictory end year; that review is historical
without a guessed exact date range.

Official evidence records the actual Kabam publisher or author. News articles
also retain their WordPress article publication timestamp and content hash.
The recurring reviews are labeled editorial catalog reviews, without an official
announcement claim. No customer session, inventory, balance, account ID or token
is in this sidecar. No private game request or purchase is made by a page load.

## Application behavior

`createCrystalAvailability()` validates unique exact IDs, source authorship,
required evidence and ordered event windows. Unknown identities remain unknown.
`getCrystalAvailability()` is the shared server reader. The existing
`jessies_crystal` acquisition exclusion and its specific notice remain intact.

Availability coverage is too sparse to be a primary discovery control. The
catalog does not show the availability facet row, and catalog, finder and
champion-page crystal cards do not show availability badges. A single catalog
snapshot note explains the data's limits without repeating unknown status on
most cards.

The `availability` URL parameter remains supported for existing links. An
active legacy filter appears as a removable applied-filter chip; clearing it
preserves the current query and star choices. A family still links to the exact
opening that matched, with its opening label retained. No status or contents
are inherited from another alias.

Crystal details retain reviewed statuses, published dates and announcement
sources. Generic unverified summaries are omitted; source-specific review
notices (including `jessies_crystal`) remain on the exact detail page. The
underlying availability catalog and acquisition-source exclusions are retained.

The small display-label module has no Zod or data imports. Validation and the
evidence sidecar remain on the server. Date resolution is synchronous and does
not add a network request or database query. Existing contents, rates and large
catalog summaries remain cached independently of date-sensitive status.
Resolved statuses are immutable and cached for the UTC day; the cache resets
when the reference date changes, so expired events cannot stay current.

## Establishing live obtainability

This feature does not claim a complete live inventory. A true **Available now**
state needs dated positive acquisition evidence: an active shop/reward offer,
its exact source opening, start/end time, eligibility and a freshness limit.
Store visibility or ownership alone is insufficient, and absence from one
account's shop cannot establish global retirement. A live collector should
sanitize those offer/reward facts and let expired observations become unverified.
It must not derive sale status from `/gacha/getOdds`: historical openings can
still return complete odds disclosures.

Add or change exact reviewed IDs only after checking their source. Refresh an
event association if Kabam announces a return. Tests cover date transitions,
unverified aliases, exact filtered destinations, retained search state and both
champion and reward-only detail pages.
