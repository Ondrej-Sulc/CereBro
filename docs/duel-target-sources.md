# Duel target attribution

`CEREBRO` identifies targets independently added or verified by CereBro maintenance. It displays as **CereBro** in champion pages, admin tools and Discord. Maintenance additions must use this source rather than `USER_SUGGESTION`.

`USER_SUGGESTION` is reserved for actual user submissions. `GUIA_MTC`, `COCPIT` and `MCOCHUB` retain their existing community attribution. Verification of an existing target does not change its credited source.

The source is attribution, not a freshness or activation guarantee. ACTIVE/OUTDATED status and the exact observed player identity/build remain separate.

The additive enum migration must be installed before writing `CEREBRO` values. Deploy compatible web and bot readers before backfilling existing rows. The maintenance backfill uses exact committed insertion receipts, excludes every preexisting row and attributed community target, and changes only the source. It preserves names, ranks, statuses, submitters and original timestamps, and validates current revisions before applying.
