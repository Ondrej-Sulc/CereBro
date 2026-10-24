# Full synergy card display

The Synergies tab uses `groupChampionSynergyFamilies` after `buildChampionSynergyView` has selected the current champion, rarity and owned/incoming direction. The raw catalog cards remain separate for effect-source matching and detailed navigation.

First, `groupChampionSynergyCards` combines identical rarity imports when their full name/level, rendered bonus content (including glossary semantics), stacking flag, partner identities and catalog member identities match. This folds repeated imports such as Hulk (Ragnarok)'s incoming It's Complicated Lv. 3 cards into one bonus row. Different amounts, recipients or rules remain distinct rows.

Then explicit `Lv. N` variants of the same named family, partner set, catalog members and stacking flag share a card. Its partner header appears once, followed by rows in numeric level order. Each row preserves its complete bonus text, glossary help and correlated star requirements; values are not inferred or summarized into a range. Non-leveled names and unknown availability stay separate. If only one variant applies to the selected champion build, its original single-card presentation remains.

Availability remains explicit. Single-partner stars can be combined only when the current champion's star set is identical. Different current-champion stars and correlated multi-partner combinations retain separate availability rows. Unknown star metadata is not consolidated. Single-variant partner badges show their available stars directly, with existing hover/focus help retained. Family cards place the star requirements beside each level instead of implying a family-wide star range.

Grouped cards preserve every original catalog ID. Existing source links, URL fragments, focus and highlighting resolve to the relevant level row through stable aliases. Identical uniqueness notes appear once per family; differing notes remain with their rows. Search matches every level's name, partner or bonus, retains the whole matching family for comparison, and direction counts match displayed family cards. No catalog rows, original descriptions, effect-source records or reviewed overview summaries are changed.
