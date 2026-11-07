# Crystal page responsiveness

The November 2026 pass measures the crystal browser, large champion pools,
mixed-reward Banquet pages, champion lookup, comparison and the champion-page
crystal endpoint. Recorded contents, odds and source hashes are unchanged.

## Findings and changes

- Full-catalog ordering reparsed edition IDs inside every sort comparison on
  every request. The bulk sorter decorates each entry once, and the immutable
  server catalog retains its name/newest orderings. Search normalizes the query
  once and skips name parsing when the query is empty.
- Dense pools created a Popover and Tooltip context tree for every champion.
  Portraits now share one anchored details popover. Memoized buttons retain
  names, exact stars, cosmetic markers, roving keyboard focus and profile links;
  native portrait titles provide hover names. Closing a dialog returns focus
  unless the user deliberately focuses another control.
- Every pool filter previously waited for a debounce and a server navigation.
  The full, exact pool is now projected once and filtered locally. The same pure
  function supplies server and client name/class/star filtering and First Edition
  visibility. Search results update as typed; URL writes remain debounced. Native
  history retains shareable deep links, modified-click fallbacks and Back/Forward.
- Automatic Link prefetching requested many filter combinations in advance.
  Local filters do not prefetch. Crystal catalog cards warm their destination
  only on mouse hover or keyboard focus, scoped to their current URL.

Champion-page recorded-pool endpoints remain bounded by selected stars and cached
publicly. The category-overview redesign requests this projection when the lazy
How to obtain panel mounts, then renders three cards in each of four leading
categories and compact entry rows for the remainder. Category expansion adds
twelve cards at a time without further requests. The earlier warm local
production response measurement was 9-35 ms; it has not been rebenchmarked for
this presentation change.

## Measurement

Use a production build, not `next dev`, for HTTP comparisons:

```powershell
pnpm --filter ./web build
pnpm --filter ./web start --port 3001
# In another terminal, after the build and other CPU-heavy work finish:
node scripts/benchmark-crystal-pages.cjs http://localhost:3001 temp/crystal-performance/report.json
```

The script warms each of eight public routes and reports the median of three
subsequent complete HTTP responses, plus time to headers and body sizes. Its
first request is a warm-up, not a controlled cold-process measurement. `bytes`
is decoded HTML; `gzipBytes` is a compression estimate, not browser transfer size.
Results depend on hardware, server/database caches and network conditions. They
do not establish production LCP, INP or mobile-network latency.

Warm local production HTTP medians (three requests each, same machine):

| Page | Before | After |
| --- | ---: | ---: |
| Main pools | 43 ms | 57 ms |
| All recorded | 236 ms | 65 ms |
| Banquet catalog search | 64 ms | 56 ms |
| 7-star hero pool | 190 ms | 112 ms |
| Paragon pool | 240 ms | 159 ms |
| Greater Banquet December 2022 | 81 ms | 72 ms |
| Champion finder (Gwenom) | 51 ms | 44 ms |
| Comparison | 176 ms | 101 ms |

All measured routes returned HTTP 200. The 14 ms increase on the already-fast
main-pool listing is small relative to run-to-run scheduling/cache variance; no
whole-site speedup is implied. The changes target the expensive paths above.

One matching production browser interaction, typing `hulk` in Paragon's 303-member
pool, reached seven visible results in 673 ms before and 34 ms after. The latter
made no RSC request for the name/class/star filter URL. These timings measure
input to updated DOM, not the next paint or INP. Class selection and Back restored
the correlated URL, counts and input locally as well.

The isolated CPU harness showed catalog processing at roughly 181 ms before and
1–2 ms after, and server rendering of 303 source-only portrait controls at
952 ms before and 183–233 ms after. These are diagnostic development-render
measurements, separate from the production HTTP benchmark.

## Regression coverage

The crystal suites verify exact membership, rates, quantities and source IDs;
equivalent name/newest ordering; immediate pool filtering without router calls;
clearing a filtered initial page; URL restoration and cancellation of pending
search on Back; exact cosmetic stars; portrait arrows, Escape and focus return;
and dialog dismissal when a selected champion is filtered out.

Run `pnpm exec vitest run web/src/app/crystals web/src/lib/data/crystals.test.ts
web/src/lib/data/crystal-browse-catalog.test.ts src/domain/crystal-chronology.test.ts
--maxWorkers=1`, followed by both TypeScript checks and the web production build.
Temporary timing probes and raw reports live under ignored
`temp/crystal-performance/`; they add no client telemetry or debug endpoints.
