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
*   [✨ Features & Domain](docs/features.md) - War Planning, Roster, Translations, Workflows.
*   [🚀 Deployment & Docker](docs/deployment.md) - Railway, Dockerfiles, Local Dev.
*   [📏 Conventions & Standards](docs/conventions.md) - **Critical Rules**, Logging, Code Style.

## 🚨 Critical Rules
1.  **Environment:** You are running on **win32 (Windows)**. All shell commands are executed via `powershell.exe`. 
    *   **NEVER** use `grep`, `&&` (in standard PS), or `mkdir -p`.
    *   **ALWAYS** use PowerShell equivalents: `;` for command separation, `Select-String` instead of `grep`, and `New-Item -ItemType Directory -Force` for directory creation.
2.  **Ephemeral Messages:** Never use `ephemeral: true`. Always use `flags: MessageFlags.Ephemeral`.
3.  **Type Safety:** No `any`. Always verify with `tsc`.
4.  **Bot Admin:** Check `BotUser.isBotAdmin`, **not** `Player.isBotAdmin`.
5.  **Caching:** Use `os.tmpdir()` for file-based caches to avoid permission issues in Docker.
6.  **Assets:** Access shared resources via the top-level `assets/` directory.
7.  **Server Actions:** **NEVER** re-export non-async functions or values from a `"use server"` file. Next.js strictly requires only async function exports for server actions.
8.  **Documentation:** Always keep this context file (`GEMINI.md`) and the `docs/` folder updated with new features, architectural changes, or important learnings.