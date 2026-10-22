# Champion resistances

Kit Overview and roster quick views distinguish **Immunity** from **Resistance** under one protection section. Resistance keeps the effect-specific activation, synergy, recipient and lifetime conditions in the existing reviewed source copy. It never implies that an effect cannot apply, even when the recorded reduction is 100% or greater.

Roster filtering defaults to actual immunities. **Include resistances** explicitly broadens protection matches, including conditional sources; check the expanded source before choosing a counter. General damage mitigation and Physical/Energy/Critical resistance ratings stay in ordinary abilities.

## Storage and projection

`ChampionAbilityResistance` maps an original `ChampionAbilityLink` to a target `Ability`, mechanism, optional fixed percentage and hash-bound evidence. This preserves original links, partner IDs, source text and independently reviewed overview records. `AbilityLinkType` remains unchanged for existing editors, bot commands and importers. The web projection exposes the verified target as `RESISTANCE` without changing its stored link identity.

The server checks current source/partner bindings and referenced imported templates before attaching metadata. Cached roster links must also match the fresh source. Changed evidence hides the classification until it is refreshed. The source and overview remain available through their original paths.

Fixed percentage labels require a matching slot-1 imported display binding without growth or stat-dependent formulas. Ambiguous, legacy-only, signature-dependent and per-stack values remain absent from numeric metadata. Their conditions are still shown. Synergy values are not inferred from native combat bindings. Onslaught's 150% reductions use the same source/binding checks as other champions, with no ID override.

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

Apply backs up the existing resistance table, validates the snapshot, source, current overview, live target catalog and same-champion numeric evidence, and inserts metadata in a serializable transaction. It refuses duplicate applications and source/evidence drift. Original links, summaries, partners and imported ability texts are hashed before and after. Plan, backup and receipt files use exclusive creation; verify compares exact metadata and protected poststates. This CLI does not overwrite an existing classification: a later correction needs an explicit reviewed update workflow.

The initial local pass added 134 target applications across 83 champions, including 10 verified fixed percentages. Rintrah link 24531 was excluded because it has no current non-null reviewed condition. Artifacts, candidate revisions and the final source-preservation receipt are in `D:/CereBro-artifacts/champion-resistances-20261022-r1/classification-final`.

This feature's local migration and classifications are not a production deployment. A release must carry both the new schema and reviewed metadata; deploying only the web code leaves the section without the new classifications.
