# Quest gates and path pickups

The map uses a 45-degree clockwise presentation transform. Native coordinates, edges, portal destinations and route membership are unchanged. The main map, overview, labels and directional flow all use the same projected points. Marker spacing includes positioned gates and pickups.

`src/data/game-quests/map-features.json` is an independent public-definition overlay. Each layer binds the quest ID, map ID, original source hash and published map file hash. The original map exports remain unchanged. The loader checks gate references, tile membership, route membership and reward quantities before attaching a layer. The strict public schema rejects unexpected fields, including collection state.

Gate definitions preserve native champion alternatives, class and rarity combinations, count operators, tag group logic, and resource costs. Tag arrays use OR between groups and AND between colon-separated terms; negated terms remain negated. Definitions without a recorded position are displayed separately and never receive an invented map marker. These rules do not establish a player's eligibility or whether a gate is currently open.

Gate markers display exact champion portraits, native class icons, star levels, tag names or resource artwork with count badges and a small lock. A finite `gate-presentation.json` binds the exact permitted blueprints to Characters and labels; gates never become encounters or rewards. Required champion portraits join the existing public portrait batch by exact game ID. Text gates receive enough presentation spacing for their captions. Feature-only reward, gate and chest inspectors omit combat modifiers; selecting an actual defender retains them. The energy-per-tile summary reuses the canonical native `resources/resource_energy_pve` artwork.

Tag gate inspectors show complete hashtag labels, AND/OR groups, exclusions and the required champion count. Matching champions and My roster links project the original native constraints into explicit catalog/personal views, including unowned champions by default. Owned only remains an optional filter. Simple positive selections use `tags`/`tagLogic`; mixed class, grouped or negative conditions use validated `questTags` groups. Native class terms match the champion class field. Tag names join complete canonical labels, allowing only a display-leading hashtag and casing normalization. Unknown structured tags and malformed filters remain visible as removable invalid rules with zero results.

The `questGate=1` entry marker clears unrelated saved facets and starts at the top. Ordinary collection browsing retains its existing memory behavior. The filter survives catalog/personal switching and sign-in; a guest requesting their roster sees matching catalog candidates and a sign-in prompt, with the requested ownership setting preserved for the return trip. These links find individual candidates; the gate's required team count remains separate.

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

## Champion swap points

`swap-points.json` is an independent overlay for the same 234 map/source versions. It establishes 154 swap locations in 96 quests. Each point retains its exact coordinate, route membership, public definition source, swap limit and provenance for absent native defaults. The native factory recognizes `teamswap`, `swapteamselect` and `swapteamselect_alt1`; a generic choice-node flag is insufficient. Healing, reviving and skip choices do not become swap markers.

The overlay uses 112 sanitized public quest-detail previews, checked against exact quest and map identities, the definition's recorded set ID, all walkable coordinates and connection endpoints. Request-container set IDs remain distinct from returned definition-set IDs. Numeric-string portal coordinates and empty wire-grid padding are normalized without changing positions. Ordinary links that also encode the same portal connection are compared as the same graph, with portal targets checked separately. Original map exports remain unchanged.

One public geometry diagnostic was rebound offline after its original guard rejected duplicate portal-link encoding. Its original failed receipt remains unchanged; the derived source records its response hash, diagnostic hash and the corrected graph proof. Other retained public field projections were also validated offline before entering the overlay. Capture transport, session material, progress, disabled/used state and swap history are absent from the published data.

Eight Special maps retain unknown swap coverage: the four Crucible maps, Acceptance, and the three Wheel of Fate maps. Their 287 generic choice locations are not labelled as swaps. The About this map disclosure identifies incomplete coverage.

Swap markers use a cyan people-and-arrows symbol with a short Swap caption. Selecting one shows its routes and positive swap limit. Fourteen points share a portal position; both features remain visible and the exact portal destinations stay selectable. Feature-only swaps omit combat modifiers. Co-located defenders and other features retain their existing selection targets, while the overview, map key, spacing and adaptive marker sizing include the new points.

Offline reproduction with the frozen evidence package available:

```powershell
python -X utf8 -B scripts/game-quests/build_swap_points.py --verify
python -X utf8 -B -m unittest discover -s scripts/game-quests -p test_swap_projection.py -v
```
