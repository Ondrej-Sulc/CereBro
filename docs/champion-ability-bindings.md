# Game ability numeric bindings

The previous extraction pipeline guessed placeholder fields from English sentence context. Two incorrect schema assumptions made that especially unreliable: protobuf `BCGStatModifier` field 13 was named `base_val` (it is **Chance**), and field 14 was named `chance` (it is **Modifier**). Top-level field 21 was interpreted as a Buff parameter order; the named contract identifies it as `parent_child_mods`, with field 6 `OverwriteChildFields`. It is inheritance metadata, not display argument order.

The renderer then applied more heuristics. A `%` elsewhere in surrounding text could override a selected field; counts marked with a percentage multiplier became 100 instead of 1. A special `% of a Bar of Power` extraction rule selected field 24 (Stackable) ahead of the actual Modifier. Champion-specific overrides concealed some cases without repairing the imported bindings.

## Verified game contract

`GameUtils.GetFormattedLocalizedBuff` passes four fixed arguments to string formatting. Named protobuf metadata, the existing ISIL method dump, and a direct read-only disassembly of the current installed `GameAssembly.dll` corroborate the fields and scaling. The current formatter was located at RVA `0x359f460`; its constants resolve to 100 and 0.01. This address is evidence for this local build, never a runtime dependency.

| Slot | Named game field | Protobuf tag | Display operation |
| --- | --- | --- | --- |
| `{0}` | Chance | 13 | ×100, rounded to two decimal places |
| `{1}` | Modifier | 14 | absolute result of the explicit DisplayFormula |
| `{2}` | Duration | 15 | rounded to two decimal places |
| `{3}` | Stackable | 24 | integer |

The localized prose does not determine the slot's meaning. For example, a count can occupy Chance and be encoded as 0.03 → 3, or occupy Modifier with an identity formula and be encoded as 1 → 1. Duration may hold a displayed cutoff or percentage in an information-only component.

The current BCG catalog defines five formulas: `mod_x_vara` (Modifier × coefficient A), `mod_x_attk` (Modifier × selected Attack), `mod_x_hp` (Modifier × selected Max Health), `standard` (rating conversion using the catalog's A/B), and `standard_critdam` (Critical Damage rating using A/B/C). An absent DisplayFormula uses Modifier unchanged. The game formula catalog supplies all coefficients; no effect-name or champion-ID table is involved.

Growth applies only to the exact `GrowthTarget` field. Named growth curves use base + A × sig^exponent + B × sig + C. The legacy fallback is base + base × GrowthConst × ln(sig). At sig zero the growth-target field becomes zero. Other slots remain static. Signature text and charts consume the same verified binding, rather than independently guessing their conversions.

## Extraction and future imports

```powershell
python -B src/scripts/extract-mcoc-ability-bindings.py `
  --schema=D:/CodexArtifacts/mcoc-relic-data-2026-10-18/protobuf-schema.json `
  --out=D:/CereBro-artifacts/champion-ability-bindings/20261020-r1/bindings.json
```

The extractor reads the original `champions.json`, `ability_display_debug.json`, and current BCG binary; it does not modify game files. `--scripts-dir` and `--bcg` can select another extraction. It checks the named schema and compares relevant raw component fields in the debug export with the actual BCG before emitting bindings. Shared HUDs are selected through the champion's explicit rank/panel component IDs; if several candidates remain, every requested display argument/formula/growth binding must agree. Missing curves, unknown formulas and differing shared-HUD arguments are reported in `held`.

Existing databases use the bounded source-only repair:

```powershell
pnpm exec tsx src/scripts/repair-champion-ability-bindings.ts `
  --bindings=<bindings.json> --run-dir=<new-artifact-directory>
# Inspect the saved plan and original rows, then apply that exact plan:
pnpm exec tsx src/scripts/repair-champion-ability-bindings.ts `
  --bindings=<bindings.json> --run-dir=<same-artifact-directory> --write
```

It requires exact game/source IDs, raw text, component and HUD identities. It preserves every original record ID, text node, markup, section, ordering field and overview summary. Only numeric value-node sources change. Local-only serializable transactions, locked snapshot checks, backups, journals and exact poststates protect the operation. Replanning after application must produce zero updates. An existing explicit `--champion-bindings` manifest can provide a previously verified missing catalog identity; it never changes `Champion.gameId`.

A complete future description import accepts `--ability-bindings=<bindings.json>` alongside `--display-metadata=<display.json>`. For the admin upload workflow, the extractor's optional `--champions-out=<new-path>` writes a regenerated champions file with verified bindings embedded. It refuses to overwrite the original export. Both the CLI and admin service reject numeric records without verified bindings **before any writes**, preventing a legacy export from restoring guessed values.

## Local result, 2026-10-20

5,060 exact matching paragraphs across 334 catalog records were regenerated and applied locally. At signature levels 1/99/200, the comparison evaluated 24,759 numeric occurrences in 5,041 records with available stats; 2,042 paragraphs across 332 records differ numerically from the old renderer. These counts include both substantive corrections and smaller precision differences; they are not a count of independently hand-reviewed gameplay errors. All evaluated bindings resolved. Nineteen additional Nameless Grandmaster records have no local stat rows, so selected-build numerical comparison was unavailable for those records.

146 numeric rows in seven NPC records remain unmodified because their catalog game identities are absent: Ares, Hulk Bahamet, Iron Man Cerastes, Glykhan, Carina Chronoserpent, Black Widow Scytalis and Nameless Collector. The export also reports a missing `crv_aol_loki_ui` for an unmapped quest Loki variant; no coefficient was invented. These are separate numeric audit limitations, not the earlier 1,121 section-display exceptions, which were resolved previously.

Artifacts, including original rows, before/after hashes, comparison details, current-native formatting evidence and the local transaction receipt:
`D:/CereBro-artifacts/champion-ability-bindings/20261020-r1`.

Regression checks cover raw captured game components, ID-independent resolution, all five formulas, signature growth, text/chart agreement, drift refusal, shared-HUD selection, importer refusal and jsonb-order-independent idempotence. Run the two `test_extract_mcoc_ability*.py` suites plus `game-binding.test.ts`, `championAbilityBindingService.test.ts` and the Full Abilities/kit tests.
