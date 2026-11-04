# Champion UX round 2

Incumbent: the first UX pass approved by the user. Source hashes are in `round2-incumbent-manifest.json`; local working snapshots are in `temp/champion-ux-round2-incumbent/`. The original baseline and first comparison remain historical evidence.

## Selected next improvements

1. **Reliable linked synergies.** A source navigation target currently lives only in component state. Persist it in page state so copying/reopening and Back/Forward retain the exact original catalog ID, including grouped aliases. Clear recognized stale synergy fragments on deliberate section navigation while preserving legacy direct links and unrelated fragments.
2. **Keyboard-safe search resets.** Clear/reset buttons are conditional on search/filter state and can remove the focused element. Return focus to the surviving search input, retaining the intended chapter or resetting synergy filters as the action promises.
3. **Clear synergy search feedback.** Show how many catalog families match the current query/direction and name the active scope in an empty result. Provide an explicit search clear action. Preserve complete bonus text, recipients, requirements, and rarity semantics.

Acceptance: original catalog IDs survive serialization/reload/history; legacy hash links remain usable; fresh section selection has no stale source target; reset actions retain visible focus; a new linked synergy cannot remain hidden behind old local filters; search counts and empty states agree with displayed families. A missing target for the selected rarity must be explained instead of silently ignored.

Independent source audit: `gpt-6.1-terra`, fresh read-only context. It identified the target/history and reset-focus issues. Its additional grouped-target-offset concern was rejected after checking existing `.synergyLevel` and `.synergyAlias` scroll margins. These are source/test findings, not human usability observations.

Game data and the approved hero/layout changes are outside this round's mutation scope.

## Retained changes

- Exact synergy IDs now travel in the `synergy` page parameter alongside the build. Original grouped aliases are retained. Leaving Synergies clears that parameter; Back/Forward restores the intended state.
- Recognized old synergy fragments survive build-only edits and direct legacy entries. Deliberate section/source navigation clears or replaces them; unrelated fragments remain intact. The panel observes legacy fragment/history changes without introducing a server/client snapshot mismatch.
- A new linked source resets old local query/direction filters, then scrolls and focuses its exact target. If that source is unavailable at the selected rarity, a focused notice explains it and offers browsing recovery.
- Synergy search shows matching family counts for each direction and a live result summary tied to the selected star level. Empty results name the query and scope. Clear search preserves direction; Show all synergies clears both.
- Reader and synergy reset actions restore focus to the surviving input and scroll the relevant search controls into view below persistent navigation. The approved reduced-motion behavior is reused.

## Verification

The new functional tests first reproduced missing URL state, hidden linked targets, missing counts, and focus loss. Final relevant suites: **117 tests in nine files passed**, including the unchanged kit/synergy projection contracts and original grouping/alias markup checks.

Additional page-level integration tests exercise the real champion client, page-state updates, native JSDOM history, and the real Copy page link action. The Next URL subscription and heavy child panels are boundary mocks. Covered: open source -> change section -> Back -> Forward; reopen a shared source/build URL -> copy the exact target; legacy fragment -> leave/revisit section -> restore with Back. Separate real-panel interaction tests verify grouped alias focus, explicit-target precedence over stale fragments, missing-rarity notices, and search resets.

Web TypeScript and targeted ESLint checks passed. This round uses source and component interaction evidence; no new native-browser or screenshot comparison is claimed. The first pass's comparison gallery and both prior screenshot manifests remain historical artifacts.

## Independent review and decision

Final reviewer: `gpt-6-astra`, fresh read-only context, comparing this batch with the approved incumbent snapshots and focused diff. It found no blockers or concrete domain, history, accessibility, SSR/hydration regressions in the reviewed source. It did not run tests or assess visual quality. The page-level history/copy tests were added afterward without changing production behavior.

Decision: retain this functional UX batch. The original hero layout, kit grouping, effect/rarity semantics, and game data are unchanged. Physical-device, screen-reader, production performance, and broader missing-data coverage remain outside the evidence for this round.
