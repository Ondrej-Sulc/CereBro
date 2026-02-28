# Architecture & Patterns

## Shared Assets
To maintain consistency between the Discord Bot and Web Application, shared resources (like class icons, fonts, and game data) are stored in a top-level `assets/` directory.
*   **Icons:** `assets/icons` contains champion class and game-specific icons.
*   **Fonts:** `assets/fonts` stores branded typography (e.g., Bebas Neue).
*   **Docker:** The `Dockerfile` is configured to copy the `assets/` folder into the production build, ensuring these resources are available at runtime for both the bot and the web server.

## Interactive Champion Command (Controller/View)
For complex interactive commands like `/champion`, we utilize a strict **Controller/View** architecture:

*   **Controllers:** Handle business logic, data fetching, and component assembly (e.g., `index.ts`, `buttonHandler.ts`). They build the `ContainerBuilder`, generate thumbnails, and manage pagination.
*   **Views:** Pure functions (e.g., `getAbilitiesContent`) that format data into strings. They **never** create Discord components directly.
*   **Re-render Model:** Every interaction generates a complete new message layout from scratch.

## Web Component Architecture
Complex web pages (like Roster) follow a modular architecture:
*   **Container/Page:** Handles data fetching and state management (e.g., `roster-view.tsx`).
*   **Components:** Logic-heavy UI sections are extracted (e.g., `roster-filters.tsx`).
*   **Strict Typing:** Use specific interfaces (e.g., `NewChampionFormData`) instead of `any`.

## Cross-Service Communication (Async Job Queue)
To decouple the Web App and Discord Bot, we use a database-backed `BotJob` queue.
*   **Producer (Web):** Creates `BotJob` records (e.g., `NOTIFY_WAR_VIDEO`).
*   **Consumer (Bot):** `JobProcessor` service polls for `PENDING` jobs and executes Discord API calls.
*   **Job Types:** `NOTIFY_WAR_VIDEO`, `DISTRIBUTE_WAR_PLAN`, `UPDATE_MEMBER_ROLES`.

## Direct Discord API Access (Web)
While most Discord actions are handled via the `BotJob` queue, the Web App can directly query the Discord API for read-only operations (e.g., fetching guild channels).
*   **Pattern:** Server Actions use `fetch` to call the Discord API (v10) with `Bot ${config.BOT_TOKEN}`.
*   **Use Case:** Providing real-time Discord data to the Web UI that doesn't require complex state management by the bot.

## Caching Strategy (Web)
We use a server-side, in-memory caching mechanism to optimize performance:
*   **`getFromCache`:** Generic utility with TTL.
*   **Global Data:** `getCachedChampions()` caches the full champion list for 1 hour.
*   **War Planning:** Uses a hybrid approach. Static node data is cached for 1 hour; dynamic fight data is polled and hydrated client-side.

## User Identity Model
*   **`BotUser` (Global):** Represents the Discord user. Stores global permissions (`isBotAdmin`). Linked to NextAuth.
*   **`Player` (Game Profile):** Represents an MCOC account. Linked to `BotUser`. Stores roster/prestige. Users can have multiple profiles.

## React 19 Patterns
We strictly adhere to React 19's asynchronous parameter and state management rules:
*   **Async Params:** `params` and `searchParams` in Server Components MUST be awaited before property access.
*   **Suspense:** Any component using `useSearchParams()` MUST be wrapped in a `<Suspense>` boundary to prevent build-time prerendering errors.
*   **State Sync:** Use **render-time structural synchronization** (comparing props against a `prev` state ref) instead of `useEffect` for props-to-state updates to avoid infinite render loops and hydration mismatches.

## API Hardening & Resilience
*   **Resource Limits:** File-based APIs (e.g., `/api/admin/debug-roster`) enforce strict upload bounds (MAX_FILES=10, MAX_FILE_SIZE=10MB) and per-file validation to ensure system availability.
- **Concurrent Interaction:** Web filters use a mutable `pendingParamsRef` pattern to correctly merge rapid, concurrent search and filter updates into a single URL state push during the debounce window.

## Database Integrity & Maintenance
*   **Cascading Deletes:** Alliances use `onDelete: Cascade` in Prisma for linked records (Wars, etc.) to support safe, automated cleanup of abandoned server registrations.
*   **Atomic Cleanup:** The `checkAndCleanupAlliance` service uses `prisma.$transaction` to eliminate TOCTOU (Time-of-Check to Time-of-Use) race conditions during orphan pruning.

## Admin Portal Architecture
The Admin Portal (`/admin`) is a secure, server-rendered section of the web app.
*   **Security:** Uses a dedicated `ensureAdmin()` server action that verifies the session user's `isBotAdmin` status against the database before rendering any admin layouts or executing mutations.
*   **Data Mutation:** Relies heavily on **Server Actions** for CRUD operations (e.g., `updateChampionDetails`, `saveChampionAttacks`), ensuring direct and type-safe database interaction without API routes.
*   **State Management:** Uses optimistic updates and `revalidatePath` to ensure the UI remains snappy and consistent after edits.
