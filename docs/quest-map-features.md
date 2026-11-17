# Quest gates and path pickups

The map uses a 45-degree clockwise presentation transform. Native coordinates, edges, portal destinations and route membership are unchanged. The main map, overview, labels and directional flow all use the same projected points. Marker spacing includes positioned gates and pickups.

`src/data/game-quests/map-features.json` is an independent public-definition overlay. Each layer binds the quest ID, map ID, original source hash and published map file hash. The original map exports remain unchanged. The loader checks gate references, tile membership, route membership and reward quantities before attaching a layer. The strict public schema rejects unexpected fields, including collection state.

Gate definitions preserve native champion alternatives, class and rarity combinations, count operators, tag group logic, and resource costs. Tag arrays use OR between groups and AND between colon-separated terms; negated terms remain negated. Definitions without a recorded position are displayed separately and never receive an invented map marker. These rules do not establish a player's eligibility or whether a gate is currently open.

Path rewards retain individual placements and native quantities/ranges. Sharing a tile across routes does not duplicate its rewards. The map inspector and compact Path rewards section use the same display projection; each reward links back to its map location. Collected/claimed lists and account progress are excluded.

The reviewed overlay covers 211 maps, 74 positioned gates, 510 additional gate definitions and 1,301 pickups. Fourteen Act 10 sources omit the path-reward field; those maps explicitly retain unknown coverage. Mausoleum has four seven-star Deathless Signature Stone placements of ten each, and four six-star placements of fifty each.

The path-reward presentation supplement joins exact GameStore, Gacha and blueprint identities. Original PNG bytes, native references, localization and source hashes are retained. It supplies seven definitions missing from the existing global reward catalogs; the other tokens reuse their existing resolvers.

Offline reproduction (frozen sources must be available at the exporter paths or supplied through its CLI options):

```powershell
python -X utf8 -B scripts/game-quests/build_map_features.py --verify
python -X utf8 -B scripts/game-quests/build_path_reward_artwork.py --check
python -X utf8 -B -m unittest discover -s scripts/game-quests -p test_map_features.py -v
python -X utf8 -B -m unittest discover -s scripts/game-quests -p test_build_path_reward_artwork.py -v
```

The extraction uses frozen public definitions and pinned native consumer semantics. No new game session or process capture is required.
