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

The snapshot creates `manifest.json`, `snapshot.json`, `catalog.json` and `inputs/<id>.json`. Drafts belong in `drafts/<id>.json`, reviews in `reviews/<id>.json`. Schemas and hash helpers are exported by `src/domain/champion-effect-enrichment.ts`. Use its `artifactHash` function rather than inventing an alternative canonical JSON sort order. Use `buildEnrichmentSynergyRequirement` to preserve complete source requirements. For a bonus explicitly requiring all synergy champions, pass `true` as its third argument and include the complete partner set. This emits `AND`; the default remains `OR` for ordinary alternatives and historical artifacts. Both forms require cited imported context. The kit display accepts a colon or sentence-ending period after the complete requirement header.

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

## November 3, 2026 local update

Run artifacts: `D:/CereBro-artifacts/champion-kits-20261103`.
Five newly imported playable champions received independently approved kits:
Star-Lord (Kitty Pryde), Human Torch (Victorious), Invisible Woman (Victorious),
Mister Fantastic (Victorious), and Thing (Victorious). The run added 144 effect
sources (including 16 immunity sources) and 144 separately reviewed overview
summaries. Conditional immunities and bonuses requiring the full Victorious Four
team remain explicit. New canonical effects are Ambush, Misstep, Stone Stack,
and Inequity Mastery Effectiveness Reduction.

`enrichment/history/r1` retains the rejected drafts and findings;
`enrichment/reviews` and `enrichment/receipts` bind the approved revisions and
applied poststates. `overview` contains the independent display-copy review,
backup and receipt. `verification.json` checks all selected poststates, current
summary hashes, display conditions, synergy requirements and rarity filtering.
`protected-before.json` and `protected-after.json` confirm that the other 335
playable champions' effect data, selected imported ability text, synergy catalog,
and game glossary did not change. All 340 local playable champions now have kit
links. This records local application only; production promotion remains separate.

The user then added Beast's rework (496). Its separate `beast/` run replaces the
old Freestyle/Acrobatic kit and changed synergy rewards using the current game
import and official replacement-kit evidence. The approved plan preserves four
unchanged sources, replaces eight, and removes 19 explicitly scoped obsolete
sources; additions bring Beast to 109 current applications. It publishes 105 new
overview summaries and retains the four unchanged reviewed summaries. Two newly
reviewed resistance records bind Bleed and Coldsnap to the refreshed imported
template, retaining the 65% base potency/duration reduction and Class Relationship
qualification. Regeneration Rate floors remain distinct from immunity.

Beast's `selected-before.json` also backs up the prior overview and resistance
children, since replacing/removing a source cascades those records. For rollback,
restore the enrichment sources first, then restore those exact backed-up child
rows only after checking their source identities and absence/current equality.
The enrichment restore command alone does not restore these child tables.
`beast/verification.json` verifies all 109 source poststates, current summaries,
resistance evidence and display/rareness filtering. Its protected fingerprints
confirm the other 339 playable champions (including the five new kits) and all
imported text, synergies and glossary records remained unchanged during this
follow-up. Both runs are local only and must be promoted together with the source
parser changes for deployment.

The deployment handoff is `deployment/bundle/manifest.json`, SHA-256
`632fe7feaed4eb23999f82e2915b3bb4aa6fa6425c363a24d1667e616c86e952`.
Promotion is restricted to these six champions, their five new canonical effect
definitions, 249 newly reviewed overview summaries, and two Beast resistance
records. Four existing Beast source/summary pairs are preserved. Production
backup, identity mappings, rehearsal, rollback and application receipts belong
under `deployment/`; the original local proof indexes remain immutable.
