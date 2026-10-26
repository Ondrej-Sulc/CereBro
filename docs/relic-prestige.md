# Relic prestige

Status (26 October 2026): captured, imported locally and integrated into relic detail pages on `feat/relic-prestige`. No production import or deployment has been performed.

## Coverage and meaning

- 145 relic definitions, including individual Statcast secondary variants.
- All 458 public relic/rarity combinations and 2,026 rank/rarity combinations.
- 407,226 exact ratings: every supported rank and signature 0?200. Statcasts are limited to the catalog's public 5?7-star rarities.
- Each rating uses **all unlocked runes at their maximum levels for that rank**. It is not a rating for arbitrary rune levels or a player's owned relic.

Rune levels affect prestige. For example, 6-star Ant-Man at rank 1/signature 0 returns 831 with maxed level-10 runes, versus 408 with level-1 runes. At maxed runes, signature 100 returns 1,202 and rank 5/signature 200 returns 2,527. These are direct game responses, not interpolations.

The page provides rank buttons, a signature slider and a numeric signature input. Rank/signature are preserved in URL query parameters; rarity and secondary variant changes retain them and clamp selections to valid bounds. The family's captured curves load together, so changing a control needs no server round trip. The panel states its max-runes basis. Ability descriptions continue to show rarity-wide progression ranges, independently of these prestige controls.

## Game evidence

`RelicInstance.Pi` supplies the rating used by `GameRelicUtils.GetRelicRating` and the relic prestige comparator. The authenticated client calls the read-only `Relics2API.GetRelicsPi` endpoint, POST `/relics2/relicsPi`. Each request identifies `Id`, `RarityId`, `Rank`, `InnateAbilityLevel` and `SocketRanks`; the response includes the same identity, socket ranks and integer `Pi`.

The source unlock configuration, rarity-order strategy, `UnlockOrder`/`UnlockRank`, and per-rank socket-level limits determine the requested rune configuration. Alternative rune choices must agree on their level bounds. The TypeScript plan independently matched the full capture plan.

Fourteen single-build probes established response identity, signature-zero and rune-level behavior. Batch probes then verified 2, 100 and 1,000 builds. The full capture completed in 408 sequential batches, with one request in flight, a 500 ms cooldown and no errors or retries. Response order is not assumed. No account progression or relic upgrades were performed. The account's owned-relic UI was locked, so an owned-relic display comparison was not available; the data comes from the game's rating endpoint and verified client call path.

Capture artifacts are under `D:/CereBro-artifacts/relic-prestige-20261026`. They include requests/responses, executable fingerprints, probes, scanner source/build backups, the complete package and local DB verification. The game is closed and the original installed scanner DLL is restored; the capture scanner remains archived.

| Evidence | SHA-256 |
| --- | --- |
| Source package manifest | `33e10798f68e8976bf5fc5d3aba91aceba077cb64eb71e3ed2f53e278418ba47` |
| GameAssembly | `fb24b8b5fc547790ee2e054a16026644f33ea02838572114a2224a6353cc0bd7` |
| Captured JSONL | `c6d64315c7674f79b2507a92aa3804d5a540b1c9a724af4d66ca6e9293c15ae2` |

`RelicChallengeRating` and `SupportCombatRateMultipliers` are not treated as prestige. Neither endpoint interpolation nor another variant's ratings substitute for captured builds.

## Import and storage

`GameRelicPrestige` stores one complete rank/signature table per relic/rarity, separately from catalog definitions and player prestige. Rows retain source-definition, source-package, executable and capture hashes plus capture time. Missing or stale source-package/definition bindings keep prestige hidden until a verified import refreshes it. The second additive migration deliberately leaves pre-binding rows unbound; it does not guess which source package produced them.

The importer verifies the source package and capture file bytes/hash, binds each response to its recorded request, validates exact build/rune identities, and rejects errors, gaps, duplicate builds or conflicting counts. It regenerates the expected complete plan from the source package. Before writing, it rechecks current source identities and all selectable rarity coverage under the same transactional advisory lock as the catalog importer. Only prestige rows are upserted.

```powershell
# Apply additive schema and generate the client before deploying code that reads it.
pnpm exec prisma migrate deploy
pnpm prisma:generate

# Preview first. Both directories must be available on the target machine.
pnpm import:relic-prestige --source=D:/CodexArtifacts/mcoc-relic-data-2026-10-18 --capture=D:/CereBro-artifacts/relic-prestige-20261026/capture-package

# Explicit publication to the database selected by DATABASE_URL.
pnpm import:relic-prestige --source=D:/CodexArtifacts/mcoc-relic-data-2026-10-18 --capture=D:/CereBro-artifacts/relic-prestige-20261026/capture-package --write
```

The captured package contains a strict `mcoc-relic-prestige-v1` manifest and `capture.jsonl`. The raw capture is about 154 MB and stays outside Git. Deployment needs both this package and the matching original relic source package; the code/migration alone does not populate prestige. Import after the matching catalog, then restart the web process or allow the five-minute family cache to expire.

## Verification

The local import covers all 458 tables / 407,226 builds. Every stored curve and provenance field was compared with the validated capture. Before/after fingerprints confirm the existing relic, rarity, rune and source-import records are unchanged.

Automated tests cover response reordering, missing/duplicate/wrong builds, rune bounds, invalid ratings, package hashes, incomplete streams, source drift, transactional preview/write behavior, exact lookup and selection bounds. Loader tests cover variant identity and stale definition/package rejection.

Desktop/mobile browser checks cover exact Ant-Man and Kushala values, signature zero and intermediate levels, keyboard slider operation, rank clamping, preserved query/hash, and instant rarity/variant changes without RSC requests. The panel fits a 390 px viewport without horizontal overflow. Release validation commands are `pnpm test:relics`, root/web TypeScript checks, scoped ESLint and `pnpm --dir web build`.

## Local performance measurements

Measured on the production build, 26 October 2026, using the local PostgreSQL database and localhost network. These are not deployed-server or low-end-phone benchmarks.

| Page | Uncached complete HTML response | Warm median / slowest (10 requests) | Gzipped HTML body |
| --- | --- | --- | --- |
| Kushala Statcast, five variants | 1,288 ms | 49 / 79 ms | 45,381 bytes |
| Ant-Man Battlecast | 756 ms | 25 / 31 ms | 20,521 bytes |

The first Statcast request also includes a fresh server process. Ant-Man is a new family in that already-running process. Payload figures include HTML and embedded page data, but exclude separate JavaScript, CSS and images. Ten simultaneous warm Statcast requests all succeeded in 449 ms overall (slowest request 446 ms); this is a small concurrency smoke test, not a production capacity test.

Across 31 browser interactions, event-to-DOM updates took 3.6–7.4 ms: rank median 4.4 ms, signature median 4.9 ms, variant median 6.0 ms. There were no new relic-detail RSC requests and no observed long tasks during the measured repeated-interaction sequence. Exact displayed values and retained selections were checked.

The embedded preview throttled animation-frame callbacks, so these measurements deliberately make no input-to-paint, INP or LCP claim. Real-device/network-throttled testing and deployed monitoring remain separate release follow-ups. Raw measurements are `performance-http.json` and `performance-browser.json` in the capture artifact directory. Cold loading is the main remaining performance opportunity; no code or database changes were made for this measurement pass.
