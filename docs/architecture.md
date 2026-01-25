# Architecture & Patterns

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

## Caching Strategy (Web)
We use a server-side, in-memory caching mechanism to optimize performance:
*   **`getFromCache`:** Generic utility with TTL.
*   **Global Data:** `getCachedChampions()` caches the full champion list for 1 hour.
*   **War Planning:** Uses a hybrid approach. Static node data is cached for 1 hour; dynamic fight data is polled and hydrated client-side.

## User Identity Model
*   **`BotUser` (Global):** Represents the Discord user. Stores global permissions (`isBotAdmin`). Linked to NextAuth.
*   **`Player` (Game Profile):** Represents an MCOC account. Linked to `BotUser`. Stores roster/prestige. Users can have multiple profiles.
