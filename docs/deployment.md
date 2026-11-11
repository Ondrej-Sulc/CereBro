# Deployment & Infrastructure

## Hosting
*   **Platform:** [Railway](https://railway.app/)
*   **Pipeline:** Continuous deployment from `main` branch.
*   **Beta:** `dev` deploys to https://dev.cerebro-bot.com/. Main-to-dev synchronization is fast-forward only; beta-only commits are preserved. When histories diverge, review and merge main into dev explicitly.

## Beta catalog release prerequisites

* The web image uses Node 24, including the built-in SQLite reader required by `/assets`.
* Apply pending Prisma migrations to the beta database with `prisma migrate deploy` before deploying matching web/bot clients. The node-icon change adds nullable `NodeModifier.iconKey`; it does not assign icons to existing curated records.
* The artwork library is provisioned separately from Git and the Docker build. Mount its persistent volume at `/game-artwork` and set server-only `GAME_ARTWORK_LIBRARY_ROOT` to a verified immutable snapshot containing `catalog.sqlite`, `originals/` and `previews/`. Keep the checked-in search projection matched to the catalog hash. Verify SQLite read-only access as the runtime user, including required WAL sidecars, before switching the configured snapshot.
* Audit beta public data before testing glossary/champion pages. A refresh must preserve beta accounts, rosters, plans, configuration and duel review state. Back up the affected public tables, check source identities and incoming references, rehearse the complete transaction with rollback, then verify imported semantic hashes and protected records. Retain legacy tag memberships required by existing plans/tactics.
* Portable feature tests run explicitly in CI. Source-reproduction tests needing ignored local captures are kept separate; never use broad Python discovery patterns that can import live acquisition readers.

## Docker Strategy
We use separate, optimized `Dockerfile`s for the Bot and Web services.

### Web Service (`web.Dockerfile`)
*   **No Pruning:** `pnpm prune` is **omitted** to avoid Prisma generation/dependency bugs.
*   **Stages:** `dependencies` (installs all including devDeps) -> `production` (copies all, runs build).
*   **Production permissions:** Source/build directories are copied with `--chown=node:node`. Prisma generation runs as root in the root-owned dependency tree; Next build and runtime use `node`. Do not recursively chown all dependencies, which forces an expensive overlay filesystem copy-up.
*   **Permissions:** `docker-entrypoint.sh` runs as root to `chown` `.next` and `node_modules` before switching to `node` user (fixes local dev permission issues).
*   **Deployment Identity:** Next.js uses deployment metadata (`APP_VERSION`, `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_DEPLOYMENT_ID`, etc.) as the build id and response version so clients can detect stale deployments.
*   **PostHog source maps:** Upload is disabled in the Railway Docker build, whose builder rejects secret mounts. The optional Next.js integration requires a separate CI build with a build-only write credential; see [error tracking setup](error-tracking-fixes.md#private-source-maps).
*   **Server Actions:** Self-hosted deploys must provide a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time, or provide `AUTH_SECRET`/`NEXTAUTH_SECRET` at build time so the build can derive one. This prevents Server Action id mismatches across instances.
*   **CI build memory:** The GitHub Actions web-build step uses `NODE_OPTIONS=--max-old-space-size=4096`, matching the Railway Docker build. The default approximately 2GB Node heap can exhaust memory during Next.js TypeScript checking even after compilation succeeds.
*   **Google API imports:** Import the used clients and auth helpers from `googleapis/build/src/apis/youtube` or `googleapis/build/src/apis/sheets`. The package root pulls every API's declarations into TypeScript, which exhausted the 4GB build heap with the release catalogs. CI checks the resolved application dependency graph to prevent that fan-out; keep the full typecheck enabled.

### Bot Service (`Dockerfile`)
*   **Manual Packaging:** `pnpm deploy` is avoided because it ignored the `dist` folder.
*   **Build:** `production-builder` stage runs `pnpm run build` and manually copies `dist`, `package.json`, `assets`, and `node_modules`.

## Local Development
*   **`docker-compose.yaml`:** Mirrors production but uses `development` targets.
*   **Volumes:** Anonymous volumes for `node_modules` and `.next` prevent host contamination.
