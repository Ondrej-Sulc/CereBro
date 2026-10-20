# Champion effect enrichment

The enrichment workflow reads the local game-description import and classifies each application of an effect separately. Independent agents draft and review each champion; the batch CLI validates their artifacts and applies approved changes to the local database.

## Workflow

1. Export an immutable roster snapshot, canonical ability catalog and individual champion inputs.
2. Draft one champion at a time. Account for every existing link and cite exact imported evidence for changes, splits and additions.
3. A different agent reads the full evidence and checks classifications, source restrictions, omissions, effect names and actual immunities. Reviews reference the exact draft hash.
4. Archive rejected drafts and reviews, revise the draft, and obtain a new independent review. An approval for an earlier draft cannot approve a revision.
5. Validate approved artifacts, apply them locally, and retain transaction receipts. Check roster coverage and report unsupported evidence separately.

Form (`BUFF`, `DEBUFF`, `PASSIVE`, `UNKNOWN`) and direction (`GAIN`, `INFLICT`, `UNKNOWN`) are independent. A champion can receive a Debuff or apply a Buff to their opponent. A condition mentioning another effect does not establish that the champion applies it. Secondary properties do not automatically inherit their parent effect's form. Immunities always use `UNKNOWN` direction; partial resistance and purification are different mechanics.

Imported qualitative descriptions are the authority. Preserve numeric placeholders rather than inventing values. Legacy sources remain comparison context; a missing mention alone does not justify deleting them. Unknown metadata is allowed when evidence is insufficient. Synergy changes retain the exact required partners, obtainable rarities and stacking restrictions.

## CLI

```powershell
pnpm exec tsx src/scripts/champion-effect-enrichment.ts snapshot --out-dir=scratch/champion-enrichment/my-run
pnpm exec tsx src/scripts/champion-effect-enrichment.ts validate --run-dir=scratch/champion-enrichment/my-run --require-review --require-complete
pnpm exec tsx src/scripts/champion-effect-enrichment.ts apply --run-dir=scratch/champion-enrichment/my-run
```

Use `'--champion-ids=790,612'` to validate or apply a subset. Quote comma-separated arguments in PowerShell. Without `--require-complete`, validation can inspect work in progress; its counts must not be treated as full-roster completion.

The snapshot creates `manifest.json`, `snapshot.json`, `catalog.json` and `inputs/<id>.json`. Drafts belong in `drafts/<id>.json`, reviews in `reviews/<id>.json`. Schemas and hash helpers are exported by `src/domain/champion-effect-enrichment.ts`. Use its `artifactHash` function rather than inventing an alternative canonical JSON sort order. Use `buildEnrichmentSynergyRequirement` to preserve complete source requirements.

Agents write artifacts; the coordinator alone applies database changes. No external model API is called by this CLI. Run directories belong under ignored `scratch/` because they contain local data and backups.

An explicitly authorized positive-evidence correction can use `action: "remove"`, with nonempty exact evidence and a `policyHash` bound to that run's `removal-policy.json`. The policy lists exact champion/link/ability/type/source identities and separately attributed primary evidence. Removal is refused without the matching policy, source identity and independent current review. Policy quotations are separate evidence, never fabricated imported documents. A missing current description alone does not authorize removal; nonempty replacements remain required for splits. Removal uses the same transaction, backup, intent, recovery journal, receipt and guarded restore path as other changes.

## Application and recovery

Writes require a loopback database host and an independently approved review of the current draft. The CLI validates all selected champions before the first write, creates a complete backup of affected tables, then applies each champion in a transaction. Input drift, stale approvals and unexpected database edits cause a refusal instead of an overwrite.

An intent is written before mutation and an application journal before transaction commit; receipts allow an interrupted run to resume without duplicating effects. Metadata updates retain the original link and teammate relationship IDs. Replacement splits and additions create distinct applications.

To reverse applied champions while their data still matches the application receipts:

```powershell
pnpm exec tsx src/scripts/champion-effect-enrichment.ts restore --run-dir=scratch/champion-enrichment/my-run '--champion-ids=790,612'
```

Restore refuses to overwrite subsequent edits. A restored champion requires a new run before reapplication. Never discard a run's backup, intents or receipts while it may need to resume or restore.
