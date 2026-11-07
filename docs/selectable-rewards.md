# Selectable reward definitions

Crystal prize rows with type `sra` contain a selector object ID, rather than a
GameStore item ID. `src/data/game-selectable-rewards/catalog.json` supplies exact
names, descriptions and activation-icon references from the game's
`SelectableRewardsState.Available` definition dictionary. It currently resolves
all 111 selectors referenced by the recorded opening catalog.

The Jubilant 2025 definitions resolve as follows:

| Exact reward ID | Game name |
| --- | --- |
| `69152ddc4d51d164bc3ea06f` | 7-STAR LIMITED POOL SELECTOR 2025 |
| `690aa4e61db43a840da0c130` | 7-STAR RARE CHAMPION SELECTOR |

The binding comes from the registry's dictionary key and `SRId` field, rather
than prize ordering or odds-label similarity. `SelectableRewardsRedeemerMapping`
uses the set's `Name` for labels and `SRAIconPath` for activation rewards.
Its generic-icon and hidden-box-preview branches do not establish identity for
unresolved selectors; these retain a readable “Reward selector” fallback.

The captured catalog is a presentation sidecar. It does not assert current
availability, flatten selector choices into direct crystal champion drops, or
alter probability evidence. The two Jubilant selectors are selectors, so their
cards do not incorrectly link to crystal pages. Their actual game icons are
published through the shared immutable reward-artwork pipeline.

## Reproduce

`capture_mcoc_selectable_rewards.py` requires the already running Windows game
and the reviewed named field-layout export. It checks the GameAssembly hash and
Fuse.Runtime metadata/field contracts before bounded read-only process access.
It reads only public metadata for IDs referenced by the opening catalog. It
never reads `Active` user sets, inventory, eligibility results or credentials,
and performs no game calls, writes, purchases or claims. A changed game binary
requires review before its offsets can be used.

```powershell
python scripts/capture_mcoc_selectable_rewards.py `
  --layout temp/selectable-rewards/layouts.json `
  --out src/data/game-selectable-rewards/catalog.json

python scripts/extract_mcoc_selector_artwork.py `
  --catalog src/data/game-selectable-rewards/catalog.json `
  --base-manifest temp/reward-artwork/local-collections.json `
  --assets temp/reward-artwork/assets `
  --download-cache temp/reward-artwork/downloads `
  --manifest temp/reward-artwork/local-selectors.json

pnpm exec tsx src/scripts/publish-mcoc-reward-artwork.ts --manifest=temp/reward-artwork/local-selectors.json
pnpm exec tsx src/scripts/publish-mcoc-reward-artwork.ts --manifest=temp/reward-artwork/local-selectors.json --upload-assets
```

The named layout format contains `sources[{path,sha256}]` and
`types[fullName].fields[{name,type,offset,static}]`, exported from the reviewed
Cpp2IL Fuse.Runtime.dll without loading game code. Required field contracts and
accepted binary hashes are explicit in the capture script.

The artwork extension records the selector catalog's exact SHA-256 and its
capture/binary provenance. All 111 bindings resolve to 29 source references and
22 unique lossless WebPs, stored in the existing champion-image bucket (19 new objects and three reused objects). Existing
reward bindings remain unchanged. Public URLs and bytes were verified before
the manifest was updated.

Checks: the `selectable-rewards` domain/data tests, Jubilant page-reward regression
test, reward-display/artwork suites, and the selector capture/artwork Python suites.
