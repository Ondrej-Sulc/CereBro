# Champion page design decisions

Question: Which hierarchy makes abilities, immunities, and team synergies easiest to inspect?

The user selected those three tasks as the primary reason for opening a champion page. After comparing smaller headers and parallel reference layouts, they explicitly chose to continue the main Dossier, keeping the large artwork banner.

## Decision - 2026-10-17

The regular champion route now keeps Dossier's large artwork banner and removes the tiny navigation row. Four prominent tabs follow the banner, in this order: Kit overview, Full abilities, Synergies, Stats & attacks. Build selections are shared between tabs. On narrow screens, all four tabs remain visible and build controls can collapse.

Kit overview uses imported effect colors, shows source conditions and teammate requirements immediately, and keeps generic effect definitions in hover/focus/tap tooltips. Different teammate requirements remain separate even when their source labels match. The full reader has a desktop chapter sidebar and a narrow-screen section selector. Synergies offer search and direction filters. Stats separate offense and defense ratings, with expandable hit sequences below.

The Columns, Reference, Team view, and Refined comparison components, query handling, and floating switcher have been removed. Their question has been answered; the older standalone concept routes predate these comparisons.

Validation: 54 focused tests cover ability text, obtainable rarities, synergy data, and effect source grouping. Collaborative browser access recovered. Desktop and mobile screenshots and interactions were checked with Pavitr, Wasp, and Iceman: tab switching, chapter selection, effect definitions, synergy search/direction filters, build persistence, and expandable attack hits. Wasp defaults to her obtainable six-star build and shows 21 synergy cards. The current Iceman data has no curated immunity links; the UI reports that absence rather than inventing immunity records. Mobile QA also corrected reader overflow and made banner artwork more visible.

## External references reviewed

Reviewed on 2026-10-16. Initial observations came from public page content and HTML, plus CoCPit's publicly delivered component and stylesheet definitions. A browser retry subsequently allowed inspection of AuntM.ai and mcoc.gg's live DOM, including layout measurements for AuntM.ai. Browser screenshots still failed. The user supplied a desktop screenshot of their authenticated Khonshu champion page. These sources establish the desktop structure, but do not constitute a complete visual or mobile audit of every site.

| Reference | Observed structure | Useful implication for CereBro |
| --- | --- | --- |
| [MCOCHUB — Wasp](https://mcochub.insaneskull.com/champions/wasp) | Compact portrait/name/class, an early ability summary, named synergy groups, and stat controls. | Keep the utility index near the champion identity; detailed text can follow. |
| [CoCPit — Wasp](https://cocpit.org/champions/wasp) | Public component code separates the ability overview from the detailed kit and provides section links; stat panels can expand. | Give fast lookup and full reading distinct levels of detail. Stats need not dominate the first view. |
| [MarvelSynergy — Wasp](https://www.marvelsynergy.com/champions/wasp) | A linked bonus summary and partner navigation precede the longer pairing explanations and rarity tables. The page identifies its last Wasp update as 2019. | Make partners easy to find, with exact requirements available as detail. Use this as a layout reference rather than a current data authority. |
| [mcoc.help — Wasp](https://mcoc.help/champions/wasp/) | Champion identity leads directly into separate groups for synergies the champion brings and combinations it enables for other champions. | Explain synergy direction in player language. Keep activation partners and effect recipients distinguishable. |

Additional references inspected after the user's feedback:

| Reference | Evidence and observed structure | Useful implication for CereBro |
| --- | --- | --- |
| [AuntM.ai - Wasp](https://auntm.ai/champions/wasp/tier/6) | Live DOM at 1280px: a 256px portrait and identity on the left, build controls/stats in the middle, and an open signature reader on the right. Abilities and synergies begin side by side below. Sections can collapse. | Use desktop width to keep related references visible together. Full ability text need not be hidden behind navigation by default. |
| [mcoc.gg - Wasp](https://mcoc.gg/#C,198) | Opened Wasp through the live champion grid. Its champion dialog contains separate Abilities and Immunities & Resistances sections, ability and synergy summary/detail controls, partner portraits, basic hits, tags, and rarity information. Screenshots remained unavailable. | Provide a fast effect index alongside access to exact kit text; keep immunity information distinct. No visual polish judgment is based on the DOM alone. |
| [Khonshu's Ankh](https://khonshu.app/) | The browser session is signed out and the Wasp route requires membership. The user's authenticated screenshot of Green Goblin (Stellar-Forged) shows identity and attributes above synergies in the left area, signature/effect summaries/attack details in the middle, and a wide full ability reader on the right. Synergy partners use small portraits on the same row as the bonus name. | Build a coordinated reference grid with readable full text and supporting summaries visible together. The screenshot does not establish mobile behavior or historical influence between sites. |

The research informed effect semantics and reading hierarchy. The final layout direction follows the user's explicit preference for Dossier's large banner and four clear content tabs.
