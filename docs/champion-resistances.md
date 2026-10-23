# Champion resistances

Kit Overview and roster quick views distinguish **Immunity** from **Resistance** under one protection section. Resistance keeps the effect-specific activation, synergy, recipient and lifetime conditions in the existing reviewed source copy. It never implies that an effect cannot apply, even when the recorded reduction is 100% or greater.

Roster filtering defaults to actual immunities. **Include resistances** explicitly broadens protection matches, including conditional sources; check the expanded source before choosing a counter. General damage mitigation and Physical/Energy/Critical resistance ratings stay in ordinary abilities.

## Storage and projection

`ChampionAbilityResistance` maps an original `ChampionAbilityLink` to a target `Ability`, mechanism, optional fixed percentage and hash-bound evidence. This preserves original links, partner IDs, source text and independently reviewed overview records. `AbilityLinkType` remains unchanged for existing editors, bot commands and importers. The web projection exposes the verified target as `RESISTANCE` without changing its stored link identity.

The server checks current source/partner bindings and referenced imported templates before attaching metadata. Cached roster links must also match the fresh source. Changed evidence hides the classification until it is refreshed. The source and overview remain available through their original paths.

Fixed percentage labels require the target effect's protection clause in an imported combat record. A percentage can be literal game text, a slot-0 percentage argument, or a slot-1 modifier without growth or stat-dependent formulas. Bound values use the same two-decimal formatting as Full Abilities, avoiding raw float equality failures such as `40.000000596` versus `40`. Record selection recognizes effect plurals, and unrelated percentages in other clauses cannot establish a resistance value. Ambiguous, legacy-only, signature-dependent and per-stack values remain absent from numeric metadata. Their conditions are still shown. Synergy values are not inferred from native combat bindings. No champion-specific overrides are used.

## Local data workflow

Apply the Prisma migration and generate the client before running the CLI. It accepts only local database URLs. Use a new directory for each snapshot:

```powershell
pnpm exec tsx src/scripts/champion-resistances.ts snapshot --run-dir=D:/CereBro-artifacts/resistance-review
pnpm exec tsx src/scripts/champion-resistances.ts plan --run-dir=D:/CereBro-artifacts/resistance-review
# Review plan.json against snapshot.json before applying.
pnpm exec tsx src/scripts/champion-resistances.ts apply --run-dir=D:/CereBro-artifacts/resistance-review
pnpm exec tsx src/scripts/champion-resistances.ts verify --run-dir=D:/CereBro-artifacts/resistance-review
```

The proposal generator recognizes explicit incoming effect protection. It is not a universal English-language mechanic extractor. Review new phrases and extend regression coverage rather than introducing champion-specific overrides. A source with no current usable reviewed condition is excluded. General mitigation and unconfirmed legacy protections remain unchanged.

Apply backs up the existing resistance table, validates the snapshot, source, current overview, live target catalog and same-champion numeric evidence, and inserts metadata in a serializable transaction. It refuses duplicate applications and source/evidence drift. Original links, summaries, partners and imported ability texts are hashed before and after. Plan, backup and receipt files use exclusive creation; verify compares exact metadata and protected poststates.

For existing classifications, use a fresh snapshot and plan, then `plan-refresh` instead of `apply`. Review `percentage-refresh-plan.json`, then run `apply-refresh` and `verify-refresh` with the same run directory. This narrow update path permits only missing percentages to become independently evidenced fixed values, plus their imported record references. It refuses changes to the classification set, mechanism, source/review bindings or existing non-null percentages. The serializable application locks and compares the exact prior resistance table, revalidates live evidence, preserves original source/overview data, and writes separate before/receipt artifacts. It is local-only; production promotion remains a separate release step.

The initial local pass added 134 target applications across 83 champions, including 10 verified fixed percentages. Rintrah link 24531 was excluded because it has no current non-null reviewed condition. Artifacts, candidate revisions and the final source-preservation receipt are in `D:/CereBro-artifacts/champion-resistances-20261022-r1/classification-final`.

The subsequent local percentage refresh populated 30 missing values across 19 champions, bringing the fixed-percentage total to 40. Knull now has 60% Bleed, 60% Poison and 40% Degeneration resistance. All 134 classifications, the ten existing numeric values and original source/overview records were preserved. The snapshot, exact update plan, prior metadata and verified receipt are in `D:/CereBro-artifacts/champion-resistance-percentages-20261022-r1`. Production promotion must use a separate mapped update plan and receipts; its backup, clone rehearsal/rollback and verification artifacts are retained in `D:/CereBro-artifacts/champion-resistance-percentage-deployment/20261023-r1`.

This feature's local migration and classifications are not a production deployment. A release must carry both the new schema and reviewed metadata; deploying only the web code leaves the section without the new classifications.
