# CereBro Context

**CereBro** is a full-stack "Operating System for MCOC Alliances" combining a Discord Bot and Next.js Web App.

## Tech Stack
*   **Core:** TypeScript, Node.js
*   **Bot:** Discord.js v14
*   **Web:** Next.js (App Router), React, Tailwind, shadcn/ui
*   **Data:** PostgreSQL, Prisma ORM, Redis
*   **Infra:** Docker, Railway

## Quick Start
*   **Verify Code:** `pnpm exec tsc`
*   **Announce Updates:** `npm run changelog` (Interactive CLI for posting to Discord).

## Documentation Index
*   [📂 Architecture & Patterns](docs/architecture.md) - Controller/View, Job Queue, Caching, Identity.
*   [✨ Features & Domain](docs/features.md) - War Planning, Roster, Admin Portal, Translations.
*   [🚀 Deployment & Docker](docs/deployment.md) - Railway, Dockerfiles, Local Dev.
*   [📏 Conventions & Standards](docs/conventions.md) - **Critical Rules**, Logging, Code Style.

## 🚨 Critical Rules
1.  **Environment:** You are running on **win32 (Windows)**. All shell commands are executed via `powershell.exe`. 
    *   **NEVER** use `grep`, `&&` (in standard PS), or `mkdir -p`.
    *   **ALWAYS** use PowerShell equivalents: `;` for command separation, `Select-String` instead of `grep`, and `New-Item -ItemType Directory -Force` for directory creation.
2.  **Ephemeral Messages:** Never use `ephemeral: true`. Always use `flags: MessageFlags.Ephemeral`.
3.  **Type Safety:** No `any`. Always verify with `tsc`.
4.  **Bot Admin:** Check `BotUser.isBotAdmin`, **not** `Player.isBotAdmin`.
5.  **React 19:**
    *   **Async Params:** `params` and `searchParams` in Server Components MUST be awaited before property access.
    *   **Suspense:** Components using `useSearchParams()` MUST be wrapped in `<Suspense>` boundaries.
    *   **State Sync:** Use **render-time structural synchronization** instead of `useEffect` for props-to-state syncing to avoid infinite render loops.
6.  **Caching:** Use `os.tmpdir()` for file-based caches to avoid permission issues in Docker.
7.  **Assets:** Access shared resources via the top-level `assets/` directory.
8.  **Server Actions:** **NEVER** re-export non-async functions or values from a `"use server"` file. Next.js strictly requires only async function exports for server actions.
9.  **Multi-Profile Logic:** `BotUser` (Discord account) maps to multiple `Player` (In-game identity) profiles; Admin directories focus on `Player` profiles for granular roster/prestige tracking.
10. **Data Protection:** The alliance with ID `GLOBAL` (Mercenaries) is critical for solo war uploads and guest players; it is exempt from all automated and manual cleanup routines.
11. **Documentation:** Always keep this context file (`GEMINI.md`) and the `docs/` folder updated with new features, architectural changes, or important learnings.