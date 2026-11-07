# Pre-deployment toolchain and packaging validation — 7 November 2026

Assessment only, against the dirty shared working tree at HEAD
`8898fd42b8f086c4331b4375cca9de73dea199b0`. This validator made no production
edit, commit, deployment, migration, seed, account operation, cloud write or
browser session. The parent's separately authorized corrections are recorded below.
Read `CLAUDE.md`, `CONTEXT.md`, the prestige/combat/ascension/crystal domain docs,
workspace manifests, lockfile, Next configuration, Dockerfiles and CI workflows.
No applicable `AGENTS.md` was found in the workspace. This task was the sole
owner of heavy validation; existing user/shared processes were preserved.

## Readiness verdict

**Hold final release sign-off for a genuine production web build.** Fresh full
web TypeScript, bot compilation and all selected non-database CI tests passed
on the combined snapshot immediately before the parent's two finding fixes.
The parent's two corrections are now stable; full web TypeScript passed again
on that final source snapshot, as did bot production compilation. The parent
also passed 82 tests in the four affected existing suites. There is no open
confirmed correctness/toolchain defect from these two reviews; final bot emission
and correction regression results are recorded separately below.
The first typecheck's bounded-heap failure was superseded by the successful resource-aware retry;
it is not a confirmed TypeScript or production defect. No P0/P1 defect was
reported by the independent correctness reviewer.

## Actual command results

| Check | Actual command/scope | Result |
| --- | --- | --- |
| Fresh non-database CI Vitest selection | `node --max-old-space-size=2048 node_modules/vitest/vitest.mjs run <177 deduplicated CI selectors> --maxWorkers=1 --reporter=default --reporter=json --outputFile.json=temp/predeploy-validation/ci-vitest.json` | **PASS**, process exit 0; 1,434 tests in 182 files, no failures/skips, 375.32s |
| Additional portrait fallback suite | Same runner, `web/src/lib/championHelper.test.ts`, single worker | **PASS**, exit 0; 4 tests, 2.88s |
| All CI Python validation modules | `python -m unittest discover -s scripts -p <each of the 11 CI test filenames>` | **PASS**, every exit 0; 79 tests in 11 modules |
| Full web TypeScript, first attempt | `node --max-old-space-size=2048 node_modules/typescript/bin/tsc -p web/tsconfig.json --noEmit --incremental false --pretty false` | Heap exhausted, exit 134; 38.12s, no TypeScript diagnostics |
| Full web TypeScript, resource-recovery retry | Same complete configuration, `--max-old-space-size=6144` | **PASS**, exit 0; no diagnostics, 81.20s |
| Full web TypeScript after stable parent fixes | Same complete configuration, `--max-old-space-size=6144`; see `web-tsc-final.result.json` | **PASS**, exit 0; no diagnostics, 100.92s |
| Bot CI compilation | `node --max-old-space-size=4096 node_modules/typescript/bin/tsc -p tsconfig.json --outDir temp/predeploy-validation/bot-dist --incremental false --pretty false` | **PASS**, exit 0; no diagnostics, 51.80s |
| Bot compilation after stable parent fixes | Same complete configuration and 4 GB heap, `--outDir temp/predeploy-validation/bot-dist-final` | **PASS**, exit 0; no diagnostics, 57.49s |
| Parent's targeted correction regressions | Four existing acquisition/component/loader/page suites listed below | **PASS**, parent-reported 82 tests; parent also reports scoped ESLint 0 errors/5 existing fixture warnings and `git diff --check` pass |
| Production web build | Native build unsafe against shared `.next`; supported Docker engine unavailable | **NOT RUN** |

Vitest's saved JSON has `success: true`, all 182 file reports passed, and the
recorded test-process exit is 0. The audit helper initially returned 1 only while
printing Unicode checkmarks to the Windows console **after** saving those
successful results. Its console printing was corrected; the test run was not
repeated. This is an audit-helper issue, not a failed suite.

Current CI retains every prior Vitest selector (verified against HEAD); the
new compact-card suite appears exactly once. The selected run combines every
non-database explicit CI Vitest command and `test:relics`, deduplicating shared
selectors. Five PostgreSQL suites across two CI steps were intentionally omitted
because they require setup and database writes. No full-repository test run or
hosted CI run is claimed. Python dependencies already matched the pinned
`requirements-game-data.txt`; no pip install was performed.

The canonical web production command is `pnpm --filter web run build`, expanding
to `next build --webpack`; CI uses `pnpm --filter ./web... run build` with a 4 GB
Node heap. The full web TypeScript command is
`pnpm --filter web exec tsc -p tsconfig.json --noEmit --incremental false`.
The attempted direct compiler invocation uses the same installed TypeScript
and complete `web/tsconfig.json`, including tests, transitive shared core and
existing Next-generated types. It does not substitute a scoped configuration.

### Why the production web build was not launched

`web/next.config.ts` provides no isolated `distDir`/environment override; the
installed Next build CLI provides no output-directory flag. A native build would
write the same `web/.next` used by the live shared dev server. No cache or lock
was removed, no process stopped, and no config/typechecking bypass was added.

The supported alternative is `web.Dockerfile`'s production stage. Its build line
89 explicitly disables source-map upload and runs the genuine Next build.
However, `docker version --format '{{.Server.Version}}'` failed, exit 1:
`open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified`.
Docker Desktop was not started. No production HTTP smoke is claimed because
there is no freshly validated production output.

The full web check was capped at 2 GB because only about 2.8–3.0 GB physical RAM
was free before it started, while the existing Next process used about 9.8 GB.
It exhausted that heap after 38.12 seconds, exit 134:
`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.
No `TS...` diagnostics were emitted. Retrying with a larger heap in that window
would compete with shared processes. After all single-worker test runs completed,
free physical memory recovered to about 9.1 GB. That material resource change
justified one fresh full-check retry with a 6 GB heap, still sequentially.

## Confirmed integration findings and parent corrections

**Medium: Blade (Stellar-Forged) objective is labeled ended without an evidenced
end date.** `src/data/champion-ascension-acquisition/catalog.json:1068` records
`blade-stellar-necropolis` with `availability: historical` at line 1079, `window: null`, and
explicitly missing deadline/current-activity evidence at line 1085.
`src/domain/champion-ascension-acquisition.ts:72` maps undated historical records
to `periodStatus: past`; `web/src/components/champion-ascension-acquisition.tsx:17`
maps the historical availability directly to **Past event** in both shared hosts.
The report proves an unsupported ended-objective assertion, not present access.

Recommended smallest correction: represent this undated route as
`activity_dependent`/`not_dated`, or use neutral historical-report wording that
does not assert an end. Add a regression for a historical observation without
an end date. The parent made the narrow catalog correction: this route is now
`activity_dependent`, with its null window and evidence limits preserved.
The shared reader therefore produces `not_dated`; no start/end/current access
was invented. This validator made no production fix.
The independent review owns the broader correctness assessment in
`docs/predeploy-integration-review-2026-11-07.md`.

**Low / optional: comparison capture-date provenance is stale.** The independent
review reproduced a November 5 exact-opening comparison (41-member Empire of
Doom example) whose `loadCrystalComparison` payload still labels contents with
the November 3 champion-catalog date at `web/src/lib/data/crystals.ts:196`.
Use the exact-opening loader's date for those contents while preserving the
separately dated archival acquisition evidence. This is a provenance-label fix,
not a demonstrated wrong comparison pool or release blocker. The parent now
returns each comparison side's actual `observedAt`, supplies a common date only
when equal, and renders mixed capture dates inside one disclosure through
`crystal-comparison.tsx` and `SourceNote` in `crystal-shared.tsx`.

The parent changed four production inputs and added regressions in four existing
suites: `src/data/champion-ascension-acquisition/index.test.ts`,
`web/src/components/champion-ascension-acquisition.test.tsx`,
`web/src/lib/data/crystals.test.ts`, and
`web/src/app/crystals/crystal-pages.test.tsx`. The parent reported reproducing
all four expected pre-fix failures, followed by **82 passing tests** across those
four suites, scoped ESLint with zero errors/five existing fixture warnings and
a passing `git diff --check`. The final green results are also recorded in the
independent review's primary-agent follow-up section. The full
web typecheck above ran only after the parent declared all eight files stable;
it did not encounter transient red-test typing while patches were in progress.
The independent reviewer separately reported five passing audit-only probes.

## Release packaging

- New catalogs, source readers, shared components, APIs, routes and regression
  fixtures exist but are extensively **untracked**. Include them with the
  modified consumers and CI workflow in the eventual release; a HEAD-only
  release would omit this work. `temp/predeploy-validation/untracked-release-inputs.json`
  enumerates 274 new source/script/test/data inputs. Nothing was staged.
- All 16 new JSON data files parse. The artifact records their sizes and SHA-256
  hashes, including the opening catalog, eligibility/costs, acquisition and
  ascension-source catalogs, exact odds/history, selectable rewards, crystal
  art, reward art/palette, and piece-art projection. All are outside ignored temp.
  The initial successful bot compile emitted all 14 runtime JSON inputs with identical
  parsed contents. The two non-emitted JSON files are offline source/coverage
  review sidecars, not runtime imports. `bot-packaging.json` records each result.
  The final bot compile was rerun after the parent corrections and again emitted
  all 14 runtime JSON files with contents identical to final source inputs;
  `final-snapshot-verification.json` contains the final hashes and comparison.
- Static inspection of 193 changed/new non-test TS/TSX/JSON/CSS files found no
  missing relative/aliased imports or import casing mismatch. The only scratch
  filesystem reference found belongs to the offline reward-art publisher's
  input default (`src/scripts/publish-mcoc-reward-artwork.ts:13`), not an app
  runtime import. No publisher/extractor/importer was executed.
- Published GCS URLs are represented in the crystal-art, reward-art and piece-art
  manifests and allowed by Next's image configuration. One HEAD sample from each
  manifest returned **200 image/webp**. This is three read-only public-object
  checks, not a claim that every remote image or database portrait was checked.
- Root dependency specifications/settings/package-manager declaration are
  identical to HEAD. Only root scripts changed. `pnpm-lock.yaml`, workspace YAML,
  and the web/core package manifests are unchanged. All 112 dependency specifiers
  across the three manifests match their lockfile importer entries; no dependency install or
  lifecycle hook was needed. Local Node is 24.4.0/pnpm 10.33.3/Python 3.13.5;
  CI declares Node 20.19.x/pnpm setup 10.22.0/Python 3.12. Local checks do not
  replace the actual CI runtime.
- **Pre-existing local Docker packaging caveat:** `web.Dockerfile:41` copies
  the build context into the final image, while `.dockerignore` does not exclude
  ignored `temp/`, `scratch/` or `backup/`. A local build from this dirty workspace
  would include such evidence/artifacts. This is not a runtime import dependency
  or a new regression. Use a clean, complete Git-sourced release context; if local
  dirty-tree Docker builds are intended, explicitly exclude those directories.

## Required remaining validation and optional work

The standalone full typecheck has passed on the final stable source tree. The
remaining build gate is the genuine production Next build in a dedicated clean
release workspace with enough RAM and complete release inputs. These reproduce
the typecheck and CI build **sequentially**, not against the shared dev `.next`:

```powershell
# Dedicated release worker only. Child-process setting; choose adequate RAM.
$env:NODE_OPTIONS = '--max-old-space-size=8192'
pnpm --filter web exec tsc -p tsconfig.json --noEmit --incremental false
# Repository CI build uses a 4 GB heap; validate that setting too.
$env:NODE_OPTIONS = '--max-old-space-size=4096'
$env:POSTHOG_UPLOAD_SOURCEMAPS = 'false'
pnpm --filter ./web... run build
```

Complete hosted CI, including its existing isolated PostgreSQL suites. They were
not run against any local/production database during this audit. Preserve CI's
frozen-lockfile install and Prisma-client generation in that disposable worker.
The parent's targeted correction regressions are complete. A short owned
production HTTP smoke can follow a successful build; current dev timings and
historical browser captures establish no production-performance result.

Optional CI polish: the new four-test `web/src/lib/championHelper.test.ts` is the
only new TypeScript test outside the current explicit CI selectors. Existing
Finder-artwork integration tests exercise the consumer; registering the focused
image-fallback suite would retain its separate edge-case coverage. It passed
separately in this assessment. No workflow was edited by this assessment.

## Evidence

All command logs, exact arguments, exit codes, suite selection, CI coverage
comparison, packaging hashes and before/after source hashes are retained in
ignored `temp/predeploy-validation/`. No production web build, hosted CI, live
stock evidence or production benchmark is claimed. The successful 6 GB check is
a fresh full-web TypeScript check, not a production build.

Before/after hashing of 1,849 source/config/asset inputs found no changes during
this validator's checks. `snapshot-before-parent-fixes.json` preserves that tested
tree. The parent then announced two small finding fixes; final snapshot coverage
distinguishes those eight changed production/test files from the broad pre-fix
passes above. `snapshot-final-before.json` and `snapshot-final-after.json` match
exactly: no source/config/asset input changed during the final full web typecheck
and bot compilation. This validator has not edited production files.

The preserved `temp/predeploy-integration-review/repro.test.tsx` characterizes
pre-fix behavior and may now fail if included by an unfiltered root Vitest scan.
It is a disposable ignored audit artifact, not a release input or a registered
CI suite. Generated compiler output is likewise confined to ignored audit temp.
No unfiltered whole-workspace Vitest scan was used or claimed, and preserved
pre-fix audit probes are not classified as production regressions.
