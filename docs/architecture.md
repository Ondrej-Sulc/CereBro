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

## Admin Portal Architecture
The Admin Portal (`/admin`) is a secure, server-rendered section of the web app.
*   **Security:** Uses a dedicated `ensureAdmin()` server action that verifies the session user's `isBotAdmin` status against the database before rendering any admin layouts or executing mutations.
*   **Data Mutation:** Relies heavily on **Server Actions** for CRUD operations (e.g., `updateChampionDetails`, `saveChampionAttacks`), ensuring direct and type-safe database interaction without API routes.
*   **State Management:** Uses optimistic updates and `revalidatePath` to ensure the UI remains snappy and consistent after edits.
