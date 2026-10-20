# Full ability section display

`ChampionAbilityText.template.display` stores optional display metadata independently of the original `raw` text and `blocks`. `kind: ability` identifies an actual combat paragraph; `kind: glossary` identifies HUD effect help. The latter remains available through the glossary and is not rendered as a second combat paragraph. `section.id/title` identifies an explicit localized trigger section, such as Magical Theft, rather than a Buff name.

The game export's description alone loses this distinction. The extraction helper matches the exact panel, component, HUD and raw text against `ability_display_debug.json`. Attribute descriptions become ability paragraphs; Buff-only descriptions become glossary help. Section labels require an exact trigger ID in field 5 and its `ID_UI_STAT_ATTRIBUTE_TRIGGER_SUBTITLE_*` localization. Ambiguous or absent labels are not invented. The manifest includes hashes of all three source files.

Older champions have direct component/HUD references and an empty `panel_id`. The extractor follows `ability_to_hud` and the debug export's `displays`/`abilities` indexes for those entries, using the same identity path as the game parser. It still requires the exact localized attribute/help text; an invalid HUD mapping or raw-text mismatch is reported in `unmatched`. A nonempty but missing panel is not replaced by a guessed direct binding.

```powershell
python src/scripts/extract-mcoc-ability-display.py
pnpm exec tsx src/scripts/repair-champion-ability-display.ts
pnpm exec tsx src/scripts/repair-champion-ability-display.ts --write
```

The repair defaults to the three preview champions: Agatha Harkness, Beta Ray Bill and Silver Sable. Select an explicitly intended subset with `--champions=slug,slug`. It matches stable source IDs and exact text, refuses text drift or conflicting existing metadata, and patches only the display JSON. It never replaces IDs, titles, sort order, original paragraphs, parameter nodes, effect applications or overview summaries. A local-only transaction locks and verifies the exact snapshot and poststate; `scratch/champion-ability-display/pilot-20261019` retains the backup, manifest and receipt. It is idempotent. Broader display repair and the roster-wide summary pass are separate work.

For a champion with no stored game ID, an explicit `--champion-bindings=<file.json>` repair manifest may bind its selected source snapshot to a verified export identity:

```json
{"schemaVersion":1,"bindings":[{"championId":809,"gameId":"grandmaster_blackorder","sourceRowsHash":"<abilityDisplayBindingHash of the selected rows>"}]}
```

The hash binds each selected row's ID, champion, existing game ID, source ID and exact raw text. The binding refuses a changed/incomplete snapshot, duplicate or unselected champion, and any existing game ID. It is a display-repair alias: `Champion.gameId` remains unchanged. Its complete definition and hash are included in the backup and receipt. Nameless Grandmaster's 85 stored paragraphs match this export identity exactly.

Keep historical metadata inputs intact when regenerating: use `--out=<new-file>` and pass that file to the repair with `--metadata=<new-file>`.

For a future complete game description import, provide `--display-metadata=scratch/ability-display-metadata.json` to `import-mcoc-game-descriptions.ts` so the metadata survives import. Use the bounded repair for an existing database; do not replace all description rows just to add display metadata.

Numeric bindings are a separate extraction concern; see [Game ability numeric bindings](champion-ability-bindings.md). The renderer now follows the game's positional formatter and explicit display formulas, including paragraphs that use several different percentages/counts in one sentence.

When every visible paragraph in a special group has the same explicit `SPECIAL23` trigger section (or another explicit multi-special trigger), the reader promotes that shared section title to the card. Both attacks' imported names and flavor descriptions appear above the rules, which render once. Both chapter aliases and attack links resolve to the shared card; original record IDs and database groups remain unchanged. Mixed or unannotated sections keep their individual attack scope.

The local legacy recovery on 2026-10-20 resolved all 1,121 previously unmatched rows across 74 champions: 954 combat paragraphs and 167 glossary entries, with 104 explicit localized section labels. The earlier 8,981 generated metadata entries remain identical. Before/after verification preserves all original text/parameter data, champion identities, effect sources, existing display metadata outside selection and overview summaries. The backup, transaction receipt and final verification are under `D:/CereBro-artifacts/champion-ability-display/legacy-recovery-20261020-r1`.

Regression checks: `python -B -m unittest discover -s src/scripts -p test_extract_mcoc_ability_display.py` and `pnpm exec vitest run src/services/championAbilityDisplayService.test.ts web/src/lib/champion-ability-text.test.ts web/src/lib/champion-ability-search.test.ts`.

The Full Abilities reader presents each explicit section as a lightly tinted panel and each original source as a semantic list row with a decorative marker. Source anchors, search, keyboard popovers and full available text width are preserved. Number styling is inline rather than boxed; glossary links retain their game hue with a lighter text blend for contrast.

The earlier Karolina/Agatha/Pavitr/Nico renderer exceptions were removed on 2026-10-20. Regenerated `gameBinding` sources fix count scaling, rate/cap confusion and percentage-context leakage through one shared implementation. The bounded numeric repair replaces only value-node sources; original text, markup, headings and overview summaries are unchanged.
