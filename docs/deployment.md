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

### Bot Service (`Dockerfile`)
*   **Manual Packaging:** `pnpm deploy` is avoided because it ignored the `dist` folder.
*   **Build:** `production-builder` stage runs `pnpm run build` and manually copies `dist`, `package.json`, `assets`, and `node_modules`.

## Local Development
*   **`docker-compose.yaml`:** Mirrors production but uses `development` targets.
*   **Volumes:** Anonymous volumes for `node_modules` and `.next` prevent host contamination.
