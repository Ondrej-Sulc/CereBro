# Agent-led champion data release

The champion pages need the catalog data as well as the code. The old GCS
`db-sync.ts` table list is not a complete champion-page release mechanism. An
agent can promote the reviewed local catalog using the bundle below; no sync
service, new summary generation, or production reset is required.

## Prepare the handoff locally

```powershell
pnpm exec prisma migrate deploy
pnpm exec tsx src/scripts/verify-champion-overview-length-migration.ts
pnpm exec tsx src/scripts/export-champion-release.ts --output=D:/CereBro-artifacts/champion-release-<new-id>
```

The exporter only accepts a loopback source DB, uses one read-only repeatable-read
transaction, refuses an existing output directory, checks every stored overview's
source hash and length allowance, and verifies every exported file after writing.
An `INCOMPLETE` marker means the export is unusable. `manifest.json` records row
counts, byte SHA-256 hashes, canonical content hashes and data checks. It contains
no connection strings or user/alliance data. Transfer the complete directory,
including the manifest, without editing it. Recompute file hashes after transfer.

The datasets include champion metadata and tags, ability definitions and category
relations, prestige, stats, full ability templates and display/binding metadata,
signature curves, glossary terms/icons, game synergies and their members, curated
effect applications and partners, reviewed overviews, attacks and ordered hits.
This includes NPC catalog rows already present locally; it does not claim that
unsupported NPC ability parameters have been repaired. A missing overview row
means no stored copy. It must remain absent, not become an invented summary or a
sentence describing missing data. Absence alone does not prove an independent
null review; historical review records remain the source of that distinction.

## Promotion procedure for the deployment agent

1. Bind the exact release commit and bundle manifest hash. Ensure all new files
   and migrations in this working tree are included in that commit; many are new
   files, not modifications to tracked files. `main` auto-deploys, so coordinate
   the database step before triggering the new web/bot release.
2. Inspect the **target** migration history and catalog read-only. Confirm the
   intended environment from its identity, without logging credentials. Back up
   the target champion tables, join relations, relevant sequences and schema;
   retain a restorable managed DB backup too. Record unrelated account, roster,
   alliance and war state fingerprints. Do not truncate or replace their tables.
3. Apply the repository migrations using the target's normal secret injection:
   `pnpm exec prisma migrate deploy`, then `pnpm prisma:generate`. Do not copy
   `_prisma_migrations` from local or mark migrations applied without executing
   them. If the target already contains divergent manual DDL, reconcile that
   explicitly before importing. Rehearse the following mapping/import in a
   staging clone of the target; retain the exact write plan and rollback proof.
4. Build and save explicit local-to-target identity maps. Preserve existing target
   IDs referenced by player rosters, wars and plans. Stop on ambiguous identities
   or incompatible target-only edits; do not resolve collisions by numeric ID.
5. In a transaction with drift checks/appropriate locks, upsert parent catalog
   rows, then dependent rows/relations, then reviewed overview rows. Import
   partner relations **before** long overviews so their authorized identity is
   available. Preserve ordered hit position. Reconcile only relations and rows
   in the reviewed import plan; do not globally delete target-only records.
6. Verify the target's semantic data against the bundle after mapping IDs. Require
   complete expected coverage, no dangling links, no stale summary hashes, exact
   summary text/review metadata, exact source/templates/parameters/display
   metadata, correct ordered hits, and exact synergy membership. Verify unrelated
   state is unchanged. Counts alone are insufficient. Record per-dataset hashes,
   mapping/provenance, changed-row before/after receipts and rollback steps.
7. Build/deploy the web and bot from that commit **after** the data promotion.
   Use a fresh Next build/cache rather than copying a previous `.next/cache`.
   If the host retains a shared Next data cache, invalidate `champion-details`
   and `champion-details-shared` in the authenticated server runtime (the existing
   admin actions use these tags). Restart web/bot instances to drop process-local
   catalog caches. A separate CLI process cannot clear a running server's memory.
8. Smoke-test overview, full abilities, synergies and stats at multiple builds;
   include Karolina's one-Buff/two-percent bindings, Storm's long copy, a synergy
   partner link, kit API input validation, and the roster popup/filter path.
   Production `/champions/<slug>/prototype/<concept>` must return 404. Record the
   actual deployed commit, migration status and verification results.

## Identity and summary hash rules

| Dataset | Target identity / mapping rule |
| --- | --- |
| Champion | Stable game ID and slug must identify the same row; exact unique name is a documented fallback if one is missing. |
| Ability / category | Exact canonical ability name / exact category name; preserve glossary association. |
| Tag | Exact `(name, category)`. |
| Prestige | Mapped champion + `(rarity, rank, sig)`. |
| Stats | `(tierId, rank)`; verify mapped champion and tier metadata. |
| Ability text | Mapped champion + `sourceId`; retain template JSON including binding/display metadata. |
| Ability curve | `curveId`; map nullable champion, retain formula and params. |
| Glossary / game synergy | Stable game string ID; verify source hash, raw data and values. |
| Game synergy member | `(synergyId, role, tierId)` plus verified mapped champion/rarity. |
| Curated effect | Mapped champion + canonical ability + type + exact nullable source + form + direction + exact mapped partner set. |
| Attack / hit | Mapped champion + attack type; hits in original numeric-ID order, with exact ordered properties. |
| Overview | Mapped effect application, with the rebinding proof below. |

`overviewSourceHash` in `src/domain/champion-overview-summary.ts` deliberately
includes numeric link/champion/ability/partner IDs. If those IDs differ on the
target, blindly copying the local hash hides the summary as stale. First prove
the complete semantic source and partner set are unchanged, then compute the
hash using the **target** source and that same function. Preserve text,
`reviewHash` and original `reviewedAt`. Save an append-only receipt linking local
source/hash, identity map, target source/hash and original review. This is a
mechanical identity rebind, not permission to edit wording or generate a review.
If source text, classification, ability or partner requirements differ, do not
publish that overview without a separate approved correction.

## Scoped length migration

`20261020010000_scope_overview_summary_lengths` replaces the local-ID-only
constraint with a portable source-bound allowance. Its checked-in
`allowances.json` contains exactly 68 approved identities: 31 Storm entries and
37 entries from the seven remaining champions. Each permits 1,000 characters;
all other overview writes remain capped at 360. Matching includes champion slug,
canonical ability, type/form/direction, SHA-256 of exact source text and sorted
partner slugs. The local numeric IDs are documentary only.

The database uses a 1–1,000 ceiling plus a BEFORE INSERT/UPDATE trigger for the
source-specific cap. This avoids cross-table CHECK constraints that break dump
restore ordering. Source edits invalidate the application summary hash and also
remove the long-write allowance unless the new identity is separately approved.
The migration works before the catalog is populated. The local-only verification
script creates/drops an isolated schema, remaps IDs, and checks all 68 identities,
boundaries, source/classification drift and partner drift without writing any
application tables.

Rollback must preserve already approved long text: do not restore the historical
global 360-character constraint over long rows. Restore the captured prior scoped
constraint/trigger definitions and corresponding data backup as one reviewed
rollback, or leave this backward-compatible allowance in place when rolling back
only the application code.

## Suggested task for the deployment agent

> Promote the champion catalog from `<bundle directory>` with manifest SHA-256
> `<hash>` to `<explicit target environment>`, and deploy release `<commit>`.
> Follow `docs/champion-data-release.md`. First verify the bundle and inspect the
> target read-only, then produce/rehearse the exact identity mapping and write
> plan with a target backup and rollback. Preserve player/roster/alliance/war data
> and target IDs. Import all 16 catalog datasets and both join relations, rebind
> overview source hashes only after semantic equality proof, preserve review
> provenance and exact scoped length allowances, verify the result and refresh
> caches. Do not use the old partial sync script, regenerate summaries, or copy
> local migration history. Report actual target verification and deployed commit.

This document and a local export prepare the release. They do not assert that a
target mapping, staging rehearsal or production deployment has happened.
