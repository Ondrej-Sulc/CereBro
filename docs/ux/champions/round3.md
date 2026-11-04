# Champion UX round 3

Date: 2026-11-04. Incumbent: the user-approved second pass. The four affected source/test files were preserved before edits in `temp/champion-ux-round3-incumbent/` with `.snapshot` suffixes; hashes are in `round3-incumbent-manifest.json`. Changes remain local and uncommitted on the original base commit `eef079255376a0905913442568b5a71ab1804ec1`.

## Selected problems and acceptance checks

Independent source audit: `gpt-6.1-terra`, fresh read-only context. These are source-supported findings, not browser observations.

1. **Signature replacement rejects an empty edit.** The controlled number field ignored a non-finite `valueAsNumber` and committed every finite intermediate value. Clearing the current number restored it; out-of-range or fractional drafts normalized during typing. Hypothesis: preserve a string draft and commit on Enter or blur. Acceptance: clear and type 50 normally; empty drafts restore the last applied value; valid drafts retain existing rounding and rarity bounds; slider/build changes synchronize the field.
2. **Missing ability links fail silently.** A numeric record ID absent from the available combat passages fell back to an ordinary chapter without explaining the failed destination. Hypothesis: show and focus an unavailable-passage notice with browsing recovery. Acceptance: stale links explain the missing destination, recovery clears the target and restores search focus, and valid links still focus the exact passage.

Affected tasks: T2, T3, T6 and T7. The audit's weaker biography-search wording concern was deferred; this round does not change biography scope or imported game facts.

## Retained behavior

- Signature numbers can be cleared and replaced without changing the applied build during typing. Enter or blur commits the value using the existing integer rounding and bounds. Empty/non-finite drafts restore the applied value. A short associated hint explains the range and commit behavior; the slider continues to update immediately.
- Slider changes synchronize the number field. Rarity/rank changes reset its draft to the current build. Copying the build link after leaving the field includes the newly applied signature, including Sig 0.
- An unavailable ability target produces a focused status notice below the persistent navigation. Browse all abilities clears the target/chapter and returns focus to search. Exact valid passage links retain their existing behavior. If the same record ID becomes available with updated data, focus moves from the notice to that passage.

The previous hero, kit grouping, synergy navigation and search changes remain the incumbent. Numeric source bindings and game calculation helpers were not edited.

## Verification and review

New interaction tests first reproduced seven failures across signature draft editing and missing-link recovery. The final relevant suites passed **126 tests in nine files**. Coverage includes draft replacement, Enter/blur, empty/negative/oversized/fractional values, slider synchronization, a 4-star signature limit, pending-edit clipboard ordering, missing-target recovery, same-ID availability changes, and the prior history/grouping/domain contracts.

The real champion client, controls, reader, URL state and JSDOM history are exercised. Next's URL subscription and clipboard are boundary mocks; heavy child panels are mocked in the page integration suite. These tests do not establish native browser event behavior, physical-device layout or screen-reader announcement quality.

Web TypeScript, targeted ESLint and tracked diff whitespace checks passed. No fresh browser capture or screenshot comparison was performed in this round. The [original comparison gallery](comparison.html) remains evidence of the first visual pass only.

Final independent reviewer: `gpt-6-astra`, fresh read-only context, compared all four files with their incumbent snapshots and checked relevant domain rules. It found no blocking regression. Its small test-coverage finding was addressed by retaining the same target ID while changing availability; a pending-edit copy test was also added. Production code did not change after that review. The reviewer did not run tests or inspect a browser.

Decision: retain both functional improvements. This completes the pilot's three candidate rounds; further iteration should begin a new bounded pilot with refreshed browser evidence, rather than continue this one indefinitely.
