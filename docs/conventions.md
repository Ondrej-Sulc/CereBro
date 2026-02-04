# Development Conventions

## Critical Mandates
*   **Discord Ephemeral:** **NEVER** use `ephemeral: true`. **ALWAYS** use `flags: MessageFlags.Ephemeral`.
*   **Type Safety:** Strict mode enabled. Avoid `any`. Verification: `pnpm exec tsc`.

## Code Style & Structure
*   **Slash Commands:** All commands are slash commands with clear subcommand structures.
*   **UI Components:** Prioritize Discord V2 components (`ContainerBuilder`, `ActionRowBuilder`).
*   **Caching:** Use `os.tmpdir()` for local file caching (e.g., champion images) to ensure write permissions across different environments (Windows dev vs. Linux Docker).
*   **Assets:** Use the top-level `assets/` directory for shared resources. Services should resolve paths using `path.join(process.cwd(), 'assets', ...)`.
*   **Services vs Utils:**
    *   `src/services`: Stateful logic, API connections.
    *   `src/utils`: Stateless helpers.
*   **Logging:**
    *   **Bot:** `src/services/loggerService.ts` (Pino).
    *   **Web:** `web/src/lib/logger.ts`.
    *   **Rule:** No `console.log` for persistent logs.

## Database (Prisma)
*   **Schema:** `prisma/schema.prisma`.
*   **Prestige:** Normalized `ChampionPrestige` model (linked to Champion, stores rank/sig/rarity).
*   **Deprecation:** `Player.isBotAdmin` is deprecated. Use `BotUser.isBotAdmin`.

## Documentation
*   **Single Source of Truth:** Command docs are defined in the `help` property of command files (e.g., `src/commands/xyz/index.ts`).
*   **Generation:** `npm run build` generates `commands.json` for the help command and web UI.
