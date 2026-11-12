# Node locations and reward sources

Native node pages link to current public Story/Special encounters, approximate encounter regions and Class/Challenge/Event Tower rules or floors. The quest projection uses the same source/map/application/version bindings as the modifier links. Tower projection requires an exact native definition version in the node catalog. It never joins curated nodes by name. Region-wide claims require the same effect and description on every possible region tile.

`/rewards` searches exact native reward identities and lists their quest, Act, Chapter, block and floor sources. Type and data token form the identity; names, images and quantities do not merge item variants. Completion, exploration, potential, first-completion maximum, replay, block and floor scopes remain separate, as do repeated native grant rows. Entry costs, unspecified placeholders and unproved rating grants are excluded. Availability and potential rewards remain qualified in the UI.

Quest links select the defender or region. Tower links reveal the matching block/floor modifier, or open the target floor's reward disclosure. Parent reward links select the matching collection and scroll to the actual scope. Crystal detail pages use their exact opening token to link back to reward sources; crystal and shard identities remain separate.

The offline builder reads the accepted source readers without game access, networking or database queries:

```powershell
pnpm exec tsx scripts/build-game-discovery.ts
pnpm exec vitest run --config web/src/lib/game-discovery/vitest.config.mts
```

The generated `src/data/game-discovery/index.json` shares repeated location strings through an internal location table. Server readers expand only the requested node or reward; pages render at most 20 source rows or 24 reward choices. Raw sources, definition versions and evidence catalogs are not shipped to the client. The source regeneration test compares the complete compact artifact against a fresh projection and runs in CI.

Source presentation reuses the existing reward resolver and rank/signature overlays. Searches tolerate ordinary punctuation and spacing differences such as ISO8 and block100, while the resulting links always retain exact native identities. The champion quest lookup uses compact result rows and a collapsed Change champion control; filters and distinct encounter destinations remain intact.
