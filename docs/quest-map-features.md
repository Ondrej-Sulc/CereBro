# Quest gates and path pickups

The map uses a 45-degree clockwise presentation transform. Native coordinates, edges, portal destinations and route membership are unchanged. The main map, overview, labels and directional flow all use the same projected points. Marker spacing includes positioned gates and pickups.

`src/data/game-quests/map-features.json` is an independent public-definition overlay. Each layer binds the quest ID, map ID, original source hash and published map file hash. The original map exports remain unchanged. The loader checks gate references, tile membership, route membership and reward quantities before attaching a layer. The strict public schema rejects unexpected fields, including collection state.

Gate definitions preserve native champion alternatives, class and rarity combinations, count operators, tag group logic, and resource costs. Tag arrays use OR between groups and AND between colon-separated terms; negated terms remain negated. Definitions without a recorded position are displayed separately and never receive an invented map marker. These rules do not establish a player's eligibility or whether a gate is currently open.

Path rewards retain individual placements and native quantities/ranges. Sharing a tile across routes does not duplicate its rewards. The map inspector and compact Path rewards section use the same display projection; each reward links back to its map location. Collected/claimed lists and account progress are excluded.

The reviewed overlay covers all 234 public maps, 99 positioned gates, 558 additional gate definitions and 1,335 pickups. The public-ID list follows the runtime's progressed catalog, including the 23 Special quests absent from the original permanent list. Fourteen Act 10 sources omit the path-reward field; those maps explicitly retain unknown coverage. Mausoleum has four seven-star Deathless Signature Stone placements of ten each, and four six-star placements of fifty each.

The path-reward presentation supplement joins exact GameStore, Gacha and blueprint identities. Original PNG bytes, native references, localization and source hashes are retained. It supplies seven definitions missing from the existing global reward catalogs; the other tokens reuse their existing resolvers.

## Preparation, chests and portals

`quest-details.json` binds a separate strict public layer to each of the 234 exact map/source versions. It adds energy per tile, the native recommended team rating, meaningful team-size limits and 72 champion requirements. Comma-separated restriction groups are alternatives; colon-separated terms must all match the same champion. The preparation summary preserves zero energy, omits an unknown zero maximum and hides a trivial minimum of one unless an upper bound is known. Recommendations are distinct from entry requirements. Nonpositive ratings and exceptionally large ratings of 9,999,999 or more are omitted by an explicit presentation policy, not a claimed native sentinel rule.

The layer preserves 1,108 individual chest placements through the exact native `tile.item` to quest chest-table join. These are separate from fixed pickups and do not establish contents or quantities. Twelve exact native chest assets reuse unchanged original game PNGs; unsupported assets use a neutral chest graphic. Shared routes do not duplicate a chest. Act 10 omits the chest placement field on 16 maps; their About this map disclosure retains this unknown coverage.

Selecting a portal lists its recorded destinations and focuses the exact chosen tile. Human native labels are used where available. Empty/generic labels receive numbered destinations. The saved zero probability fields do not establish meaningful odds, so no probabilities are displayed. Choice-node events and route energy totals are not inferred from incomplete definitions.

Offline reproduction (frozen sources must be available at the exporter paths or supplied through its CLI options):

```powershell
python -X utf8 -B scripts/game-quests/build_map_features.py --verify
python -X utf8 -B scripts/game-quests/build_path_reward_artwork.py --check
python -X utf8 -B scripts/game-quests/build_quest_details.py --verify
python -X utf8 -B scripts/game-quests/build_chest_artwork.py --check
python -X utf8 -B -m unittest discover -s scripts/game-quests -p test_map_features.py -v
python -X utf8 -B -m unittest discover -s scripts/game-quests -p test_build_path_reward_artwork.py -v
```

The extraction uses frozen public definitions and pinned native consumer semantics. No new game session or process capture is required.
