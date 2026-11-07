# Crystal and ascension evidence boundaries

Reviewed on 5 November 2026. This document complements the extraction reports; it records primary-source interpretation rather than a table of current rates or shop stock.

## What the public sources establish

| Source | Established behavior | Boundary |
| --- | --- | --- |
| [Kabam Miike: Drop Rate Information in The Contest](https://forums.playcontestofchampions.com/en/discussion/55022/drop-rate-information-in-the-contest) | The in-game crystal information panel displays percentages supplied by the back end. | This historical announcement describes the disclosure system. Its illustrative percentages are not current crystal rates. |
| [Kabam Support: First Appearance Champion Portraits](https://help.kabamsupport.com/hc/en-us/articles/44256413933339-First-Appearance-Champion-Portraits) | Grace can guarantee the featured champion, while the First Appearance portrait must be obtained from a direct crystal reward. The portrait's rate is disclosed in Crystal Info. | A champion guarantee must not be presented as a guarantee of its cosmetic portrait. A recorded `hcos` outcome establishes a possible cosmetic reward, not its probability. |
| [Kabam Support: Missing Ascension Tokens](https://help.kabamsupport.com/hc/en-us/articles/54596500602011-Missing-Ascension-Tokens) | On the first Ascended 7-star acquisition, a champion token is granted and consumed to reach A1. Later tokens can remain in inventory. The article distinguishes Empowered/featured token sources from ordinary Hero and Titan crystals, which do not grant ascension tokens. | A champion being in a crystal does not establish that its ascension materials are awarded there. The support article was updated 16 September 2026; exact recorded bonus bindings remain necessary for each source definition. |
| [Kabam (Osaurus) Rex: Everything About 7 Star Ascension, So Far](https://forums.playcontestofchampions.com/en/discussion/411731/everything-about-7-star-ascension-so-far) | At launch, cluster rewards combined a champion with A1 materials. The announced Super-Duper Box excluded a drawn champion until its six-champion cycle was completed. Seven-star ascension also affects Challenge Rating and Might/ISO-Burst. | This is a launch article. Its original eleven-level roadmap is historical, not evidence of the currently enabled levels or current box contents. Stateful boxes cannot be treated as repeated independent draws from a fixed pool. |

The September and October stream recaps surfaced in search are authored by community members, even when hosted on the official forum or marked as announced discussions. They are useful discovery leads, but do not replace the game contracts or a staff-authored announcement. Forum users' estimates for trophy champions likewise must not be imported as official rates.

## Identities that must stay separate

The current crystal family is an exact champion-membership presentation. It can group Standard/Nexus/shard openings while retaining their source IDs. An odds or reward-rules record needs the original crystal/opening identity and its observation, not only the family ID. Equal champion sets do not establish equal rarity rates, per-champion weights, selection sampling, pity rules, cluster bonuses, prices or availability.

Three different questions need different answers:

1. **Can this outcome occur?** The existing exact reward-category and blueprint join answers membership.
2. **What is its disclosed probability?** A captured rate disclosure must identify the crystal and whether a row describes a category, individual outcome or conditional group. Missing disclosure remains unknown; neither equal weighting nor `1 / championCount` follows from membership.
3. **What changes after more openings or an acquisition?** Pity counters, box exclusion cycles, bonus rewards and automatic ascension consumption describe separate state transitions. A threshold is meaningful only with its trigger, qualifying tags, group scope, reward and reset/replacement rules.

An in-game screenshot can prove the displayed value for a particular crystal and observation. It cannot, by itself, identify every same-named historical definition, the hidden split within a grouped disclosure, or the rates of an unavailable event crystal. A reusable odds import should preserve the original disclosure and capture date and bind it to an exact source identity before making comparisons.

## Ascension projection

Ascension information should join by champion game ID and exact blueprint/star identity. Explicit blueprint tier lists and their resolved costs establish recorded paths; global tuning templates do not grant eligibility. An explicitly empty eligible path differs from a champion absent from the available snapshot.

The new extraction should retain each step's original material IDs, quantities, attack/health modifiers, Challenge Rating, Might fields and buff IDs separately. Material definitions can supply names and artwork without asserting that the materials are currently sold in a shop. A quest or crystal source link requires its own exact reward binding.

CereBro now uses the validated collectible blueprint paths for champion build controls and simulated targets. Health, Attack and Challenge Rating use their separately recorded additive effects, including the lower-rarity paths. Generic rarity bounds are only a fallback for previews; an absent champion rule grants no simulated upgrade. Saved roster observations are handled separately so a missing or newer eligibility snapshot cannot silently erase an owned level.

Prestige retains its existing calibration independently. A field named `MightGain` is not evidence of a prestige multiplier, and the extracted client code has not established a replacement prestige formula. The integration audit records the corrected state/write boundaries and regression cases. These changes do not perform a roster backfill or modify real ownership data during verification.

## Product representation

Crystal details can show separately sourced **Drop rates**, **Guarantees**, and **Additional rewards**. A family may show several opening-specific records when these facts differ, while retaining one champion pool. Trophy-champion searches can surface a verified named rate or guarantee only when that exact fact is recorded; a generic rare-category rate must keep its category label.

Champion pages can show the recorded ascension levels and per-step materials beside the selected star level. Token entries should explain whether a crystal grants materials or only the champion. A later roster-aware cost view can subtract owned materials once inventory data exists; the present roster has champion ascension state, not a verified inventory of ascension resources.

Snapshot dates, local file modification times, extraction times and current store availability are distinct facts. The crystal snapshot and the newly inspected ascension cache must retain their own hashes and provenance. Do not relabel a historical cache as current merely because it was extracted today.
