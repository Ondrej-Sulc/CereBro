# Deployment & Infrastructure

## Hosting
*   **Platform:** [Railway](https://railway.app/)
*   **Pipeline:** Continuous deployment from `main` branch.

## Docker Strategy
We use separate, optimized `Dockerfile`s for the Bot and Web services.

### Web Service (`web.Dockerfile`)
*   **No Pruning:** `pnpm prune` is **omitted** to avoid Prisma generation/dependency bugs.
*   **Stages:** `dependencies` (installs all including devDeps) -> `production` (copies all, runs build).
*   **Permissions:** `docker-entrypoint.sh` runs as root to `chown` `.next` and `node_modules` before switching to `node` user (fixes local dev permission issues).
*   **Deployment Identity:** Next.js uses deployment metadata (`APP_VERSION`, `RAILWAY_GIT_COMMIT_SHA`, `RAILWAY_DEPLOYMENT_ID`, etc.) as the build id and response version so clients can detect stale deployments.
*   **Server Actions:** Self-hosted deploys must provide a stable `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` at build time, or provide `AUTH_SECRET`/`NEXTAUTH_SECRET` at build time so the build can derive one. This prevents Server Action id mismatches across instances.

### Bot Service (`Dockerfile`)
*   **Manual Packaging:** `pnpm deploy` is avoided because it ignored the `dist` folder.
*   **Build:** `production-builder` stage runs `pnpm run build` and manually copies `dist`, `package.json`, `assets`, and `node_modules`.

## Local Development
*   **`docker-compose.yaml`:** Mirrors production but uses `development` targets.
*   **Volumes:** Anonymous volumes for `node_modules` and `.next` prevent host contamination.
