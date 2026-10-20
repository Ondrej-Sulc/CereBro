# Champion overview summaries

`ChampionAbilityOverview` stores short independently reviewed display copy for one `ChampionAbilityLink`. It never replaces the original source or changes effect identity, form, direction or partner requirements. Original enrichment artifacts and receipts stay valid and unchanged.

The summary source hash binds link/champion/ability identity, canonical name, detailed source, form, direction and sorted required partner IDs. Champion Details serves the summary only when this hash still matches. Summary rows are fetched separately from the long-lived champion cache so new reviewed copy appears without waiting for cache expiry.

The V1 source-hash serializer uses an explicit field order matching the original
reviewed format, rather than the host's locale-dependent object-key sort. This
keeps the same hashes on Windows and Linux. Existing stored hashes, review
receipts and the generic historical artifact serializer remain unchanged.

The portable deployment migration and source-bound long-summary allowances are
documented in [champion-data-release.md](champion-data-release.md). The standard
limit remains 360 characters; exactly 68 user-authorized source identities permit
1,000, including after numeric IDs are remapped during deployment.

Summaries normally use one sentence describing the trigger and important restrictions. Exclude rank/rarity/signature/ascension-dependent magnitudes, placeholders and audit prose. Retain fixed chances, durations, caps and thresholds only with supporting imported evidence and parameter context. Percentages can scale too. Preserve material eligibility qualitatively when its exact value is uncertain; use a null draft summary if no honest short description is supported.

If no source condition is recorded (including a source containing only form/direction tags), leave its overview condition blank. Do not generate a sentence restating the effect, a missing-condition placeholder or a guessed ability link. Existing saved summaries cannot fill this absence. The effect name/icon and genuine form or synergy-partner metadata remain visible. Future summary drafts should use null for these sources.

When a summary is unavailable or stale, only a concise usable original condition may serve as the fallback: at most 360 characters, without template placeholders, evidence IDs or audit/legacy/unresolved wording. Otherwise leave the condition blank and do not guess a native ability destination from that rejected prose. Keep the effect card and known synergy partners/destination. Do not strip clauses, replace missing values or manufacture a summary. This display rule does not modify original source data, classifications or frozen review/application artifacts.

The pilot at `scratch/champion-overview-summaries/pilot-20261019` covers Agatha Harkness (814), Beta Ray Bill (497), and Silver Sable (709), exactly 100 source applications. One author drafts; a different reviewer checks the new copy and retained values. No effect discovery or roster-wide re-audit belongs to this pass.

Draft/review schemas and validation are in `src/domain/champion-overview-summary.ts`. A draft accounts for every input source, citing exact input documents. Every retained numeric token except attack identifiers requires an evidence annotation. The review binds the exact input and draft hashes and must be independent of its author.

```powershell
pnpm exec tsx src/scripts/champion-overview-summaries.ts validate --run-dir=scratch/champion-overview-summaries/pilot-20261019
pnpm exec tsx src/scripts/champion-overview-summaries.ts apply --run-dir=scratch/champion-overview-summaries/pilot-20261019
```

Only `apply` writes data, requires current independent approval and a loopback DB, checks source drift under transaction locks, backs up the selected rows, and inserts display records in one transaction. Existing summary rows are not silently overwritten. A receipt records the exact summary poststate and unchanged source-row hash. A later revision uses a separately bound run.
