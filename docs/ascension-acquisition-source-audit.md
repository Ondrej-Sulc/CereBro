# Ascension acquisition source audit

Reviewed **7 November 2026**. Research only: no eligibility rules, UI, source catalogs, account state, or cloud data were changed.

**Yes, special ascension acquisition methods exist.** The absence of a champion-specific crystal reward is not evidence that the champion cannot ascend. There are documented currency exchanges, challenge objectives, event milestones/ranked rewards, and store token offers. Conversely, a recorded ascension path does not establish a currently obtainable method. Some paths in the November snapshot belong to announced future events.

The useful answer is star-specific. Lower-star ascension uses shared dust; seven-star ascension needs the exact champion token as well as other materials. The existing crystal reader answers only one part of the acquisition question.

## Audit population and reproducibility

The sample is the **entire exact seven-star gap**, not a selection of champions already known to have ascension crystals:

- `listChampionAscensionEligibility().filter(c => c.ascendableRarities.includes(7))`: **112** identities.
- `getChampionCrystalAscensionSources(c.gameId, 7).crystals.length > 0`: **81** of those identities.
- Exact difference: **31** identities, all listed below. A row counts bindings, not current shop stock, probabilities, or completeness of acquisition coverage.

Reproduce the read-only join with the ignored `temp/ascension-source-audit/gaps.ts`:

```powershell
pnpm exec tsx --tsconfig web/tsconfig.json temp/ascension-source-audit/gaps.ts
python temp/ascension-source-audit/evidence.py
```

`gaps.json` preserves every matching canonical rule, materialized cost, and source count. `store-exact-bindings.json` preserves 22 GameStore definitions with **exact** `Redeemers[].Type == inv` and `Data` matching a gap champion token. It excludes similarly prefixed inventory definitions such as `ascension_token_champion_storm_realm`; substring matches are not bindings. `evidence-manifest.json` records local file hashes and the official articles' publication metadata/content hashes. Everything under that temp directory is ignored research output, not a production input.

The eligibility observation is **2026-11-03T09:10:42+00:00**; crystal opening rewards have their separate November 5 observation. The GameStore display/redeemer cache is the already documented `5AFEBC8CC99BE2C1546DB91EF7B1F6360DFD7154.bin`, SHA-256 `1b56c68c34813a40647a559f4e3b130cd26f080d2ffd063c9db417ac97603c55`, mtime November 5. None of these dates establishes present acquisition availability.

## Sources and confidence

The Kabam website article bodies below were independently fetched on November 7 through Kabam's public WordPress API; the forum announcement was read through the web tool. The author endpoint identifies author ID 25 as **The MCoC Team**. Public citations point to the normal articles. Livestream summaries are explicitly credited to **Ackbar67 and published by The MCoC Team**; they are classified as Kabam-published summaries, not staff-authored forum posts. No random forum reply is used to confirm a route. A staff edit or an announcement badge alone would not establish authorship.

| Ref | Official source, publisher/author, publication date | Relevant scope |
| --- | --- | --- |
| S1 | [7-Star Doom Pieces and Ascension](https://playcontestofchampions.com/news/7-star-doom-pieces-and-ascension/), The MCoC Team, 2026-11-02 | DoomScrip, Victorious Four tokens, Doom ascension gates and announced higher tiers. |
| S2 | [The Reclamation War](https://playcontestofchampions.com/news/the-reclamation-war/), The MCoC Team, 2026-11-02 | Weekly final milestone for A1; top 10% ranked for A2 tokens. |
| S3 | [November 2nd Livestream Summary](https://playcontestofchampions.com/news/november-2nd-livestream-summary/), The MCoC Team, credited Ackbar67, 2026-11-02 | Nine named weekly champions; Magneto event; planned Medusa sale. |
| S4 | [September 4th Livestream Summary](https://playcontestofchampions.com/news/september-4th-livestream-summary/), The MCoC Team, credited Ackbar67, 2026-09-04 | Magik's separate A1/A2 Limbo exchanges. |
| S5 | [February 27th Livestream Summary](https://playcontestofchampions.com/news/february-27th-livestream-summary/), The MCoC Team, credited Ackbar67, 2026-02-27 | Star-Lord challenge; Maestro ascension in Carina's Challenges. |
| S6 | [May 29th Livestream Summary](https://playcontestofchampions.com/news/may-29th-livestream-summary/), The MCoC Team, credited Ackbar67, published **2026-06-01** | Blade (Stellar-Forged) awakening/A1 objective. The title is the stream date, not the article publication date. |
| S7 | [October 2nd Livestream Summary](https://playcontestofchampions.com/news/october-2nd-livestream-summary/), The MCoC Team, credited Ackbar67, 2026-10-02; [V59.0 Release Notes](https://playcontestofchampions.com/news/v59-0-release-notes/), The MCoC Team, 2026-10-02 | Green Goblin (Stellar-Forged) event Tower ascension/awakening. |
| S8 | [April 2nd Livestream Summary](https://playcontestofchampions.com/news/april-2nd-livestream-summary/), The MCoC Team, credited Ackbar67, 2026-04-02 | America Chavez Action Figure exchanges. |
| S9 | [Saga: Web of Corruption](https://playcontestofchampions.com/news/saga-web-of-corruption/), The MCoC Team, 2026-07-03; [V57.1 Release Notes](https://playcontestofchampions.com/news/v57-1-release-notes/), same publisher/date | Mysterio's Helmets chase explicitly includes ascension and seven-star scope. |
| S10 | [Saga: Empire of Doom](https://playcontestofchampions.com/news/saga-empire-of-doom/), The MCoC Team, 2026-11-02; [Saga Chase: Shuri Ascension](https://playcontestofchampions.com/news/saga-chase-shuri-ascension/), same publisher/date; [Sieges - Gatekeepers and Overlords](https://playcontestofchampions.com/news/sieges-gatekeepers-and-overlords/), same publisher/date | Locator Chips, their activity/progression sources, and Shuri ascension. |
| S11 | [New Twitch Drops, Thor (Ragnarok), Observance, and More](https://forums.playcontestofchampions.com/en/discussion/413318/new-twitch-drops-thor-ragnarok-observance-and-more), **Kabam (Osaurus) Rex** | Staff-authored announcement explicitly separates buying Thor from buying A1/A2. Observance drops start **2026-04-02**. The public text extraction did not expose a publication timestamp; do not invent one. [V57.0 Release Notes](https://playcontestofchampions.com/news/v57-0-release-notes/), The MCoC Team, 2026-05-29, corroborate Twitch/Observance acquisition of the updated Thor. |
| S12 | [Spider-Ham's Sizzling Summer Sales](https://playcontestofchampions.com/news/spider-hams-sizzling-summer-sales/), The MCoC Team, 2026-06-26 | Explicit seven-star Spider-Ham plus ascension materials; historical sale/event window. |

**High confidence** below means the cited source explicitly establishes the mechanism, with exact local redeemers where available. It does not mean an account can buy/claim it today. **Partial** means the mechanism is announced but a payout, exact objective binding, date, or access contract is missing. **Definition only** cannot establish an obtainable route.

## Verified exchanges and store mechanisms

All rows in this section concern **7-star** champions. Token IDs are verified against the canonical materialized costs, not derived from English names. Store binding IDs refer to `GameStoreDataBuffer.items -> gameStoreItems[Name] -> Redeemers` in the pinned cache. Prices are not inferred from a bundle title or an enabled flag.

| Champion / exact game ID | Exact item and mechanism | Established quantities/conditions | Status and confidence |
| --- | --- | --- | --- |
| Magik / `magik` | `ascension_token_champion_magik`; Limbo Token exchanges, S4. Exact bundles `event_090226_magik_a1` and `event_090226_magik_a2`. | Announced September 9: **10 Limbo Tokens** for A1 pack; **15** for A2 pack. Local A1 pack: 1 champion + 1 `ascension_token_class_mystic`; A2 pack: 2 champion + 10 Mystic + 500 `primordial_dust_t2`. Both descriptions require Thronebreaker. | High confidence documented mechanism; **current stock not verified**. These purchases are separate from buying Magik herself for 20 Limbo Tokens. |
| Thor (Ragnarok) / `thor_ragnarok` | `ascension_token_champion_thor_ragnarok`; Observance earned via Twitch Drops and spent on successive store bundles, S11. | `observance_7star_thor_ragnarok_ascension_1_bundle`: 1 champion token + 1 `ascension_token_class_trained` + `thor_ragnarok_t7`; requires the prior Thor purchase. `..._ascension_2_bundle`: **per purchase**, 1 champion token + 5 trained-class tokens; max 2 purchases; requires A1 bundle purchase. | High confidence mechanism and local contents; **current stock/drop campaign not verified**. The announced **50 Observance is Thor's initial purchase**, not a verified ascension-bundle price. A2 still needs its other upgrade materials. |
| America Chavez / `americachavez` | `ascension_token_champion_americachavez`; Action Figure saga exchanges, S8; local `saga_america_chavez_7star_tokens_bundle` / `saga_america_chavez_tokens_bundle`. | Historical summary: 100 Action Figures for A1 Chavez; 50 for a pack described as 1 Chavez token + 1 Mystic token. November cache: champion pack has `americachavez_t7` + 1 champion + 1 Mystic token; separate token pack has **1 champion + 5 Mystic tokens**. | Mechanism verified; **historical saga**, no current offer verified. The summary and newer static pack differ on class quantity: **do not combine the old price with the newer pack contents**. |
| Mysterio / `mysterio` | `ascension_token_champion_mysterio`; Mysterio's Helmets saga exchange explicitly awards champion/ascension, S9. Local `saga_mysterio_7star_rankup_tokens_bundle`, `saga_mysterio_a1_bundle`, `saga_mysterio_a2_bundle`. | Champion pack: `mysterio_t7` + 1 champion + 1 Tech token. Other packs: 1 champion + 5 Tech; 2 champion + 10 Tech respectively. Rank-up gems included in some packs remain separate rewards. | High confidence historical mechanism and exact static rewards; **exchange prices, remaining purchase limits and current access not verified**. |
| Shuri / `shuri` | `ascension_token_champion_shuri`; Locator Chip saga exchange, S10. Local `saga_shuri_7star_rankup_tokens_bundle`, `saga_shuri_tokens_r3_bundle`, `saga_shuri_tokens_r4_bundle`. | Champion pack: `shuri_t7` + 1 champion + 1 Tech token. Each other named pack: 1 champion + 5 Tech tokens. Announcement specifies Chips from EQ/Mysterium Store, Reclamation activity, battlepass, Sieges and other dated activities, with progression gates. | High confidence mechanism; **announced November-January chase**, not a claim every chip/reward is already claimable November 7. No verified chip price for these packs; Chavez's recipe must not be reused. |
| Doctor Doom / `doctordoom` | `ascension_token_champion_doctordoom`; DoomScrip exchanged for Ascended Talismans/token offers in Von Doom Armory, S1. Local `event_110226_castellan_store_ascension_bundle_1` and `_6`. | Official gate: own 7-star Doom and any **2 Victorious Four at A2**. Local `_1`: 1 Doom token, one purchase, gate 4 Victorious token purchases. `_6`: 1 Doom token per purchase, max 2, gate 8 Victorious token purchases. The announcement says event-earned DoomScrip supports A1; extra offer currency supports chasing A2. | High confidence announced event mechanism and static bindings; **gated/current account access not verified**. The separate **100 ordinary Latverian Talismans obtains Doom**, not his ascension. Exact Ascended Talisman prices/recipe not established here. |
| Mister Fantastic (Victorious) / `mrfantastic_victorious` | `ascension_token_champion_mrfantastic_victorious`; Armory token offer, S1; `event_110226_castellan_store_ascension_bundle_2`. | 1 champion token per purchase, max 2; local access description: **Reclamation milestone 12**. | High confidence event mechanism/static reward; milestone-dependent, not verified claimable now. |
| Invisible Woman (Victorious) / `invisiblewoman_victorious` | `ascension_token_champion_invisiblewoman_victorious`; same mechanism, `_bundle_3`. | 1 champion token per purchase, max 2; **milestone 14**. | Same boundary. |
| Human Torch (Victorious) / `humantorch_victorious` | `ascension_token_champion_humantorch_victorious`; same mechanism, `_bundle_4`. | 1 champion token per purchase, max 2; **milestone 16**. | Same boundary. |
| Thing (Victorious) / `thing_victorious` | `ascension_token_champion_thing_victorious`; same mechanism, `_bundle_5`. | 1 champion token per purchase, max 2; **milestone 18**. | Same boundary. |

The Victorious offers also award the `gsi/v4b` purchase counter. That counter is **not a champion token or ascension level**. S3 says A2 for all four is supported by event-earned DoomScrip. The two-token-per-champion static offers alone do not explain the entire A0-to-A2 path, which normally requires three champion tokens. The initial champion/A1 reward binding must be captured before a finder promises a complete material budget. Do not invent a voucher-to-A1 conversion from their champion acquisition methods.

S1 also announces Doom A3 tokens for the overall top 100 and A4 tokens for the top 5. These are **future tier rewards/announcements**; the November 3 canonical path still stops at A2. This audit does not enable A3/A4 or infer their full costs.

## Challenges, milestones, and historical offers

These establish other mechanisms outside the crystal API. Missing objective/event payloads remain explicit; a published mechanism does not establish an exact currently payable token quantity.

| Champion / exact game ID (all 7-star) | Material identity and documented activity | Evidence, dates and limitations |
| --- | --- | --- |
| Maestro / `maestro_trophy` | Required token: `ascension_token_champion_maestro_trophy`. Carina's Challenges reward Maestro A1/A2 separately from a champion selector. | S5, February 27, announces weekly challenges beginning March 11: Ordeal, Abyss and Epoch Gauntlet with Hero/Villain restrictions. **Mechanism confirmed in Kabam-published summary; exact objective thresholds/token payouts and present claimability unverified.** May 13 is the stated First Appearance deadline, not evidence that ascension rewards also expired. Neither a Maestro token nor this summary proves a new Maestro is awarded with every ascension reward. |
| Star-Lord (Stellar-Forged) / `starlord_stellar` | Required token: `ascension_token_champion_starlord_stellar`. Defeat **Abyss Quake using Stellar-Forged Star-Lord** to receive a duplicate and ascension. | S5. Announced challenge mechanism confirmed; **token/class quantities, exact star restriction, objective ID and end date not captured**. Seven-star applicability comes from canonical costs; the summary does not independently specify every star-specific reward. Do not claim a six-star route or a currently active objective from this. |
| Blade (Stellar-Forged) / `blade_stellar` | Required token: `ascension_token_champion_blade_stellar`. Defeat **Necropolis Red Goblin with only Blade (Stellar-Forged)** for awakening and A1. | S6, published June 1, describes the objective as already live then. **Historical confirmation**, not current-objective verification; exact item payout, objective ID, star restriction and deadline need a payload/capture. This is separate from collecting Blade's five pieces. |
| Green Goblin (Stellar-Forged) / `green_goblin_stellar` | Required token: `ascension_token_champion_green_goblin_stellar`. Special Event Tower; beat **Destroyer** for awakening/ascension, then a Sasquatch test fight. | S7 release notes directly establish the Tower mechanism; October 2 summary schedules October 7. **Historical event**; exact token quantities/star restriction and end timestamp are not established by these cited texts. Collecting his five pieces does not grant this objective reward by itself. |
| Spider-Ham / `spiderham` | Required token: `ascension_token_champion_spiderham`. Sizzling Sale tracker/offers explicitly include **7-star Spider-Ham and ascension materials**. | S12, **June 26-July 6, 2026, 11:00 AM PT**. **Past sale**; progression-tuned offers and Units-spent tracker. Named materials are confirmed, but article prose does not establish token counts, a specific webstore tier, fixed price, or probability. No replacement current method verified. |
| Magneto (House of X) / `magneto_marvelnow` | Required token: `ascension_token_champion_magneto_marvelnow`. Ascendable Magneto associated with Alliance Super Season's multiplayer objectives/Realm Event. | S3: **November 4-December 9**. **Announced current event period; partial payout contract.** Exact token quantities, milestone/rank thresholds and live claimability are not established by that summary. Community claims about top 1,000 were not promoted into verified facts. |
| Medusa / `medusa` | Required token: `ascension_token_champion_medusa` (its display metadata is unresolved). Quantum Tangle sale/webstore chase announces **5 champion tokens**, associated with A3. | S3: scheduled **November 20**. **Upcoming on November 7**; no current Medusa ascension offer verified. No offer price, exact webstore tiers or sale end inferred. A3 remains an announcement, not an enabled canonical path. |

### Nine weekly Reclamation War champions

S2 (The MCoC Team, November 2) explicitly assigns **A1 to the weekly final milestone** and **A2 tokens to the top 10% ranked**. S3 (The MCoC Team's November 2 publication, credited Ackbar67) supplies these exact champion names. Each is an exact canonical seven-star gap; the token IDs below are their verified costs, **not independently captured event payouts**.

| Champion | Exact game ID | Required champion token |
| --- | --- | --- |
| Blade | `blade` | `ascension_token_champion_blade` |
| Captain America (Infinity War) | `captainamerica_movie` | `ascension_token_champion_captainamerica_movie` |
| Iron Man (Infinity War) | `ironman_movie` | `ascension_token_champion_ironman_movie` |
| Elsa Bloodstone | `elsabloodstone` | `ascension_token_champion_elsabloodstone` |
| Wong | `wong` | `ascension_token_champion_wong` |
| Storm | `storm` | `ascension_token_champion_storm` |
| Iceman | `iceman` | `ascension_token_champion_iceman` |
| The Leader | `leader` | `ascension_token_champion_leader` |
| Captain Marvel (Movie) | `captainmarvel_movie` | `ascension_token_champion_captainmarvel_movie` |

**High confidence announced mechanism; incomplete per-week availability.** The nine champions belong to a multiweek event, not nine simultaneously obtainable rewards. The cited announcement describes November/December Reclamation and further January challenges, but does not bind each champion to an exact dated week or expose the personal-point minimums. No per-champion week order, token counts, or immediate availability is invented. Obtaining a champion from an ordinary Hero/Titan crystal remains separate from these event ascension rewards.

## Five cases without a verified obtainable ascension route

All five have positive canonical seven-star paths and zero matching crystal API rows. Their required token IDs are recorded below. None is labeled unobtainable.

| Champion / game ID | Evidence found | What remains missing |
| --- | --- | --- |
| Arnim Zola / `arnimzola` | `ascension_token_champion_arnimzola`. Three store definitions `arnim_zola_ascension_box_champion_dummy_a/b/c` explicitly contain `arnimzola_t7` + 1 champion + 1 Tech token. | **Definition only.** No verified staff announcement/live box binding establishing access, box prizes, key sources, price, exclusion/reset rules, or current stock. Dummy rows cannot establish the playable offer. Community sale reports are leads only. |
| Scarlet Witch (Sigil) / `scarletwitch_current` | `sigil_store_ascension_sw_token` directly redeems 1 `ascension_token_champion_scarletwitch_current`. Access metadata: `gent/premium_access` quantity 1 and `gsi/prg` quantity 8; description explicitly requires the Summoner's Sigil. | **Definition only.** Exact token offer is real static evidence, but no reviewed current sale/price/refresh binding or staff announcement for that token offer. The old Sigil **champion** reward table does not prove this later ascension token's availability. Do not confuse her with `scarletwitch` (Classic). |
| Cable / `cable` | Required token `ascension_token_champion_cable`. [Wakandan Trials](https://playcontestofchampions.com/news/wakandan-trials/), The MCoC Team, September 4, describes **7-star First Appearance Cable**, September 9-October 7. | No exact ascension reward in the reviewed article prose or store token redeemers. **First Appearance is cosmetic, not ascension.** A champion reward alone is insufficient. |
| Deadpool / `deadpool` | Required token `ascension_token_champion_deadpool`. [Deadpool's Deadlift](https://playcontestofchampions.com/news/deadpools-deadlift/), The MCoC Team, April 9, documents the Deadweights sale ending April 17; S8 mentions First Appearance seven-star Deadpool. | No reviewed champion-specific ascension-token grant/offer binding. Neither the event's rank-up resources nor its cosmetic/champion promotion proves ascension. |
| Scream / `scream` | Required token `ascension_token_champion_scream`. No matching store token redeemer found in this cache. | Community Final Formation/Clash discussion is not a staff-authored payout source. Need the actual milestone/ranked reward table or Kabam announcement identifying Scream's ascension reward and dates. **No current method verified.** |

Thus **26 of the 31 gaps have an officially published mechanism or scheduled mechanism**, with the contract/availability limits above. Two further cases have exact static store-token evidence only, and three remain acquisition-only/unresolved. This is a research disposition, **not 26 complete current routes**.

## Lower-star ascension and shared materials

[Kabam's August 4, 2023 stream summary](https://playcontestofchampions.com/news/twitch-stream-summary-august/), The MCoC Team, explicitly describes Primordial Dust as generic: T1 for 4/5-star ascension and T2 for 6-star ascension. The canonical per-blueprint paths independently establish these exact A0-to-A1 costs:

| Stars | Exact incremental materials |
| --- | --- |
| 4-star | 50 `inv/primordial_dust_t1` + 100,000 `res/sc` |
| 5-star | 100 `inv/primordial_dust_t1` + 500,000 `res/sc` |
| 6-star | 200 `inv/primordial_dust_t2` + 900,000 `res/sc` |
| Eligible 7-star A1 | 1 exact champion token + 1 exact class token |
| Eligible 7-star A2, from A1 | 2 exact champion tokens + 10 exact class tokens + 500 `inv/primordial_dust_t2` + 100,000 `res/sc` |

A six-star champion does not need a personal ascension crystal: acquiring the shared dust and meeting its recorded upgrade cost is the relevant route. This does not grant the same champion a seven-star path. Nor is seven-star ascension exclusively token-only: A2 also consumes dust and `res/sc`.

Concrete shared-material sources exist, but do not solve missing champion tokens. [Battlegrounds Season 43](https://playcontestofchampions.com/news/battlegrounds-season-43/), The MCoC Team, October 14, lists **500 T2 Primordial Dust and 15 Class Ascension Token Crystals at Vibranium 1**. This is a published season reward, not a live account entitlement check; it supplies neither a named champion token nor a guaranteed chosen class. [Act 9.4](https://playcontestofchampions.com/news/act-9-4-the-reckoning/), The MCoC Team, April 13, lists **10 Class Ascension Token Crystals in chapter exploration rewards**. Do not distribute these randomly awarded class crystals equally among classes or substitute them for champion tokens.

## Existing local evidence and missing contracts

- **GameStore:** inspected the existing decoded registry's 13,937 item rows and exact nested redeemers. 22 definitions bind a gap champion's token; bundle gates and quantities are recorded above. These rows contain no verified live stock response, and the relevant bundles do not expose their price in the inspected `pricings` field. Inventory token names/`Enabled` flags establish neither sale nor source. The registry also contains non-reward gate-counter/dummy definitions.
- **Selectors:** `src/data/game-selectable-rewards/catalog.json` has 111 metadata entries (November 6 observation), with names/descriptions/icons rather than verified selectable contents. No champion-specific ascension route is promoted from a selector name. A missing/unresolved nested selection requires its selection options and the activity granting that exact selector.
- **Quest/event captures:** scanned existing `runtime-home-validated.json` and `runtime-event-rewards.json` under `temp/quest-data-investigation/game-only/`, captured November 5. Neither contains a direct gap champion-token reward. Their six ascension matches are the Act 9.4 class-crystal reward and duplicated Carina token/class rewards in quest/summary representations; duplication is not extra rewards. The validated snapshot hash is `ebe5e7f2d5fbc759dbeb08d30ca174c7941c13ae4e2c81f545fb0b97c7694aa3`.
- **Carina supplemental evidence:** `epilogue_ch04_q04.masteryCompletionRewards` explicitly contains 1 `ascension_token_champion_carina_white` and 1 Cosmic token. This is an exact quest source outside the crystal reader. The canonical collectible seven-star gap set excludes her special/event-marked blueprint; this audit does not reinterpret her eligibility or modify that other audit's findings.
- **BCG scope:** the named `BCGDataBuffer` schema includes blueprint eligibility/global ascension tiers, but no complete objective/event reward registry. Searching its tier definitions cannot establish a Carina challenge or a weekly Realm payout. Existing PvE quest captures do not substitute for the separate objective/live-event contracts.

For a complete finder entry, the missing evidence is specific: objective ID + eligible star/attacker restrictions + exact completion condition + reward tuples + start/end/access; for weekly Realm events, champion/week identity + milestone/rank/personal-point requirements + payout; for offers, exact item/selector/box ID + price/gates/limits + active window/stock observation. Arnim's box additionally needs prize/exclusion/reset semantics. No live account capture, new decoder, purchase, or account mutation was performed for this audit.

## Recommended How to obtain / finder wording

Keep **recorded applicability**, **champion acquisition**, and **ascension material sources** independently visible for the selected stars. Preserve the crystal reader's exact-binding standard, and add separately reviewed non-crystal route records rather than broadening crystal membership into source evidence.

For seven-star Magik, explain the two Limbo exchanges and link S4; for Thor, link the Observance announcement; for Stellar-Forged champions, link their particular challenge rather than their piece collection; for Doom/Victorious Four, link the Armory gates and dated Reclamation evidence. Each card should carry its own evidence type/date and a label such as **Past event**, **Announced for November 20**, **Activity-dependent**, or **Current stock unverified**. Exact static bundle contents can be shown with their snapshot date, but should not silently acquire an unverified current price.

For lower stars, use: **“Ascend with shared Primordial Dust and the recorded upgrade cost.”** Link the matching dust search/material requirements; a lack of personal token sources is expected there.

For an unresolved seven-star source, use: **“A seven-star ascension path is recorded. We have not verified an obtainable source for this champion's ascension materials.”** For an announced multiweek reward, say **“Announced through Reclamation War weekly rewards; exact week and current claimability unverified.”** A general material finder remains useful, but must not imply it supplies the missing named token.

No UI or data implementation is proposed as already verified by this report. The immediate product correction is explanatory scope; production route additions should carry these explicit evidence/availability boundaries.
