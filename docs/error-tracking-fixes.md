# Error tracking investigation, 31 October 2026

The read-only PostHog review covered production exceptions in project 97072 during
the 24 hours ending 12:33 UTC. It found 365 exception events in 27 active issue
groups. These are reports, not unique incidents. Existing issue groups predate
the Big Thing node fix. No issue statuses or production data were changed.

## Confirmed and addressed

- **War map canvas sizing:** the observer passed positive fractional dimensions
  directly into Konva. A 0.4-pixel width passed the positive-size render guard but
  became a zero-width backing canvas. The regression uses the actual Konva
  `SceneCanvas` at the browser canvas attribute boundary. Measurements are now
  floored to whole drawable pixels, hidden/invalid measurements preserve the last
  valid stage, and observer notifications are coalesced into one animation-frame
  update. Cleanup cancels pending work and ignores late notifications.
- **Map recovery:** a React render/commit exception in the map host is contained
  locally instead of discarding the planner and fight-editor state. Retry rebuilds the map, and a
  changed map/battlegroup clears the prior failure. Reports include map context
  and React's component stack. Recovery is not a claim that every canvas failure
  has the same cause as the reproduced resize bug. Konva's separate React root,
  asynchronous drawing and event-handler failures are outside this boundary;
  global error reporting remains enabled.
- **Profile hydration:** the always-rendered profile list formatted roster dates
  using the server's default locale. Hydrating the actual list with a Czech
  browser locale/timezone reproduced React's hydration mismatch. Dates now have
  deterministic initial ISO date text and localize after hydration, preserving
  the user's local date display.
- **Capture filtering and release attribution:** the provider enabled SDK error
  autocapture without a `before_send` filter. Browser event propagation filtering
  alone did not reliably exclude ResizeObserver reports. The SDK boundary now
  drops only exception chains consisting entirely of exact known observer
  warnings, and stamps the build version on every outgoing browser event. Save,
  network, React, malformed and unattributed script errors remain reportable.
- **Caught roster failures:** the roster update returned HTTP 500 after an
  `ECONNRESET`, but its catch block hid the exception from the route wrapper.
  Update/delete catches now report non-validation errors with request context.
  Tests exercise the real wrapper, ensure exactly one report, retain validation
  as HTTP 400, and verify that a failed write or later cache invalidation does
  not trigger a mutation retry. This adds diagnosis; it does not establish the
  cause of the connection reset.

PostHog JS and its Next.js build integration are updated together to compatible
versions. The existing SDK capture defaults remain explicit.

## Private source maps

The optional official Next.js integration is disabled unless
`POSTHOG_UPLOAD_SOURCEMAPS=true`. When enabled it requires:

- `POSTHOG_PROJECT_ID=97072` for this installation.
- `POSTHOG_SOURCEMAPS_HOST=https://eu.posthog.com` (the API host, not the ingestion host).
- A **build-only** `POSTHOG_SOURCEMAPS_API_KEY` with error-tracking write access.

The capture token cannot upload maps. The read-only review credential is not used
for uploading, copied into an env file, or embedded in the client. Configure a
separate upload credential when enabling this feature. Maps are bound to the
actual build version and deleted after successful upload; upload failure fails
an enabled build. Ordinary builds remain unchanged when upload is disabled.
Configuration is applied only during the production build phase. Development and
production startup do not require the upload credential even if the upload flag
is present in the runtime environment.

Railway's current Dockerfile builder rejects secret mounts before executing the
build, including when upload is disabled. The initial release attempt confirmed
this parser restriction. The standard Dockerfile therefore explicitly disables
upload and contains no private-key mount, `ARG` or persistent image `ENV`.

To enable source maps later, run the Next.js integration in a separate CI build
with the credential scoped to that build step, and arrange deployment of those
same built artifacts. This build/promotion flow is not configured by this patch.
Do not put the private key in `NEXT_PUBLIC_*` variables, Docker build arguments,
or a persistent image environment variable.

Actual authenticated upload requires that build credential and is a rollout
check; it is not exercised by credential-free local builds or CI tests.

References: [PostHog source maps](https://posthog.com/docs/error-tracking/stack-traces)
and [Next.js integration](https://posthog.com/tutorials/nextjs-error-monitoring).

## Still needs attribution or reproduction

- **React #310 hook order:** current minified stacks contain React/Next framework
  frames without usable application source maps. The planner component review
  found no conditional hook order violation. Do not mark these issues fixed or
  hide them. Reproduce route changes, expired authentication and concurrent server
  actions with source-mapped stacks before changing framework or component logic.
- **Other hydration and removeChild failures:** the profile date reproduction
  fixes a concrete mismatch, not every hydration report. Browser translation or
  injected DOM changes are possible explanations for removal failures, not
  established causes. Keep those reports.
- **Network failures:** distinguish initial load recovery from mutations. Failed
  fight saves and quest changes must stay visible. The single roster update 500
  in the review correlated with `ECONNRESET` in production logs; that observation
  does not justify retrying a potentially committed mutation automatically.
- **Opaque script/injected-global reports:** the generic script issue had 97
  events from two browser identities; missing `xbrowser`/`zaloJSV2` globals likely
  originate in embedded or injected browser scripts. Keep opaque errors until
  their origin is established.

After deployment, monitor new-release events, confirm that known observer noise
falls and component stacks/source maps appear, and compare the concrete crash
groups. Do not resolve issues solely because a local fix has been prepared.

## Validation of the prepared changes

- Full Vitest run: **1,122 passed**, with **25 PostgreSQL integration checks
  skipped** by their existing environment guards. No database behavior or schema
  changes are part of this patch.
- Final focused run: **40 passed**, covering canvas dimensions/cleanup, local map
  recovery, actual ProfileManager server rendering/hydration, SDK capture
  filtering, caught roster failures, and source-map build/startup configuration.
- Bot TypeScript build and production Next.js build passed.
- Independent web TypeScript check passed after the final frozen install.
- Frozen-lockfile install passed. Unrelated Google API type and Prisma peer
  resolution changes introduced during dependency installation were reverted.

The upload-enabled authenticated build and its separate artifact promotion flow
remain future setup. The local production build used the normal upload-disabled
configuration. Preparation made no PostHog status changes or production data
mutations. Deployment follows separately under the user's release instruction.
