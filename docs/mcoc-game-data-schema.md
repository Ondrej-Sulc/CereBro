# MCOC Game Data Schema Plan

## Goal

Store game-extracted champion stats in CereBro without replacing the existing champion content model yet.

The immediate scope is rank/stat data from the local game extraction pipeline:

- Runtime AD capture from `mcoc_ad_log.csv`.
- Static rank data from `stats_per_rank.json`.
- Tier metadata from `hero_tiers.json`.
- Collectable roster source from `mcoc_collectable_blueprints.csv`.

Champion descriptions, glossary links, and signature curves are planned as a later layer, but the storage direction is included here so the stats schema does not paint us into a corner.

## Current Baseline

CereBro already has a canonical `Champion` model. It should remain the app-facing champion entity.

The game extraction currently has full coverage for the game collectable catalog:

- Collectable base champions: `352`.
- Blueprint tiers: `2,107`.
- Rank rows: `9,833`.
- Missing rank rows: `0`.

## Champion Identity

Add a game-native ID to the existing `Champion` model:

```prisma
model Champion {
  id     Int     @id @default(autoincrement())
  name   String  @unique
  gameId String? @unique

  stats ChampionStats[]
}
```

`gameId` is the base game ID, for example:

- `absorbingman`
- `quake`
- `brothervoodoo`
- `summoned_symbiote`

Do not add duplicate game names such as `gameFullName` or `gameShortName` in this pass. CereBro's existing `name` and `shortName` remain canonical. The importer should report name differences for review, such as punctuation or ligature differences.

## ChampionStats

Use one row per game tier and rank. This intentionally merges tier metadata and rank stats into one table. The total row count is small, and the denormalized tier fields make queries and imports simpler.

```prisma
model ChampionStats {
  id         Int @id @default(autoincrement())
  championId Int

  tierId      String
  rarity      Int?
  rarityLabel String?
  rank        Int
  level       Int?

  challengeRating Int

  health Int?
  attack Int?

  healthRating Int?
  attackRating Int?
  prestige     Int?

  armorRating             Int?
  armorPenetration        Int?
  criticalRating          Int?
  criticalResistance      Int?
  criticalDamageRating    Int?
  blockProficiency        Int?
  blockPenetration        Int?
  specialDamageMultiplier Float?
  energyResistance        Int?
  physicalResistance      Int?

  baseAbilityIds String[]
  sigAbilityIds  String[]

  champion Champion @relation(fields: [championId], references: [id], onDelete: Cascade)

  @@unique([tierId, rank])
  @@index([championId])
  @@index([rarity, rank])
  @@index([challengeRating])
}
```

`tierId` is the game tier blueprint ID, for example:

- `absorbingman_t7`
- `quake_leg`
- `summoned_symbiote_mls`

No separate suffix field is required for now. Suffix can be derived from `tierId`, while `rarity` and `rarityLabel` are better for application queries.

## Field Mapping

The importer maps source field names into readable database names.

| Database field | Source |
| --- | --- |
| `Champion.gameId` | base ID from collectable catalog / `champions.json` |
| `ChampionStats.tierId` | `blueprintId` / hero tier ID |
| `rarity` | `hero_tiers.json.rarity_num` |
| `rarityLabel` | `hero_tiers.json.rarity_label` |
| `rank` | static rank row / AD row |
| `level` | static rank row / AD row |
| `challengeRating` | static `challenge_rating`, checked against AD `challengeRating` |
| `health` | AD `hpMax` |
| `attack` | AD `attack` |
| `healthRating` | AD `hrHP` |
| `attackRating` | AD `hrAtk` |
| `prestige` | AD `heroRating` |
| `armorRating` | static `armor` |
| `armorPenetration` | static `armor_pen` |
| `criticalRating` | static `crit_rate` |
| `criticalResistance` | static `crit_resist` |
| `criticalDamageRating` | static `crit_damage` |
| `blockProficiency` | static `block_prof` |
| `blockPenetration` | static `block_pen` |
| `specialDamageMultiplier` | static `special_dmg` |
| `energyResistance` | static `energy_resist` |
| `physicalResistance` | static `phys_resist` |
| `baseAbilityIds` | static `base_ability_ids` |
| `sigAbilityIds` | static `sig_ability_ids` |

`healthRating + attackRating` should normally equal `prestige`. Small rounding deltas have been observed in extracted rows, so validation should report deltas rather than assuming exact equality is guaranteed.

## Relation To ChampionPrestige

`ChampionStats.prestige` stores the extracted sig-0 baseline from the game.

Existing `ChampionPrestige` stores prestige by `(championId, rarity, rank, sig)`. Keep it for now. Later, after signature-curve math is solved, `ChampionPrestige` can be regenerated from:

- `ChampionStats.prestige`
- signature curve parameters
- selected rarity/rank/sig

Do not remove or merge `ChampionPrestige` in the stats migration.

## Import Pipeline

Create a canonical export in the extraction project before writing to CereBro:

`mcoc_game_stats.json`

The exporter should join:

- `mcoc_collectable_bases.csv`
- `champions.json`
- `hero_tiers.json`
- `stats_per_rank.json`
- `ad_log_normalized.csv`

Then add a CereBro importer:

`src/scripts/import-mcoc-game-stats.ts`

Importer behavior:

1. Load and validate the canonical JSON.
2. Match each base game ID to `Champion.gameId`.
3. If `gameId` is missing, attempt normalized-name matching.
4. Fill `Champion.gameId` only after a confident match.
5. Upsert `ChampionStats` by `(tierId, rank)`.
6. Emit a review report.

The importer should support dry-run mode before writing.

## Import Validation

Every import should report:

- Total collectable bases.
- Total tier IDs.
- Total rank rows.
- Missing `Champion` matches.
- Existing `Champion` rows not linked to game IDs.
- Game full-name vs CereBro name mismatches after normalization.
- Static rows without runtime AD values.
- Runtime AD values without static rows.
- Static `challengeRating` vs AD `challengeRating` mismatches.
- `healthRating + attackRating - prestige` delta distribution.

## Description Storage Direction

Do not implement this in the first stats migration, but this is the intended shape.

Descriptions should not be stored only as rendered text. Store structured source templates and render at runtime for selected rarity, rank, and signature level.

```prisma
model ChampionAbilityText {
  id         Int @id @default(autoincrement())
  championId Int

  sourceId  String
  group     String
  title     String?
  sortOrder Int
  template  Json

  champion Champion @relation(fields: [championId], references: [id], onDelete: Cascade)

  @@unique([championId, sourceId])
  @@index([championId, group])
}
```

`template` should be a JSON AST. Example node types:

- `text`
- `value`
- `glossary`
- `lineBreak`
- `paragraph`

Example:

```json
{
  "blocks": [
    {
      "type": "paragraph",
      "children": [
        { "type": "text", "value": "Gain " },
        {
          "type": "value",
          "key": "carl_sig_dur_edit_200",
          "format": "percent",
          "source": {
            "kind": "sigCurve",
            "curveId": "carl_sig_dur_edit"
          }
        },
        { "type": "text", "value": " increased " },
        { "type": "glossary", "id": "armor_up", "label": "Armor Up" },
        { "type": "text", "value": "." }
      ]
    }
  ]
}
```

## Signature Curves

Signature and ability curves should be separate records referenced by description value nodes.

```prisma
model ChampionAbilityCurve {
  id         Int @id @default(autoincrement())
  championId Int?

  curveId String @unique
  kind    String
  formula String
  params  Json
  minSig  Int?
  maxSig  Int?

  champion Champion? @relation(fields: [championId], references: [id], onDelete: Cascade)
}
```

Known decoded sig text curve shape:

```text
curve_value = f2 * sig^f5 + optional f3*sig + optional f4
```

Some displayed values are:

```text
(base ability value + curve_value) * 100
```

Store both raw curve fields and normalized formula parameters in `params` until the curve system is fully proven across champions.

## Glossary Tooltips

Glossary references should be normalized so UI can render clickable links/tooltips.

```prisma
model GameGlossaryTerm {
  id          String @id
  name        String
  description String?
  category    String?
  raw         Json?
}
```

Description `glossary` nodes reference `GameGlossaryTerm.id`.

## Implementation Order

1. Add canonical `mcoc_game_stats.json` exporter in the extraction project.
2. Add Prisma schema changes for `Champion.gameId` and `ChampionStats`.
3. Add `import-mcoc-game-stats.ts` with dry-run/report mode.
4. Run dry-run and fix champion mapping issues.
5. Run import and verify counts.
6. Add description/glossary/curve models in a later migration.
