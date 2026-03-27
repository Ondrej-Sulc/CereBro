# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CereBro** is a TypeScript monorepo managing **Marvel Contest of Champions (MCOC) Alliance operations**. It consists of:
- **Discord Bot** (`src/`) — slash commands, event handlers, job queue consumer
- **Next.js Web App** (`web/`) — alliance management UI, war planning, roster tools
- **Shared Database** (`prisma/`) — PostgreSQL via Prisma ORM

## Architecture

### Cross-Service Communication
The Web App and Discord Bot communicate via a **database-backed `BotJob` queue**:
- **Producer (Web):** Server Actions create `BotJob` records with types: `NOTIFY_WAR_VIDEO`, `DISTRIBUTE_WAR_PLAN`, `UPDATE_MEMBER_ROLES`, `LEAVE_GUILD`
- **Consumer (Bot):** `src/services/jobProcessor.ts` polls for `PENDING` jobs

For read-only Discord data, the Web App calls the Discord API directly from Server Actions using `fetch` with `Bot ${config.BOT_TOKEN}`.

### User Identity
- `BotUser` — Discord identity, global permissions (`isBotAdmin`). Linked to NextAuth.
- `Player` — MCOC game profile, linked to `BotUser`. Users can have multiple Players.
- **Note:** `Player.isBotAdmin` is deprecated. Always use `BotUser.isBotAdmin`.

### Bot Command Structure
Commands are auto-loaded from `src/commands/` with tiered access (Public, User, Admin, Feature). Complex commands use a **Controller/View pattern**:
- **Controllers** (`index.ts`, `buttonHandler.ts`): business logic, data fetching, `ContainerBuilder` assembly
- **Views** (`*Content.ts`): pure functions formatting data into strings — never create Discord components directly
- Every interaction re-renders a complete new message layout from scratch

### Web App Patterns
- **Server Components** fetch data; **Server Actions** handle mutations with `revalidatePath`
- **Caching:** `web/src/lib/cache.ts` — server-side in-memory with TTL. Champions cached 1 hour.
- **War Planning:** Konva.js canvas; static node data cached 1 hour, fight data polled client-side
- **Admin Portal** (`/admin`): All routes guarded by `ensureAdmin()` which checks `BotUser.isBotAdmin`

### Services vs Utils (Bot)
- `src/services/` — stateful logic, API connections, external integrations
- `src/utils/` — stateless helpers

## Critical Conventions

### Discord Bot
- Use Discord V2 components (`ContainerBuilder`, `ActionRowBuilder`).
- Shared assets (icons, fonts) live in `assets/`. Resolve paths via `getAssetsPath()` from `src/utils/assets.ts`.
- Logging via `src/services/loggerService.ts` (Pino). No `console.log` for persistent logs.

### TypeScript
- Strict mode is enforced. Never use `any`. Verify with `pnpm exec tsc`.

## Testing
- Framework: **Vitest**
- Tests live under `src/tests/` by default; co-locate only when file-local context clearly helps.
- Naming: `*.test.ts` or `*.integration.test.ts`
- Follow **Red-Green-Refactor**: write a failing test first, implement minimal code to pass, then refactor.
- Mock at boundaries (API calls, database) — not internal logic.
- Tests must target public APIs so they survive internal refactorings.

## Database
- Schema: `prisma/schema.prisma`
- Alliances use `onDelete: Cascade` for linked records (Wars, etc.)
- Use `prisma.$transaction` for operations that must be atomic to avoid TOCTOU race conditions.
- After changing `schema.prisma`, run `pnpm prisma:generate` and `pnpm prisma:migrate`.

## Documentation
- Command docs are defined in the `help` property of each command file.
- `pnpm build` generates `commands.json` used by both the bot help command and the web UI.
- Additional architecture and convention details are in `docs/`.
