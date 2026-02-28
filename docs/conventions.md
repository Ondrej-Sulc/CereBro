# Development Conventions

## Critical Mandates
*   **Discord Ephemeral:** **NEVER** use `ephemeral: true`. **ALWAYS** use `flags: MessageFlags.Ephemeral`.
*   **Type Safety:** Strict mode enabled. Avoid `any`. Verification: `pnpm exec tsc`.

## Code Style & Structure
*   **Slash Commands:** All commands are slash commands with clear subcommand structures.
*   **UI Components:** Prioritize Discord V2 components (`ContainerBuilder`, `ActionRowBuilder`).
*   **Caching:** Use `os.tmpdir()` for local file caching (e.g., champion images) to ensure write permissions across different environments (Windows dev vs. Linux Docker).
*   **Assets:** Use the top-level `assets/` directory for shared resources. Services should resolve paths using the `getAssetsPath` utility from `src/utils/assets.ts`.
*   **Services vs Utils:**
    *   `src/services`: Stateful logic, API connections.
    *   `src/utils`: Stateless helpers.
*   **Logging:**
    *   **Bot:** `src/services/loggerService.ts` (Pino).
    *   **Web:** `web/src/lib/logger.ts`.
    *   **Rule:** No `console.log` for persistent logs.

## React 19 Rules
*   **Async Params:** Always `await` `params` and `searchParams` in Server Components.
*   **Suspense:** Wrap all components using `useSearchParams()` in a `<Suspense>` boundary.
*   **State Sync:** Use **render-time structural checks** (comparing current props to a `prev` state ref) instead of `useEffect` for syncing props to state to avoid React 19 infinite render loops.

## State Synchronization
*   **Structural Equality:** When syncing state (e.g., in `SeasonDeepDive`), compare IDs/Tabs/SubTabs explicitly instead of using reference-based checks.
*   **Explicit Clearing:** If a state-driving prop becomes `null`, explicitly clear the `prev` state ref to ensure consistent behavior.

## URL Parameter Building & Navigation
*   **Query String Pollution:** Use the `buildSearchParams` utility to merge current params with overrides. Explicitly filter out `undefined` and `null` values to prevent query string pollution (e.g., `?query=undefined`).
*   **Sorting UX:** Sorting is managed via `sortBy` and `order` query params. Changing the sort order MUST reset `page` to "1" to ensure valid data presentation.
*   **Controlled Inputs:** Table search inputs must be controlled (syncing `value` with `useEffect` or `useSyncExternalStore`) to maintain UI consistency during browser history navigation (Back/Forward).

## Database (Prisma)
*   **Schema:** `prisma/schema.prisma`.
*   **Prestige:** Normalized `ChampionPrestige` model (linked to Champion, stores rank/sig/rarity).
*   **Deprecation:** `Player.isBotAdmin` is deprecated. Use `BotUser.isBotAdmin`.

## Documentation
*   **Single Source of Truth:** Command docs are defined in the `help` property of command files (e.g., `src/commands/xyz/index.ts`).
*   **Generation:** `npm run build` generates `commands.json` for the help command and web UI.
