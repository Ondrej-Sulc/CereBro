# Champion page UX hill climb

This is a bounded, Codex-only evaluation loop for `/champions/[slug]`. The first pass establishes a baseline and an experiment backlog; it does not change the product UI. See [the initial audit](ux/champions/baseline.md).

The initial three-round pilot is complete: [visual/navigation pass](ux/champions/candidate-review.md), [synergy state and search](ux/champions/round2.md), and [signature editing and ability-link recovery](ux/champions/round3.md). The last two rounds have source/component evidence; the [comparison gallery](ux/champions/comparison.html) covers the first visual pass. Refresh browser evidence before a new pilot.

The user's next visual request starts [a new pilot with matched Chromium captures](ux/champions/visual-1/notes.md) of the approved incumbent and candidate.
Its [second candidate](ux/champions/visual-2/notes.md) focuses on the ability reader and synergy controls, with ten matched screenshot pairs and unchanged full card text.
The [third candidate](ux/champions/visual-3/notes.md) focuses on synergy cards and completes this visual pilot. Eight matched pairs preserve full semantic card data; browser verification also corrected initial linked-level scroll positioning.

The user's Khonshu reference then established a clearer density requirement. The [compact-row redesign](ux/champions/compact-synergies/notes.md) starts a new focused pilot against that approved incumbent, checking complete rows visible at fixed zoom, list height and access to full partner/star data. Prior model agreement did not supersede the user's evidence that the cards remained too bulky.
Its [second candidate](ux/champions/compact-refinement/notes.md) follows the user's preference for less repeated wording, retains detail access through a shared guide and tooltips, and improves mobile density without reducing body text size.

## Method and scope

Inspired by Theo's [Agents Sucked At UI (Until Today)](https://www.youtube.com/watch?v=xq0eB8vxeqk): capture the interface, collect independent critiques, change it, and evaluate again. Our adaptation freezes tasks and evidence, keeps an incumbent version, and uses demonstrated task improvements to decide whether to retain a candidate. Model scores are supporting opinions.

Preserve CereBro's dark, champion-led visual identity, class/effect colors, artwork, and useful information density. Improve retrieval, comprehension, navigation, and polish without rewriting imported game facts.

## Roles

| Role | Initial model | Responsibility |
| --- | --- | --- |
| Coordinator / eventual implementer | `gpt-6.1-sol` | Capture evidence, reproduce findings, select one hypothesis, implement and validate candidates. |
| Independent reviewer A | `gpt-6.1-terra` | Evaluate the same frozen packet and rubric in a fresh context. |
| Independent reviewer B | `gpt-6-astra` | Evaluate the same frozen packet and rubric in a separate fresh context. |

These are experiment assignments, not claims about relative model quality. They were exposed by the local Codex model catalog on 2026-11-04; verify availability before later runs. Use only the Codex provider. Do not substitute another provider or model silently if a requested model fails. No API-key integration is needed for these delegated reviews.

Different Codex models still share likely biases. Reviewer agreement is useful triangulation, not user research or independent proof of usability. Record disagreements and resolve factual claims through reproduction. The product owner decides subjective tradeoffs that remain unresolved.

## Freeze the evidence before reviewing

Record the commit, dirty files, data/fixture description, exact URLs/builds, browser, CSS viewport, zoom, authentication, scroll positions, local-storage display preference, image loading, and any capture failures. Use public catalog pages; exclude personal account chrome and credentials from artifacts.

Initial screen sizes: desktop 1280 x 800, mobile 390 x 844; add 320 x 568 as a stress check. Browser viewport emulation is not a physical-device test. Use the same sizes and data for incumbent and candidate. Wait for fonts and visible images, hydrate URL-driven sections, then explicitly set the scroll position before each capture.

Start with Absorbing Man for dense effects, resistances, and synergies. Before accepting a candidate, also freeze a second champion with a parenthesized/long name and a third with sparse/missing optional data. Record their actual slugs and builds after verifying them; do not treat a single champion as coverage of the catalog.

Capture: fresh landing, overview in Detailed and Compact, full abilities, synergy results and star requirements, stats/attack details, build popover, a linked passage, search with no results, and a keyboard-focused control. Screenshots support visual assessment; action traces and DOM observations support behavioral claims.

## Repeatable tasks

Reset to the task's declared starting URL and display preference. Measure deliberate clicks/taps, required upward/downward scroll distance, wrong turns, and success. Separate first-visit discovery from a known-control replay. Agent wall-clock time includes tool latency and is not a human usability measurement.

| ID | Start and task | Evidence of success |
| --- | --- | --- |
| T1 | Fresh page, no `tab` query: find one immunity/resistance and explain its condition. Repeat in Detailed and Compact. | Correct effect, immunity/resistance distinction, and source condition visible without losing champion context. |
| T2 | Overview: follow a native source to Full abilities, search a known term, narrow to a chapter, recover from no results, then return. | Exact source highlighted, search scope understood, navigation/focus visible, return behavior recorded. |
| T3 | Deep Stats or Full abilities: change rank/signature, read the changed value, and return to the same passage/rating. | Current build visible, adjustment discoverable, values updated, no avoidable loss of place. Include signature 0. |
| T4 | Synergies: search a real partner, compare From this champion/From teammates, inspect star requirements, change rarity. | Correct owner, partner, recipients, rarity pairs and full bonus remain understandable. This catalog does not claim an active team. |
| T5 | Overview: locate a duel target, copy its name, identify status/recency. | Copy feedback and fallback verified; stale targets distinguishable. Mark N/A when absent. |
| T6 | A linked ability/synergy and selected build: share/reopen, then Back/Forward. | Section, build, and promised target restored. Note filters/searches that are intentionally local. Verify actual clipboard content when available. |
| T7 | Keyboard and mobile: navigate tabs, open/close build and effect details, search, follow a source. | Visible focus, accessible labels, Escape and focus return, no clipped controls or obscured targets. Include zoom and reduced-motion checks. |

## Fixed review rubric

Assess every dimension against the same evidence. Use whole-number scores from 1 to 10 only for observable dimensions; otherwise use `N/O` with the missing evidence. Do not fabricate interaction or accessibility scores from screenshots.

| Dimension | Questions |
| --- | --- |
| Task clarity | Can players discover the next action and understand the result? |
| Information hierarchy | Do identity, build, navigation, conditions, and details get appropriate emphasis? |
| Typography and readability | Are text size, line length, spacing, and contrast suitable for dense game information? |
| Visual consistency and identity | Are components coherent while preserving class/effect meaning and champion character? |
| Interaction and state | Are controls reachable, state visible, feedback clear, links/history predictable, and errors recoverable? |
| Responsive and accessible use | Does the flow work with narrow viewports, keyboard, zoom, and reduced motion? |

Anchors: 1-2 = task-blocking problems; 3-4 = major repeated friction; 5-6 = usable with material friction; 7-8 = clear with specific remaining issues; 9-10 = unusually polished across the observed states. Every score needs evidence and a stated limitation. Do not compute an average that hides a failed task.

## Reviewer brief (copy into each fresh review)

```text
Read-only champion-page UX review. Do not edit files or delegate further.
Read docs/champion-ux-hill-climb.md and CONTEXT.md. Evaluate ONLY the supplied
evidence packet and relevant source; do not read other reviewers' reports or
the coordinator's findings/backlog. Do not operate a shared browser tab.

Packet: <manifest path and screenshots/action observations>
Revision(s): <commit and changed files; optional neutral A/B labels>
Coverage: <tasks actually exercised and gaps>

Review all six rubric dimensions. For each: score 1-10 or N/O, evidence,
confidence, and limitation. Separate observed behavior, source-based
hypotheses, and aesthetic preference. Give at most five prioritized findings,
each with task ID, reproduction, impact, source/screenshot reference,
one small proposed experiment, and a falsifiable acceptance check.
Include strengths to preserve and possible regressions. If comparing versions,
choose A, B, tie, or insufficient evidence per affected task. Do not assume
the newer version is better or invent findings to ensure a list is full.
```

Keep target scores, previous ratings, implementation rationale, and other reviewers' feedback out of the initial brief. On paired comparisons, randomize neutral A/B order and keep the mapping with the coordinator. Keep one unchanged reference capture to detect score drift. Do not re-run an unchanged candidate just to obtain a favorable rating. A model comparison requires identical packet, rubric, options, and scope; two different briefs cannot establish which model reviews better.

## Iteration and retention

1. Choose one reproduced problem and one falsifiable hypothesis. Record the affected tasks, intended change, risk, and acceptance check before editing.
2. Preserve the incumbent revision and evidence. A candidate is a small reversible diff. Broad visual alternatives belong in a separately declared exploration, with fresh baselines after selection.
3. Implement the candidate, then run relevant behavior tests/static checks and replay affected tasks plus the cross-champion/mobile/keyboard smoke checks. Domain contracts below are hard gates.
4. Capture the same states. Obtain fresh independent reviews for a candidate that passed those checks. Compare task evidence first, visual preference second, scores last.
5. Keep a candidate when the preregistered task criterion improves, neither reviewer identifies an unresolved material regression, and the coordinator verifies the claims. Revert or revise only that candidate otherwise. Record disagreements and rejected ideas.
6. Stop after three candidate rounds per pilot, two consecutive rounds with no retained improvement, a required evidence/tooling blocker, or the user's stop instruction, whichever comes first. Report unresolved work. Do not keep running until all scores reach 9 or 10. Change the rubric only between pilots and rebaseline when doing so.

Routine rounds can use one reviewer; use both for the initial baseline, a materially different candidate, or final assessment. Freeze the chosen review configuration within a paired comparison. Track review duration/usage when reported, accepted findings, reproduced false positives, and unique useful findings; no assumed prices or fabricated token counts.

## Domain contracts (hard gates)

- Preserve source-level effect form and direction on the same application, conditional wording, reviewed overview hashes, and original record identities.
- Preserve immunity versus resistance, including build-dependent versus fixed amounts. A 100% reduction is not proof of immunity.
- Offer only obtainable rarities with imported stats, keep build state consistent across sections, and preserve signature/prestige numeric bindings.
- Preserve complete synergy recipients, activation partners, correlated rarity pairs, stacking semantics, and original catalog navigation targets.
- Preserve deep links/history and empty-data states. Do not "simplify" by deleting required conditions, records, or full ability access.

`CONTEXT.md`, `docs/champion-synergy-display.md`, and the champion ability/resistance documents define these contracts. UI polish cannot amend them implicitly.

## Round record

```text
Round / date / coordinator:
Incumbent commit and evidence:
Candidate diff and evidence (or baseline-only):
Data, URL/build, viewport, storage preference, auth:
Hypothesis and preregistered acceptance check:
Task results / interaction counts / scroll distances / reproduction:
Reviewer models/options and independent reports:
Disagreements, confidence, unobserved states:
Checks run and domain gates:
Decision: baseline / keep / reject / inconclusive
Reason and remaining risks:
Next experiment:
```

Run the loop through the existing agent/delegation and browser tools. This setup adds documentation and evidence, not a new model SDK, unattended service, scheduling system, or telemetry pipeline.
