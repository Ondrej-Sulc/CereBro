# Gemini Code Assistant Context

This document provides context for the Gemini code assistant to understand the CereBro project.

## Project Overview

CereBro is a full-stack platform, "The Operating System for MCOC Alliances," combining a powerful Discord bot and a high-performance Next.js web application. It is designed to streamline Alliance War management, roster tracking, and knowledge sharing for the mobile game Marvel Contest of Champions (MCOC).

The platform provides a variety of features, including:

*   **Discord Bot Features:**
    *   **Champion Information:** Users can query for information about champions, including their abilities, attacks, and immunities.
    *   **Champion Administration:** A powerful admin command to add or update champions in the database.
    *   **Prestige Tracking:** Users can update and view their prestige values.
    *   **Roster Management:** Users can manage their MCOC rosters.
    *   **Scheduling:** The bot can be used to schedule reminders and other events.
    *   **AQ Management:** The bot has features to help with Alliance Quest (AQ) management.
*   **Web Application Features:**
    *   **War Planning UI:** An interactive, high-performance web interface for managing Alliance War plans.
    *   **War Defense Planner:** A specialized interface for strategizing alliance defense placements, supporting multiple battlegroups, map types (Standard/Big Thing), and player roster management.
    *   **Season Overview:** A comprehensive analytics dashboard for tracking player and alliance performance across entire war seasons.
    *   **War Archive:** A searchable database of uploaded Alliance War videos and fight logs.
    *   **Profile & Roster Management:** Users can view and update their profiles and rosters through the web UI.

*   **War Videos Database & Planning**

The bot features a sophisticated system for tracking Alliance War performance by linking war plans to video uploads.

*   **Normalized Data Model:** The system is built on a normalized, three-model schema in Prisma:
    *   `War`: Represents a top-level war event, containing metadata like season, tier, `mapType` (e.g., `STANDARD`, `BIG_THING`), and the enemy alliance.
    *   `WarFight`: The core model, representing a single fight (attacker, defender, node) and linking it to a `War`, a `Player`, and optionally, a `WarVideo`.
    *   `WarVideo`: A lean model that represents the video asset itself, containing the video URL and a link to one or more `WarFight` records.

*   **Plan-to-Upload Workflow:**
    1.  The `/aw plan` command reads war plan data from a Google Sheet.
    2.  It then `upserts` `War` and `WarFight` records into the database, creating a persistent record of the war plan.
    3.  A message is sent to each player's private thread containing their assignments and a button labeled "Upload Video(s)".
    4.  When a player clicks the button, the bot generates a temporary, single-use `UploadSession` token that corresponds to that player's list of fights for that war.
    5.  The bot replies with a private link to the web UI, containing the session token.
    6.  The web UI uses the token to fetch the fight data and pre-fills the video upload form, creating a seamless user experience.
    7.  The user can then upload a single video for all their fights or one video per fight. The backend API handles the creation of the `WarVideo` record(s) and links them to the correct `WarFight`(s). **The war planning interface now supports real-time updates through polling to facilitate collaborative planning.**
*   **Fight Result Visualization:** The video list UI visually distinguishes fight outcomes, displaying a skull icon and death count for failed attempts, replacing the previous "Solo" text indicators for a cleaner look.

### Caching Strategy (Web Application)

To optimize database queries and reduce load, especially for frequently accessed, relatively static data, the web application employs a server-side, in-memory caching mechanism:

*   **`web/src/lib/cache.ts`**: Provides a generic `getFromCache<T>(key: string, ttl: number, fetchData: () => Promise<T>)` utility for simple time-to-live (TTL) based caching.
*   **`web/src/lib/data/champions.ts`**: Implements `getCachedChampions()`, a specialized function that leverages `getFromCache` to provide a cached, comprehensive list of all champion data (including images, abilities, tags, etc.). This function is cached for 1 hour.
*   **Seasonal Analysis Optimization:** The Season Overview page uses `getFromCache` to optimize high-volume data processing:
    *   **Season List:** The distinct list of historical seasons is cached for 1 hour.
    *   **War Statistics:** Seasonal war and fight data is cached for 5 minutes, ensuring high performance while allowing for near real-time updates as wars finish.
*   **War Planning Optimization (Static vs Dynamic):** The War Planner (`/web/src/app/planning`) uses a hybrid approach to minimize database load during frequent polling:
    *   **Static Data (`/api/war-planning/nodes`):** Heavy, non-changing structural data (Nodes, Allocations, Modifiers) is fetched *once* on component mount and cached server-side for 1 hour.
    *   **Dynamic Data (`/api/war-planning/fights`):** The polling endpoint returns *only* the lightweight fight data (ids, assignments) without joining the heavy node relations.
    *   **Client-Side Hydration:** The React hook (`useWarPlanning`) merges the static node map with the dynamic fight updates in real-time, creating a seamless experience with minimal bandwidth and DB usage.
*   **Usage Pattern:**
    *   For global, static data like the complete champion list, `getCachedChampions()` is used across various server components and API routes.
    *   For semi-static data tied to user sessions or specific contexts (e.g., alliance rosters, season bans, war bans), `getFromCache` is directly used with appropriate keys and shorter TTLs.
    *   **Polling Endpoint Optimization:** For frequently polled endpoints (e.g., `/api/war-planning/fights`), instead of performing expensive database `JOIN` operations, lightweight IDs are fetched, and full entity details are "hydrated" in memory from the `getCachedChampions()` cache. This significantly reduces database load and response times.

### Cross-Service Communication (Async Job Queue)

To reliably handle communication between the Web App and the Discord Bot (e.g., for notifications or future complex tasks like plan distribution) without direct HTTP coupling, the system implements a **Database-backed Job Queue**.

*   **Architecture:**
    *   **Model:** `BotJob` (id, type, status, payload, error).
    *   **Producer (Web):** The Next.js app creates a `BotJob` record (e.g., type `NOTIFY_WAR_VIDEO`) instead of trying to contact the bot directly.
    *   **Consumer (Bot):** The Discord Bot runs a `JobProcessor` service that polls the database for `PENDING` jobs. It processes them (executing Discord API calls via `discord.js`) and updates the status to `COMPLETED` or `FAILED`.
*   **Benefits:** This decouples the services, ensuring that if the bot is restarting, notifications are not lost but simply queued. It also avoids timeout issues for long-running tasks.
*   **Submission Helpers:** A shared library `web/src/lib/api/submission-helpers.ts` centralizes the logic for validating tokens, handling War/Fight creation (including Offseason logic), and queuing these notifications.

### War Video Notifications & Uploads

*   **Smart Notifications:** When a video is uploaded or linked, the system checks if the uploader's alliance has a configured `warVideosChannelId`. If so, it queues a `NOTIFY_WAR_VIDEO` job. The bot then posts a rich Embed to that channel with video details and a "Watch Video" button.
*   **Authorized Uploads:** Direct file uploads are restricted to alliances with the `canUploadFiles` flag enabled (to manage server costs). Other users can still link YouTube videos.
*   **Archive Integration:** The War Archive now includes an "Upload Video" button (`+`) for fights without videos, allowing users to easily backfill content for existing records.

### War Plan Distribution

The system now supports distributing detailed Alliance War plans directly from the Web UI or via the `/aw plan` command. This is achieved through the asynchronous `BotJob` queue with a `DISTRIBUTE_WAR_PLAN` job type.

*   **Workflow:**
    1.  Officers create/edit war plans in the Web UI.
    2.  They can click "Distribute Plan" (for all BGs or specific ones) in the Web UI, or use the `/aw plan` Discord command.
    3.  A `DISTRIBUTE_WAR_PLAN` job is created, containing `warId`, `allianceId`, and optional `battlegroup`.
    4.  The Bot's `JobProcessor` picks up the job, fetches all relevant fight data for the specified war from the database.
    5.  It then constructs highly personalized Discord messages for each player, sent to their private threads.
*   **Message Content:** Messages utilize Discord V2 components (`ContainerBuilder`) and include:
    *   **Rich Header:** Displays detailed war context including Season, War Number, Tier, Opponent, and Map Type with appropriate emojis.
    *   **Visual Map:** A dynamically generated high-quality PNG map (using `sharp`) attached to the message.
        *   **Pill Style:** Main fights are rendered as wide "Pills" displaying both the Attacker and Defender portraits.
        *   **Prefight Visualization:** Nodes where the player places a prefight are highlighted with a **Purple** border and display the Prefight Champion vs the Defender.
        *   **Standard Targets:** Regular attack targets are highlighted with a **Blue** border.
        *   **Tactic Integration:** Champions matching the active war tactic display a visual **Sword** (Attacker) or **Shield** (Defender) badge, utilizing the same visual logic as the web planner.
        *   **Color Synchronization:** Player colors on the map (used for borders and identifiers) are now globally synchronized with the Web UI palette, ensuring a consistent visual language across platforms.
    *   **Battlegroup Overview:** In addition to private messages, the bot generates a "Battlegroup Overview Map" sent to the specific BG channel. This map includes a full legend and visualizes the entire lane strategy at a glance.
    *   **Assignments List:** Textual list of assigned fights (Attacker vs Defender on Node X).
    *   **Your Team:** A consolidated section listing all champions involved in attacks and prefights.
    *   **Pre-Fights to Place:** Clearly outlines prefight duties with dynamic wording.
    *   **Notes:** Specific notes for fights.
    *   **Upload Button:** An "Upload Video(s)" button to streamline the plan-to-upload workflow.
*   **Dynamic Channel Configuration:** The `/alliance config-channels` command has been extended to allow server administrators to configure specific Discord channels for each battlegroup, ensuring plans are sent to the correct locations.
*   **Consistent Emojis:** The system now uses a robust emoji resolution mechanism (`createEmojiResolver`) to ensure champion emojis display correctly across different Discord environments (e.g., development vs. production bots).

### War Planning UI (Web)

The project now includes a dedicated "War Planning" feature within the web interface (`/web/src/app/planning`), replacing the reliance on Google Sheets.

*   **High-Performance Canvas Map (Konva):** The interactive Alliance War map has been completely rewritten using `react-konva` (HTML5 Canvas) to solve performance bottlenecks inherent in the previous DOM/SVG approach. This ensures a buttery-smooth 60fps experience even on low-end devices. **It now includes native mobile pinch-to-zoom and two-finger panning.**
    *   **Layered Architecture:**
        *   **Background Layer:** Static visual elements (Nebulas, Paths, Stars) are rendered once to an offscreen canvas and cached. A "Picture Frame" linear gradient vignette is applied to fade edges seamlessly into the UI background. **The background also dynamically adjusts based on the selected `WarMapType`.**
        *   **Node Layer:** Interactive nodes are rendered on a separate layer. Heavy effects like `shadowBlur` are avoided in favor of performant alternatives (e.g., offset circles for hard shadows).
    *   **Zoom & Pan:** Native Canvas transformation logic replaces the DOM-based `react-zoom-pan-pinch` library, providing instant feedback without layout thrashing.
    *   **Dynamic Layout:** The map structure remains configuration-driven (`nodes-data.ts`), preserving flexibility. **It now supports different layouts, including the `BIG_THING` (10-node, 5-island) layout alongside the standard map.**
*   **Deployment Stability (Version Checker):** To prevent errors when users are active during a new deployment (e.g., "Failed to find Server Action"), the web app includes a proactive `VersionChecker`.
    *   **Mechanism:** The build process generates a unique ID (Git Commit Hash or Timestamp) injected via `next.config.ts`.
    *   **Client Polling:** A client-side component polls a lightweight `/api/version` endpoint. If the server version differs from the client's initial version, a persistent Toast notification prompts the user to refresh the page.
*   **Optimized Planning Workflow:**
    *   **Node Editing:** Clicking a node opens an optimized "Inspector Panel".
        *   **Virtualization:** The Champion and Player selection dropdowns (`ChampionCombobox`, `PlayerCombobox`) use `react-virtuoso` to virtualize their lists, rendering only visible items. This eliminates the massive render storms caused by mounting hundreds of DOM nodes for large rosters.
        *   **Smart Roster Integration (Defense):** The Defense Editor actively cross-references the selected Player's roster with the chosen Defender. If matches are found, it presents precise "Smart Select" buttons (e.g., "7★ R3 (Ascended)") to ensure accurate placement tracking, replacing generic dropdowns. The Player selection list also displays the rank/star level of the currently selected champion for each player.
        *   **State Efficiency:** The editor uses deep equality checks to synchronize state with props, preventing unnecessary re-render cycles.
    *   **Visual Polish:** Nodes feature class-colored background glows (using tinted fills behind transparent PNGs), crisp SVG-based tactic badges (Sword/Shield) matching the application's design system, and a cleaner, connector-free aesthetic. **Players assigned to nodes are now uniquely color-coded on the map (via node borders) and in the player roster, replacing the old initials badge. The color palette is optimized for distinguishability between the maximum 10 players.**
    *   **Tier-Based Modifiers:** Defense Plans now support an optional **Tier** setting. Selecting a tier filters the active **Node Modifiers** displayed in the editor, ensuring planners only see rules relevant to their specific war tier.
    *   **UX Refinements:** The planning interface features a refactored header separating metadata (Tier/Tactic filters) from navigation (Battlegroups) and actions (Tools/View Mode). The global page footer is conditionally removed on planning routes to maximize vertical screen real estate.
*   **Search Tools:** Integrated tools to assist planning:
    *   **Player Roster:** View a specific player's top champions to find suitable attackers/defenders. **This section now expands to show detailed champion names, star levels, and ranks. Additionally, champions can be added as "Extra Assignments" from this view directly to a player's war roster, and are automatically converted to a normal assignment once placed on the map.**
    *   **Find Champion:** Search for a specific champion to see which alliance members own it (and at what rank/ascension).
*   **Historical Matchups:** The Node Editor now displays historical matchup data, including solos, deaths, and prefight champions used in sample fights. Links to sample videos now point to the internal `/war-videos/[videoId]` page for seamless playback.

### War Tactics & Node Modifiers

The system now includes robust support for managing the dynamic rules of Alliance War seasons.

*   **Data Models:**
    *   `WarTactic`: Defines season-wide tactics linked to specific tiers (min/max) and seasons. It relates to the `Tag` model for both `attackTag` and `defenseTag`.
    *   `NodeModifier`: Represents specific buffs or rules (e.g., "Masochism").
    *   `WarNodeAllocation`: Links a `WarNode` to a `NodeModifier` with constraints on tier and season, allowing for precise mapping of node rules.
*   **Admin Management:**
    *   **Tactics:** A dedicated admin page (`/admin/tactics`) allows Bot Admins to create and manage tactics. It features a "Tag Selector" that searches existing tags or creates new ones on the fly.
    *   **Nodes:** The `/admin/nodes` page allows for the granular assignment of modifiers to specific nodes. **This page now supports selecting the `WarMapType` (Standard or Big Thing) to manage node allocations specific to each map configuration.**
*   **Visual Integration:**
    *   **War Map:** Champions on the map now feature:
        *   **Class Rings:** Outer glowing rings colored by champion class (e.g., Mystic=Purple, Science=Green).
        *   **Tactic Icons:** Champions matching the active tactic display a green Sword (Attacker) or red Shield (Defender) icon.
    *   **Node Editor:** Automatically highlights active tactics with badges and lists all active node modifiers in a popover for easy reference.

### Season Overview & Performance Analysis

The platform now features a dedicated analytics dashboard at `/analysis/season-overview` for deep-diving into Alliance War performance metrics over time.

*   **War Room Navigation:** To address UI crowding, all war-related tools (Season Overview, Defense Strategy, and Attack Planning) are consolidated into a unified **"War Room" dropdown menu** in the main site header.
*   **Player Performance Tracking:**
    *   **Battlegroup Ranking:** Players are organized by battlegroup and ranked primarily by **least deaths**, with total fights used as a tie-breaker.
    *   **Solo % Calculation:** A success rate metric is displayed for every player, providing critical context for performance on "Big Thing" maps where fight counts are restricted.
    *   **Group Totals:** Each battlegroup card displays aggregate statistics (Total Solo % and Total Deaths) for easy inter-BG comparison.
*   **Season Insights:** A specialized analytics section at the bottom of the dashboard highlights:
    *   **Deadliest Defenders:** Top 5 champions causing the most deaths, with "deaths per fight" metrics.
    *   **Top Attackers:** Most frequently used attackers and their success rates.
    *   **Hardest Nodes:** Node numbers with the highest lethality across the alliance.
*   **Visual Polish:** Insights utilize **champion class-colored names and avatar rings**, maintaining visual consistency with the rest of the application.
*   **Robustness:** The dashboard includes strict URL parameter validation, whitelist-based season selection, and a professional empty-state UI for alliances with no recorded data.

### Alliance Structure & Role Management

The bot includes a robust system for managing alliance structure, including officer roles and battlegroup assignments, directly linked to Discord roles.

*   **Database Model:**
    *   The `Player` model contains an `isOfficer` boolean flag and a nullable `battlegroup` integer field.
    *   The `Alliance` model contains nullable string fields for `officerRole`, `battlegroup1Role`, `battlegroup2Role`, and `battlegroup3Role` to store the corresponding Discord Role IDs.
*   **Automatic Guild Initialization:** When the bot joins a new server (`guildCreate` event), it automatically initializes an `Alliance` record and sends a welcome message with a "Start Setup" button.
*   **Interactive Setup Wizard:** The new `/setup` command provides an interactive, step-by-step process for server administrators to configure essential alliance roles (Officer, Battlegroups).
*   **Configuration:** The `/alliance config-roles` command allows server administrators to map their Discord roles to the bot's internal officer and battlegroup designations.
*   **Synchronization & Auto-Registration:**
    *   The `/alliance sync-roles` command allows officers to manually trigger a sync between Discord roles and the bot's database.
    *   An automatic, hourly background job also performs this sync, ensuring the bot's data remains up-to-date with changes in Discord roles.
    *   During synchronization, members with configured alliance roles are automatically registered with the bot. If a `Player` profile does not exist for them, one is created using their Discord display name, and they are linked to the alliance with the appropriate officer/battlegroup status.
*   **Management & Permissions:**
    *   A new `/alliance manage` command group provides officer-only tools to `remove` and `list` members from the alliance roster.
    *   Commands requiring elevated permissions are restricted to users with either Discord Administrator permissions or the `isOfficer` flag set to `true` in the database.
*   **Overview:** The `/alliance view` command provides a public, read-only overview of the entire alliance, showing members organized by battlegroup and highlighting officers.

### Interactive Champion Command

The `/champion` command has been refactored into a fully interactive experience using V2 components. It follows a "re-render everything" model, where every interaction (initial command or button click) generates a complete, new message layout from scratch.

*   **Controller/View Architecture:** The command's logic is split between "controllers" and "views":
    *   **Controllers:** The main `index.ts` file (for the initial command execution) and the button handlers (`buttonHandler.ts` for view-switching, `pageHandler.ts` for pagination) act as controllers. They are responsible for fetching data, building the `ContainerBuilder`, generating the thumbnail, and assembling all components (content, buttons, separators) into a final message.
    *   **Views:** Simple functions like `getAbilitiesContent` or `getInfoContent` act as views. Their only job is to format data into a display-ready string. They do not create any Discord components themselves.
*   **Dynamic Thumbnail Generation:** The thumbnail banner is now regenerated on every interaction to reflect the currently active view (e.g., showing "Abilities" or "Attacks" in the title).
*   **Pagination:** The `info` view, which can contain a large amount of text, is now fully paginated. The `getInfoContent` function splits the content into pages, and the controllers add "Previous" and "Next" buttons to navigate between them.

### Community-Sourced Duel Target Management

The `/champion duel` command has been enhanced to allow for community contributions and a robust administrative review process, ensuring the duel target list remains accurate and up-to-date.

*   **User-Facing Features:**
    *   **Suggest a Target:** From the `/champion duel` view, users can click a "Suggest New Target" button, which opens a modal for them to submit the in-game name of a new duel target for that champion.
    *   **Report Outdated Target:** Users can also click "Report Outdated Target" to select from a list of current duel targets and flag one as outdated.
*   **Admin Review Workflow:**
    *   All user suggestions and reports are submitted to a queue with a `SUGGESTED` or `OUTDATED` status.
    *   Bot administrators are notified of new submissions in a designated admin channel.
    *   The `/admin duel review` command provides an interactive interface for admins to approve, reject, or archive submissions one by one.
    *   Rejected or deleted duel targets are not deleted from the database but are moved to an `ARCHIVED` status to prevent them from being re-added by automated CSV imports.
*   **Database Model:**
    *   The `Duel` model in `prisma/schema.prisma` has been updated to support this workflow.
    *   A `DuelStatus` enum (`ACTIVE`, `SUGGESTED`, `OUTDATED`, `ARCHIVED`) tracks the state of each duel target.
    *   `source` and `submittedByDiscordId` fields have been added to track where a suggestion came from and who submitted it.

The bot is built with a modern tech stack, including:

*   **Language:** TypeScript
*   **Framework:** Discord.js v14, Next.js (App Router)
*   **Database:** PostgreSQL with Prisma ORM
*   **Frontend:** React, Tailwind CSS, shadcn/ui
*   **APIs:** Google Sheets, OpenRouter, Google Cloud Storage, PostHog
*   **Authentication:** NextAuth.js (Discord OAuth2) for the web interface
*   **Containerization:** Docker and Docker Compose
*   **Caching:** Redis

The project is well-structured, with a clear separation of concerns. Commands are organized into their own directories, each containing sub-files for subcommands, handlers, and other related logic. This modular approach is demonstrated in the `roster`, `search`, and `aq` commands. The bot also includes a robust error handling system and a dynamic command loading mechanism.

## Hosting

The entire CereBro platform, including the production environment for both the bot, its PostgreSQL database, and the web application, is hosted on [Railway](https://railway.app/). A continuous deployment pipeline is configured to automatically deploy updates from the `main` branch. This provides a seamless deployment and scaling solution.

## Guiding Principles

*   **Code Quality:** The highest priority is to maintain a clean, readable, and well-organized codebase.
*   **Modularity:** Commands and features should be modular and self-contained to the extent possible. As demonstrated with the `roster`, `search`, and `aq` commands, the preferred structure is to have a directory for each command, with sub-files for subcommands, handlers, and other related logic.
*   **Type Safety:** The project uses TypeScript in strict mode. Avoid using `any` and ensure all new code is type-safe.
*   **Refactoring:** Proactively refactor code to improve its structure and maintainability.
*   **Discord UI Components:** Prioritize the use of Discord UI Components V2 (e.g., `ContainerBuilder`, `TextDisplayBuilder`, `ActionRowBuilder`) over traditional embeds for rich, interactive, and consistent user interfaces. Always ensure the `MessageFlags.IsComponentsV2` flag is set when using these components.
*   **Controller/View Architecture for Interactive Commands:** For complex interactive commands like `/champion`, a controller/view pattern is preferred.
    *   **Controllers** (`index.ts` for the initial command, and button handlers for subsequent interactions) are responsible for fetching data and building the complete message response, including all UI components (Containers, Action Rows, etc.).
    *   **Views** (e.g., `getAbilitiesContent`) are simple, pure functions responsible only for formatting data into a string. They should not create Discord components.
    *   This pattern centralizes response-building logic and makes the individual view formatters easier to test and maintain.

## Web Interface

The project includes a modern, visually appealing web interface built with Next.js and hosted at `/web`. This interface serves as a landing page for the bot, showcasing its features, commands, and providing an FAQ section. It is styled with Tailwind CSS and uses shadcn/ui for its component library.

### War Archive & Authentication

The web interface features a "War Archive" that allows users to browse and search for uploaded Alliance War videos and fight logs.
*   **Authentication:** It uses `next-auth` with Discord OAuth2 provider. Users can log in with their Discord account.
*   **Access Control:** The system checks the user's Discord ID against the `Player` database to resolve their `allianceId`. Users can see public videos and videos restricted to their specific alliance. Visibility is now tied to the `War` entity's `allianceId`, ensuring historic alliance context is preserved for fight logs and alliance-private videos.
*   **Enhanced Search Filters & Deep Linking:** The web search interface includes advanced filters for `Attacker`, `Defender`, `Player`, `Node`, `Season` (multi-select), and `Has Video`. All filters are bi-directionally synchronized with the URL query parameters, allowing users to share deep links to specific search views.
*   **Uploads:** Authenticated users can generate upload tokens and submit new war videos directly from the web interface.

### Profile & Roster Management
The web interface now includes a comprehensive Profile section.
*   **View Profile:** Authenticated users can view their profile details, including registered name, alliance, prestige, and a summary of their champion roster (grouped by star rating, rank, and class).
*   **Update Roster:** Users can update their roster by uploading screenshots. The system reuses the bot's powerful OCR processing logic (`src/commands/roster/ocr/process.ts`) to detect champions, stats, and awakened status, and syncs the data to the database and linked Google Sheets.

## Building and Running

The project is fully containerized with Docker, so the easiest way to get started is with Docker Compose.

### Prerequisites

*   Node.js v18+
*   Docker and Docker Compose
*   A Discord Bot application
*   API keys for Google, OpenRouter, and PostHog
*   Discord OAuth2 Client ID and Secret (for web auth)

### 1. Set Up Environment Variables

Create a `.env` file by copying the example:

```bash
cp .env.example .env
```

Fill in the values in the `.env` file. This includes your Discord bot token, API keys, the connection details for your PostgreSQL database, the `GCS_BUCKET_NAME` for champion image uploads, the `POSTHOG_API_KEY` and `POSTHOG_HOST` for product analytics, and the Discord OAuth2 credentials (`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `AUTH_SECRET`).

### 2. Run the Bot

Use Docker Compose to build the images and start the containers (bot and database). The `docker-compose.yaml` is configured for development with hot-reloading.

```bash
docker-compose up --build
```

The bot should now be running and connected to Discord and the database.

### Other Useful Commands

*   **Build the project:** `npm run build`
*   **Generate Prisma client:** `npm run prisma:generate`
*   **Run database migrations:** `npm run prisma:migrate`
*   **Seed the database:** `npm run prisma:seed`

## Development Conventions

*   **Slash Commands:** All commands are implemented as slash commands.
*   **Subcommands:** Subcommands and subcommand groups are used to create a clear and intuitive command structure.
*   **Modern Components:** Modern Discord UI components (Buttons, Select Menus, Modals) are used to improve user experience.
*   **Error Handling:** A centralized error handling system is used to provide users with a unique error ID while logging detailed context for debugging.
*   **Database:** Prisma is used to manage the PostgreSQL database. The schema is defined in `prisma/schema.prisma`.
*   **Code Style:** The project follows standard TypeScript and Prettier conventions.
*   **Logging:** For consistency and performance, all logging should be done using the `pino` logger, which is available through the `loggerService`. This provides structured, leveled logging. Avoid using `console.log` for any persistent or important logging.
*   **Documentation Maintenance:** Command documentation is managed via a "Single Source of Truth" system. All descriptions, groups, and other metadata are defined in a `help` property within each command's main source file (e.g., `src/commands/somecommand/index.ts`). The `npm run build` command executes a script that automatically generates a master `commands.json` file from this data. This file is then used by both the in-bot `/help` command and the `/web` interface, ensuring all documentation is consistent and automatically updated with code changes. To update documentation, edit the `help` block in the relevant command file.
*   **Services vs. Utils:**
    *   `src/services`: For modules that connect to external APIs or manage stateful business logic.
*   **`src/utils`: For generic, stateless helper functions and internal application logic handlers.

## Important Note on Discord.js Ephemeral Replies

**NEVER** use `ephemeral: true` in Discord.js interaction replies or deferrals. This option is deprecated and can lead to `InteractionAlreadyReplied` errors and other unexpected behavior. Always use `flags: MessageFlags.Ephemeral` instead to ensure correct and consistent ephemeral messaging.

## Docker, PNPM Monorepo, and Deployment Strategy

This project uses a sophisticated Docker setup to manage the `pnpm` monorepo for both local development and production deployments on Railway. The following is a summary of the key configurations and learnings.

### Production Deployment on Railway

The `bot` and `web` services use separate, multi-stage `Dockerfile`s optimized for production.

**Web Service (`web.Dockerfile`):**
The web app deployment uses a simplified and robust multi-stage build process. The previous strategy involving `pnpm deploy` and `pnpm prune` proved to be unreliable and caused numerous build and runtime errors related to Prisma client generation and dependency management.

The new, more standard approach is as follows:
- **`dependencies` stage:** All dependencies (including `devDependencies`) are installed in a cached layer.
- **`production` stage:** This final stage copies the source code and the full `node_modules` directory from the `dependencies` stage, then runs `prisma generate` and `pnpm --filter web run build`. A `chown` command is used to grant the `node` user proper permissions to the `node_modules` directory, which is required for the `prisma generate` step.
- **No Pruning:** The `pnpm prune` step is intentionally omitted. While this results in a larger final image (as `devDependencies` are included), it guarantees a stable and working build by avoiding the bugs and complexities encountered with pruning in this monorepo setup.
- **Next.js 16 Type Error:** The `next.config.ts` file has `typescript: { ignoreBuildErrors: true }` enabled. This is a necessary workaround for a persistent build-time type error related to the new Next.js 16 release, which allows the deployment to succeed.

**Bot Service (`Dockerfile`):**
The bot's production build uses a manual packaging strategy, as `pnpm deploy` was found to ignore the compiled `dist` directory (due to `.gitignore` rules).
- **Manual `cp`:** The `production-builder` stage runs `pnpm run build` and then manually copies the required artifacts (`./dist`, `src/package.json`, `./assets`, `./node_modules`) into a clean `deploy` directory, which is then used for the final image.

### Local Development (`docker-compose.yaml`)

The local development environment is designed for a smooth, hot-reloading workflow while accurately mirroring the containerized setup.
- **`development` Target:** The `docker-compose.yaml` file builds and runs the `development` target of each service's Dockerfile.
- **Anonymous Volumes:** To prevent host-mounted source code from overwriting necessary files generated within the container, several anonymous volumes are used:
    - `/usr/src/app/node_modules` (for both services)
    - `/usr/src/app/src/node_modules` (for the bot)
    - `/usr/src/app/web/node_modules` (for the web app)
    - `/usr/src/app/web/.next` (for the web app's build cache)
- **Entrypoint for Permissions:** The `web` service uses a `docker-entrypoint.sh` script. This script runs as `root` on container startup to `chown` the volume-mounted directories (`.next`, `node_modules`) to the `node` user before stepping down and executing the main application. This solves runtime permission errors caused by mismatched host/container user IDs.
