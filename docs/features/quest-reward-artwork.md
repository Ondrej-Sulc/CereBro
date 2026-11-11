# Quest and Tower reward artwork

The shared reward-artwork manifest was extracted from crystal-drop identities.
Quest rewards and Tower prizes contain additional exact GameStore and Gacha
tokens; named items such as `rankup_epic1_chemical`, `refined_xp_token` and Saga
rank-up gems previously projected a null image URL despite valid native artwork.

`src/data/game-quests/reward-artwork` is an additive supplement. Both quest and
Tower presentation readers call `getQuestRewardArtwork`, which prefers the
unchanged shared catalog, then looks up exact type/data/role in the supplement.
It never aliases inventory IDs, substitutes full icons for fragments, fabricates
missing identities, or changes the source reward quantities or scopes.

`scripts/game-quests/build_reward_artwork.py` reads the pinned native Gacha,
GameStore, BCG, named schema and palette. It uses the existing canonical artwork
dispatch, tint and transparent lossless-WebP extraction. Existing public objects
are reused only for matching native reference and rendering metadata. Additional
images live at content-addressed local `/game-quests/reward-artwork/` URLs; no
external publication or overwrite is required. Source registry hashes, exact
references, input/output hashes and renderer metadata remain in the manifest.

The initial supplement resolves 104 additional bindings across the saved quest
and Tower corpus, reusing 22 published bindings and storing 68 unique local
images. Unsupported cosmetics, offers, event outcomes, unknown placeholders and
resource metadata stay explicit; the unresolved inventory is not a count of
missing physical prize icons. Hero portraits retain the champion pipeline.

The Event Tower increment adds six exact bindings, bringing the supplement to
110. This includes the `pve-energy` texture branch: the pinned native
`ResourceRedeemerMapping.GetTexture` explicitly joins that resource to
`resources/resource_energy_pve`. The source method hash is retained, and the
extractor regression ensures unrelated Tower energy resources do not borrow it.

Reproduce from the existing retained native sources:

```powershell
python -X utf8 scripts/game-quests/build_reward_artwork.py
pnpm exec vitest run src/tests/game-quests/reward-artwork.test.ts
pnpm exec vitest run --config web/src/lib/game-towers/vitest.config.mts
```

Override source/resource/cache/output paths with the script flags on another
machine. The generator does not read the game process or account data. The test
suite uses only the published files and checks source-bound reuse, exact roles,
every local file hash and WebP signature. The actual Tower projection regression
failed before the fix and passes with native inventory artwork.

The export reproduced byte-identically. Real browser checks on Saga block 1 and
Skill Tower block 37 confirmed all seven/six reward icons respectively, including
the previously missing icons, at desktop and phone widths. Offscreen lazy images
were scrolled into view before asserting image readiness. Evidence and inspected
captures: `temp/quest-explorer-review/reward-art-fix-20261110/`.
